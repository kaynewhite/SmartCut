const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateAdmin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `admin_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ADMIN: dashboard stats
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [shops, customers, appts, pendingSubs, openReports, todayAppts] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM barbershops'),
      pool.query('SELECT COUNT(*) as count FROM customers'),
      pool.query('SELECT COUNT(*) as count FROM appointments'),
      pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) as count FROM feedback_reports WHERE status = 'open'"),
      pool.query("SELECT COUNT(*) as count FROM appointments WHERE appointment_date = CURRENT_DATE"),
    ]);
    const activeSubs = await pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");
    const shopSubs = await pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE subscriber_type = 'barbershop' AND status = 'active'");
    const custSubs = await pool.query("SELECT COUNT(*) as count FROM subscriptions WHERE subscriber_type = 'customer' AND status = 'active'");
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
      },
      recent_shops: recentShops.rows
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: list all barbershops with subscription info
router.get('/barbershops', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.name, b.email, b.phone, b.city, b.address, b.is_active, b.subscription_status, b.created_at,
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
          ? 'Your subscription has been approved. You now have full access.'
          : `Your subscription was rejected. ${admin_note || 'Please contact support.'}`
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

// ADMIN: upload QR code for subscription payment
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

// ADMIN: update own profile (name + email)
router.put('/me', authenticateAdmin, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
    const conflict = await pool.query('SELECT id FROM admins WHERE email=$1 AND id!=$2', [email.toLowerCase(), req.user.id]);
    if (conflict.rows.length) return res.status(400).json({ message: 'Email already in use' });
    const result = await pool.query(
      'UPDATE admins SET name=$1, email=$2 WHERE id=$3 RETURNING id, name, email',
      [name.trim(), email.toLowerCase(), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: change own password
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

// ADMIN: toggle barbershop active status (restrict/unrestrict)
router.patch('/barbershops/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('UPDATE barbershops SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: restrict/unrestrict barbershop (same as toggle — alias)
router.patch('/barbershops/:id/restrict', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('UPDATE barbershops SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: delete barbershop
router.delete('/barbershops/:id', authenticateAdmin, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, name FROM barbershops WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    await pool.query('DELETE FROM barbershops WHERE id=$1', [req.params.id]);
    res.json({ ok: true, name: existing.rows[0].name });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ADMIN: restrict/unrestrict customer
router.patch('/customers/:id/restrict', authenticateAdmin, async (req, res) => {
  try {
    const current = await pool.query('SELECT id, name, subscription_status FROM customers WHERE id=$1', [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ message: 'Not found' });
    const newStatus = current.rows[0].subscription_status === 'restricted' ? 'inactive' : 'restricted';
    const result = await pool.query('UPDATE customers SET subscription_status=$1 WHERE id=$2 RETURNING id, name, subscription_status', [newStatus, req.params.id]);
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
