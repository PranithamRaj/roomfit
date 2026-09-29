// Vercel Function entry: the whole Express API (routes under /api and /ar) runs here.
// vercel.json rewrites those paths to this function; req.url keeps the original path.
let app;
try {
  app = require('../backend/src/app').createApp();
} catch (err) {
  // Surface startup failures as JSON instead of Vercel's opaque FUNCTION_INVOCATION_FAILED.
  console.error('RoomFit API failed to start:', err);
  app = (_req, res) => {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Server failed to start: ${err.message}` }));
  };
}

module.exports = app;
