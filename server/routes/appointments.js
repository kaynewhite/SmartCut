const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateCustomer, authenticateBarbershop, authenticateBarbershopOrBarber } = require('../middleware/auth');

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `proof_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

// PUBLIC: top services (for customer explore/dashboard)
router.get('/top-services', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const result = await pool.query(`
      SELECT s.id, s.name, s.price, s.image_url, s.duration_minutes,
        b.id as barbershop_id, b.name as barbershop_name,
        COUNT(a.id)::int as booking_count
      FROM services s
      JOIN barbershops b ON b.id = s.barbershop_id
      LEFT JOIN appointments a ON a.service_id = s.id AND a.status NOT IN ('cancelled','no_show')
      WHERE s.is_active = true AND s.price IS NOT NULL
        AND b.is_active = true AND b.subscription_status = 'active'
      GROUP BY s.id, b.id
      ORDER BY booking_count DESC, s.id DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: upcoming appointment reminders (today and tomorrow)
router.get('/reminders', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.appointment_date, a.appointment_time, a.status,
        b.name as barbershop_name, s.name as service_name
      FROM appointments a
      LEFT JOIN barbershops b ON b.id = a.barbershop_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.customer_id = $1
        AND a.status IN ('pending','confirmed')
        AND a.appointment_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
      ORDER BY a.appointment_date, a.appointment_time
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: available (booked) time slots for a date
router.get('/available-slots', async (req, res) => {
  try {
    const { barbershop_id, barber_id, date } = req.query;
    if (!barbershop_id || !date) return res.status(400).json({ message: 'barbershop_id and date are required' });
    let q = `SELECT appointment_time FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled','no_show')`;
    const params = [barbershop_id, date];
    if (barber_id) { params.push(barber_id); q += ` AND barber_id=$${params.length}`; }
    const result = await pool.query(q, params);
    const booked_slots = result.rows.map(r => r.appointment_time?.substring(0, 5)).filter(Boolean);
    res.json({ booked_slots });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: book appointment
router.post('/', authenticateCustomer, async (req, res) => {
  try {
    const { barbershop_id, barber_id, service_id, appointment_date, appointment_time, is_home_service, home_address, notes } = req.body;
    if (!barbershop_id || !service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (appointment_date < today) {
      return res.status(400).json({ message: 'Cannot book an appointment in the past' });
    }

    // Check customer subscription — block if restricted
    const custRow = await pool.query('SELECT subscription_status FROM customers WHERE id=$1', [req.user.id]);
    if (custRow.rows[0]?.subscription_status === 'restricted') {
      return res.status(403).json({ message: 'Your account is restricted. Please contact support.' });
    }

    // Check if customer is banned from this shop
    const banCheck = await pool.query(
      `SELECT id FROM customer_bans WHERE customer_id=$1 AND barbershop_id=$2 AND (banned_until IS NULL OR banned_until > NOW())`,
      [req.user.id, barbershop_id]
    );
    if (banCheck.rows.length) return res.status(403).json({ message: 'You are banned from this barbershop' });

    // Validate barber belongs to this barbershop
    if (barber_id) {
      const barberCheck = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [barber_id, barbershop_id]);
      if (!barberCheck.rows.length) {
        return res.status(400).json({ message: 'Selected barber does not belong to this barbershop' });
      }
    }

    // Normalize time to HH:MM:SS
    let normalizedTime = appointment_time;
    if (/^\d{2}:\d{2}$/.test(appointment_time)) {
      normalizedTime = appointment_time + ':00';
    }

    // Check time slot not already taken for this barber
    if (barber_id) {
      const slotCheck = await pool.query(
        `SELECT id FROM appointments WHERE barbershop_id=$1 AND barber_id=$2 AND appointment_date=$3 AND appointment_time=$4 AND status NOT IN ('cancelled','no_show')`,
        [barbershop_id, barber_id, appointment_date, normalizedTime]
      );
      if (slotCheck.rows.length) {
        return res.status(400).json({ message: 'This time slot is already taken for the selected barber' });
      }
    }

    const serviceRes = await pool.query('SELECT price FROM services WHERE id=$1', [service_id]);
    if (!serviceRes.rows.length) return res.status(404).json({ message: 'Service not found' });
    const total_amount = serviceRes.rows[0].price;

    const queueRes = await pool.query(
      `SELECT COALESCE(MAX(queue_number),0)+1 as q FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2`,
      [barbershop_id, appointment_date]
    );

    const result = await pool.query(
      `INSERT INTO appointments (customer_id, barbershop_id, barber_id, service_id, appointment_date, appointment_time,
         is_home_service, home_address, notes, total_amount, queue_number, status, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending','unpaid') RETURNING *`,
      [req.user.id, barbershop_id, barber_id || null, service_id, appointment_date, normalizedTime,
       is_home_service || false, home_address || null, notes || null, total_amount, queueRes.rows[0].q]
    );
    const appt = result.rows[0];

    // Notify barbershop
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
       VALUES ('barbershop',$1,'📅 New Appointment Booked',$2,'new_booking',$3)`,
      [barbershop_id, `New ${is_home_service ? 'home service' : 'in-shop'} appointment booked for ${appointment_date} at ${appointment_time}`, appt.id]
    );

    // Notify assigned barber
    if (barber_id) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
         VALUES ('barber',$1,'📅 New Appointment Assigned',$2,'new_booking',$3)`,
        [barber_id, `You have a new appointment on ${appointment_date} at ${appointment_time}`, appt.id]
      );
    }

    res.status(201).json(appt);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: my appointments (all, ordered newest first)
router.get('/my', authenticateCustomer, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.name as barbershop_name, b.address as barbershop_address, b.logo_url as barbershop_logo,
        b.qr_code_url as barbershop_qr, s.name as service_name, s.duration_minutes, s.price as service_price,
        s.image_url as service_image, s.category as service_category,
        br.name as barber_name, br.photo_url as barber_photo,
        r.id as rating_id
      FROM appointments a
      LEFT JOIN barbershops b ON b.id=a.barbershop_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      LEFT JOIN ratings r ON r.appointment_id=a.id AND r.customer_id=a.customer_id
      WHERE a.customer_id=$1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: history (completed/cancelled/no_show)
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
      LEFT JOIN loyalty_transactions lt ON lt.customer_id=a.customer_id AND lt.barbershop_id=a.barbershop_id
        AND lt.type='earned' AND lt.description LIKE '%'||a.id||'%'
      WHERE a.customer_id=$1 AND a.status IN ('completed','cancelled','no_show')
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// SHOP/BARBER: list appointments + walk-ins for a date
router.get('/shop', authenticateBarbershopOrBarber, async (req, res) => {
  try {
    const { date, status } = req.query;
    const isBarber = req.user.type === 'barber';
    const shopId = isBarber ? req.user.barbershop_id : req.user.id;
    const today = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT a.id, a.queue_number, a.status, a.payment_status, a.total_amount,
        a.appointment_date, a.appointment_time, a.notes, a.home_address,
        a.is_home_service, a.barber_id, a.customer_id, a.service_id, a.payment_proof_url,
        c.name as customer_name, c.phone as customer_phone, c.avatar_url as customer_avatar,
        c.no_show_count as customer_no_show_count, c.rating as customer_rating,
        s.name as service_name, s.price as service_price, s.duration_minutes, s.category as service_category,
        br.name as barber_name,
        CASE WHEN a.is_home_service THEN 'home_service' ELSE 'online' END as appointment_type
      FROM appointments a
      LEFT JOIN customers c ON c.id=a.customer_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      WHERE a.barbershop_id=$1
    `;
    const params = [shopId];
    if (isBarber) { params.push(req.user.id); query += ` AND a.barber_id=$${params.length}`; }
    if (date) { params.push(today); query += ` AND a.appointment_date=$${params.length}`; }
    if (status) { params.push(status); query += ` AND a.status=$${params.length}`; }
    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const apptResult = await pool.query(query, params);

    let walkInQuery = `
      SELECT w.id, w.queue_number, w.status, w.customer_name, w.barber_id,
        s.name as service_name, s.price as service_price, br.name as barber_name,
        w.created_at as appointment_date, NULL as customer_id, NULL as customer_phone,
        NULL as customer_avatar, NULL as customer_no_show_count, NULL as customer_rating,
        'walk_in' as appointment_type, NULL as payment_status, NULL as total_amount,
        NULL as appointment_time, NULL as notes, NULL as is_home_service
      FROM walk_ins w
      LEFT JOIN services s ON s.id=w.service_id
      LEFT JOIN barbers br ON br.id=w.barber_id
      WHERE w.barbershop_id=$1 AND DATE(w.created_at)=$2
    `;
    const walkParams = [shopId, today];
    if (isBarber) { walkParams.push(req.user.id); walkInQuery += ` AND w.barber_id=$${walkParams.length}`; }
    if (status) {
      const walkStatus = status === 'completed' ? 'done' : status;
      walkParams.push(walkStatus); walkInQuery += ` AND w.status=$${walkParams.length}`;
    }
    walkInQuery += ' ORDER BY w.queue_number';

    const walkResult = await pool.query(walkInQuery, walkParams);

    res.json({ appointments: apptResult.rows, walk_ins: walkResult.rows });
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
        br.name as barber_name,
        CASE WHEN a.is_home_service THEN 'home_service' ELSE 'online' END as appointment_type,
        r.barbershop_rating, r.barber_rating, r.comment as review_comment
      FROM appointments a
      LEFT JOIN customers c ON c.id=a.customer_id
      LEFT JOIN services s ON s.id=a.service_id
      LEFT JOIN barbers br ON br.id=a.barber_id
      LEFT JOIN ratings r ON r.appointment_id=a.id
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

// SHOP: dashboard stats (legacy — kept for backward compat)
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
      today_appointments: parseInt(todayRes.rows[0].count),
      today_revenue: parseFloat(todayRes.rows[0].revenue),
      total_bookings: parseInt(totalRes.rows[0].count),
      total_revenue: parseFloat(totalRes.rows[0].revenue),
      avg_rating: parseFloat(ratingRes.rows[0].avg),
      in_queue: parseInt(queueRes.rows[0].count),
      queue_count: parseInt(queueRes.rows[0].count),
      weekly: weekRes.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// CUSTOMER: cancel appointment
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
    const { payment_method } = req.body;
    const url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE appointments SET payment_proof_url=$1, payment_status='pending_verification' WHERE id=$2 AND customer_id=$3 RETURNING *`,
      [url, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,'💳 Payment Proof Submitted',$2,'payment_proof',$3)`,
      [result.rows[0].barbershop_id, `Customer submitted payment proof for appointment #${req.params.id}${payment_method ? ` via ${payment_method}` : ''}`, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// SHOP: verify payment
router.patch('/:id/verify-payment', authenticateBarbershop, async (req, res) => {
  try {
    const { approved } = req.body;
    const paymentStatus = approved === false ? 'unpaid' : 'paid';
    const result = await pool.query(
      `UPDATE appointments
       SET payment_status=$1,
           status=CASE WHEN $2 AND status IN ('pending') THEN 'confirmed' ELSE status END
       WHERE id=$3 AND barbershop_id=$4 RETURNING *`,
      [paymentStatus, approved !== false, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,$2,$3,'payment_verified',$4)`,
      [result.rows[0].customer_id,
        paymentStatus === 'paid' ? '✅ Payment Confirmed' : '❌ Payment Rejected',
        paymentStatus === 'paid' ? 'Your payment has been verified. Your appointment is confirmed!' : 'Your payment proof was rejected. Please upload a new screenshot.',
        req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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

    // Status-change notifications to customer
    if (appt.customer_id && ['confirmed', 'in_progress', 'cancelled'].includes(status)) {
      const shopRes = await pool.query('SELECT name FROM barbershops WHERE id=$1', [appt.barbershop_id]);
      const shopName = shopRes.rows[0]?.name || 'the barbershop';

      if (status === 'confirmed') {
        await pool.query(
          `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
           VALUES ('customer',$1,'✅ Appointment Confirmed',$2,'confirmed',$3)`,
          [appt.customer_id, `Your appointment at ${shopName} is confirmed! We'll see you soon.`, req.params.id]
        );
      } else if (status === 'in_progress') {
        await pool.query(
          `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
           VALUES ('customer',$1,'✂️ Your Service Has Started',$2,'in_progress',$3)`,
          [appt.customer_id, `Your appointment at ${shopName} has started — you're being served now!`, req.params.id]
        );
        // Notify the NEXT customer in queue: "You're next!"
        const nextRes = await pool.query(
          `SELECT a.id, a.customer_id, a.queue_number, s.name as service_name
           FROM appointments a
           LEFT JOIN services s ON s.id = a.service_id
           WHERE a.barbershop_id = $1
             AND a.appointment_date = $2
             AND a.status IN ('pending','confirmed')
             AND a.queue_number > $3
           ORDER BY a.queue_number ASC
           LIMIT 1`,
          [appt.barbershop_id, appt.appointment_date, appt.queue_number]
        );
        if (nextRes.rows.length && nextRes.rows[0].customer_id) {
          const next = nextRes.rows[0];
          await pool.query(
            `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
             VALUES ('customer',$1,'🔔 You\'re Next!',$2,'next_in_queue',$3)`,
            [next.customer_id,
             `You're next in line at ${shopName}! Get ready — your ${next.service_name || 'service'} is starting soon.`,
             next.id]
          );
        }
      } else if (status === 'cancelled') {
        await pool.query(
          `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
           VALUES ('customer',$1,'❌ Appointment Cancelled',$2,'cancelled',$3)`,
          [appt.customer_id,
           `Your appointment at ${shopName} has been cancelled. Please rebook or contact the shop for more info.`,
           req.params.id]
        );
      }
    }

    if (status === 'completed') {
      // Guard against double-awarding loyalty points
      if (appt.customer_id && !appt.loyalty_awarded) {
        const shopSettings = await pool.query(
          'SELECT COALESCE(loyalty_points_per_appointment, 1) as pts, COALESCE(loyalty_streak_bonus, 0) as bonus, COALESCE(loyalty_streak_every, 5) as streak_every FROM barbershops WHERE id=$1',
          [appt.barbershop_id]
        ).catch(() => ({ rows: [{ pts: 1, bonus: 0, streak_every: 5 }] }));
        const { pts, bonus, streak_every } = shopSettings.rows[0] || { pts: 1, bonus: 0, streak_every: 5 };
        const basePoints = parseInt(pts || 1);
        const streakBonus = parseInt(bonus || 0);
        const streakEvery = parseInt(streak_every || 5);

        const countRes = await pool.query(
          `SELECT COUNT(*) as cnt FROM appointments WHERE customer_id=$1 AND barbershop_id=$2 AND status='completed'`,
          [appt.customer_id, appt.barbershop_id]
        );
        const visitCount = parseInt(countRes.rows[0].cnt);
        const isStreakVisit = streakBonus > 0 && streakEvery > 0 && visitCount % streakEvery === 0;
        const totalPoints = basePoints + (isStreakVisit ? streakBonus : 0);

        await pool.query(
          `INSERT INTO customer_shop_loyalty (customer_id, barbershop_id, points, updated_at) VALUES ($1,$2,$3,NOW())
           ON CONFLICT (customer_id, barbershop_id) DO UPDATE SET points=customer_shop_loyalty.points+$3, updated_at=NOW()`,
          [appt.customer_id, appt.barbershop_id, totalPoints]
        );
        await pool.query(
          `INSERT INTO loyalty_transactions (customer_id, barbershop_id, points, type, description) VALUES ($1,$2,$3,'earned',$4)`,
          [appt.customer_id, appt.barbershop_id, totalPoints, `Completed appointment #${req.params.id}${isStreakVisit ? ` (includes +${streakBonus} streak bonus!)` : ''}`]
        );
        // Mark loyalty as awarded to prevent double-awarding
        await pool.query('UPDATE appointments SET loyalty_awarded=true WHERE id=$1', [req.params.id]);
      }

      // Notify customer
      if (appt.customer_id) {
        const shopRes = await pool.query('SELECT name FROM barbershops WHERE id=$1', [appt.barbershop_id]);
        const shopName = shopRes.rows[0]?.name || 'your barbershop';
        await pool.query(
          `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id)
           VALUES ('customer',$1,'✂️ Service Complete — Please Pay & Rate',$2,'service_complete',$3)`,
          [appt.customer_id, `Your appointment at ${shopName} is complete! Please proceed with payment and leave a rating. Thank you!`, req.params.id]
        );
      }
    }

    if (status === 'no_show' && appt.customer_id) {
      await pool.query('UPDATE customers SET no_show_count=no_show_count+1 WHERE id=$1', [appt.customer_id]);
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('customer',$1,'⚠️ Marked as No-Show','You missed your appointment. Repeated no-shows may lead to account restrictions.','no_show',$2)`,
        [appt.customer_id, req.params.id]
      );
    }

    res.json(appt);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
