const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateAdmin } = require('../middleware/auth');

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `admin_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

// ADMIN: dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [shops, customers, appts, pendingSubs, openReports, todayAppts, activeSubs, shopSubs, custSubs, revenueRes, monthlyRevenueRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM barbershops'),
      pool.query('SELECT COUNT(*) as count FROM customers'),
      pool.query('SELECT COUNT(*) as count FROM appointments'),
      pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as count FROM feedback_reports WHERE status = 'open'"),
      pool.query("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE subscriber_type = 'barbershop' AND status = 'active'"),
      pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE subscriber_type = 'customer' AND status = 'active'"),
      pool.query("SELECT COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as total FROM appointments WHERE appointment_date <= CURRENT_DATE"),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('month', appointment_date), 'Mon YYYY') as month,
        DATE_TRUNC('month', appointment_date) as month_start,
        COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue,
        COUNT(*)::int as bookings
        FROM appointments
        WHERE appointment_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY month, month_start ORDER BY month_start`)
    ]);
    const recentShops = await pool.query(`
      SELECT b.id, b.name, b.email, b.city, b.created_at, b.subscription_status,
        (SELECT COUNT(*) FROM appointments WHERE barbershop_id = b.id) as total_appointments
      FROM barbershops b ORDER BY b.created_at DESC LIMIT 5
    `);
    res.json({
      stats: {
        total_barbershops: parseInt(shops.rows[0].count),
        total_customers: parseInt(customers.rows[0].count),
        total_appointments: parseInt(appts.rows[0].count),
        pending_subscriptions: parseInt(pendingSubs.rows[0].count),
        open_reports: parseInt(openReports.rows[0].count),
        today_appointments: parseInt(todayAppts.rows[0].count),
        active_subscriptions: parseInt(activeSubs.rows[0].count),
        active_shop_subs: parseInt(shopSubs.rows[0].count),
        active_customer_subs: parseInt(custSubs.rows[0].count),
        total_revenue: parseFloat(revenueRes.rows[0].total),
      },
      monthly_revenue: monthlyRevenueRes.rows,
      recent_shops: recentShops.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: list all barbershops with subscription info
router.get('/barbershops', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.name, b.email, b.phone, b.city, b.address, b.is_active,
        b.subscription_status, b.created_at, b.restriction_reason, b.restriction_requirements,
        b.appeal_text, b.appeal_status, b.restricted_at,
        (SELECT COUNT(*) FROM appointments WHERE barbershop_id = b.id) as total_appointments,
        (SELECT COUNT(*) FROM barbers WHERE barbershop_id = b.id) as total_barbers,
        s.id as sub_id, s.status as sub_status, s.payment_proof_url, s.created_at as sub_created_at, s.expires_at
      FROM barbershops b
      LEFT JOIN subscriptions s ON s.subscriber_type = 'barbershop' AND s.subscriber_id = b.id AND s.status = 'pending'
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: view full non-sensitive barbershop details and related records
router.get('/barbershops/:id/details', authenticateAdmin, async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!Number.isInteger(shopId) || shopId < 1) return res.status(400).json({ message: 'Invalid barbershop id' });

    const [shopRes, subscriptionsRes, barbersRes, servicesRes, appointmentsRes, walkInsRes, paymentMethodsRes, promosRes, ratingsRes] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, address, city, description, opening_time, closing_time,
          qr_code_url, logo_url, cover_url, latitude, longitude, downpayment_percent, is_active,
          subscription_status, rating, is_solo, solo_barber_id, restriction_reason,
          restriction_requirements, appeal_text, appeal_status, restricted_at, created_at
         FROM barbershops WHERE id=$1`,
        [shopId]
      ),
      pool.query(
        `SELECT id, status, payment_proof_url, admin_note, reviewed_by, expires_at, created_at, updated_at
         FROM subscriptions WHERE subscriber_type='barbershop' AND subscriber_id=$1 ORDER BY created_at DESC`,
        [shopId]
      ),
      pool.query(
        `SELECT b.id, b.name, b.email, b.phone, b.bio, b.photo_url, b.event_price, b.is_available, b.rating,
          b.total_cuts, b.created_at,
          ARRAY(SELECT specialty FROM barber_specialties WHERE barber_id=b.id) as specialties
         FROM barbers b WHERE b.barbershop_id=$1 ORDER BY b.name`,
        [shopId]
      ),
      pool.query(
        `SELECT id, name, description, price, duration_minutes, category, image_url, is_active,
          is_home_service, created_by_barber_id, created_at
         FROM services WHERE barbershop_id=$1 ORDER BY name`,
        [shopId]
      ),
      pool.query(
        `SELECT a.id, a.customer_id, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          a.barber_id, br.name as barber_name, a.service_id, s.name as service_name,
          a.appointment_date, a.appointment_time, a.is_home_service, a.home_service_type, a.is_event_booking, a.home_address,
          a.home_contact_name, a.home_contact_phone, a.home_service_notes, a.notes,
          a.total_amount, a.queue_number, a.status, a.payment_status, a.payment_proof_url, a.created_at
         FROM appointments a
         LEFT JOIN customers c ON c.id=a.customer_id
         LEFT JOIN barbers br ON br.id=a.barber_id
         LEFT JOIN services s ON s.id=a.service_id
         WHERE a.barbershop_id=$1 ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [shopId]
      ),
      pool.query(
        `SELECT w.id, w.customer_name, w.barber_id, b.name as barber_name, w.service_id, s.name as service_name,
          w.appointment_date, w.appointment_time, w.duration_minutes, w.queue_number, w.status, w.created_at
         FROM walk_ins w
         LEFT JOIN barbers b ON b.id=w.barber_id
         LEFT JOIN services s ON s.id=w.service_id
         WHERE w.barbershop_id=$1 ORDER BY w.appointment_date DESC, w.appointment_time DESC`,
        [shopId]
      ),
      pool.query(
        `SELECT id, type, account_name, account_number, qr_code_url, is_active, created_at
         FROM payment_methods WHERE barbershop_id=$1 ORDER BY created_at DESC`,
        [shopId]
      ),
      pool.query(
        `SELECT p.id, p.name, p.description, p.points_cost, p.real_price, p.image_url, p.is_active, p.created_at,
          b.name as barber_name, s.name as service_name,
          COUNT(r.id)::int as redemption_count,
          COALESCE(SUM(r.points_spent), 0)::int as points_spent,
          COALESCE(SUM(r.promo_value), 0)::float as promo_value_redeemed
         FROM loyalty_promos p
         LEFT JOIN barbers b ON b.id=p.barber_id
         LEFT JOIN services s ON s.id=p.service_id
         LEFT JOIN promo_redemptions r ON r.promo_id=p.id
         WHERE p.barbershop_id=$1
         GROUP BY p.id, b.name, s.name ORDER BY p.created_at DESC`,
        [shopId]
      ),
      pool.query(
        `SELECT r.id, r.customer_id, c.name as customer_name, r.barber_id, b.name as barber_name,
          r.appointment_id, r.barbershop_rating, r.barber_rating, r.comment, r.created_at
         FROM ratings r
         LEFT JOIN customers c ON c.id=r.customer_id
         LEFT JOIN barbers b ON b.id=r.barber_id
         WHERE r.barbershop_id=$1 ORDER BY r.created_at DESC`,
        [shopId]
      )
    ]);
    if (!shopRes.rows.length) return res.status(404).json({ message: 'Barbershop not found' });
    res.json({
      profile: shopRes.rows[0],
      subscriptions: subscriptionsRes.rows,
      barbers: barbersRes.rows,
      services: servicesRes.rows,
      appointments: appointmentsRes.rows,
      walk_ins: walkInsRes.rows,
      payment_methods: paymentMethodsRes.rows,
      promos: promosRes.rows,
      ratings: ratingsRes.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: list all customers
router.get('/customers', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.email, c.phone, c.subscription_status, c.no_show_count, c.rating, c.created_at,
        (SELECT COUNT(*) FROM appointments WHERE customer_id = c.id) as total_appointments,
        s.id as sub_id, s.status as sub_status, s.payment_proof_url, s.created_at as sub_created_at
      FROM customers c
      LEFT JOIN subscriptions s ON s.subscriber_type = 'customer' AND s.subscriber_id = c.id AND s.status = 'pending'
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: view full non-sensitive customer details and related records
router.get('/customers/:id/details', authenticateAdmin, async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId < 1) return res.status(400).json({ message: 'Invalid customer id' });

    const [customerRes, subscriptionsRes, appointmentsRes, loyaltyRes, loyaltyBalancesRes, promoRedemptionsRes, bansRes] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, avatar_url, loyalty_points, rating, no_show_count,
          subscription_status, created_at FROM customers WHERE id=$1`,
        [customerId]
      ),
      pool.query(
        `SELECT id, status, payment_proof_url, admin_note, reviewed_by, expires_at, created_at, updated_at
         FROM subscriptions WHERE subscriber_type='customer' AND subscriber_id=$1 ORDER BY created_at DESC`,
        [customerId]
      ),
      pool.query(
        `SELECT a.id, a.barbershop_id, bs.name as barbershop_name,
          a.barber_id, br.name as barber_name, a.service_id, s.name as service_name,
          a.appointment_date, a.appointment_time, a.is_home_service, a.home_service_type, a.is_event_booking, a.home_address,
          a.home_contact_name, a.home_contact_phone, a.home_service_notes, a.notes,
          a.total_amount, a.queue_number, a.status, a.payment_status, a.payment_proof_url, a.created_at
         FROM appointments a
         LEFT JOIN barbershops bs ON bs.id=a.barbershop_id
         LEFT JOIN barbers br ON br.id=a.barber_id
         LEFT JOIN services s ON s.id=a.service_id
         WHERE a.customer_id=$1 ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [customerId]
      ),
      pool.query(
        `SELECT lt.id, lt.barbershop_id, bs.name as barbershop_name, lt.points, lt.type, lt.description, lt.created_at
         FROM loyalty_transactions lt
         LEFT JOIN barbershops bs ON bs.id=lt.barbershop_id
         WHERE lt.customer_id=$1 ORDER BY lt.created_at DESC`,
        [customerId]
      ),
      pool.query(
        `SELECT csl.barbershop_id, bs.name as barbershop_name, csl.points, csl.updated_at
         FROM customer_shop_loyalty csl
         LEFT JOIN barbershops bs ON bs.id=csl.barbershop_id
         WHERE csl.customer_id=$1 ORDER BY bs.name`,
        [customerId]
      ),
      pool.query(
        `SELECT r.id, r.barbershop_id, bs.name as barbershop_name, r.promo_id, p.name as promo_name,
          r.points_spent, r.promo_value, r.redemption_code, r.status, r.appointment_id, r.created_at
         FROM promo_redemptions r
         LEFT JOIN barbershops bs ON bs.id=r.barbershop_id
         LEFT JOIN loyalty_promos p ON p.id=r.promo_id
         WHERE r.customer_id=$1 ORDER BY r.created_at DESC`,
        [customerId]
      ),
      pool.query(
        `SELECT cb.id, cb.barbershop_id, bs.name as barbershop_name, cb.reason, cb.banned_until, cb.created_at
         FROM customer_bans cb
         LEFT JOIN barbershops bs ON bs.id=cb.barbershop_id
         WHERE cb.customer_id=$1 ORDER BY cb.created_at DESC`,
        [customerId]
      )
    ]);
    if (!customerRes.rows.length) return res.status(404).json({ message: 'Customer not found' });
    res.json({
      profile: customerRes.rows[0],
      subscriptions: subscriptionsRes.rows,
      appointments: appointmentsRes.rows,
      loyalty_transactions: loyaltyRes.rows,
      loyalty_balances: loyaltyBalancesRes.rows,
      promo_redemptions: promoRedemptionsRes.rows,
      bans: bansRes.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: list pending subscriptions
router.get('/subscriptions', authenticateAdmin, async (req, res) => {
  try {
    const { type, status } = req.query;
    let query = `SELECT s.*,
      CASE WHEN s.subscriber_type = 'barbershop' THEN b.name ELSE c.name END as subscriber_name,
      CASE WHEN s.subscriber_type = 'barbershop' THEN b.email ELSE c.email END as subscriber_email
      FROM subscriptions s
      LEFT JOIN barbershops b ON s.subscriber_type = 'barbershop' AND s.subscriber_id = b.id
      LEFT JOIN customers c ON s.subscriber_type = 'customer' AND s.subscriber_id = c.id
      WHERE 1=1`;
    const params = [];
    if (type) { params.push(type); query += ` AND s.subscriber_type = $${params.length}`; }
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    else { query += ` AND s.status = 'pending'`; }
    query += ' ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: approve or reject subscription
router.patch('/subscriptions/:id', authenticateAdmin, async (req, res) => {
  try {
    const { action, admin_note } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });
    const sub = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [req.params.id]);
    if (!sub.rows.length) return res.status(404).json({ message: 'Not found' });
    const s = sub.rows[0];
    const newStatus = action === 'approve' ? 'active' : 'rejected';
    const expiresAt = action === 'approve' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
    await pool.query(
      `UPDATE subscriptions SET status=$1, admin_note=$2, reviewed_by=$3, expires_at=$4, updated_at=NOW() WHERE id=$5`,
      [newStatus, admin_note || null, req.user.id, expiresAt, req.params.id]
    );
    if (action === 'approve') {
      const table = s.subscriber_type === 'barbershop' ? 'barbershops' : 'customers';
      await pool.query(`UPDATE ${table} SET subscription_status='active' WHERE id=$1`, [s.subscriber_id]);
    }
    await pool.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ($1,$2,$3,$4,'subscription')`,
      [s.subscriber_type, s.subscriber_id,
        action === 'approve' ? 'Subscription Approved!' : 'Subscription Rejected',
        action === 'approve'
          ? 'Your subscription has been approved. You now have full access to SmartCut.'
          : `Your subscription was rejected. ${admin_note || 'Please contact support for more information.'}`
      ]
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: list reports
router.get('/reports', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT f.*,
      CASE f.reporter_type
        WHEN 'customer' THEN (SELECT name FROM customers WHERE id = f.reporter_id)
        WHEN 'barbershop' THEN (SELECT name FROM barbershops WHERE id = f.reporter_id)
        WHEN 'barber' THEN (SELECT name FROM barbers WHERE id = f.reporter_id)
      END as reporter_name
      FROM feedback_reports f WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); query += ` AND f.status = $${params.length}`; }
    query += ' ORDER BY f.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: respond to report
router.patch('/reports/:id', authenticateAdmin, async (req, res) => {
  try {
    const { status, admin_response } = req.body;
    const result = await pool.query(
      `UPDATE feedback_reports SET status=$1, admin_response=$2, reviewed_by=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [status || 'reviewed', admin_response || null, req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    const r = result.rows[0];
    if (admin_response) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ($1,$2,'Admin Response','Your report has been reviewed. Check your reports for details.','report_response')`,
        [r.reporter_type, r.reporter_id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: upload QR code
router.post('/qr', authenticateAdmin, upload.single('qr'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const { type, account_name } = req.body;
    const qr_url = `/uploads/${req.file.filename}`;
    await pool.query('UPDATE admin_qr_codes SET is_active = false WHERE admin_id = $1', [req.user.id]);
    const result = await pool.query(
      `INSERT INTO admin_qr_codes (admin_id, type, account_name, qr_url) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, type || 'gcash', account_name || null, qr_url]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// PUBLIC: get active admin QR code
router.get('/qr', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_qr_codes WHERE is_active = true ORDER BY id DESC LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: get own profile
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM admins WHERE id=$1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/me', authenticateAdmin, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
    const conflict = await pool.query('SELECT id FROM admins WHERE email=$1 AND id!=$2', [email.toLowerCase(), req.user.id]);
    if (conflict.rows.length) return res.status(400).json({ message: 'Email already in use' });
    const result = await pool.query('UPDATE admins SET name=$1, email=$2 WHERE id=$3 RETURNING id, name, email', [name.trim(), email.toLowerCase(), req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/me/password', authenticateAdmin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const bcrypt = require('bcryptjs');
    const admin = await pool.query('SELECT password FROM admins WHERE id=$1', [req.user.id]);
    const match = await bcrypt.compare(current_password, admin.rows[0].password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE admins SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: restrict barbershop
router.patch('/barbershops/:id/restrict', authenticateAdmin, async (req, res) => {
  try {
    const { reason, requirements } = req.body;
    const current = await pool.query('SELECT id, name, is_active, email FROM barbershops WHERE id=$1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Not found' });
    const shop = current.rows[0];

    if (shop.is_active) {
      if (!reason || !reason.trim()) return res.status(400).json({ message: 'A reason is required to restrict a barbershop' });
      await pool.query(
        `UPDATE barbershops SET is_active=false, restriction_reason=$1, restriction_requirements=$2, appeal_status='none', restricted_at=NOW() WHERE id=$3`,
        [reason.trim(), requirements?.trim() || null, req.params.id]
      );
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barbershop',$1,$2,$3,'restriction')`,
        [req.params.id, '⚠️ Your Shop Has Been Restricted',
          `Your barbershop has been restricted and is no longer visible to customers.\n\nReason: ${reason}${requirements ? `\n\nRequirements to lift restriction: ${requirements}` : ''}\n\nYou may submit an appeal from your Settings page.`]
      );
      const barbers = await pool.query('SELECT id FROM barbers WHERE barbershop_id=$1', [req.params.id]);
      for (const b of barbers.rows) {
        await pool.query(
          `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barber',$1,'Shop Restricted','Your barbershop has been restricted by the admin. Please contact your shop owner for details.','restriction')`,
          [b.id]
        );
      }
      res.json({ ok: true, is_active: false, name: shop.name });
    } else {
      await pool.query(
        `UPDATE barbershops SET is_active=true, restriction_reason=NULL, restriction_requirements=NULL, appeal_status='none', restricted_at=NULL WHERE id=$1`,
        [req.params.id]
      );
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barbershop',$1,'✅ Restriction Lifted','Your barbershop restriction has been lifted. Your shop is now visible to customers again.','restriction')`,
        [req.params.id]
      );
      res.json({ ok: true, is_active: true, name: shop.name });
    }
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: view appeals (must be before /:id routes)
router.get('/barbershops/appeals', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, restriction_reason, restriction_requirements, appeal_text, appeal_status, restricted_at
       FROM barbershops WHERE appeal_status = 'pending' ORDER BY restricted_at DESC`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: resolve appeal
router.patch('/barbershops/:id/appeal', authenticateAdmin, async (req, res) => {
  try {
    const { action, admin_note } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

    if (action === 'approve') {
      await pool.query(
        `UPDATE barbershops SET is_active=true, appeal_status='approved', restriction_reason=NULL, restriction_requirements=NULL, restricted_at=NULL WHERE id=$1`,
        [req.params.id]
      );
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barbershop',$1,'✅ Appeal Approved',$2,'restriction')`,
        [req.params.id, `Your appeal has been approved and your shop restriction has been lifted. ${admin_note || 'Welcome back!'}`]
      );
    } else {
      await pool.query(`UPDATE barbershops SET appeal_status='rejected' WHERE id=$1`, [req.params.id]);
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barbershop',$1,'❌ Appeal Rejected',$2,'restriction')`,
        [req.params.id, `Your appeal has been rejected. ${admin_note || 'Your shop remains restricted. Please contact support.'}`]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: delete barbershop
router.delete('/barbershops/:id', authenticateAdmin, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, name FROM barbershops WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const shop = existing.rows[0];
    const barbers = await pool.query('SELECT id FROM barbers WHERE barbershop_id=$1', [req.params.id]);
    for (const b of barbers.rows) {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('barber',$1,'Shop Account Deleted',$2,'restriction')`,
        [b.id, `The barbershop "${shop.name}" has been permanently deleted by an admin. Your barber account is no longer active.`]
      );
    }
    await pool.query('DELETE FROM barbershops WHERE id=$1', [req.params.id]);
    res.json({ ok: true, name: shop.name });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: restrict/unrestrict customer
router.patch('/customers/:id/restrict', authenticateAdmin, async (req, res) => {
  try {
    const current = await pool.query('SELECT id, name, subscription_status FROM customers WHERE id=$1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Not found' });
    const newStatus = current.rows[0].subscription_status === 'restricted' ? 'inactive' : 'restricted';
    const result = await pool.query('UPDATE customers SET subscription_status=$1 WHERE id=$2 RETURNING id, name, subscription_status', [newStatus, req.params.id]);
    if (newStatus === 'restricted') {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('customer',$1,'⚠️ Account Restricted','Your customer account has been restricted by an admin. You cannot book appointments until this is resolved.','restriction')`,
        [req.params.id]
      );
    } else {
      await pool.query(
        `INSERT INTO notifications (recipient_type, recipient_id, title, message, type) VALUES ('customer',$1,'✅ Account Restriction Lifted','Your account restriction has been lifted. You can now book appointments again.','restriction')`,
        [req.params.id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: delete customer
router.delete('/customers/:id', authenticateAdmin, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, name FROM customers WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    res.json({ ok: true, name: existing.rows[0].name });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
