const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { authenticateCustomer } = require('../middleware/auth');

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `avatar_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, avatar_url, loyalty_points, rating, no_show_count, subscription_status FROM customers WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/me', authenticateCustomer, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name = $1, phone = $2 WHERE id = $3 RETURNING id, name, email, phone, avatar_url, loyalty_points, rating, subscription_status`,
      [name, phone || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: upload avatar
router.post('/me/avatar', authenticateCustomer, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      'UPDATE customers SET avatar_url=$1 WHERE id=$2 RETURNING id, name, email, phone, avatar_url, loyalty_points, rating',
      [url, req.user.id]
    );
    res.json({ avatar_url: url, user: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: change password
router.put('/me/password', authenticateCustomer, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const cust = await pool.query('SELECT password FROM customers WHERE id=$1', [req.user.id]);
    if (!cust.rows.length) return res.status(404).json({ message: 'Not found' });
    const match = await bcrypt.compare(current_password, cust.rows[0].password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE customers SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/me/loyalty', authenticateCustomer, async (req, res) => {
  try {
    const cust = await pool.query('SELECT loyalty_points FROM customers WHERE id = $1', [req.user.id]);
    const result = await pool.query('SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json({ total_points: cust.rows[0]?.loyalty_points || 0, history: result.rows });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
