const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop, authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get all barbershops (public, for recommendation/explore)
router.get('/', async (req, res) => {
  try {
    const { city, service, minPrice, maxPrice, search } = req.query;
    let query = `
      SELECT b.id, b.name, b.address, b.city, b.description, b.logo_url, b.cover_url,
             b.opening_time, b.closing_time, b.is_active,
             COALESCE(AVG(r.barbershop_rating), 0) as avg_rating,
             COUNT(DISTINCT r.id) as review_count
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      WHERE b.is_active = true
    `;
    const params = [];
    let idx = 1;
    if (city) { query += ` AND LOWER(b.city) LIKE LOWER($${idx++})`; params.push(`%${city}%`); }
    if (search) { query += ` AND (LOWER(b.name) LIKE LOWER($${idx++}) OR LOWER(b.description) LIKE LOWER($${idx++}))`; params.push(`%${search}%`, `%${search}%`); }
    query += ` GROUP BY b.id ORDER BY avg_rating DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single barbershop (public)
router.get('/:id', async (req, res) => {
  try {
    const shop = await pool.query(
      `SELECT b.*, COALESCE(AVG(r.barbershop_rating), 0) as avg_rating, COUNT(DISTINCT r.id) as review_count
       FROM barbershops b LEFT JOIN ratings r ON r.barbershop_id = b.id
       WHERE b.id = $1 GROUP BY b.id`,
      [req.params.id]
    );
    if (shop.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const barbers = await pool.query(
      `SELECT bar.*, COALESCE(AVG(r.barber_rating), 0) as avg_rating,
              ARRAY_AGG(bs.specialty) FILTER (WHERE bs.specialty IS NOT NULL) as specialties
       FROM barbers bar
       LEFT JOIN ratings r ON r.barber_id = bar.id
       LEFT JOIN barber_specialties bs ON bs.barber_id = bar.id
       WHERE bar.barbershop_id = $1
       GROUP BY bar.id ORDER BY bar.name`,
      [req.params.id]
    );
    const services = await pool.query(
      'SELECT * FROM services WHERE barbershop_id = $1 AND is_active = true ORDER BY category, name',
      [req.params.id]
    );
    const reviews = await pool.query(
      `SELECT r.*, c.name as customer_name FROM ratings r
       JOIN customers c ON c.id = r.customer_id
       WHERE r.barbershop_id = $1 ORDER BY r.created_at DESC LIMIT 10`,
      [req.params.id]
    );
    const { password: _, ...shopSafe } = shop.rows[0];
    res.json({ shop: shopSafe, barbers: barbers.rows, services: services.rows, reviews: reviews.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my barbershop profile
router.get('/me/profile', authenticateBarbershop, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM barbershops WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const { password: _, ...shopSafe } = result.rows[0];
    res.json(shopSafe);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update barbershop profile
router.put('/me/profile', authenticateBarbershop, async (req, res) => {
  const { name, phone, address, city, description, opening_time, closing_time } = req.body;
  try {
    const result = await pool.query(
      `UPDATE barbershops SET name=COALESCE($1,name), phone=COALESCE($2,phone),
       address=COALESCE($3,address), city=COALESCE($4,city), description=COALESCE($5,description),
       opening_time=COALESCE($6,opening_time), closing_time=COALESCE($7,closing_time)
       WHERE id=$8 RETURNING *`,
      [name, phone, address, city, description, opening_time, closing_time, req.user.id]
    );
    const { password: _, ...shopSafe } = result.rows[0];
    res.json(shopSafe);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload QR code
router.post('/me/qr-code', authenticateBarbershop, upload.single('qr_code'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE barbershops SET qr_code_url=$1 WHERE id=$2', [url, req.user.id]);
    res.json({ qr_code_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload logo
router.post('/me/logo', authenticateBarbershop, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE barbershops SET logo_url=$1 WHERE id=$2', [url, req.user.id]);
    res.json({ logo_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload cover
router.post('/me/cover', authenticateBarbershop, upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  try {
    await pool.query('UPDATE barbershops SET cover_url=$1 WHERE id=$2', [url, req.user.id]);
    res.json({ cover_url: url });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard stats
router.get('/me/dashboard', authenticateBarbershop, async (req, res) => {
  try {
    const shopId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const totalToday = await pool.query(
      `SELECT COUNT(*) FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status != 'cancelled'`,
      [shopId, today]
    );
    const totalRevenue = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) as revenue FROM appointments WHERE barbershop_id=$1 AND payment_status='paid'`,
      [shopId]
    );
    const avgRating = await pool.query(
      `SELECT COALESCE(AVG(barbershop_rating),0) as avg FROM ratings WHERE barbershop_id=$1`,
      [shopId]
    );
    const topServices = await pool.query(
      `SELECT s.name, COUNT(a.id) as count FROM appointments a JOIN services s ON s.id=a.service_id
       WHERE a.barbershop_id=$1 GROUP BY s.name ORDER BY count DESC LIMIT 5`,
      [shopId]
    );
    const peakHours = await pool.query(
      `SELECT EXTRACT(HOUR FROM appointment_time) as hour, COUNT(*) as count
       FROM appointments WHERE barbershop_id=$1 AND status != 'cancelled'
       GROUP BY hour ORDER BY hour`,
      [shopId]
    );
    const monthlyRevenue = await pool.query(
      `SELECT TO_CHAR(appointment_date, 'Mon') as month, COALESCE(SUM(total_amount),0) as revenue
       FROM appointments WHERE barbershop_id=$1 AND payment_status='paid'
       AND appointment_date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(appointment_date, 'Mon'), DATE_TRUNC('month', appointment_date)
       ORDER BY DATE_TRUNC('month', appointment_date)`,
      [shopId]
    );
    const queueCount = await pool.query(
      `SELECT COUNT(*) FROM walk_ins WHERE barbershop_id=$1 AND status='waiting'`,
      [shopId]
    );

    res.json({
      today_appointments: parseInt(totalToday.rows[0].count),
      total_revenue: parseFloat(totalRevenue.rows[0].revenue),
      avg_rating: parseFloat(avgRating.rows[0].avg).toFixed(1),
      top_services: topServices.rows,
      peak_hours: peakHours.rows,
      monthly_revenue: monthlyRevenue.rows,
      queue_count: parseInt(queueCount.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
