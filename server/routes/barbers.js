const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop, authenticateBarber } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `barber_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: get barbers for a barbershop with their services & specialties
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    let query = `
      SELECT b.id, b.barbershop_id, b.name, b.phone, b.photo_url, b.bio, b.is_available, b.rating, b.total_cuts,
        COALESCE(AVG(r.barber_rating), 0)::numeric(3,2) as avg_rating,
        COUNT(DISTINCT r.id) as review_count,
        ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id = b.id) as specialties,
        ARRAY(SELECT service_id FROM barber_services WHERE barber_id = b.id) as service_ids
      FROM barbers b LEFT JOIN ratings r ON r.barber_id = b.id
    `;
    const params = [];
    if (barbershop_id) { params.push(barbershop_id); query += ` WHERE b.barbershop_id = $1`; }
    query += ' GROUP BY b.id ORDER BY b.id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: get all unique specialties (for explore dropdown)
router.get('/specialties', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT specialty FROM barber_specialties ORDER BY specialty');
    res.json(result.rows.map(r => r.specialty));
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: get my barbershop's barbers (owner)
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.barbershop_id, b.name, b.phone, b.email, b.photo_url, b.bio, b.is_available, b.rating, b.total_cuts,
        (b.password IS NOT NULL) as has_account,
        COALESCE(AVG(r.barber_rating), 0)::numeric(3,2) as avg_rating,
        ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id = b.id) as specialties,
        ARRAY(SELECT service_id FROM barber_services WHERE barber_id = b.id) as service_ids
      FROM barbers b LEFT JOIN ratings r ON r.barber_id = b.id
      WHERE b.barbershop_id = $1 GROUP BY b.id ORDER BY b.id
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (BARBER): get own profile
router.get('/me/profile', authenticateBarber, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, bs.name as barbershop_name,
        ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id = b.id) as specialties,
        ARRAY(SELECT service_id FROM barber_services WHERE barber_id = b.id) as service_ids
      FROM barbers b LEFT JOIN barbershops bs ON bs.id = b.barbershop_id
      WHERE b.id = $1
    `, [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    const barber = result.rows[0];
    delete barber.password;
    res.json(barber);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (BARBER): update own profile (bio, specialties, services they offer)
router.put('/me/profile', authenticateBarber, upload.single('photo'), async (req, res) => {
  try {
    const { bio, phone, specialties, service_ids } = req.body;
    const existing = await pool.query('SELECT * FROM barbers WHERE id = $1', [req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].photo_url;
    await pool.query(
      `UPDATE barbers SET bio=$1, phone=$2, photo_url=$3 WHERE id=$4`,
      [bio ?? existing.rows[0].bio, phone ?? existing.rows[0].phone, photo_url, req.user.id]
    );
    if (specialties !== undefined) {
      await pool.query('DELETE FROM barber_specialties WHERE barber_id = $1', [req.user.id]);
      const list = typeof specialties === 'string' ? JSON.parse(specialties || '[]') : (specialties || []);
      for (const sp of list) {
        if (sp && sp.trim()) await pool.query('INSERT INTO barber_specialties (barber_id, specialty) VALUES ($1,$2)', [req.user.id, sp.trim()]);
      }
    }
    if (service_ids !== undefined) {
      await pool.query('DELETE FROM barber_services WHERE barber_id = $1', [req.user.id]);
      const list = typeof service_ids === 'string' ? JSON.parse(service_ids || '[]') : (service_ids || []);
      for (const sid of list) {
        await pool.query('INSERT INTO barber_services (barber_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, sid]);
      }
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (BARBER): toggle own availability
router.patch('/me/toggle', authenticateBarber, async (req, res) => {
  try {
    const result = await pool.query('UPDATE barbers SET is_available = NOT is_available WHERE id = $1 RETURNING *', [req.user.id]);
    delete result.rows[0].password;
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): create barber with optional login credentials
router.post('/', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, bio, email, password, specialties } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    let hashedPwd = null;
    let normalizedEmail = null;
    if (email) {
      normalizedEmail = email.toLowerCase().trim();
      const existing = await pool.query('SELECT id FROM barbers WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length) return res.status(400).json({ message: 'Email already used by another barber' });
      if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      hashedPwd = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      'INSERT INTO barbers (barbershop_id, name, phone, bio, photo_url, email, password) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, barbershop_id, name, phone, bio, photo_url, email, is_available',
      [req.user.id, name, phone || null, bio || null, photo_url, normalizedEmail, hashedPwd]
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

// AUTH (OWNER): update barber + reset login
router.put('/:id', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, bio, is_available, specialties, email, password } = req.body;
    const existing = await pool.query('SELECT * FROM barbers WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].photo_url;

    let updateEmail = existing.rows[0].email;
    let updatePassword = existing.rows[0].password;
    if (email !== undefined) {
      const normalized = email ? email.toLowerCase().trim() : null;
      if (normalized && normalized !== existing.rows[0].email) {
        const conflict = await pool.query('SELECT id FROM barbers WHERE email = $1 AND id <> $2', [normalized, req.params.id]);
        if (conflict.rows.length) return res.status(400).json({ message: 'Email already used' });
      }
      updateEmail = normalized;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      updatePassword = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE barbers SET name=$1, phone=$2, bio=$3, photo_url=$4, is_available=$5, email=$6, password=$7
       WHERE id=$8 AND barbershop_id=$9 RETURNING id, barbershop_id, name, phone, bio, photo_url, email, is_available`,
      [name || existing.rows[0].name, phone ?? existing.rows[0].phone, bio ?? existing.rows[0].bio, photo_url,
       is_available !== undefined ? (is_available === 'true' || is_available === true) : existing.rows[0].is_available,
       updateEmail, updatePassword,
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

// AUTH: toggle availability (owner)
router.patch('/:id/toggle', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE barbers SET is_available = NOT is_available WHERE id = $1 AND barbershop_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    delete result.rows[0].password;
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
