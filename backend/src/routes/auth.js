const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, publicUser, requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'buyer' } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'A valid email is required' });
  if ((password || '').length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['buyer', 'seller'].includes(role)) return res.status(400).json({ error: 'Role must be buyer or seller' });

  const normalized = email.trim().toLowerCase();
  if (await db.users.findOne({ email: normalized })) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const user = await db.users.insert({
    name: name.trim(),
    email: normalized,
    role,
    passwordHash: await bcrypt.hash(password, 10),
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.users.findOne({ email: String(email || '').trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const shop = await db.shops.findOne({ ownerId: req.user.id });
  res.json({ user: publicUser(req.user), shop });
});

module.exports = router;
