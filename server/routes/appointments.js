const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateCustomer, authenticateBarbershop, authenticateBarbershopOrBarber, authenticateBarber } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `proof_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// CUSTOMER: book appointment
router.post('/', authenticateCustomer, async (req, res) => {
  try {
    const { barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes } = req.body;
    if (!barbershop_id || !service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const banCheck = await pool.query(
      `SELECT id FROM customer_bans WHERE customer_id=$1 AND barbershop_id=$2 AND (banned_until IS NULL OR banned_until > NOW())`,
      [req.user.id, barbershop_id]
    );
    if (banCheck.rows.length) return res.status(403).json({ message: 'You are banned from this barbershop' });

    const activeCheck = await pool.query(
      `SELECT id FROM appointments WHERE customer_id=$1 AND barbershop_id=$2 AND status IN ('pending','confirmed','in_progress')`,
      [req.user.id, barbershop_id]
    );
    if (activeCheck.rows.length) return res.status(400).json({ message: 'You already have an active appointment at this shop' });

    const serviceRes = await pool.query('SELECT price FROM services WHERE id=$1', [service_id]);
    if (!serviceRes.rows.length) return res.status(404).json({ message: 'Service not found' });
    const total_amount = serviceRes.rows[0].price;

    const queueRes = await pool.query(
      `SELECT COALESCE(MAX(queue_number),0)+1 as q FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2`,
      [barbershop_id, appointment_date]
    );

    const result = await pool.query(
      `INSERT INTO appointments (customer_id, barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes, total_amount, queue_number, status, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending','unpaid') RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, service_id, appointment_date, appointment_time,
       is_home_service || false, home_address || null, notes || null, total_amount, queueRes.rows[0].q]
    );
    const appt = result.rows[0];

    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,'New Appointment Booked',$2,'new_booking',$3)`,
      [barbershop_id, `New appointment booked for ${appointment_date} at ${appointment_time}`, appt.id]
    );
    res.status(201).json(appt);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: my active appointments
router.get('/my', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo,
        b.qr_code_url as barbershop_qr, s.name as service_name, s.duration_minutes, s.price as service_price,
        br.name as barber_name, br.photo_url as barber_photo
      FROM appointments a
      LEFT JOIN barbershops b ON b.id=a.barbershop_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      WHERE a.customer_id=$1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: history (all completed/cancelled/no_show)
router.get('/history', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo, b.city as barbershop_city,
        s.name as service_name, s.price as service_price, s.duration_minutes, s.category as service_category,
        s.image_url as service_image, s.is_home_service as service_is_home,
        br.name as barber_name, br.photo_url as barber_photo,
        r.barbershop_rating, r.barber_rating, r.comment as review_comment,
        bcr.rating as customer_rating_received, bcr.comment as customer_rating_comment,
        lt.points as loyalty_points_earned
      FROM appointments a
      LEFT JOIN barbershops b ON b.id=a.barbershop_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      LEFT JOIN ratings r ON r.appointment_id=a.id AND r.customer_id=a.customer_id
      LEFT JOIN barber_customer_ratings bcr ON bcr.appointment_id=a.id
      LEFT JOIN loyalty_transactions lt ON lt.customer_id=a.customer_id AND lt.barbershop_id=a.barbershop_id AND lt.type='earned' AND lt.description LIKE '%'||a.id||'%'
      WHERE a.customer_id=$1 AND a.status IN ('completed','cancelled','no_show')
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP/BARBER: list appointments (today + active)
router.get('/shop', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { date, status } = req.query;
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    let query = `
      SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.avatar_url as customer_avatar,
        c.no_show_count as customer_no_show_count, c.rating as customer_rating,
        s.name as service_name, s.duration_minutes, br.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON c.id=a.customer_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      WHERE a.barbershop_id=$1
    `;
    const params = [shopId];
    if (isBarber) { params.push(req.user.id); query += ` AND a.barber_id=$${params.length}`; }
    if (date) { params.push(date); query += ` AND a.appointment_date=$${params.length}`; }
    if (status) { params.push(status); query += ` AND a.status=$${params.length}`; }
    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// SHOP/BARBER: history (completed + cancelled + no_show)
router.get('/shop/history', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { status, from_date, to_date } = req.query;
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    let query = `
      SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.avatar_url as customer_avatar, c.rating as customer_rating,
        s.name as service_name, s.price as service_price, s.duration_minutes, s.category as service_category,
        br.name as barber_name
      FROM appointments a
      LEFT JOIN customers c ON c.id=a.customer_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      WHERE a.barbershop_id=$1 AND a.status IN ('completed','cancelled','no_show')
    `;
    const params = [shopId];
    if (isBarber) { params.push(req.user.id); query += ` AND a.barber_id=$${params.length}`; }
    if (status) { params.push(status); query += ` AND a.status=$${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND a.appointment_date >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND a.appointment_date <= $${params.length}`; }
    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// SHOP: dashboard stats
router.get('/shop/stats', authenticateBarbershop, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [todayRes, totalRes, ratingRes, queueRes, weekRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2`, [req.user.id, today]),
      pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0) as revenue FROM appointments WHERE barbershop_id=$1`, [req.user.id]),
      pool.query(`SELECT COALESCE(AVG(barbershop_rating),0)::numeric(3,2) as avg FROM ratings WHERE barbershop_id=$1`, [req.user.id]),
      pool.query(`SELECT COUNT(*) as count FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status IN ('pending','confirmed','in_progress')`, [req.user.id, today]),
      pool.query(`SELECT appointment_date as date, COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue, COUNT(*)::int as bookings FROM appointments WHERE barbershop_id=$1 AND appointment_date >= CURRENT_DATE - INTERVAL '7 days' GROUP BY appointment_date ORDER BY appointment_date`, [req.user.id])
    ]);
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

// CUSTOMER: cancel
router.patch('/:id/cancel', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE appointments SET status='cancelled' WHERE id=$1 AND customer_id=$2 AND status IN ('pending','confirmed') RETURNING *`,
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
    const { payment_method, amount } = req.body;
    const url = `/uploads/${req.file.filename}`;
    const notes_addon = payment_method ? `\n[Payment via: ${payment_method}${amount ? ' - ₱' + amount : ''}]` : '';
    const result = await pool.query(
      `UPDATE appointments SET payment_proof_url=$1, payment_status='pending_verification', notes=COALESCE(notes,'')||$2
       WHERE id=$3 AND customer_id=$4 RETURNING *`,
      [url, notes_addon, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,'Payment proof submitted',$2,'payment_proof',$3)`,
      [result.rows[0].barbershop_id, `Payment proof uploaded for appointment #${req.params.id}`, req.params.id]
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
      `UPDATE appointments SET payment_status=$1, status=CASE WHEN $1='paid' AND status='pending' THEN 'confirmed' ELSE status END
       WHERE id=$2 AND barbershop_id=$3 RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,$2,$3,'payment_verified',$4)`,
      [result.rows[0].customer_id, status === 'paid' ? 'Payment confirmed' : 'Payment rejected',
       status === 'paid' ? 'Your payment was verified' : 'Please re-upload your payment proof', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP/BARBER: update appointment status
router.patch('/:id/status', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    const existing = await pool.query(
      isBarber ? 'SELECT * FROM appointments WHERE id=$1 AND barbershop_id=$2 AND barber_id=$3'
               : 'SELECT * FROM appointments WHERE id=$1 AND barbershop_id=$2',
      isBarber ? [req.params.id, shopId, req.user.id] : [req.params.id, shopId]
    );
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });

    const result = await pool.query('UPDATE appointments SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    const appt = result.rows[0];

    if (status === 'completed' && appt.customer_id) {
      const shopSettings = await pool.query(
        'SELECT COALESCE(loyalty_points_per_appointment, 1) as pts FROM barbershops WHERE id=$1',
        [appt.barbershop_id]
      ).catch(() => ({ rows: [{ pts: 1 }] }));
      const pts = parseInt(shopSettings.rows[0]?.pts || 1);
      await pool.query(
        `INSERT INTO customer_shop_loyalty (customer_id, barbershop_id, points, updated_at) VALUES ($1,$2,$3,NOW())
         ON CONFLICT (customer_id, barbershop_id) DO UPDATE SET points=customer_shop_loyalty.points+$3, updated_at=NOW()`,
        [appt.customer_id, appt.barbershop_id, pts]
      );
      await pool.query(
        `INSERT INTO loyalty_transactions (customer_id, barbershop_id, points, type, description) VALUES ($1,$2,$3,'earned',$4)`,
        [appt.customer_id, appt.barbershop_id, pts, `Completed appointment #${req.params.id}`]
      );
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,$2,$3,'loyalty',$4)`,
        [appt.customer_id, `+${pts} Loyalty Point${pts !== 1 ? 's' : ''}`, `You earned ${pts} loyalty point${pts !== 1 ? 's' : ''}! Visit the shop page to see & redeem promos.`, req.params.id]
      );
    }
    if (status === 'no_show' && appt.customer_id) {
      await pool.query('UPDATE customers SET no_show_count=no_show_count+1 WHERE id=$1', [appt.customer_id]);
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,'Marked as No-Show','You missed your appointment. Repeated no-shows may lead to restrictions.','no_show',$2)`,
        [appt.customer_id, req.params.id]
      );
    }
    res.json(appt);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
