const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireRole } = require('../middleware/auth');

// Uploads go to Vercel Blob when a store is connected (production), otherwise to local disk.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
// Vercel Functions reject request bodies over 4.5 MB.
const MAX_BYTES = USE_BLOB ? 4 * 1024 * 1024 : 50 * 1024 * 1024;

const ALLOWED = {
  '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'], '.png': ['image', 'image/png'],
  '.webp': ['image', 'image/webp'], '.glb': ['model', 'model/gltf-binary'], '.usdz': ['model', 'model/vnd.usdz+zip'],
};

const fileName = (original) => `${crypto.randomUUID()}${path.extname(original).toLowerCase()}`;

if (!USE_BLOB) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: USE_BLOB
    ? multer.memoryStorage()
    : multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, file, cb) => cb(null, fileName(file.originalname)) }),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED[ext]) return cb(null, true);
    cb(Object.assign(new Error(`Unsupported file type ${ext || '(none)'} — use jpg/png/webp images or glb/usdz models`), { status: 400 }));
  },
});

const router = express.Router();

router.post('/', requireRole('seller'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const [kind, contentType] = ALLOWED[ext];

  if (USE_BLOB) {
    // The Blob store must be created with Public access so shoppers' phones can load files.
    const { put } = require('@vercel/blob');
    const blob = await put(`uploads/${fileName(req.file.originalname)}`, req.file.buffer, { access: 'public', contentType });
    return res.status(201).json({ url: blob.url, kind, size: req.file.size });
  }
  // Local: a server-relative URL; clients resolve it against the API origin.
  res.status(201).json({ url: `/uploads/${req.file.filename}`, kind, size: req.file.size });
});

module.exports = router;
module.exports.UPLOAD_DIR = UPLOAD_DIR;
module.exports.MAX_BYTES = MAX_BYTES;
