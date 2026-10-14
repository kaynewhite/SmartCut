const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop, authenticateBarber, authenticateBarbershopOrBarber } = require('../middleware/auth');
const { resolveActingBarberId } = require('../utils/soloBarber');

const SERVICE_CATEGORIES = new Set(['haircut', 'beard', 'shave', 'color', 'treatment', 'kids', 'massage', 'other']);

function normalizeCategory(category) {
  const normalized = String(category || 'haircut').trim().toLowerCase();
  return normalized === 'coloring' ? 'color' : normalized;
}

function isValidCategory(category) {
  return SERVICE_CATEGORIES.has(normalizeCategory(category));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `svc_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: list services for a shop (only priced + active)
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    if (!barbershop_id) return res.json([]);
    const result = await pool.query(
      `SELECT s.*, b.name as barber_name, b.id as barber_id_creator
       FROM services s
       LEFT JOIN barbers b ON b.id = s.created_by_barber_id
       WHERE s.barbershop_id = $1 AND s.is_active = true AND s.price IS NOT NULL
       ORDER BY s.created_by_barber_id, s.id`,
      [barbershop_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: get services for a specific barber (for booking flow)
router.get('/by-barber/:barberId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.* FROM services s
       JOIN barber_services bs ON bs.service_id = s.id
       WHERE bs.barber_id = $1 AND s.is_active = true AND s.price IS NOT NULL
       ORDER BY s.id`,
      [req.params.barberId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// BARBER (or solo shop owner) AUTH: list my own services (all statuses)
router.get('/mine', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const barberId = await resolveActingBarberId(req);
    const result = await pool.query(
      `SELECT s.* FROM services s
       WHERE s.created_by_barber_id = $1
       ORDER BY s.id`,
      [barberId]
    );
    res.json(result.rows);
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// BARBER (or solo shop owner) AUTH: all services in my shop (to toggle which I offer)
router.get('/shop-all', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const barberId = await resolveActingBarberId(req);
    const barber = await pool.query('SELECT barbershop_id FROM barbers WHERE id = $1', [barberId]);
    if (!barber.rows.length) return res.status(404).json({ message: 'Barber not found' });
    const result = await pool.query(
      'SELECT * FROM services WHERE barbershop_id = $1 ORDER BY id',
      [barber.rows[0].barbershop_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// BARBER (or solo shop owner) AUTH: create service (sets name, description, price, image)
router.post('/by-barber', authenticateBarbershopOrBarber, upload.single('image'), async (req, res) => {
  try {
    const barberId = await resolveActingBarberId(req);
    const { name, description, price, category, is_home_service } = req.body;
    if (!name) return res.status(400).json({ message: 'Service name required' });
    if (!price) return res.status(400).json({ message: 'Price is required' });
    if (category && !isValidCategory(category)) return res.status(400).json({ message: 'Choose a valid service category' });
    const barber = await pool.query('SELECT barbershop_id FROM barbers WHERE id = $1', [barberId]);
    if (!barber.rows.length) return res.status(404).json({ message: 'Barber not found' });
    const shopId = barber.rows[0].barbershop_id;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO services (barbershop_id, name, description, price, duration_minutes, category, image_url, is_home_service, created_by_barber_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
      [shopId, name.trim(), description || null, parseFloat(price),
       30, normalizeCategory(category), image_url,
       is_home_service === 'true' || is_home_service === true, barberId]
    );
    await pool.query(
      'INSERT INTO barber_services (barber_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [barberId, result.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// BARBER (or solo shop owner) AUTH: update own service
router.put('/by-barber/:id', authenticateBarbershopOrBarber, upload.single('image'), async (req, res) => {
  try {
    const barberId = await resolveActingBarberId(req);
    const { name, description, price, category, is_active, is_home_service } = req.body;
    if (category !== undefined && !isValidCategory(category)) return res.status(400).json({ message: 'Choose a valid service category' });
    const existing = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND created_by_barber_id = $2',
      [req.params.id, barberId]
    );
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found or not your service' });
    const old = existing.rows[0];
    const image_url = req.file ? `/uploads/${req.file.filename}` : old.image_url;
    const result = await pool.query(
      `UPDATE services SET name=$1, description=$2, price=$3, duration_minutes=$4, category=$5, image_url=$6, is_active=$7, is_home_service=$8
       WHERE id=$9 AND created_by_barber_id=$10 RETURNING *`,
      [name || old.name, description ?? old.description,
       price ? parseFloat(price) : old.price,
       30,
       category !== undefined ? normalizeCategory(category) : old.category, image_url,
       is_active !== undefined ? (is_active === 'true' || is_active === true) : old.is_active,
       is_home_service !== undefined ? (is_home_service === 'true' || is_home_service === true) : old.is_home_service,
       req.params.id, barberId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Server error' });
  }
});

// BARBER (or solo shop owner) AUTH: delete own service
router.delete('/by-barber/:id', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const barberId = await resolveActingBarberId(req);
    const result = await pool.query(
      'DELETE FROM services WHERE id = $1 AND created_by_barber_id = $2 RETURNING id',
      [req.params.id, barberId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found or not your service' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ message: err.message });
    res.status(500).json({ message: 'Cannot delete (may have appointments)' });
  }
});

// SHOP OWNER: list all services (legacy view)
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, b.name as barber_name FROM services s
       LEFT JOIN barbers b ON b.id = s.created_by_barber_id
       WHERE s.barbershop_id = $1 ORDER BY s.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP OWNER: update pricing, category, and visibility for a service in this shop
router.put('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const { price, category, is_active } = req.body;
    if (category !== undefined && !isValidCategory(category)) {
      return res.status(400).json({ message: 'Choose a valid service category' });
    }
    if (price !== undefined && price !== '' && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
      return res.status(400).json({ message: 'Price must be greater than 0' });
    }
    const existing = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND barbershop_id = $2',
      [req.params.id, req.user.id]
    );
    if (!existing.rows.length) return res.status(404).json({ message: 'Service not found in your shop' });
    const old = existing.rows[0];
    const result = await pool.query(
      `UPDATE services
       SET price=$1, duration_minutes=30, category=$2, is_active=$3
       WHERE id=$4 AND barbershop_id=$5
       RETURNING *`,
      [
        price !== undefined && price !== '' ? Number(price) : old.price,
        category !== undefined ? normalizeCategory(category) : normalizeCategory(old.category),
        is_active !== undefined ? (is_active === true || is_active === 'true') : old.is_active,
        req.params.id,
        req.user.id
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// SHOP OWNER: upload an image for a service in this shop
router.post('/:id/image', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    const imageUrl = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      'UPDATE services SET image_url=$1 WHERE id=$2 AND barbershop_id=$3 RETURNING *',
      [imageUrl, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Service not found in your shop' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
