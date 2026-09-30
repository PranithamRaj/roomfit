const express = require('express');
const db = require('../db');
const { optionalAuth, requireRole } = require('../middleware/auth');
const { withShops } = require('./products');
const { publish } = require('../events');
const activity = require('../activity');

const router = express.Router();

const SHOP_FIELDS = ['name', 'description', 'logo', 'coverImage', 'city', 'address', 'phone'];
const pick = (body) => Object.fromEntries(SHOP_FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

async function shopSummary(shop) {
  const products = await db.products.findMany({ shopId: shop.id });
  return { ...shop, productCount: products.length };
}

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const shops = (await db.shops.findMany())
    .filter((s) => !s.suspended) // hidden from shoppers by an admin
    .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q));
  res.json({ shops: await Promise.all(shops.map(shopSummary)) });
});

// Seller's own shop (declared before /:id so "mine" isn't treated as an id)
router.get('/mine', requireRole('seller'), async (req, res) => {
  const shop = await db.shops.findOne({ ownerId: req.user.id });
  if (!shop) return res.status(404).json({ error: 'You have not created a shop yet' });
  res.json({ shop: await shopSummary(shop), products: await db.products.findMany({ shopId: shop.id }) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const shop = await db.shops.byId(req.params.id);
  if (!shop || (shop.suspended && req.user?.role !== 'admin')) return res.status(404).json({ error: 'Shop not found' });
  const products = await withShops(await db.products.findMany({ shopId: shop.id }));
  res.json({ shop: await shopSummary(shop), products });
});

router.post('/', requireRole('seller'), async (req, res) => {
  if (await db.shops.findOne({ ownerId: req.user.id })) {
    return res.status(409).json({ error: 'You already own a shop — update it instead' });
  }
  const data = pick(req.body || {});
  if (!data.name?.trim()) return res.status(400).json({ error: 'Shop name is required' });
  const shop = await db.shops.insert({ ...data, name: data.name.trim(), ownerId: req.user.id });
  publish('shop.updated', { shopId: shop.id });
  await activity.record('shop.created', req.user, `${req.user.name} opened ${shop.name}`, { shopId: shop.id });
  res.status(201).json({ shop: await shopSummary(shop) });
});

router.put('/:id', requireRole('seller'), async (req, res) => {
  const shop = await db.shops.byId(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (shop.ownerId !== req.user.id) return res.status(403).json({ error: 'You do not own this shop' });
  const data = pick(req.body || {});
  if (data.name !== undefined && !String(data.name).trim()) {
    return res.status(400).json({ error: 'Shop name cannot be empty' });
  }
  const updated = await db.shops.update(shop.id, data);
  publish('shop.updated', { shopId: shop.id });
  await activity.record('shop.updated', req.user, `${updated.name} updated its shop profile`, { shopId: shop.id });
  res.json({ shop: await shopSummary(updated) });
});

module.exports = router;
