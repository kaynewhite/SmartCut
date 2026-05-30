const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: list barbershops — only active + subscribed
router.get('/', async (req, res) => {
  try {
    const { search, city, specialty, max_price } = req.query;
    let query = `
      SELECT b.*,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) as avg_rating,
        COUNT(DISTINCT r.id) as review_count,
        (SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) as min_price
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      WHERE b.is_active = true AND b.subscription_status = 'active'
    `;
    const params = [];
    if (search) { params.push(`%${search}%`); query += ` AND b.name ILIKE $${params.length}`; }
    if (city) { params.push(`%${city}%`); query += ` AND b.city ILIKE $${params.length}`; }
    if (specialty) {
      params.push(`%${specialty}%`);
      query += ` AND b.id IN (SELECT bp.barbershop_id FROM barbers bp JOIN barber_specialties bs ON bs.barber_id = bp.id WHERE bs.specialty ILIKE $${params.length})`;
    }
    query += ' GROUP BY b.id';
    if (max_price) { params.push(max_price); query += ` HAVING (SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) <= $${params.length}`; }
    query += ' ORDER BY avg_rating DESC, review_count DESC';
    const result = await pool.query(query, params);
    const rows = result.rows.map(r => { delete r.password; return r; });
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: get one barbershop with services + barbers + restriction info
router.get('/:id', async (req, res) => {
  try {
    const shopRes = await pool.query(`
      SELECT b.*, COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) as avg_rating, COUNT(DISTINCT r.id) as review_count
      FROM barbershops b LEFT JOIN ratings r ON r.barbershop_id = b.id
      WHERE b.id = $1 GROUP BY b.id
    `, [req.params.id]);
    if (!shopRes.rows.length) return res.status(404).json({ message: 'Not found' });
    const shop = shopRes.rows[0];
    delete shop.password;

    const servicesRes = await pool.query(
      `SELECT s.*, b.name as barber_name FROM services s
       LEFT JOIN barbers b ON b.id = s.created_by_barber_id
       WHERE s.barbershop_id = $1 AND s.is_active = true AND s.price IS NOT NULL ORDER BY s.id`,
      [req.params.id]
    );
    const barbersRes = await pool.query(`
      SELECT b.id, b.barbershop_id, b.name, b.phone, b.photo_url, b.bio, b.is_available, b.rating, b.total_cuts,
        COALESCE(AVG(r.barber_rating), 0)::numeric(3,2) as avg_rating,
        ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id = b.id) as specialties,
        ARRAY(
          SELECT json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', s.duration_minutes)
          FROM services s JOIN barber_services bs ON bs.service_id = s.id
          WHERE bs.barber_id = b.id AND s.is_active = true AND s.price IS NOT NULL
        ) as services
      FROM barbers b LEFT JOIN ratings r ON r.barber_id = b.id
      WHERE b.barbershop_id = $1 GROUP BY b.id ORDER BY b.is_available DESC, b.id
    `, [req.params.id]);

    const reviewsRes = await pool.query(`
      SELECT r.id, r.barbershop_rating, r.barber_rating, r.comment, r.created_at,
        c.name as customer_name, b.name as barber_name
      FROM ratings r
      LEFT JOIN customers c ON c.id = r.customer_id
      LEFT JOIN barbers b ON b.id = r.barber_id
      WHERE r.barbershop_id = $1
      ORDER BY r.created_at DESC LIMIT 100
    `, [req.params.id]);

    res.json({ shop, services: servicesRes.rows, barbers: barbersRes.rows, reviews: reviewsRes.rows });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: get own profile (includes restriction info for the shop owner)
router.get('/me/profile', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    const shop = result.rows[0]; delete shop.password;
    res.json(shop);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update profile (basic info only)
router.put('/me/profile', authenticateBarbershop, async (req, res) => {
  try {
    const { name, phone, address, city, description, opening_time, closing_time, latitude, longitude } = req.body;
    const result = await pool.query(
      `UPDATE barbershops SET name=$1, phone=$2, address=$3, city=$4, description=$5, opening_time=$6, closing_time=$7, latitude=$8, longitude=$9
       WHERE id=$10 RETURNING *`,
      [name, phone, address, city, description, opening_time || '08:00', closing_time || '20:00',
       latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, req.user.id]
    );
    const shop = result.rows[0]; delete shop.password;
    res.json(shop);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: update loyalty settings
router.put('/me/loyalty-settings', authenticateBarbershop, async (req, res) => {
  try {
    const { loyalty_points_per_appointment, loyalty_streak_bonus, loyalty_streak_every } = req.body;
    const pts = Math.max(0, parseInt(loyalty_points_per_appointment) || 1);
    const bonus = Math.max(0, parseInt(loyalty_streak_bonus) || 0);
    const every = Math.max(1, parseInt(loyalty_streak_every) || 5);
    const result = await pool.query(
      `UPDATE barbershops SET loyalty_points_per_appointment=$1, loyalty_streak_bonus=$2, loyalty_streak_every=$3 WHERE id=$4 RETURNING *`,
      [pts, bonus, every, req.user.id]
    );
    const shop = result.rows[0]; delete shop.password;
    res.json(shop);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: submit appeal (when restricted)
router.post('/me/appeal', authenticateBarbershop, async (req, res) => {
  try {
    const shop = await pool.query('SELECT is_active, appeal_status FROM barbershops WHERE id=$1', [req.user.id]);
    if (!shop.rows.length) return res.status(404).json({ message: 'Not found' });
    if (shop.rows[0].is_active) return res.status(400).json({ message: 'Your shop is not restricted' });
    if (shop.rows[0].appeal_status === 'pending') return res.status(400).json({ message: 'An appeal is already pending review' });

    const { appeal_text } = req.body;
    if (!appeal_text?.trim()) return res.status(400).json({ message: 'Please provide an appeal message' });

    await pool.query(
      `UPDATE barbershops SET appeal_text=$1, appeal_status='pending' WHERE id=$2`,
      [appeal_text.trim(), req.user.id]
    );

    // Notify admin(s)
    const admins = await pool.query('SELECT id FROM admins LIMIT 5');
    for (const admin of admins.rows) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('admin',$1,'📋 Barbershop Appeal Submitted',$2,'restriction')`,
        [admin.id, `A barbershop has submitted an appeal. Review it in the Admin → Barbershops → Appeals section.`]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: upload logo
router.post('/me/logo', authenticateBarbershop, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE barbershops SET logo_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ logo_url: url });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: upload cover
router.post('/me/cover', authenticateBarbershop, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE barbershops SET cover_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ cover_url: url });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
