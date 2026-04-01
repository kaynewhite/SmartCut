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

// Get all barbers for barbershop
router.get('/', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bar.*, COALESCE(AVG(r.barber_rating), 0) as avg_rating,
              ARRAY_AGG(bs.specialty) FILTER (WHERE bs.specialty IS NOT NULL) as specialties
       FROM barbers bar
       LEFT JOIN ratings r ON r.barber_id = bar.id
       LEFT JOIN barber_specialties bs ON bs.barber_id = bar.id
       WHERE bar.barbershop_id = $1
       GROUP BY bar.id ORDER BY bar.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add barber
router.post('/', authenticateBarbershop, async (req, res) => {
  const { name, phone, bio, specialties } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  try {
    const result = await pool.query(
      'INSERT INTO barbers (barbershop_id, name, phone, bio) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, name, phone || null, bio || null]
    );
    const barber = result.rows[0];
    if (specialties && specialties.length > 0) {
      for (const sp of specialties) {
        await pool.query('INSERT INTO barber_specialties (barber_id, specialty) VALUES ($1,$2)', [barber.id, sp]);
      }
    }
    res.status(201).json(barber);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update barber
router.put('/:id', authenticateBarbershop, async (req, res) => {
  const { name, phone, bio, is_available, specialties } = req.body;
  try {
    const own = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const result = await pool.query(
      `UPDATE barbers SET name=COALESCE($1,name), phone=COALESCE($2,phone), bio=COALESCE($3,bio),
       is_available=COALESCE($4,is_available) WHERE id=$5 RETURNING *`,
      [name, phone, bio, is_available, req.params.id]
    );
    if (specialties) {
      await pool.query('DELETE FROM barber_specialties WHERE barber_id=$1', [req.params.id]);
      for (const sp of specialties) {
        await pool.query('INSERT INTO barber_specialties (barber_id, specialty) VALUES ($1,$2)', [req.params.id, sp]);
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload barber photo
router.post('/:id/photo', authenticateBarbershop, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const own = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    const url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE barbers SET photo_url=$1 WHERE id=$2', [url, req.params.id]);
    res.json({ photo_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete barber
router.delete('/:id', authenticateBarbershop, async (req, res) => {
  try {
    const own = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(403).json({ message: 'Forbidden' });
    await pool.query('DELETE FROM barbers WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barber schedule
router.get('/:id/schedule', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barber_schedules WHERE barber_id=$1 ORDER BY day_of_week', [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Set barber schedule
router.post('/:id/schedule', authenticateBarbershop, async (req, res) => {
  const { schedules } = req.body;
  try {
    await pool.query('DELETE FROM barber_schedules WHERE barber_id=$1', [req.params.id]);
    for (const s of schedules) {
      await pool.query(
        'INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time, is_available) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, s.day_of_week, s.start_time, s.end_time, s.is_available !== false]
      );
    }
    res.json({ message: 'Schedule updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
