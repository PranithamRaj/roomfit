const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { withShop } = require('./products');

const router = express.Router();
router.use(requireRole('buyer'));

async function cartFor(userId) {
  return (await db.carts.findOne({ userId })) || db.carts.insert({ userId, items: [] });
}

// Expands stored {productId, qty} pairs into full line items, dropping deleted products.
async function hydrate(cart) {
  const lines = await Promise.all(
    cart.items.map(async ({ productId, qty }) => {
      const product = await db.products.byId(productId);
      return product ? { product: await withShop(product), qty, lineTotal: product.price * qty } : null;
    }),
  );
  const items = lines.filter(Boolean);
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items, count: items.reduce((n, i) => n + i.qty, 0), subtotal: Math.round(subtotal * 100) / 100 };
}

router.get('/', async (req, res) => res.json({ cart: await hydrate(await cartFor(req.user.id)) }));

router.post('/', async (req, res) => {
  const { productId } = req.body || {};
  const qty = Number.parseInt(req.body?.qty ?? 1, 10);
  const product = await db.products.byId(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty must be at least 1' });

  const cart = await cartFor(req.user.id);
  const existing = cart.items.find((i) => i.productId === productId);
  const nextQty = (existing?.qty || 0) + qty;
  if (nextQty > product.stock) return res.status(400).json({ error: `Only ${product.stock} in stock` });

  const items = existing
    ? cart.items.map((i) => (i.productId === productId ? { ...i, qty: nextQty } : i))
    : [...cart.items, { productId, qty }];
  res.json({ cart: await hydrate(await db.carts.update(cart.id, { items })) });
});

router.patch('/:productId', async (req, res) => {
  const qty = Number.parseInt(req.body?.qty, 10);
  const cart = await cartFor(req.user.id);
  const product = await db.products.byId(req.params.productId);
  if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: 'qty must be 0 or more' });
  if (product && qty > product.stock) return res.status(400).json({ error: `Only ${product.stock} in stock` });

  const items = qty === 0
    ? cart.items.filter((i) => i.productId !== req.params.productId)
    : cart.items.map((i) => (i.productId === req.params.productId ? { ...i, qty } : i));
  res.json({ cart: await hydrate(await db.carts.update(cart.id, { items })) });
});

router.delete('/:productId', async (req, res) => {
  const cart = await cartFor(req.user.id);
  const items = cart.items.filter((i) => i.productId !== req.params.productId);
  res.json({ cart: await hydrate(await db.carts.update(cart.id, { items })) });
});

module.exports = router;
module.exports.cartFor = cartFor;
module.exports.hydrate = hydrate;
