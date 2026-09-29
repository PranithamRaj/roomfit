// Vercel Function entry: the whole Express API (routes under /api and /ar) runs here.
// vercel.json rewrites those paths to this function; req.url keeps the original path.
const { createApp } = require('../backend/src/app');

module.exports = createApp();
