// End-to-end API tests: a seller lists a product, a shopper finds it by size and
// sends an enquiry, and the seller follows up. Uses a throwaway data file.
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

test('listing flow: create product without price, find it by size', async () => {
  const seller = await login('seller@oakandloom.test');
  const buyer = await login('buyer@roomfit.test');

  // Buyers cannot create products
  assert.equal((await api('POST', '/api/products', { token: buyer, body: {} })).status, 403);

  const invalid = await api('POST', '/api/products', { token: seller, body: { name: 'Table' } });
  assert.equal(invalid.status, 400);

  const created = await api('POST', '/api/products', {
    token: seller,
    body: {
      name: 'Compact Coffee Table',
      category: 'Tables',
      price: 9999, // ignored: listings have no prices
      stock: 2,
      dimensions: { width: 90, depth: 50, height: 40 },
      modelUrl: 'https://example.com/table.glb',
    },
  });
  assert.equal(created.status, 201, created.raw);
  assert.equal(created.body.product.price, undefined);
  assert.equal(created.body.product.shop.name, 'Oak & Loom');
  assert.ok('phone' in created.body.product.shop);

  // No product in the catalogue exposes a price
  const all = await api('GET', '/api/products');
  assert.ok(all.body.products.every((p) => p.price === undefined));

  // "Fits my space" filter: a 100cm-wide nook fits the table but not the sofas
  const fits = await api('GET', '/api/products?maxWidth=100&category=Tables');
  assert.ok(fits.body.products.some((p) => p.id === created.body.product.id));
  assert.equal((await api('GET', '/api/products?maxWidth=100&category=Sofas')).body.products.length, 0);

  // AR viewer page renders for products with a model
  const ar = await fetch(`${base}/ar/${created.body.product.id}`);
  assert.equal(ar.status, 200);
  assert.match(await ar.text(), /ar-scale="fixed"/);
});

test('enquiry flow: guest and shopper enquire, seller follows up', async () => {
  const seller = await login('seller@chairhouse.test');
  const otherSeller = await login('seller@lumen.test');
  const buyer = await login('buyer@roomfit.test');
  const { body } = await api('GET', '/api/products?category=Chairs');
  const chair = body.products[0];

  // Validation
  assert.equal((await api('POST', '/api/enquiries', { body: { productId: 'nope', name: 'A', phone: '9876543210' } })).status, 404);
  assert.equal((await api('POST', '/api/enquiries', { body: { productId: chair.id, phone: '9876543210' } })).status, 400);
  assert.equal((await api('POST', '/api/enquiries', { body: { productId: chair.id, name: 'A', phone: 'abc' } })).status, 400);
  const wantsEmailButNone = await api('POST', '/api/enquiries', {
    body: { productId: chair.id, name: 'A', phone: '9876543210', preferredContact: 'email' },
  });
  assert.equal(wantsEmailButNone.status, 400);
  assert.equal((await api('POST', '/api/enquiries', { token: seller, body: { productId: chair.id, name: 'S', phone: '9876543210' } })).status, 403);

  // Guest enquiry gets a default message
  const guest = await api('POST', '/api/enquiries', { body: { productId: chair.id, name: 'Guest', phone: '+91 98765 43210' } });
  assert.equal(guest.status, 201, guest.raw);
  assert.equal(guest.body.enquiry.buyerId, null);
  assert.match(guest.body.enquiry.message, /price and availability/);

  // Signed-in shopper enquiry
  const mine = await api('POST', '/api/enquiries', {
    token: buyer,
    body: { productId: chair.id, name: 'Demo Buyer', phone: '9000000000', email: 'b@x.com', preferredContact: 'whatsapp', message: 'Is it available in green?' },
  });
  assert.equal(mine.status, 201, mine.raw);
  assert.equal(mine.body.enquiry.shopName, 'The Chair House');

  // Shopper sees only their own enquiry
  const buyerList = await api('GET', '/api/enquiries', { token: buyer });
  assert.deepEqual(buyerList.body.enquiries.map((e) => e.id), [mine.body.enquiry.id]);

  // Seller sees both, newest first; another shop sees none of them
  const sellerList = await api('GET', '/api/enquiries', { token: seller });
  assert.deepEqual(sellerList.body.enquiries.map((e) => e.id), [mine.body.enquiry.id, guest.body.enquiry.id]);
  assert.equal((await api('GET', `/api/enquiries/${mine.body.enquiry.id}`, { token: otherSeller })).status, 404);

  // Only the shop can change status; buyers cannot
  const id = mine.body.enquiry.id;
  assert.equal((await api('PATCH', `/api/enquiries/${id}/status`, { token: buyer, body: { status: 'closed' } })).status, 404);
  assert.equal((await api('PATCH', `/api/enquiries/${id}/status`, { token: seller, body: { status: 'bogus' } })).status, 400);
  const contacted = await api('PATCH', `/api/enquiries/${id}/status`, { token: seller, body: { status: 'contacted' } });
  assert.equal(contacted.body.enquiry.status, 'contacted');
  const closed = await api('PATCH', `/api/enquiries/${id}/status`, { token: seller, body: { status: 'closed' } });
  assert.deepEqual(closed.body.enquiry.history.map((h) => h.status), ['new', 'contacted', 'closed']);

  // The shopper can view their enquiry and its status
  const view = await api('GET', `/api/enquiries/${id}`, { token: buyer });
  assert.equal(view.body.enquiry.status, 'closed');
});
