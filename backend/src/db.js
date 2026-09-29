// Persistence layer with two interchangeable adapters, selected at startup:
//  - MongoDB when MONGODB_URI is set (production / Vercel)
//  - a JSON file otherwise (local development and tests)
// Routes only use the async collection API below:
//   byId(id) · findOne(query) · findMany(query) · insert(doc) · update(id, patch) · remove(id)
// `query` is a plain equality match, e.g. { shopId, status: 'placed' }.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COLLECTIONS = ['users', 'shops', 'products', 'carts', 'orders'];
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const matches = (row, query = {}) => Object.entries(query).every(([k, v]) => row[k] === v);

// ---------- JSON file adapter ----------
function fileAdapter(file) {
  let state = null;

  function load() {
    if (state) return state;
    try {
      state = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      state = {};
    }
    for (const c of COLLECTIONS) state[c] ||= [];
    return state;
  }

  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  }

  const collection = (name) => {
    const rows = () => load()[name];
    return {
      async byId(id) { return rows().find((r) => r.id === id) || null; },
      async findOne(query) { return rows().find((r) => matches(r, query)) || null; },
      async findMany(query) { return rows().filter((r) => matches(r, query)); },
      async insert(doc) {
        const row = { id: newId(), createdAt: now(), updatedAt: now(), ...doc };
        rows().push(row);
        save();
        return row;
      },
      async update(id, patch) {
        const row = rows().find((r) => r.id === id);
        if (!row) return null;
        Object.assign(row, patch, { updatedAt: now() });
        save();
        return row;
      },
      async remove(id) {
        const list = rows();
        const i = list.findIndex((r) => r.id === id);
        if (i === -1) return false;
        list.splice(i, 1);
        save();
        return true;
      },
    };
  };

  return {
    kind: 'file',
    collection,
    async reset() {
      state = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
      save();
    },
    async ping() {
      load();
    },
    async close() {},
  };
}

// ---------- MongoDB adapter ----------
function mongoAdapter(uri) {
  const { MongoClient } = require('mongodb');

  // Connect lazily and reuse the client across serverless invocations. A failed connection
  // (bad URI, Atlas network rules) is reported to that request and retried on the next one,
  // instead of crashing the function at startup.
  async function client() {
    if (!globalThis.__roomfitMongo) {
      const connecting = (async () => new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect())();
      globalThis.__roomfitMongo = connecting;
      connecting.catch(() => {
        if (globalThis.__roomfitMongo === connecting) globalThis.__roomfitMongo = null;
      });
    }
    try {
      return await globalThis.__roomfitMongo;
    } catch (err) {
      throw Object.assign(new Error(`Cannot connect to MongoDB: ${err.message}`), { status: 503, expose: true });
    }
  }
  const database = async () => (await client()).db(process.env.MONGODB_DB || 'roomfit');
  const noMongoId = { projection: { _id: 0 } };

  const collection = (name) => {
    const col = async () => (await database()).collection(name);
    return {
      async byId(id) { return (await col()).findOne({ id }, noMongoId); },
      async findOne(query = {}) { return (await col()).findOne(query, noMongoId); },
      async findMany(query = {}) { return (await col()).find(query, noMongoId).toArray(); },
      async insert(doc) {
        const row = { id: newId(), createdAt: now(), updatedAt: now(), ...doc };
        await (await col()).insertOne({ ...row });
        return row;
      },
      async update(id, patch) {
        return (await col()).findOneAndUpdate(
          { id },
          { $set: { ...patch, updatedAt: now() } },
          { returnDocument: 'after', ...noMongoId },
        );
      },
      async remove(id) {
        return (await (await col()).deleteOne({ id })).deletedCount === 1;
      },
    };
  };

  return {
    kind: 'mongo',
    collection,
    async reset() {
      const d = await database();
      for (const c of COLLECTIONS) await d.collection(c).deleteMany({});
      await d.collection('users').createIndex({ email: 1 }, { unique: true });
      for (const c of COLLECTIONS) await d.collection(c).createIndex({ id: 1 }, { unique: true });
    },
    async ping() {
      await (await database()).command({ ping: 1 });
    },
    async close() {
      const pending = globalThis.__roomfitMongo;
      globalThis.__roomfitMongo = null;
      if (pending) await (await pending.catch(() => null))?.close();
    },
  };
}

// Vercel's filesystem is read-only, so the JSON file can't work there.
function missingDatabase() {
  const fail = async () => {
    throw Object.assign(
      new Error('Database not configured: set MONGODB_URI (Vercel → Storage → connect MongoDB Atlas), then redeploy'),
      { status: 503, expose: true },
    );
  };
  const collection = () => ({ byId: fail, findOne: fail, findMany: fail, insert: fail, update: fail, remove: fail });
  return { kind: 'none', collection, reset: fail, ping: fail, async close() {} };
}

const adapter = process.env.MONGODB_URI
  ? mongoAdapter(process.env.MONGODB_URI)
  : process.env.VERCEL
    ? missingDatabase()
    : fileAdapter(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'));

module.exports = {
  kind: adapter.kind,
  reset: adapter.reset,
  ping: adapter.ping,
  close: adapter.close,
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, adapter.collection(c)])),
};
