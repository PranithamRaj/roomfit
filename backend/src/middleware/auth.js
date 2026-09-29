const jwt = require('jsonwebtoken');
const db = require('../db');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Attaches req.user when a valid bearer token is present; never rejects.
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    let payload = null;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      // invalid/expired token -> treated as anonymous
    }
    if (payload) req.user = (await db.users.byId(payload.sub)) || undefined;
  }
  next();
}

async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

const requireRole = (...roles) => async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Only ${roles.join('/')} accounts can do this` });
  }
  next();
};

module.exports = { signToken, publicUser, optionalAuth, requireAuth, requireRole };
