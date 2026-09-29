// End-to-end API test: seller lists a product, buyer finds it, checks fit, buys it,
// seller fulfils the order. Uses a throwaway data file.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DATA_FILE = path.join(os.tmpdir(), `roomfit-test-${process.pid}.json`);

const { createApp } = require('../src/app');
const { seed, DEMO_PASSWORD } = require('../src/seed');

let server;
let base;

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
}

const login = async (email) => (await api('POST', '/api/auth/login', { body: { email, password: DEMO_PASSWORD } })).body.token;

before(async () => {
  await seed({ log: false });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await require('../src/db').close();
  fs.rmSync(process.env.DATA_FILE, { force: true });
});

test('auth: register, duplicate email, bad login, me', async () => {
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'New Buyer', email: 'New@Example.com', password: 'secret1', role: 'buyer' },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'new@example.com');
  assert.equal(reg.body.user.passwordHash, undefined);

  const dup = await api('POST', '/api/auth/register', {
    body: { name: 'X', email: 'new@example.com', password: 'secret1' },
  });
  assert.equal(dup.status, 409);

  const bad = await api('POST', '/api/auth/login', { body: { email: 'new@example.com', password: 'nope' } });
  assert.equal(bad.status, 401);

  const me = await api('GET', '/api/auth/me', { token: reg.body.token });
  assert.equal(me.body.user.name, 'New Buyer');
});

test('marketplace flow: list → search by fit → cart → checkout → fulfil', async () => {
  const seller = await login('seller@oakandloom.test');
  const buyer = await login('buyer@roomfit.test');

  // Buyers cannot create products
  const forbidden = await api('POST', '/api/products', { token: buyer, body: {} });
  assert.equal(forbidden.status, 403);

  const invalid = await api('POST', '/api/products', { token: seller, body: { name: 'Table', price: 10 } });
  assert.equal(invalid.status, 400);

  const created = await api('POST', '/api/products', {
    token: seller,
    body: {
      name: 'Compact Coffee Table',
      category: 'Tables',
      price: 9999,
      stock: 2,
      dimensions: { width: 90, depth: 50, height: 40 },
      modelUrl: 'https://example.com/table.glb',
    },
  });
  assert.equal(created.status, 201);
  const productId = created.body.product.id;
  assert.equal(created.body.product.shop.name, 'Oak & Loom');

  // "Fits my space" filter: a 100cm-wide nook fits the table but not the 219cm sofa
  const fits = await api('GET', '/api/products?maxWidth=100&category=Tables');
  assert.ok(fits.body.products.some((p) => p.id === productId));
  const sofas = await api('GET', '/api/products?maxWidth=100&category=Sofas');
  assert.equal(sofas.body.products.length, 0);

  // AR viewer page renders for products with a model
  const ar = await fetch(`${base}/ar/${productId}`);
  assert.equal(ar.status, 200);
  assert.match(await ar.text(), /ar-scale="fixed"/);

  // Cart respects stock
  const tooMany = await api('POST', '/api/cart', { token: buyer, body: { productId, qty: 3 } });
  assert.equal(tooMany.status, 400);
  const added = await api('POST', '/api/cart', { token: buyer, body: { productId, qty: 2 } });
  assert.equal(added.body.cart.count, 2);
  assert.equal(added.body.cart.subtotal, 19998);

  const noAddress = await api('POST', '/api/orders', { token: buyer, body: { shipping: {} } });
  assert.equal(noAddress.status, 400);

  const checkout = await api('POST', '/api/orders', {
    token: buyer,
    body: { shipping: { name: 'Demo', phone: '999', address: '1 Main St', city: 'Pune' }, paymentMethod: 'cod' },
  });
  assert.equal(checkout.status, 201);
  const [order] = checkout.body.orders;
  assert.equal(order.total, 19998 + 49);

  const afterStock = await api('GET', `/api/products/${productId}`);
  assert.equal(afterStock.body.product.stock, 0);
  assert.equal((await api('GET', '/api/cart', { token: buyer })).body.cart.count, 0);

  // Another shop's seller can't see or move this order
  const otherSeller = await login('seller@chairhouse.test');
  assert.equal((await api('GET', `/api/orders/${order.id}`, { token: otherSeller })).status, 404);

  // Seller workflow with enforced transitions
  const skip = await api('PATCH', `/api/orders/${order.id}/status`, { token: seller, body: { status: 'delivered' } });
  assert.equal(skip.status, 400);
  for (const status of ['confirmed', 'shipped', 'delivered']) {
    const r = await api('PATCH', `/api/orders/${order.id}/status`, { token: seller, body: { status } });
    assert.equal(r.status, 200, r.raw);
  }
  const sellerOrders = await api('GET', '/api/orders', { token: seller });
  assert.equal(sellerOrders.body.orders[0].status, 'delivered');
});

test('buyer cancellation restores stock', async () => {
  const buyer = await login('buyer@roomfit.test');
  const { body } = await api('GET', '/api/products?category=Chairs');
  const chair = body.products[0];

  await api('POST', '/api/cart', { token: buyer, body: { productId: chair.id, qty: 1 } });
  const { body: co } = await api('POST', '/api/orders', {
    token: buyer,
    body: { shipping: { name: 'D', phone: '1', address: 'A', city: 'C' } },
  });
  const cancel = await api('PATCH', `/api/orders/${co.orders[0].id}/status`, { token: buyer, body: { status: 'cancelled' } });
  assert.equal(cancel.status, 200);
  assert.equal((await api('GET', `/api/products/${chair.id}`)).body.product.stock, chair.stock);
});
