const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['Sofas', 'Chairs', 'Tables', 'Beds', 'Storage', 'Lighting', 'Decor', 'Outdoor'];

async function withShop(product) {
  const shop = await db.shops.byId(product.shopId);
  return { ...product, shop: shop ? { id: shop.id, name: shop.name, city: shop.city, logo: shop.logo } : null };
}
const withShops = (list) => Promise.all(list.map(withShop));

// Validates & normalizes a product payload. `partial` allows updates to omit fields.
function parseProduct(body, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const has = (k) => body[k] !== undefined;

  if (has('name') || !partial) {
    if (!String(body.name || '').trim()) errors.push('name is required');
    else out.name = String(body.name).trim();
  }
  if (has('price') || !partial) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('price must be a positive number');
    else out.price = Math.round(price * 100) / 100;
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

  if (has('placement')) {
    // Where AR anchors the model: on the floor (furniture) or on a wall (mirrors, art, sconces).
    if (!['floor', 'wall'].includes(body.placement)) errors.push('placement must be floor or wall');
    else out.placement = body.placement;
  } else if (!partial) out.placement = 'floor';

  for (const k of ['description', 'material', 'color', 'modelUrl', 'iosModelUrl']) {
    if (has(k)) out[k] = String(body[k] || '').trim();
  }
  if (has('images')) {
    out.images = (Array.isArray(body.images) ? body.images : [body.images]).filter(Boolean).map(String);
  } else if (!partial) out.images = [];

  return { data: out, errors };
}

router.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

router.get('/', async (req, res) => {
  const { q, category, shop, minPrice, maxPrice, arOnly, sort = 'newest', maxWidth, maxDepth, maxHeight } = req.query;
  const term = String(q || '').toLowerCase();

  // Equality filters go to the database; text search and ranges are applied here.
  const query = {};
  if (category) query.category = category;
  if (shop) query.shopId = shop;

  let list = (await db.products.findMany(query)).filter((p) => {
    if (term && !`${p.name} ${p.description} ${p.material} ${p.color}`.toLowerCase().includes(term)) return false;
    if (minPrice && p.price < Number(minPrice)) return false;
    if (maxPrice && p.price > Number(maxPrice)) return false;
    if (arOnly === 'true' && !p.modelUrl) return false;
    // "Fits my space" filter
    if (maxWidth && p.dimensions.width > Number(maxWidth)) return false;
    if (maxDepth && p.dimensions.depth > Number(maxDepth)) return false;
    if (maxHeight && p.dimensions.height > Number(maxHeight)) return false;
    return true;
  });

  const sorters = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  list = [...list].sort(sorters[sort] || sorters.newest);

  res.json({ products: await withShops(list) });
});

router.get('/:id', async (req, res) => {
  const product = await db.products.byId(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const related = (await db.products.findMany())
    .filter((p) => p.id !== product.id && (p.category === product.category || p.shopId === product.shopId))
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
  return product;
}

router.post('/', requireRole('seller'), async (req, res) => {
  const shop = await db.shops.findOne({ ownerId: req.user.id });
  if (!shop) return res.status(400).json({ error: 'Create your shop before adding products' });
  const { data, errors } = parseProduct(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const product = await db.products.insert({ ...data, shopId: shop.id });
  res.status(201).json({ product: await withShop(product) });
});

router.put('/:id', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  const { data, errors } = parseProduct(req.body || {}, { partial: true });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  res.json({ product: await withShop(await db.products.update(product.id, data)) });
});

router.delete('/:id', requireRole('seller'), async (req, res) => {
  const product = await ownedProduct(req, res);
  if (!product) return;
  await db.products.remove(product.id);
  res.status(204).end();
});

module.exports = router;
module.exports.withShop = withShop;
module.exports.withShops = withShops;
module.exports.CATEGORIES = CATEGORIES;
