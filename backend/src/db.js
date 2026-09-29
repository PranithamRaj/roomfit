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
    async close() {},
  };
}

// ---------- MongoDB adapter ----------
function mongoAdapter(uri) {
  // Reuse one client across serverless invocations.
  const { MongoClient } = require('mongodb');
  globalThis.__roomfitMongo ||= new MongoClient(uri).connect();
  const database = async () => (await globalThis.__roomfitMongo).db(process.env.MONGODB_DB || 'roomfit');
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
    async close() {
      if (globalThis.__roomfitMongo) await (await globalThis.__roomfitMongo).close();
      globalThis.__roomfitMongo = null;
    },
  };
}

const adapter = process.env.MONGODB_URI
  ? mongoAdapter(process.env.MONGODB_URI)
  : fileAdapter(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json'));

module.exports = {
  kind: adapter.kind,
  reset: adapter.reset,
  close: adapter.close,
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, adapter.collection(c)])),
};
