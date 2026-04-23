const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateCustomer, authenticateBarbershop, authenticate } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `proof_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// CUSTOMER: book appointment
router.post('/', authenticateCustomer, async (req, res) => {
  const { barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes } = req.body;
  if (!barbershop_id || !service_id || !appointment_date || !appointment_time) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const svc = await pool.query('SELECT price FROM services WHERE id = $1', [service_id]);
    if (!svc.rows.length) return res.status(404).json({ message: 'Service not found' });

    const lastQ = await pool.query(
      'SELECT COALESCE(MAX(queue_number), 0) + 1 as q FROM appointments WHERE barbershop_id = $1 AND appointment_date = $2',
      [barbershop_id, appointment_date]
    );
    const queue_number = lastQ.rows[0].q;

    const result = await pool.query(
      `INSERT INTO appointments (customer_id, barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes, total_amount, queue_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, service_id, appointment_date, appointment_time,
       !!is_home_service, home_address || null, notes || null, svc.rows[0].price, queue_number]
    );
    // notify barbershop
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,$2,$3,'new_appointment',$4)`,
      [barbershop_id, 'New appointment', `New booking on ${appointment_date} at ${appointment_time}`, result.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AVAILABLE SLOTS
router.get('/available-slots', async (req, res) => {
  try {
    const { barbershop_id, barber_id, date } = req.query;
    if (!barbershop_id || !date) return res.json({ booked_slots: [] });
    let query = `SELECT appointment_time FROM appointments WHERE barbershop_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')`;
    const params = [barbershop_id, date];
    if (barber_id) { params.push(barber_id); query += ` AND barber_id = $3`; }
    const result = await pool.query(query, params);
    const booked_slots = result.rows.map(r => r.appointment_time?.substring(0,5));
    res.json({ booked_slots });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: my appointments
router.get('/my', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo,
        s.name as service_name, s.duration_minutes,
        br.name as barber_name
      FROM appointments a
      LEFT JOIN barbershops b ON b.id = a.barbershop_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.customer_id = $1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: history (completed only)
router.get('/history', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as barbershop_name, b.logo_url as barbershop_logo,
        s.name as service_name, br.name as barber_name,
        r.barbershop_rating, r.barber_rating, r.comment
      FROM appointments a
      LEFT JOIN barbershops b ON b.id = a.barbershop_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      LEFT JOIN ratings r ON r.appointment_id = a.id
      WHERE a.customer_id = $1 AND a.status = 'completed'
      ORDER BY a.appointment_date DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP: list shop appointments (with optional date filter)
router.get('/shop', authenticateBarbershop, async (req, res) => {
  try {
    const { date, status } = req.query;
    let query = `
      SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.avatar_url as customer_avatar,
        s.name as service_name, br.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.barbershop_id = $1
    `;
    const params = [req.user.id];
    if (date) { params.push(date); query += ` AND a.appointment_date = $${params.length}`; }
    if (status) { params.push(status); query += ` AND a.status = $${params.length}`; }
    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// SHOP: dashboard stats
router.get('/shop/stats', authenticateBarbershop, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2`, [req.user.id, today]);
    const totalRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM appointments WHERE barbershop_id=$1`, [req.user.id]);
    const ratingRes = await pool.query(`SELECT COALESCE(AVG(barbershop_rating),0)::numeric(3,2) as avg FROM ratings WHERE barbershop_id=$1`, [req.user.id]);
    const queueRes = await pool.query(`SELECT COUNT(*) as count FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status IN ('pending','confirmed','in_progress')`, [req.user.id, today]);
    // last 7 days revenue
    const weekRes = await pool.query(`
      SELECT appointment_date as date, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue, COUNT(*)::int as bookings
      FROM appointments WHERE barbershop_id=$1 AND appointment_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY appointment_date ORDER BY appointment_date
    `, [req.user.id]);
    res.json({
      today_bookings: parseInt(todayRes.rows[0].count),
      today_revenue: parseFloat(todayRes.rows[0].revenue),
      total_bookings: parseInt(totalRes.rows[0].count),
      total_revenue: parseFloat(totalRes.rows[0].revenue),
      avg_rating: parseFloat(ratingRes.rows[0].avg),
      in_queue: parseInt(queueRes.rows[0].count),
      weekly: weekRes.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: cancel appointment
router.patch('/:id/cancel', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND customer_id = $2 AND status IN ('pending','confirmed') RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(400).json({ message: 'Cannot cancel' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: upload payment proof
router.post('/:id/payment-proof', authenticateCustomer, upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const { payment_method } = req.body;
    const url = `/uploads/${req.file.filename}`;
    const notes_addon = payment_method ? `\n[Payment via: ${payment_method}]` : '';
    const result = await pool.query(
      `UPDATE appointments SET payment_proof_url = $1, payment_status = 'pending_verification',
       notes = COALESCE(notes,'') || $2 WHERE id = $3 AND customer_id = $4 RETURNING *`,
      [url, notes_addon, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    // notify barbershop
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,'Payment proof submitted',$2,'payment_proof',$3)`,
      [result.rows[0].barbershop_id, `Payment proof uploaded for appointment #${req.params.id}${payment_method ? ' via ' + payment_method : ''}`, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// SHOP: verify payment
router.patch('/:id/verify-payment', authenticateBarbershop, async (req, res) => {
  try {
    const { approved } = req.body;
    const status = approved === false ? 'unpaid' : 'paid';
    const result = await pool.query(
      `UPDATE appointments SET payment_status = $1, status = CASE WHEN $1='paid' AND status='pending' THEN 'confirmed' ELSE status END
       WHERE id = $2 AND barbershop_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,$2,$3,'payment_verified',$4)`,
      [result.rows[0].customer_id, status === 'paid' ? 'Payment confirmed' : 'Payment rejected',
       status === 'paid' ? 'Your payment was verified successfully' : 'Please re-upload your payment proof', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP: update appointment status
router.patch('/:id/status', authenticateBarbershop, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const result = await pool.query(
      `UPDATE appointments SET status = $1 WHERE id = $2 AND barbershop_id = $3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    // award loyalty points on completion
    if (status === 'completed' && result.rows[0].customer_id) {
      const points = 10;
      await pool.query('UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2', [points, result.rows[0].customer_id]);
      await pool.query(`INSERT INTO loyalty_transactions (customer_id, points, type, description) VALUES ($1,$2,'earned',$3)`,
        [result.rows[0].customer_id, points, `Completed appointment #${req.params.id}`]);
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
