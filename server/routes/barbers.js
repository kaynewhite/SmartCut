const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `barber_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: get barbers for a barbershop (used by booking)
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    let query = `
      SELECT b.*, COALESCE(AVG(r.barber_rating), 0)::numeric(3,2) as avg_rating
      FROM barbers b LEFT JOIN ratings r ON r.barber_id = b.id
    `;
    const params = [];
    if (barbershop_id) { params.push(barbershop_id); query += ` WHERE b.barbershop_id = $1`; }
    query += ' GROUP BY b.id ORDER BY b.id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    // For owner: return their own barbers
    try {
      const { authenticateBarbershop } = require('../middleware/auth');
    } catch {}
    res.status(500).json({ message: 'Server error' });
  }
});

// AUTH: get my barbershop's barbers
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, COALESCE(AVG(r.barber_rating), 0)::numeric(3,2) as avg_rating,
        ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id = b.id) as specialties
      FROM barbers b LEFT JOIN ratings r ON r.barber_id = b.id
      WHERE b.barbershop_id = $1 GROUP BY b.id ORDER BY b.id
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: create barber
router.post('/', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, bio, specialties } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      'INSERT INTO barbers (barbershop_id, name, phone, bio, photo_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, name, phone || null, bio || null, photo_url]
    );
    const barber = result.rows[0];
    if (specialties) {
      const list = typeof specialties === 'string' ? specialties.split(',').map(s => s.trim()).filter(Boolean) : specialties;
      for (const sp of list) {
        await pool.query('INSERT INTO barber_specialties (barber_id, specialty) VALUES ($1,$2)', [barber.id, sp]);
      }
    }
    res.status(201).json(barber);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update barber
router.put('/:id', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, bio, is_available, specialties } = req.body;
    const existing = await pool.query('SELECT * FROM barbers WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].photo_url;
    const result = await pool.query(
      `UPDATE barbers SET name=$1, phone=$2, bio=$3, photo_url=$4, is_available=$5 WHERE id=$6 AND barbershop_id=$7 RETURNING *`,
      [name || existing.rows[0].name, phone ?? existing.rows[0].phone, bio ?? existing.rows[0].bio, photo_url,
       is_available !== undefined ? (is_available === 'true' || is_available === true) : existing.rows[0].is_available,
       req.params.id, req.user.id]
    );
    if (specialties !== undefined) {
      await pool.query('DELETE FROM barber_specialties WHERE barber_id = $1', [req.params.id]);
      const list = typeof specialties === 'string' ? specialties.split(',').map(s => s.trim()).filter(Boolean) : specialties;
      for (const sp of (list || [])) {
        await pool.query('INSERT INTO barber_specialties (barber_id, specialty) VALUES ($1,$2)', [req.params.id, sp]);
      }
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: toggle availability
router.patch('/:id/toggle', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE barbers SET is_available = NOT is_available WHERE id = $1 AND barbershop_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: delete barber
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM barbers WHERE id = $1 AND barbershop_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: 'Cannot delete (may have appointments)' }); }
});

module.exports = router;
