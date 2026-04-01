const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get services for a barbershop
router.get('/barbershop/:shopId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE barbershop_id=$1 AND is_active=true ORDER BY category, name',
      [req.params.shopId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my services
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE barbershop_id=$1 ORDER BY category, name',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add service
router.post('/', authenticateBarbershop, async (req, res) => {
  const { name, description, price, duration_minutes, category, is_home_service } = req.body;
  if (!name || !price) return res.status(400).json({ message: 'Name and price required' });
  try {
    const result = await pool.query(
      `INSERT INTO services (barbershop_id, name, description, price, duration_minutes, category, is_home_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, name, description || null, price, duration_minutes || 30, category || 'haircut', is_home_service || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload service image
router.post('/:id/image', authenticateBarbershop, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const own = await pool.query('SELECT id FROM services WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE services SET image_url=$1 WHERE id=$2', [url, req.params.id]);
    res.json({ image_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update service
router.put('/:id', authenticateBarbershop, async (req, res) => {
  const { name, description, price, duration_minutes, category, is_active, is_home_service } = req.body;
  try {
    const own = await pool.query('SELECT id FROM services WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const result = await pool.query(
      `UPDATE services SET name=COALESCE($1,name), description=COALESCE($2,description),
       price=COALESCE($3,price), duration_minutes=COALESCE($4,duration_minutes),
       category=COALESCE($5,category), is_active=COALESCE($6,is_active), is_home_service=COALESCE($7,is_home_service)
       WHERE id=$8 RETURNING *`,
      [name, description, price, duration_minutes, category, is_active, is_home_service, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete service
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const own = await pool.query('SELECT id FROM services WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    await pool.query('UPDATE services SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Service deactivated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
