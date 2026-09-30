const express = require('express');
const db = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'closed'];
const CONTACT_METHODS = ['call', 'whatsapp', 'email'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;
const clip = (v, n) => String(v || '').trim().slice(0, n);

// Buyers enquire about a product instead of buying it. Guests may enquire too;
// signed-in shoppers can later see their enquiries.
router.post('/', optionalAuth, async (req, res) => {
  const body = req.body || {};
  const product = await db.products.byId(body.productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const shop = await db.shops.byId(product.shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  const contact = {
    name: clip(body.name, 80),
    phone: clip(body.phone, 20),
    email: clip(body.email, 120).toLowerCase(),
  };
  const preferredContact = CONTACT_METHODS.includes(body.preferredContact) ? body.preferredContact : 'call';
  const message = clip(body.message, 1000);

  if (!contact.name) return res.status(400).json({ error: 'Please enter your name' });
  if (!PHONE_RE.test(contact.phone)) return res.status(400).json({ error: 'Please enter a valid phone number' });
  if (contact.email && !EMAIL_RE.test(contact.email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (preferredContact === 'email' && !contact.email) {
    return res.status(400).json({ error: 'Add your email to be contacted by email' });
  }
  if (req.user?.role === 'seller') return res.status(403).json({ error: 'Seller accounts cannot send enquiries' });

  const enquiry = await db.enquiries.insert({
    productId: product.id,
    productName: product.name,
    productImage: product.images?.[0] || null,
    shopId: shop.id,
    shopName: shop.name,
    buyerId: req.user?.id || null,
    ...contact,
    preferredContact,
    message: message || `I'm interested in the ${product.name}. Please share the price and availability.`,
    status: 'new',
    history: [{ status: 'new', at: new Date().toISOString() }],
  });
  res.status(201).json({ enquiry });
});

// Sellers see enquiries for their shop; shoppers see the ones they sent.
router.get('/', requireAuth, async (req, res) => {
  let enquiries;
  if (req.user.role === 'seller') {
    const shop = await db.shops.findOne({ ownerId: req.user.id });
    enquiries = shop ? await db.enquiries.findMany({ shopId: shop.id }) : [];
  } else {
    enquiries = await db.enquiries.findMany({ buyerId: req.user.id });
  }
  enquiries = [...enquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ enquiries });
});

async function isShopOwner(user, enquiry) {
  const shop = await db.shops.byId(enquiry.shopId);
  return shop?.ownerId === user.id;
}

router.get('/:id', requireAuth, async (req, res) => {
  const enquiry = await db.enquiries.byId(req.params.id);
  const allowed = enquiry && (enquiry.buyerId === req.user.id || (await isShopOwner(req.user, enquiry)));
  if (!allowed) return res.status(404).json({ error: 'Enquiry not found' });
  res.json({ enquiry });
});

// Sellers track follow-up: new → contacted → closed (and may reopen).
router.patch('/:id/status', requireAuth, async (req, res) => {
  const enquiry = await db.enquiries.byId(req.params.id);
  if (!enquiry || !(await isShopOwner(req.user, enquiry))) return res.status(404).json({ error: 'Enquiry not found' });
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  if (status === enquiry.status) return res.json({ enquiry });

  const updated = await db.enquiries.update(enquiry.id, {
    status,
    history: [...enquiry.history, { status, at: new Date().toISOString() }],
  });
  res.json({ enquiry: updated });
});

module.exports = router;
