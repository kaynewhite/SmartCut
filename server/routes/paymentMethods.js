const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `pm_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/barbershop/:barbershopId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE barbershop_id = $1 AND is_active = true ORDER BY id',
      [req.params.barbershopId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE barbershop_id = $1 ORDER BY id',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/me', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  try {
    const { type, account_name, account_number } = req.body;
    if (!type) return res.status(400).json({ message: 'Payment type required' });
    const qr_code_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO payment_methods (barbershop_id, type, account_name, account_number, qr_code_url, is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [req.user.id, type, account_name || null, account_number || null, qr_code_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/me/:id', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  try {
    const { type, account_name, account_number, is_active } = req.body;
    const existingRes = await pool.query(
      'SELECT * FROM payment_methods WHERE id = $1 AND barbershop_id = $2',
      [req.params.id, req.user.id]
    );
    if (!existingRes.rows.length) return res.status(404).json({ message: 'Not found' });
    const existing = existingRes.rows[0];
    const qr_code_url = req.file ? `/uploads/${req.file.filename}` : existing.qr_code_url;
    const result = await pool.query(
      `UPDATE payment_methods SET type=$1, account_name=$2, account_number=$3, qr_code_url=$4, is_active=$5
       WHERE id=$6 AND barbershop_id=$7 RETURNING *`,
      [
        type || existing.type,
        account_name ?? existing.account_name,
        account_number ?? existing.account_number,
        qr_code_url,
        is_active !== undefined ? is_active : existing.is_active,
        req.params.id,
        req.user.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/me/:id', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM payment_methods WHERE id = $1 AND barbershop_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/me/:id/toggle', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE payment_methods SET is_active = NOT is_active WHERE id = $1 AND barbershop_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
