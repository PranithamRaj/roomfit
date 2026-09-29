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

  // Seed demo shops on the first request to an empty database when SEED_DEMO=true.
  if (process.env.SEED_DEMO === 'true') {
    let seeding = null;
    app.use(async (_req, _res, next) => {
      seeding ||= (async () => {
        if (!(await db.users.findOne({}))) await require('./seed').seed();
      })();
      await seeding;
      next();
    });
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, db: db.kind }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/shops', require('./routes/shops'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/uploads', require('./routes/uploads'));

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
    if (status >= 500) console.error(err);
    const message = tooBig
      ? `File is larger than ${MAX_BYTES / 1024 / 1024} MB — for big 3D models, paste a link to the .glb instead`
      : err.message;
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : message });
  });

  return app;
}

module.exports = { createApp };
