const jwt = require('jsonwebtoken');
const db = require('../db');

// Production with a real database must supply its own secret; failing only the auth routes
// (with a clear message) keeps the rest of the site up and makes the misconfiguration obvious.
// In-memory demo mode holds no real data, so it may fall back to the built-in secret.
function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && db.kind !== 'memory') {
    throw Object.assign(new Error('Server not configured: set the JWT_SECRET environment variable, then redeploy'), {
      status: 503,
      expose: true,
    });
  }
  return 'dev-only-change-me';
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: '7d' });
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

const SUSPENDED = 'This account has been suspended. Contact RoomFit support.';

// Attaches req.user when a valid bearer token is present; never rejects.
// A suspended account is treated as signed out (req.suspended explains why).
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const key = secret();
    let payload = null;
    try {
      payload = jwt.verify(token, key);
    } catch {
      // invalid/expired token -> treated as anonymous
    }
    const user = payload ? await db.users.byId(payload.sub) : null;
    if (user?.suspended) req.suspended = true;
    else if (user) req.user = user;
  }
  next();
}

async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: req.suspended ? SUSPENDED : 'Authentication required' });
  next();
}

const requireRole = (...roles) => async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: req.suspended ? SUSPENDED : 'Authentication required' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Only ${roles.join('/')} accounts can do this` });
  }
  next();
};

module.exports = { SUSPENDED, signToken, publicUser, optionalAuth, requireAuth, requireRole };
