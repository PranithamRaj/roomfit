const express = require('express');
const db = require('../db');
const { publicUser, requireRole } = require('../middleware/auth');
const { publish } = require('../events');
const activity = require('../activity');
const { withShops, withShop, isFileUrl, productChanged } = require('./products');
const { enquiryChanged } = require('./enquiries');

// Admin portal: oversight of every seller's and shopper's activity, moderation (suspending
// accounts and shops, removing spam enquiries) and the 3D/AR model studio.
const router = express.Router();
router.use(requireRole('admin'));

const DAY = 24 * 60 * 60 * 1000;
const age = (iso) => Date.now() - Date.parse(iso);
const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// How long a shop took to first act on an enquiry (the first status change after "new").
function responseMs(enquiry) {
  const first = enquiry.history.find((h) => h.status !== 'new');
  return first ? Date.parse(first.at) - Date.parse(enquiry.createdAt) : null;
}

function shopStats(shop, products, enquiries) {
  const prods = products.filter((p) => p.shopId === shop.id);
  const mine = enquiries.filter((e) => e.shopId === shop.id);
  return {
    products: prods.length,
    arReady: prods.filter((p) => p.modelUrl).length,
    enquiries: mine.length,
    new: mine.filter((e) => e.status === 'new').length,
    open: mine.filter((e) => e.status !== 'closed').length,
    avgResponseMs: avg(mine.map(responseMs).filter((ms) => ms !== null)),
    lastEnquiryAt: mine.map((e) => e.createdAt).sort().pop() || null,
  };
}

const ownerSummary = (u) => (u ? { id: u.id, name: u.name, email: u.email, suspended: Boolean(u.suspended) } : null);
const enquirySummary = ({ id, name, productName, shopName, shopId, status, createdAt }) =>
  ({ id, name, productName, shopName, shopId, status, createdAt });

// ---------- Overview ----------

router.get('/overview', async (_req, res) => {
  const [users, shops, products, enquiries, recent] = await Promise.all([
    db.users.findMany(), db.shops.findMany(), db.products.findMany(), db.enquiries.findMany(),
    db.activity.findMany({}, { newestFirst: true, limit: 15 }),
  ]);
  const within = (ms) => enquiries.filter((e) => age(e.createdAt) < ms).length;
  const shopOwners = new Set(shops.map((s) => s.ownerId));

  res.json({
    users: {
      buyers: users.filter((u) => u.role === 'buyer').length,
      sellers: users.filter((u) => u.role === 'seller').length,
      admins: users.filter((u) => u.role === 'admin').length,
      suspended: users.filter((u) => u.suspended).length,
      newThisWeek: users.filter((u) => age(u.createdAt) < 7 * DAY).length,
    },
    shops: { total: shops.length, suspended: shops.filter((s) => s.suspended).length },
    products: { total: products.length, arReady: products.filter((p) => p.modelUrl).length },
    enquiries: {
      total: enquiries.length,
      new: enquiries.filter((e) => e.status === 'new').length,
      contacted: enquiries.filter((e) => e.status === 'contacted').length,
      closed: enquiries.filter((e) => e.status === 'closed').length,
      today: within(DAY),
      thisWeek: within(7 * DAY),
      lastWeek: within(14 * DAY) - within(7 * DAY),
      avgResponseMs: avg(enquiries.map(responseMs).filter((ms) => ms !== null)),
    },
    attention: {
      // Shoppers waiting more than a day for a first reply, longest wait first.
      unanswered: enquiries.filter((e) => e.status === 'new' && age(e.createdAt) > DAY)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 10).map(enquirySummary),
      shopsWithoutPhone: shops.filter((s) => !String(s.phone || '').trim()).map(({ id, name }) => ({ id, name })),
      sellersWithoutShop: users.filter((u) => u.role === 'seller' && !shopOwners.has(u.id)).map(ownerSummary),
      productsWithoutModel: products.filter((p) => !p.modelUrl).length,
    },
    recent,
  });
});

// ---------- Activity log ----------

router.get('/activity', async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 200);
  const type = String(req.query.type || ''); // prefix, e.g. "enquiry" or "product"
  const entries = await db.activity.findMany({}, { newestFirst: true, limit: type ? 1000 : limit });
  res.json({ activity: entries.filter((a) => !type || a.type.startsWith(type)).slice(0, limit) });
});

// ---------- Enquiries (every shop) ----------

router.get('/enquiries', async (req, res) => {
  const { status, shop } = req.query;
  const term = String(req.query.q || '').trim().toLowerCase();
  const query = {};
  if (['new', 'contacted', 'closed'].includes(status)) query.status = status;
  if (shop) query.shopId = shop;
  const list = (await db.enquiries.findMany(query))
    .filter((e) => status !== 'open' || e.status !== 'closed')
    .filter((e) => !term || `${e.name} ${e.phone} ${e.email} ${e.productName} ${e.shopName} ${e.message}`.toLowerCase().includes(term))
    .sort(newestFirst);
  res.json({ enquiries: list });
});

// Removes spam or abusive enquiries.
router.delete('/enquiries/:id', async (req, res) => {
  const enquiry = await db.enquiries.byId(req.params.id);
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });
  await db.enquiries.remove(enquiry.id);
  await enquiryChanged('enquiry.deleted', enquiry);
  await activity.record('enquiry.deleted', req.user,
    `${req.user.name} (admin) deleted ${enquiry.name}'s enquiry about ${enquiry.productName} at ${enquiry.shopName}`,
    { shopId: enquiry.shopId, productId: enquiry.productId });
  res.status(204).end();
});

// ---------- Shops ----------

router.get('/shops', async (_req, res) => {
  const [shops, users, products, enquiries] = await Promise.all([
    db.shops.findMany(), db.users.findMany(), db.products.findMany(), db.enquiries.findMany(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const list = shops
    .map((s) => ({ ...s, owner: ownerSummary(byId.get(s.ownerId)), stats: shopStats(s, products, enquiries) }))
    .sort((a, b) => b.stats.new - a.stats.new || a.name.localeCompare(b.name));
  res.json({ shops: list });
});

router.get('/shops/:id', async (req, res) => {
  const shop = await db.shops.byId(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  const [owner, products, enquiries, log] = await Promise.all([
    db.users.byId(shop.ownerId),
    db.products.findMany({ shopId: shop.id }),
    db.enquiries.findMany({ shopId: shop.id }),
    db.activity.findMany({ shopId: shop.id }, { newestFirst: true, limit: 30 }),
  ]);
  res.json({
    shop,
    owner: ownerSummary(owner),
    stats: shopStats(shop, products, enquiries),
    products: [...products].sort(newestFirst),
    enquiries: [...enquiries].sort(newestFirst).slice(0, 30),
    activity: log,
  });
});

// Suspended shops disappear from the catalogue and stop receiving enquiries; the seller keeps access.
router.patch('/shops/:id', async (req, res) => {
  const shop = await db.shops.byId(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });
  if (typeof req.body?.suspended !== 'boolean') return res.status(400).json({ error: 'suspended must be true or false' });
  const updated = await db.shops.update(shop.id, { suspended: req.body.suspended });
  publish('shop.updated', { shopId: shop.id });
  await activity.record(req.body.suspended ? 'shop.suspended' : 'shop.restored', req.user,
    `${req.user.name} (admin) ${req.body.suspended ? 'suspended' : 'restored'} ${shop.name}`, { shopId: shop.id });
  res.json({ shop: updated });
});

// ---------- Users ----------

router.get('/users', async (req, res) => {
  const { role } = req.query;
  const term = String(req.query.q || '').trim().toLowerCase();
  const [users, shops, enquiries] = await Promise.all([db.users.findMany(), db.shops.findMany(), db.enquiries.findMany()]);
  const shopByOwner = new Map(shops.map((s) => [s.ownerId, s]));
  const list = users
    .filter((u) => !role || u.role === role)
    .filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term))
    .sort(newestFirst)
    .map((u) => {
      const shop = shopByOwner.get(u.id);
      return {
        ...publicUser(u),
        suspended: Boolean(u.suspended),
        shop: shop ? { id: shop.id, name: shop.name, suspended: Boolean(shop.suspended) } : null,
        enquiries: enquiries.filter((e) => e.buyerId === u.id).length,
      };
    });
  res.json({ users: list });
});

router.get('/users/:id', async (req, res) => {
  const user = await db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const [shop, sent, log] = await Promise.all([
    db.shops.findOne({ ownerId: user.id }),
    db.enquiries.findMany({ buyerId: user.id }),
    db.activity.findMany({ actorId: user.id }, { newestFirst: true, limit: 30 }),
  ]);
  let shopInfo = null;
  if (shop) {
    const [products, enquiries] = await Promise.all([db.products.findMany({ shopId: shop.id }), db.enquiries.findMany({ shopId: shop.id })]);
    shopInfo = { ...shop, stats: shopStats(shop, products, enquiries) };
  }
  res.json({
    user: { ...publicUser(user), suspended: Boolean(user.suspended) },
    shop: shopInfo,
    enquiries: [...sent].sort(newestFirst),
    activity: log,
  });
});

// Suspended accounts can't sign in, and their existing sessions stop working immediately.
router.patch('/users/:id', async (req, res) => {
  const user = await db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (typeof req.body?.suspended !== 'boolean') return res.status(400).json({ error: 'suspended must be true or false' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be suspended here' });
  const updated = await db.users.update(user.id, { suspended: req.body.suspended });
  await activity.record(req.body.suspended ? 'user.suspended' : 'user.restored', req.user,
    `${req.user.name} (admin) ${req.body.suspended ? 'suspended' : 'restored'} ${user.name}'s account`, { userId: user.id });
  res.json({ user: { ...publicUser(updated), suspended: Boolean(updated.suspended) } });
});

// ---------- AR studio ----------

// The AR studio queue: every product across all shops, pieces still waiting for a 3D model first.
router.get('/products', async (req, res) => {
  const { ar } = req.query;
  const all = await db.products.findMany();
  const stats = { total: all.length, arReady: all.filter((p) => p.modelUrl).length };
  stats.missing = stats.total - stats.arReady;

  const list = all
    .filter((p) => (ar === 'missing' ? !p.modelUrl : ar === 'ready' ? Boolean(p.modelUrl) : true))
    .sort((a, b) => Number(Boolean(a.modelUrl)) - Number(Boolean(b.modelUrl)) || b.createdAt.localeCompare(a.createdAt));
  res.json({ products: await withShops(list), stats });
});

// Sets (or clears, with empty strings) a product's 3D model and AR placement.
router.put('/products/:id/ar', async (req, res) => {
  const product = await db.products.byId(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const body = req.body || {};
  const patch = {};
  const errors = [];
  for (const [key, ext] of [['modelUrl', '.glb'], ['iosModelUrl', '.usdz']]) {
    if (body[key] === undefined) continue;
    const url = String(body[key] || '').trim();
    if (url && !isFileUrl(url)) errors.push(`${key} must be an uploaded file or an http(s) link`);
    else if (url && !new URL(url, 'http://x').pathname.toLowerCase().endsWith(ext)) errors.push(`${key} must be a ${ext} file`);
    else patch[key] = url;
  }
  if (body.placement !== undefined) {
    // Where AR anchors the model: on the floor (furniture) or on a wall (mirrors, art, sconces).
    if (!['floor', 'wall'].includes(body.placement)) errors.push('placement must be floor or wall');
    else patch.placement = body.placement;
  }
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const updated = await db.products.update(product.id, patch);
  productChanged('product.updated', updated);
  const verb = !product.modelUrl && updated.modelUrl ? 'added a 3D model to'
    : product.modelUrl && !updated.modelUrl ? 'removed the 3D model from' : 'updated the 3D model of';
  await activity.record('product.ar', req.user, `${req.user.name} (admin) ${verb} ${product.name}`,
    { productId: product.id, shopId: product.shopId });
  res.json({ product: await withShop(updated) });
});

module.exports = router;
