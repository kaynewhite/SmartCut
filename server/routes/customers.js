const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { authenticateCustomer } = require('../middleware/auth');
const { createUpload, imageFileFilter, uploadedFileUrl } = require('../middleware/upload');
const upload = createUpload({ fileFilter: imageFileFilter });

router.get('/me', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, avatar_url, loyalty_points, rating, no_show_count,
              subscription_status, latitude, longitude, location_city, location_address
       FROM customers WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: update location (lat/lng + optional human-readable address)
router.patch('/location', authenticateCustomer, async (req, res) => {
  try {
    const { latitude, longitude, location_city, location_address } = req.body;
    if ((latitude !== undefined && (isNaN(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (isNaN(longitude) || longitude < -180 || longitude > 180))) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    const result = await pool.query(
      `UPDATE customers
       SET latitude = $1, longitude = $2, location_city = $3, location_address = $4
       WHERE id = $5
       RETURNING id, name, latitude, longitude, location_city, location_address`,
      [latitude || null, longitude || null, location_city || null, location_address || null, req.user.id]
    );
    res.json({ message: 'Location saved', customer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
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
    const url = uploadedFileUrl(req.file);
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
    const shopsResult = await pool.query(
      `SELECT csl.barbershop_id, b.name as barbershop_name, b.logo_url as barbershop_logo, csl.points, csl.updated_at
       FROM customer_shop_loyalty csl
       JOIN barbershops b ON b.id = csl.barbershop_id
       WHERE csl.customer_id = $1 AND csl.points > 0
       ORDER BY csl.points DESC`,
      [req.user.id]
    );
    const total = shopsResult.rows.reduce((sum, r) => sum + (parseInt(r.points) || 0), 0);
    res.json({ total_points: total, shops: shopsResult.rows });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
