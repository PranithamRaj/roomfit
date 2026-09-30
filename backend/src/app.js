const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db');
const { renderArPage } = require('./arPage');
const { UPLOAD_DIR, MAX_BYTES } = require('./routes/uploads');

function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Reports what's configured (never the values) so deployment problems are easy to spot.
  app.get('/api/health', async (_req, res) => {
    const demoMode = db.kind === 'memory';
    const config = {
      database: db.kind,
      demoMode,
      // Names (not values) of MongoDB-related variables this deployment can see.
      mongoUriVar: db.mongoUriVar,
      mongoEnvVars: db.mongoEnvNames,
      jwtSecret: Boolean(process.env.JWT_SECRET) || process.env.NODE_ENV !== 'production' || demoMode,
      blobStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN) || !process.env.VERCEL,
      seedDemo: process.env.SEED_DEMO === 'true' || demoMode,
    };
    let dbError = null;
    try {
      await db.ping();
    } catch (err) {
      dbError = err.message;
    }
    const ok = !dbError && config.jwtSecret;
    const note = demoMode
      ? 'Demo mode: no database configured, data is kept in memory and resets. Set MONGODB_URI to keep data.'
      : undefined;
    res.status(ok ? 200 : 503).json({ ok, ...config, dbError, note });
  });

  // Seed demo shops on the first request to an empty database when SEED_DEMO=true
  // (always in in-memory demo mode). A failed attempt is retried on the next request.
  if (process.env.SEED_DEMO === 'true' || db.kind === 'memory') {
    let seeding = null;
    app.use(async (_req, _res, next) => {
      seeding ||= (async () => {
        if (!(await db.users.findOne({}))) await require('./seed').seed({ log: false });
      })().catch((err) => {
        seeding = null;
        throw err;
      });
      await seeding;
      next();
    });
  }
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/shops', require('./routes/shops'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/enquiries', require('./routes/enquiries'));
  app.use('/api/uploads', require('./routes/uploads'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/events', require('./routes/events'));

  // Local-disk uploads (development). model/gltf-binary lets Scene Viewer & Quick Look recognise models.
  app.use('/uploads', express.static(UPLOAD_DIR, {
    setHeaders: (res, file) => {
      if (file.endsWith('.glb')) res.setHeader('Content-Type', 'model/gltf-binary');
      if (file.endsWith('.usdz')) res.setHeader('Content-Type', 'model/vnd.usdz+zip');
    },
  }));

  app.get('/ar/:productId', async (req, res) => {
    const product = await db.products.byId(req.params.productId);
    if (!product) return res.status(404).send('Product not found');
    if (!product.modelUrl) return res.status(404).send('This product has no 3D model yet');
    res.type('html').send(renderArPage(req, product));
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    const status = err.status || (tooBig ? 413 : 500);
    if (err.expose) console.warn(`[config] ${err.message}`);
    else if (status >= 500) console.error(err);
    const message = tooBig
      ? `File is larger than ${MAX_BYTES / 1024 / 1024} MB — for big 3D models, paste a link to the .glb instead`
      : err.message;
    // Configuration errors (expose) are safe and useful to show; other 5xx details stay in the logs.
    res.status(status).json({ error: status >= 500 && !err.expose ? 'Something went wrong' : message });
  });

  return app;
}

module.exports = { createApp };
