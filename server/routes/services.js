const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop, authenticateBarber } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `svc_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: list services for a shop
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    if (!barbershop_id) return res.json([]);
    const result = await pool.query('SELECT * FROM services WHERE barbershop_id = $1 AND is_active = true ORDER BY id', [barbershop_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: list my services (active + inactive)
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE barbershop_id = $1 ORDER BY id', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: create
router.post('/', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, duration_minutes, category, is_home_service } = req.body;
    if (!name || !price) return res.status(400).json({ message: 'Name and price required' });
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO services (barbershop_id, name, description, price, duration_minutes, category, image_url, is_home_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name, description || null, parseFloat(price), parseInt(duration_minutes) || 30,
       category || 'haircut', image_url, is_home_service === 'true' || is_home_service === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update
router.put('/:id', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, duration_minutes, category, is_active, is_home_service } = req.body;
    const existing = await pool.query('SELECT * FROM services WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const image_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].image_url;
    const result = await pool.query(
      `UPDATE services SET name=$1, description=$2, price=$3, duration_minutes=$4, category=$5, image_url=$6, is_active=$7, is_home_service=$8
       WHERE id=$9 AND barbershop_id=$10 RETURNING *`,
      [name || existing.rows[0].name, description ?? existing.rows[0].description,
       price ? parseFloat(price) : existing.rows[0].price,
       duration_minutes ? parseInt(duration_minutes) : existing.rows[0].duration_minutes,
       category || existing.rows[0].category, image_url,
       is_active !== undefined ? (is_active === 'true' || is_active === true) : existing.rows[0].is_active,
       is_home_service !== undefined ? (is_home_service === 'true' || is_home_service === true) : existing.rows[0].is_home_service,
       req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: delete
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM services WHERE id = $1 AND barbershop_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: 'Cannot delete (may have appointments)' }); }
});

// AUTH (BARBER): create a service for own shop AND auto-assign to self
router.post('/by-barber', authenticateBarber, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, duration_minutes, category, is_home_service } = req.body;
    if (!name || !price) return res.status(400).json({ message: 'Name and price required' });
    const barber = await pool.query('SELECT barbershop_id FROM barbers WHERE id = $1', [req.user.id]);
    if (!barber.rows.length) return res.status(404).json({ message: 'Barber not found' });
    const shopId = barber.rows[0].barbershop_id;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO services (barbershop_id, name, description, price, duration_minutes, category, image_url, is_home_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [shopId, name, description || null, parseFloat(price), parseInt(duration_minutes) || 30,
       category || 'haircut', image_url, is_home_service === 'true' || is_home_service === true]
    );
    await pool.query('INSERT INTO barber_services (barber_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, result.rows[0].id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (BARBER): delete service I own (only if no other barbers offer it and no appointments)
router.delete('/by-barber/:id', authenticateBarber, async (req, res) => {
  try {
    const barber = await pool.query('SELECT barbershop_id FROM barbers WHERE id = $1', [req.user.id]);
    const shopId = barber.rows[0].barbershop_id;
    const owns = await pool.query('SELECT 1 FROM services WHERE id = $1 AND barbershop_id = $2', [req.params.id, shopId]);
    if (!owns.rows.length) return res.status(404).json({ message: 'Not found' });
    const result = await pool.query('DELETE FROM services WHERE id = $1 RETURNING id', [req.params.id]);
    res.json({ message: 'Deleted', id: result.rows[0]?.id });
  } catch (err) { res.status(500).json({ message: 'Cannot delete (may have appointments)' }); }
});

module.exports = router;
