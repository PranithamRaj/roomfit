const express = require('express');
const db = require('../db');
const { optionalAuth, requireRole } = require('../middleware/auth');
const { publish } = require('../events');
const activity = require('../activity');

const router = express.Router();

const CATEGORIES = ['Sofas', 'Chairs', 'Tables', 'Beds', 'Storage', 'Lighting', 'Decor', 'Outdoor'];
const MAX_IMAGES = 12;
// Uploaded files are served from /uploads locally, and from absolute (Blob/CDN) URLs in production.
const isFileUrl = (url) => /^(https?:\/\/|\/uploads\/)\S+$/i.test(url);

const productChanged = (type, product) => publish(type, { productId: product.id, shopId: product.shopId });

// Shops suspended by an admin are hidden from shoppers, along with their products.
const hiddenShopIds = async () => new Set((await db.shops.findMany({ suspended: true })).map((s) => s.id));

// Listings don't show prices; buyers enquire instead. `price` is dropped in case older data still has it.
async function withShop({ price, ...product }) {
  const shop = await db.shops.byId(product.shopId);
  return {
    ...product,
    shop: shop ? { id: shop.id, name: shop.name, city: shop.city, logo: shop.logo, phone: shop.phone || '' } : null,
  };
}
const withShops = (list) => Promise.all(list.map(withShop));

// Validates & normalizes a seller's product payload. `partial` allows updates to omit fields.
// 3D/AR fields (modelUrl, iosModelUrl, placement) are managed by admins only (see routes/admin.js),
// so they are ignored here.
function parseProduct(body, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const has = (k) => body[k] !== undefined;

  if (has('name') || !partial) {
    if (!String(body.name || '').trim()) errors.push('name is required');
    else out.name = String(body.name).trim();
  }
  if (has('category') || !partial) {
    if (!CATEGORIES.includes(body.category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
    else out.category = body.category;
  }
  if (has('stock')) {
    const stock = Number.parseInt(body.stock, 10);
    if (!Number.isInteger(stock) || stock < 0) errors.push('stock must be a whole number');
    else out.stock = stock;
  } else if (!partial) out.stock = 1;

  if (has('dimensions') || !partial) {
    // Real-world size in centimetres — used for "will it fit" checks and true-scale AR.
    const d = body.dimensions || {};
    const dims = { width: Number(d.width), depth: Number(d.depth), height: Number(d.height) };
    if (Object.values(dims).some((v) => !Number.isFinite(v) || v <= 0)) {
      errors.push('dimensions.width, depth and height (cm) are required');
    } else out.dimensions = dims;
  }

  for (const k of ['description', 'material', 'color']) {
    if (has(k)) out[k] = String(body[k] || '').trim();
  }
  if (has('images')) {
    const images = (Array.isArray(body.images) ? body.images : [body.images]).filter(Boolean).map((u) => String(u).trim());
    if (images.some((u) => !isFileUrl(u))) errors.push('images must be uploaded files or http(s) links');
    else if (images.length > MAX_IMAGES) errors.push(`a product can have up to ${MAX_IMAGES} photos`);
    else out.images = [...new Set(images)];
  } else if (!partial) out.images = [];

  return { data: out, errors };
}

router.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

router.get('/', async (req, res) => {
  const { q, category, shop, arOnly, sort = 'newest', maxWidth, maxDepth, maxHeight } = req.query;
  const term = String(q || '').toLowerCase();

  // Equality filters go to the database; text search and ranges are applied here.
  const query = {};
  if (category) query.category = category;
  if (shop) query.shopId = shop;

  const hidden = await hiddenShopIds();
  let list = (await db.products.findMany(query)).filter((p) => {
    if (hidden.has(p.shopId)) return false;
    if (term && !`${p.name} ${p.description} ${p.material} ${p.color}`.toLowerCase().includes(term)) return false;
    if (arOnly === 'true' && !p.modelUrl) return false;
    // "Fits my space" filter
    if (maxWidth && p.dimensions.width > Number(maxWidth)) return false;
    if (maxDepth && p.dimensions.depth > Number(maxDepth)) return false;
    if (maxHeight && p.dimensions.height > Number(maxHeight)) return false;
    return true;
  });

  const sorters = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list = [...list].sort(sorters[sort] || sorters.newest);

  res.json({ products: await withShops(list) });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const product = await db.products.byId(req.params.id);
  const hidden = await hiddenShopIds();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  // Admins, and the seller editing their own listing, can still open products of a suspended shop.
  if (hidden.has(product.shopId) && req.user?.role !== 'admin') {
    const shop = await db.shops.byId(product.shopId);
    if (!req.user || shop?.ownerId !== req.user.id) return res.status(404).json({ error: 'Product not found' });
  }
  const related = (await db.products.findMany())
    .filter((p) => p.id !== product.id && !hidden.has(p.shopId) && (p.category === product.category || p.shopId === product.shopId))
    .slice(0, 6);
  res.json({ product: await withShop(product), related: await withShops(related) });
});

async function ownedProduct(req, res) {
  const product = await db.products.byId(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }
  const shop = await db.shops.byId(product.shopId);
  if (!shop || shop.ownerId !== req.user.id) {
    res.status(403).json({ error: 'This product belongs to another shop' });
    return null;
  }
  req.shop = shop;
  return product;
}

router.post('/', requireRole('seller'), async (req, res) => {
  const shop = await db.shops.findOne({ ownerId: req.user.id });
  if (!shop) return res.status(400).json({ error: 'Create your shop before adding products' });
  const { data, errors } = parseProduct(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  // New listings start without a 3D model; the RoomFit team adds it from the admin studio.
  const product = await db.products.insert({ ...data, placement: 'floor', modelUrl: '', iosModelUrl: '', shopId: shop.id });
  productChanged('product.created', product);
  await activity.record('product.created', req.user, `${shop.name} listed ${product.name}`, { productId: product.id, shopId: shop.id });
  res.status(201).json({ product: await withShop(product) });
});

router.put('/:id', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  const { data, errors } = parseProduct(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const updated = await db.products.update(product.id, data);
  productChanged('product.updated', updated);
  await activity.record('product.updated', req.user, `${req.shop.name} updated ${updated.name}`, { productId: product.id, shopId: product.shopId });
  res.json({ product: await withShop(updated) });
});

// Photos go live one at a time as they finish uploading, so shoppers see them straight away.
// Atomic list edits keep parallel uploads from overwriting each other.
router.post('/:id/images', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  const url = String(req.body?.url || '').trim();
  if (!isFileUrl(url)) return res.status(400).json({ error: 'url must be an uploaded file or an http(s) link' });
  const images = product.images || [];
  if (images.length >= MAX_IMAGES && !images.includes(url)) {
    return res.status(400).json({ error: `A product can have up to ${MAX_IMAGES} photos` });
  }
  const updated = await db.products.addToList(product.id, 'images', url);
  productChanged('product.updated', updated);
  await activity.record('product.photo', req.user, `${req.shop.name} added a photo to ${product.name}`, { productId: product.id, shopId: product.shopId });
  res.status(201).json({ product: await withShop(updated) });
});

router.delete('/:id/images', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  const updated = await db.products.removeFromList(product.id, 'images', String(req.query.url || ''));
  productChanged('product.updated', updated);
  await activity.record('product.photo', req.user, `${req.shop.name} removed a photo from ${product.name}`, { productId: product.id, shopId: product.shopId });
  res.json({ product: await withShop(updated) });
});

router.delete('/:id', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  await db.products.remove(product.id);
  productChanged('product.deleted', product);
  await activity.record('product.deleted', req.user, `${req.shop.name} removed ${product.name}`, { productId: product.id, shopId: product.shopId });
  res.status(204).end();
});

module.exports = router;
module.exports.withShop = withShop;
module.exports.withShops = withShops;
module.exports.CATEGORIES = CATEGORIES;
module.exports.isFileUrl = isFileUrl;
module.exports.productChanged = productChanged;
module.exports.hiddenShopIds = hiddenShopIds;
