// End-to-end API tests: a seller lists a product, the admin adds its 3D model, a shopper
// finds it by size and sends an enquiry, and the seller follows up (and hears about it live).
// Uses a throwaway data file and upload folder.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DATA_FILE = path.join(os.tmpdir(), `roomfit-test-${process.pid}.json`);
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `roomfit-test-uploads-${process.pid}`);
// Also creates the admin when these tests run against MongoDB (no demo admin there).
process.env.ADMIN_EMAIL = 'admin@roomfit.test';
process.env.ADMIN_PASSWORD = 'password123';

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

async function uploadFile(token, name, bytes = 'x') {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  const res = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json() };
}

const waitFor = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for a live event');
    await new Promise((r) => setTimeout(r, 20));
  }
};

// Opens the live-update stream and collects its events.
const streams = new Set();
async function openStream(token) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/events`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal,
  });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const events = [];
  (async () => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const data = buf.slice(0, i).split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
        buf = buf.slice(i + 2);
        if (data) events.push(JSON.parse(data));
      }
    }
  })().catch(() => {});
  const stream = { events, close: () => controller.abort() };
  streams.add(stream);
  await waitFor(() => events.some((e) => e.type === 'ready'));
  return stream;
}

before(async () => {
  await seed({ log: false });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const s of streams) s.close();
  server.closeAllConnections();
  server.close();
  await require('../src/db').close();
  fs.rmSync(process.env.DATA_FILE, { force: true });
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
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

  // Nobody can sign up as an admin
  const admin = await api('POST', '/api/auth/register', {
    body: { name: 'Sneaky', email: 'sneaky@example.com', password: 'secret1', role: 'admin' },
  });
  assert.equal(admin.status, 400);
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
      modelUrl: 'https://example.com/table.glb', // ignored: only the admin adds 3D models
      placement: 'wall',
    },
  });
  assert.equal(created.status, 201, created.raw);
  assert.equal(created.body.product.price, undefined);
  assert.equal(created.body.product.modelUrl, '');
  assert.equal(created.body.product.placement, 'floor');
  assert.equal(created.body.product.shop.name, 'Oak & Loom');
  assert.ok('phone' in created.body.product.shop);

  // No product in the catalogue exposes a price
  const all = await api('GET', '/api/products');
  assert.ok(all.body.products.every((p) => p.price === undefined));

  // "Fits my space" filter: a 100cm-wide nook fits the table but not the sofas
  const fits = await api('GET', '/api/products?maxWidth=100&category=Tables');
  assert.ok(fits.body.products.some((p) => p.id === created.body.product.id));
  assert.equal((await api('GET', '/api/products?maxWidth=100&category=Sofas')).body.products.length, 0);

  // Sellers can't add a model by editing the product either
  const id = created.body.product.id;
  const edited = await api('PUT', `/api/products/${id}`, { token: seller, body: { modelUrl: 'https://example.com/t.glb', stock: 3 } });
  assert.equal(edited.body.product.stock, 3);
  assert.equal(edited.body.product.modelUrl, '');
  assert.equal((await fetch(`${base}/ar/${id}`)).status, 404);
});

test('admin adds 3D models; sellers and shoppers cannot', async () => {
  const admin = await login('admin@roomfit.test');
  const seller = await login('seller@oakandloom.test');
  const buyer = await login('buyer@roomfit.test');
  const { body } = await api('GET', '/api/products?category=Decor');
  const product = body.products[0];

  for (const token of [seller, buyer, undefined]) {
    assert.ok([401, 403].includes((await api('GET', '/api/admin/products', { token })).status));
    assert.ok([401, 403].includes((await api('PUT', `/api/admin/products/${product.id}/ar`, { token, body: { modelUrl: '' } })).status));
  }

  // The queue lists every shop's products, those without a model first
  const queue = await api('GET', '/api/admin/products', { token: admin });
  assert.equal(queue.status, 200);
  assert.equal(queue.body.stats.total, queue.body.products.length);
  assert.ok(queue.body.products[0].shop.name);

  // Validation
  const badExt = await api('PUT', `/api/admin/products/${product.id}/ar`, { token: admin, body: { modelUrl: 'https://example.com/a.obj' } });
  assert.equal(badExt.status, 400);
  const badPlacement = await api('PUT', `/api/admin/products/${product.id}/ar`, { token: admin, body: { placement: 'ceiling' } });
  assert.equal(badPlacement.status, 400);

  // Remove the model: AR switches off and the piece moves to the "missing" list
  const cleared = await api('PUT', `/api/admin/products/${product.id}/ar`, { token: admin, body: { modelUrl: '', iosModelUrl: '' } });
  assert.equal(cleared.body.product.modelUrl, '');
  assert.equal((await fetch(`${base}/ar/${product.id}`)).status, 404);
  const missing = await api('GET', '/api/admin/products?ar=missing', { token: admin });
  assert.ok(missing.body.products.some((p) => p.id === product.id));

  // Upload a model (admin only) and attach it
  assert.equal((await uploadFile(seller, 'sofa.glb')).status, 403);
  assert.equal((await uploadFile(buyer, 'sofa.glb')).status, 403);
  const glb = await uploadFile(admin, 'sofa.glb');
  assert.equal(glb.status, 201);
  assert.equal(glb.body.kind, 'model');
  const set = await api('PUT', `/api/admin/products/${product.id}/ar`, { token: admin, body: { modelUrl: glb.body.url, placement: 'wall' } });
  assert.equal(set.status, 200, set.raw);
  assert.equal(set.body.product.placement, 'wall');
  const ar = await fetch(`${base}/ar/${product.id}`);
  assert.equal(ar.status, 200);
  assert.match(await ar.text(), /ar-scale="fixed"/);
});

test('seller photos go live one by one', async () => {
  const seller = await login('seller@lumen.test');
  const otherSeller = await login('seller@chairhouse.test');
  const { body } = await api('GET', '/api/products?category=Lighting');
  const lamp = body.products[0];

  const photo = await uploadFile(seller, 'lamp.jpg');
  assert.equal(photo.status, 201);
  assert.equal(photo.body.kind, 'image');

  assert.equal((await api('POST', `/api/products/${lamp.id}/images`, { token: otherSeller, body: { url: photo.body.url } })).status, 403);
  assert.equal((await api('POST', `/api/products/${lamp.id}/images`, { token: seller, body: { url: 'javascript:alert(1)' } })).status, 400);

  // Parallel adds all land (atomic list edits), without duplicates
  const urls = ['https://example.com/a.jpg', 'https://example.com/b.jpg', photo.body.url, photo.body.url];
  await Promise.all(urls.map((url) => api('POST', `/api/products/${lamp.id}/images`, { token: seller, body: { url } })));
  let images = (await api('GET', `/api/products/${lamp.id}`)).body.product.images;
  assert.deepEqual(new Set(images), new Set([...lamp.images, ...urls]));
  assert.equal(images.length, lamp.images.length + 3);

  const removed = await api('DELETE', `/api/products/${lamp.id}/images?url=${encodeURIComponent(photo.body.url)}`, { token: seller });
  images = removed.body.product.images;
  assert.ok(!images.includes(photo.body.url));
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
  const admin = await login('admin@roomfit.test');
  assert.equal((await api('POST', '/api/enquiries', { token: admin, body: { productId: chair.id, name: 'A', phone: '9876543210' } })).status, 403);

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

test('live events: enquiries reach only their shop and shopper', async () => {
  const seller = await login('seller@chairhouse.test');
  const otherSeller = await login('seller@oakandloom.test');
  const buyer = await login('buyer@roomfit.test');
  const [sellerStream, otherStream, buyerStream, guestStream] = await Promise.all(
    [seller, otherSeller, buyer, undefined].map(openStream),
  );
  const { body } = await api('GET', '/api/products?category=Chairs');
  const chair = body.products[0];

  const sent = await api('POST', '/api/enquiries', {
    token: buyer,
    body: { productId: chair.id, name: 'Demo Buyer', phone: '9000000000', message: 'Live?' },
  });
  const id = sent.body.enquiry.id;
  const isCreated = (e) => e.type === 'enquiry.created' && e.enquiryId === id;
  await waitFor(() => sellerStream.events.some(isCreated));
  await waitFor(() => buyerStream.events.some(isCreated));

  await api('PATCH', `/api/enquiries/${id}/status`, { token: seller, body: { status: 'contacted' } });
  await waitFor(() => buyerStream.events.some((e) => e.type === 'enquiry.updated' && e.status === 'contacted'));

  // Catalogue changes are public
  await api('PUT', `/api/products/${chair.id}`, { token: seller, body: { stock: 7 } });
  await waitFor(() => guestStream.events.some((e) => e.type === 'product.updated' && e.productId === chair.id));

  // Other shops and guests never hear about this enquiry
  assert.ok(!otherStream.events.some((e) => e.type.startsWith('enquiry.')));
  assert.ok(!guestStream.events.some((e) => e.type.startsWith('enquiry.')));
});

test('admin portal: sees every shop and shopper, and the activity log', async () => {
  const admin = await login('admin@roomfit.test');
  const seller = await login('seller@lumen.test');
  const buyer = await login('buyer@roomfit.test');

  for (const token of [seller, buyer, undefined]) {
    for (const url of ['/api/admin/overview', '/api/admin/enquiries', '/api/admin/shops', '/api/admin/users', '/api/admin/activity']) {
      assert.ok([401, 403].includes((await api('GET', url, { token })).status), url);
    }
  }

  // The admin's live stream hears about every shop's enquiries and every logged action
  const adminStream = await openStream(admin);
  const { body } = await api('GET', '/api/products?category=Lighting');
  const lamp = body.products[0];
  const sent = await api('POST', '/api/enquiries', { body: { productId: lamp.id, name: 'Portal Guest', phone: '9123456789' } });
  const id = sent.body.enquiry.id;
  await waitFor(() => adminStream.events.some((e) => e.type === 'enquiry.created' && e.enquiryId === id));
  await waitFor(() => adminStream.events.some((e) => e.type === 'activity.created' && e.activityType === 'enquiry.created'));

  // All enquiries, across shops
  const all = await api('GET', '/api/admin/enquiries', { token: admin });
  assert.ok(new Set(all.body.enquiries.map((e) => e.shopName)).size >= 2);
  assert.equal((await api('GET', '/api/admin/enquiries?q=portal%20guest', { token: admin })).body.enquiries.length, 1);

  // Admin can open any enquiry and step in on its status
  assert.equal((await api('GET', `/api/enquiries/${id}`, { token: admin })).status, 200);
  const closed = await api('PATCH', `/api/enquiries/${id}/status`, { token: admin, body: { status: 'closed' } });
  assert.equal(closed.body.enquiry.history.at(-1).by, 'admin');

  // Overview numbers match the underlying data
  const overview = await api('GET', '/api/admin/overview', { token: admin });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.users.sellers, 3);
  assert.equal(overview.body.enquiries.total, all.body.enquiries.length);
  assert.ok(overview.body.recent.length > 0);

  // Activity log covers shoppers, sellers and admins
  const log = (await api('GET', '/api/admin/activity', { token: admin })).body.activity;
  const types = new Set(log.map((a) => a.type));
  for (const t of ['user.registered', 'enquiry.created', 'enquiry.status', 'product.created', 'product.photo', 'product.ar']) {
    assert.ok(types.has(t), `activity log is missing ${t}`);
  }
  assert.ok(log.some((a) => a.actorRole === 'guest' && a.summary.includes('Portal Guest')));
  const onlyEnquiries = (await api('GET', '/api/admin/activity?type=enquiry', { token: admin })).body.activity;
  assert.ok(onlyEnquiries.length > 0 && onlyEnquiries.every((a) => a.type.startsWith('enquiry.')));

  // Shops and users with their stats
  const shops = (await api('GET', '/api/admin/shops', { token: admin })).body.shops;
  const lumen = shops.find((s) => s.name === 'Lumen & Glass');
  assert.equal(lumen.owner.email, 'seller@lumen.test');
  assert.ok(lumen.stats.enquiries >= 1);
  const shopDetail = await api('GET', `/api/admin/shops/${lumen.id}`, { token: admin });
  assert.ok(shopDetail.body.enquiries.some((e) => e.id === id));
  const sellers = (await api('GET', '/api/admin/users?role=seller', { token: admin })).body.users;
  assert.equal(sellers.length, 3);
  assert.ok(sellers.every((u) => u.passwordHash === undefined && u.shop));
  const demoBuyer = (await api('GET', '/api/admin/users?q=buyer%40roomfit', { token: admin })).body.users[0];
  const buyerDetail = await api('GET', `/api/admin/users/${demoBuyer.id}`, { token: admin });
  assert.ok(buyerDetail.body.enquiries.length >= 1);

  // Admin removes a spam enquiry: gone for the shop too
  assert.equal((await api('DELETE', `/api/admin/enquiries/${id}`, { token: admin })).status, 204);
  assert.equal((await api('GET', `/api/enquiries/${id}`, { token: seller })).status, 404);
});

test('admin portal: suspending a shop hides it; suspending an account blocks it', async () => {
  const admin = await login('admin@roomfit.test');
  const seller = await login('seller@lumen.test');
  const shops = (await api('GET', '/api/admin/shops', { token: admin })).body.shops;
  const lumen = shops.find((s) => s.name === 'Lumen & Glass');
  const lamp = (await api('GET', `/api/products?shop=${lumen.id}`)).body.products[0];

  assert.equal((await api('PATCH', `/api/admin/shops/${lumen.id}`, { token: admin, body: { suspended: 'yes' } })).status, 400);
  assert.equal((await api('PATCH', `/api/admin/shops/${lumen.id}`, { token: admin, body: { suspended: true } })).status, 200);

  // Hidden from shoppers, and no new enquiries
  assert.ok(!(await api('GET', '/api/products')).body.products.some((p) => p.shopId === lumen.id));
  assert.ok(!(await api('GET', '/api/shops')).body.shops.some((s) => s.id === lumen.id));
  assert.equal((await api('GET', `/api/shops/${lumen.id}`)).status, 404);
  assert.equal((await api('GET', `/api/products/${lamp.id}`)).status, 404);
  assert.equal((await api('POST', '/api/enquiries', { body: { productId: lamp.id, name: 'X', phone: '9123456789' } })).status, 403);
  // ...but the seller and the admin still see it
  assert.equal((await api('GET', `/api/products/${lamp.id}`, { token: seller })).status, 200);
  assert.equal((await api('GET', `/api/products/${lamp.id}`, { token: admin })).status, 200);
  assert.equal((await api('GET', `/api/products/${lamp.id}`, { token: await login('seller@chairhouse.test') })).status, 404);
  assert.equal((await api('GET', '/api/shops/mine', { token: seller })).body.shop.suspended, true);
  // Sellers can't lift their own suspension
  await api('PUT', `/api/shops/${lumen.id}`, { token: seller, body: { suspended: false } });
  assert.equal((await api('GET', '/api/shops/mine', { token: seller })).body.shop.suspended, true);

  await api('PATCH', `/api/admin/shops/${lumen.id}`, { token: admin, body: { suspended: false } });
  assert.ok((await api('GET', '/api/products')).body.products.some((p) => p.shopId === lumen.id));

  // Account suspension: sign-in refused, existing sessions stop working
  const users = (await api('GET', '/api/admin/users?role=buyer', { token: admin })).body.users;
  const target = users.find((u) => u.email === 'new@example.com');
  const token = await (async () => (await api('POST', '/api/auth/login', { body: { email: 'new@example.com', password: 'secret1' } })).body.token)();
  assert.equal((await api('PATCH', `/api/admin/users/${target.id}`, { token: admin, body: { suspended: true } })).status, 200);
  const refused = await api('POST', '/api/auth/login', { body: { email: 'new@example.com', password: 'secret1' } });
  assert.equal(refused.status, 403);
  assert.match(refused.body.error, /suspended/);
  const me = await api('GET', '/api/auth/me', { token });
  assert.equal(me.status, 401);
  assert.match(me.body.error, /suspended/);

  const adminUser = (await api('GET', '/api/admin/users?role=admin', { token: admin })).body.users[0];
  assert.equal((await api('PATCH', `/api/admin/users/${adminUser.id}`, { token: admin, body: { suspended: true } })).status, 403);

  await api('PATCH', `/api/admin/users/${target.id}`, { token: admin, body: { suspended: false } });
  assert.equal((await api('GET', '/api/auth/me', { token })).status, 200);
  const log = (await api('GET', '/api/admin/activity', { token: admin })).body.activity;
  assert.ok(['shop.suspended', 'shop.restored', 'user.suspended', 'user.restored'].every((t) => log.some((a) => a.type === t)));
});
