const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { subscribe } = require('../events');

const router = express.Router();

const HEARTBEAT_MS = 25_000;

// Live update stream. Anyone receives public catalogue events; enquiry events only reach
// the shop owner and the shopper involved; admins receive everything, including the
// activity log (events with an empty audience). The token is read once, when the stream opens.
router.get('/', optionalAuth, (req, res) => {
  // On Vercel each request may run on a different instance, so an in-process stream would
  // miss most events. The app falls back to polling when it sees `poll: true`.
  if (process.env.VERCEL) {
    return res.status(501).json({ error: 'Live updates are not streamed on this deployment', poll: true });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({ type: 'ready' });

  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'admin';
  const unsubscribe = subscribe((event, audience) => {
    if (!audience || isAdmin || (userId && audience.includes(userId))) send(event);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
