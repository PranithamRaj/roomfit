const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { cartFor, hydrate } = require('./cart');

const router = express.Router();

const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
// Which status a seller may move an order to from its current status.
const TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
const DELIVERY_FEE = 49;

// Checkout: one order is created per shop so each seller fulfils their own items.
router.post('/', requireRole('buyer'), async (req, res) => {
  const { shipping = {}, paymentMethod = 'cod' } = req.body || {};
  for (const field of ['name', 'phone', 'address', 'city']) {
    if (!String(shipping[field] || '').trim()) {
      return res.status(400).json({ error: `Shipping ${field} is required` });
    }
  }
  if (!['cod', 'card'].includes(paymentMethod)) return res.status(400).json({ error: 'Unknown payment method' });

  const cart = await cartFor(req.user.id);
  const { items } = await hydrate(cart);
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' });

  const outOfStock = items.find((i) => i.qty > i.product.stock);
  if (outOfStock) {
    return res.status(409).json({ error: `${outOfStock.product.name} only has ${outOfStock.product.stock} left` });
  }

  const byShop = new Map();
  for (const i of items) {
    if (!byShop.has(i.product.shopId)) byShop.set(i.product.shopId, []);
    byShop.get(i.product.shopId).push(i);
  }

  const orders = [];
  for (const [shopId, lines] of byShop) {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    for (const l of lines) await db.products.update(l.product.id, { stock: l.product.stock - l.qty });
    orders.push(await db.orders.insert({
      buyerId: req.user.id,
      shopId,
      shopName: lines[0].product.shop?.name,
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        image: l.product.images?.[0] || null,
        price: l.product.price,
        qty: l.qty,
      })),
      subtotal,
      deliveryFee: DELIVERY_FEE,
      total: subtotal + DELIVERY_FEE,
      shipping: {
        name: shipping.name.trim(),
        phone: shipping.phone.trim(),
        address: shipping.address.trim(),
        city: shipping.city.trim(),
      },
      paymentMethod,
      status: 'placed',
      history: [{ status: 'placed', at: new Date().toISOString() }],
    }));
  }

  await db.carts.update(cart.id, { items: [] });
  res.status(201).json({ orders });
});

// Buyers see their orders; sellers see orders placed with their shop.
router.get('/', requireAuth, async (req, res) => {
  let orders;
  if (req.user.role === 'seller') {
    const shop = await db.shops.findOne({ ownerId: req.user.id });
    orders = shop ? await db.orders.findMany({ shopId: shop.id }) : [];
  } else {
    orders = await db.orders.findMany({ buyerId: req.user.id });
  }
  orders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders });
});

async function canView(user, order) {
  if (order.buyerId === user.id) return true;
  const shop = await db.shops.byId(order.shopId);
  return shop?.ownerId === user.id;
}

router.get('/:id', requireAuth, async (req, res) => {
  const order = await db.orders.byId(req.params.id);
  if (!order || !(await canView(req.user, order))) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const order = await db.orders.byId(req.params.id);
  if (!order || !(await canView(req.user, order))) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });

  const isBuyer = order.buyerId === req.user.id;
  // Buyers may only cancel, and only before the order ships.
  const allowed = isBuyer ? (order.status === 'placed' ? ['cancelled'] : []) : TRANSITIONS[order.status];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot change a ${order.status} order to ${status}` });
  }

  if (status === 'cancelled') {
    for (const item of order.items) {
      const p = await db.products.byId(item.productId);
      if (p) await db.products.update(p.id, { stock: p.stock + item.qty });
    }
  }
  const updated = await db.orders.update(order.id, {
    status,
    history: [...order.history, { status, at: new Date().toISOString() }],
  });
  res.json({ order: updated });
});

module.exports = router;
