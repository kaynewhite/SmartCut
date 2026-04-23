const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateCustomer, authenticateBarbershop, authenticateBarber, authenticateBarbershopOrBarber } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `proof_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const ACTIVE = ['pending','confirmed','in_progress'];

// CUSTOMER: book appointment
router.post('/', authenticateCustomer, async (req, res) => {
  const { barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes } = req.body;
  if (!barbershop_id || !service_id || !appointment_date || !appointment_time) return res.status(400).json({ message: 'Missing required fields' });
  try {
    // 1. Check ban
    const banCheck = await pool.query(
      `SELECT * FROM customer_bans WHERE customer_id = $1 AND barbershop_id = $2 AND (banned_until IS NULL OR banned_until > NOW())`,
      [req.user.id, barbershop_id]
    );
    if (banCheck.rows.length) {
      const b = banCheck.rows[0];
      const msg = b.banned_until ? `Banned until ${new Date(b.banned_until).toLocaleDateString()}: ${b.reason}` : `Permanently banned: ${b.reason}`;
      return res.status(403).json({ message: msg });
    }

    // 2. Enforce one active appointment at a time
    const active = await pool.query(
      `SELECT id FROM appointments WHERE customer_id = $1 AND status = ANY($2)`,
      [req.user.id, ACTIVE]
    );
    if (active.rows.length) return res.status(400).json({ message: 'You already have an active appointment. Please complete or cancel it before booking again.' });

    // 3. Check slot still free
    const slotCheck = await pool.query(
      `SELECT id FROM appointments WHERE barbershop_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status NOT IN ('cancelled','no_show') ${barber_id ? 'AND barber_id = $4' : ''}`,
      barber_id ? [barbershop_id, appointment_date, appointment_time, barber_id] : [barbershop_id, appointment_date, appointment_time]
    );
    if (slotCheck.rows.length) return res.status(400).json({ message: 'That time slot was just taken. Please pick another.' });

    const svc = await pool.query('SELECT price FROM services WHERE id = $1', [service_id]);
    if (!svc.rows.length) return res.status(404).json({ message: 'Service not found' });
    const shop = await pool.query('SELECT downpayment_percent FROM barbershops WHERE id = $1', [barbershop_id]);
    const downpct = shop.rows[0]?.downpayment_percent ?? 25;

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
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,$2,$3,'new_appointment',$4)`,
      [barbershop_id, 'New appointment', `New booking on ${appointment_date} at ${appointment_time}`, result.rows[0].id]
    );
    res.status(201).json({ ...result.rows[0], downpayment_required: parseFloat((svc.rows[0].price * downpct / 100).toFixed(2)), downpayment_percent: downpct });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AVAILABLE SLOTS (auto-release no-show'd slots)
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
      SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo, b.downpayment_percent,
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

// CUSTOMER: history
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

// CUSTOMER: upcoming reminders (for in-app reminder)
router.get('/reminders', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.appointment_date, a.appointment_time, b.name as barbershop_name, s.name as service_name
      FROM appointments a
      LEFT JOIN barbershops b ON b.id = a.barbershop_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.customer_id = $1 AND a.status IN ('pending','confirmed')
        AND (a.appointment_date::timestamp + a.appointment_time::interval) BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
      ORDER BY a.appointment_date, a.appointment_time
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP / BARBER: list shop appointments
router.get('/shop', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { date, status } = req.query;
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    let query = `
      SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.avatar_url as customer_avatar, c.no_show_count as customer_no_show_count, c.rating as customer_rating,
        s.name as service_name, br.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON c.id = a.customer_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN barbers br ON br.id = a.barber_id
      WHERE a.barbershop_id = $1
    `;
    const params = [shopId];
    if (isBarber) { params.push(req.user.id); query += ` AND a.barber_id = $${params.length}`; }
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

// CUSTOMER: upload payment proof (downpayment or full)
router.post('/:id/payment-proof', authenticateCustomer, upload.single('proof'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const { payment_method, amount } = req.body;
    const url = `/uploads/${req.file.filename}`;
    const notes_addon = payment_method ? `\n[Payment via: ${payment_method}${amount ? ' - ₱' + amount : ''}]` : '';
    const result = await pool.query(
      `UPDATE appointments SET payment_proof_url = $1, payment_status = 'pending_verification',
       amount_paid = COALESCE($2, amount_paid),
       notes = COALESCE(notes,'') || $3 WHERE id = $4 AND customer_id = $5 RETURNING *`,
      [url, amount ? parseFloat(amount) : null, notes_addon, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
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

// SHOP/BARBER: update appointment status (incl. no-show)
router.patch('/:id/status', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    const checkQuery = isBarber
      ? 'SELECT * FROM appointments WHERE id = $1 AND barbershop_id = $2 AND barber_id = $3'
      : 'SELECT * FROM appointments WHERE id = $1 AND barbershop_id = $2';
    const checkParams = isBarber ? [req.params.id, shopId, req.user.id] : [req.params.id, shopId];
    const existing = await pool.query(checkQuery, checkParams);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });

    const result = await pool.query('UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);

    if (status === 'completed' && result.rows[0].customer_id) {
      const points = 1;
      const shopId = result.rows[0].barbershop_id;
      const custId = result.rows[0].customer_id;
      await pool.query(
        `INSERT INTO customer_shop_loyalty (customer_id, barbershop_id, points, updated_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (customer_id, barbershop_id) DO UPDATE SET points = customer_shop_loyalty.points + $3, updated_at = NOW()`,
        [custId, shopId, points]
      );
      await pool.query(`INSERT INTO loyalty_transactions (customer_id, barbershop_id, points, type, description) VALUES ($1,$2,$3,'earned',$4)`,
        [custId, shopId, points, `Completed appointment #${req.params.id}`]);
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,'+1 Loyalty Point','You earned 1 loyalty point at this barbershop. Visit the shop page to redeem promos!','loyalty',$2)`,
        [custId, req.params.id]
      );
    }
    if (status === 'no_show' && result.rows[0].customer_id) {
      await pool.query('UPDATE customers SET no_show_count = no_show_count + 1 WHERE id = $1', [result.rows[0].customer_id]);
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,'Marked as No-Show','You missed your appointment. Repeated no-shows may result in a ban.','no_show',$2)`,
        [result.rows[0].customer_id, req.params.id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: top featured services across all shops (for landing/home)
router.get('/top-services', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const result = await pool.query(`
      SELECT s.id, s.name, s.price, s.duration_minutes, s.image_url, s.category, s.barbershop_id,
        b.name as barbershop_name, b.city as barbershop_city, b.logo_url as barbershop_logo,
        COUNT(a.id)::int as booking_count
      FROM services s
      LEFT JOIN appointments a ON a.service_id = s.id AND a.status NOT IN ('cancelled')
      LEFT JOIN barbershops b ON b.id = s.barbershop_id
      WHERE s.is_active = true AND b.is_active = true
      GROUP BY s.id, b.name, b.city, b.logo_url
      ORDER BY booking_count DESC, s.id DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
