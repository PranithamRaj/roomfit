const express = require('express');
const db = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { publish } = require('../events');
const activity = require('../activity');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'closed'];
const CONTACT_METHODS = ['call', 'whatsapp', 'email'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;
const clip = (v, n) => String(v || '').trim().slice(0, n);

// Enquiry events reach only the shop's owner and the shopper who sent it (never other shops).
async function enquiryChanged(type, enquiry) {
  const shop = await db.shops.byId(enquiry.shopId);
  const audience = [shop?.ownerId, enquiry.buyerId].filter(Boolean);
  publish(type, { enquiryId: enquiry.id, shopId: enquiry.shopId, status: enquiry.status }, audience);
}

// Buyers enquire about a product instead of buying it. Guests may enquire too;
// signed-in shoppers can later see their enquiries.
router.post('/', optionalAuth, async (req, res) => {
  const body = req.body || {};
  const product = await db.products.byId(body.productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const shop = await db.shops.byId(product.shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (shop.suspended) return res.status(403).json({ error: "This shop isn't taking enquiries right now" });

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
  if (req.user && req.user.role !== 'buyer') return res.status(403).json({ error: 'Only shoppers can send enquiries' });

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
  await enquiryChanged('enquiry.created', enquiry);
  await activity.record('enquiry.created', req.user || { name: contact.name, role: 'guest' },
    `${contact.name} enquired about ${product.name} at ${shop.name}`,
    { enquiryId: enquiry.id, productId: product.id, shopId: shop.id });
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
  const allowed = enquiry && (req.user.role === 'admin' || enquiry.buyerId === req.user.id || (await isShopOwner(req.user, enquiry)));
  if (!allowed) return res.status(404).json({ error: 'Enquiry not found' });
  res.json({ enquiry });
});

// Sellers track follow-up: new → contacted → closed (and may reopen). Admins can step in too.
router.patch('/:id/status', requireAuth, async (req, res) => {
  const enquiry = await db.enquiries.byId(req.params.id);
  const isAdmin = req.user.role === 'admin';
  if (!enquiry || !(isAdmin || (await isShopOwner(req.user, enquiry)))) return res.status(404).json({ error: 'Enquiry not found' });
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  if (status === enquiry.status) return res.json({ enquiry });

  const updated = await db.enquiries.update(enquiry.id, {
    status,
    history: [...enquiry.history, { status, at: new Date().toISOString(), by: isAdmin ? 'admin' : 'shop' }],
  });
  await enquiryChanged('enquiry.updated', updated);
  const who = isAdmin ? `${req.user.name} (admin)` : enquiry.shopName;
  await activity.record('enquiry.status', req.user,
    `${who} marked ${enquiry.name}'s enquiry about ${enquiry.productName} as ${status}`,
    { enquiryId: enquiry.id, productId: enquiry.productId, shopId: enquiry.shopId });
  res.json({ enquiry: updated });
});

module.exports = router;
module.exports.enquiryChanged = enquiryChanged;
