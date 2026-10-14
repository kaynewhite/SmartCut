const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { authenticateBarbershop } = require('../middleware/auth');

const imageFileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

// PUBLIC: list barbershops — only active + subscribed
router.get('/', async (req, res) => {
  try {
    const { search, city, specialty, category, min_price, max_price, min_rating, available, home_service, sort } = req.query;
    const searchTerm = typeof search === 'string' ? search.trim() : '';
    const cityTerm = typeof city === 'string' ? city.trim() : '';
    const specialtyTerm = typeof specialty === 'string' ? specialty.trim() : '';
    const categoryTerm = typeof category === 'string' ? category.trim() : '';
    const minPrice = min_price === undefined || min_price === '' ? null : Number(min_price);
    const maxPrice = max_price === undefined || max_price === '' ? null : Number(max_price);
    const minRating = min_rating === undefined || min_rating === '' ? null : Number(min_rating);
    if ([minPrice, maxPrice].some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
      return res.status(400).json({ message: 'Prices must be non-negative numbers' });
    }
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return res.status(400).json({ message: 'Minimum price cannot exceed maximum price' });
    }
    if (minRating !== null && (!Number.isFinite(minRating) || minRating < 0 || minRating > 5)) {
      return res.status(400).json({ message: 'Minimum rating must be between 0 and 5' });
    }

    let query = `
      SELECT b.*,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) as avg_rating,
        COUNT(DISTINCT r.id) as review_count,
        shop_services.min_price
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      LEFT JOIN LATERAL (
        SELECT MIN(price) as min_price
        FROM services
        WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL
      ) shop_services ON true
      WHERE b.is_active = true AND b.subscription_status = 'active'
    `;
    const params = [];
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      query += ` AND (
        b.name ILIKE $${params.length}
        OR b.address ILIKE $${params.length}
        OR b.city ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM services search_services
          WHERE search_services.barbershop_id = b.id
            AND search_services.is_active = true
            AND (search_services.name ILIKE $${params.length} OR search_services.description ILIKE $${params.length})
        )
      )`;
    }
    if (cityTerm) {
      params.push(`%${cityTerm}%`);
      query += ` AND (b.city ILIKE $${params.length} OR b.address ILIKE $${params.length})`;
    }
    if (specialtyTerm) {
      params.push(specialtyTerm);
      query += ` AND EXISTS (
        SELECT 1 FROM barbers bp
        JOIN barber_specialties bs ON bs.barber_id = bp.id
        WHERE bp.barbershop_id = b.id AND LOWER(bs.specialty) = LOWER($${params.length})
      )`;
    }
    if (categoryTerm) {
      params.push(categoryTerm);
      query += ` AND EXISTS (
        SELECT 1 FROM services category_services
        WHERE category_services.barbershop_id = b.id
          AND category_services.is_active = true
          AND CASE LOWER(category_services.category)
            WHEN 'coloring' THEN 'color'
            ELSE LOWER(category_services.category)
          END = LOWER($${params.length})
      )`;
    }
    if (available === 'true') {
      query += ` AND EXISTS (
        SELECT 1 FROM barbers available_barbers
        WHERE available_barbers.barbershop_id = b.id AND available_barbers.is_available = true
      )`;
    }
    if (home_service === 'true') {
      query += ` AND EXISTS (
        SELECT 1 FROM services home_services
        WHERE home_services.barbershop_id = b.id
          AND home_services.is_active = true
          AND home_services.is_home_service = true
      )`;
    }
    if (minPrice !== null || maxPrice !== null) {
      const priceConditions = ['filtered_services.barbershop_id = b.id', 'filtered_services.is_active = true', 'filtered_services.price IS NOT NULL'];
      if (minPrice !== null) {
        params.push(minPrice);
        priceConditions.push(`filtered_services.price >= $${params.length}`);
      }
      if (maxPrice !== null) {
        params.push(maxPrice);
        priceConditions.push(`filtered_services.price <= $${params.length}`);
      }
      query += ` AND EXISTS (
        SELECT 1 FROM services filtered_services
        WHERE ${priceConditions.join(' AND ')}
      )`;
    }
    query += ' GROUP BY b.id, shop_services.min_price';
    const having = [];
    if (minRating !== null) {
      params.push(minRating);
      having.push(`COALESCE(AVG(r.barbershop_rating), 0) >= $${params.length}`);
    }
    if (having.length) query += ` HAVING ${having.join(' AND ')}`;
    if (sort === 'price_low') query += ' ORDER BY shop_services.min_price ASC NULLS LAST, avg_rating DESC';
    else if (sort === 'price_high') query += ' ORDER BY shop_services.min_price DESC NULLS LAST, avg_rating DESC';
    else query += ' ORDER BY avg_rating DESC, review_count DESC';
    const result = await pool.query(query, params);
    const rows = result.rows.map(r => { delete r.password; return r; });
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH: dashboard stats (charts + KPIs)
router.get('/me/dashboard', authenticateBarbershop, async (req, res) => {
  try {
    const shopId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const [todayRes, totalRevRes, ratingRes, queueRes, monthlyRes, peakRes, topSvcRes, promoImpactRes, barberPerformanceRes] = await Promise.all([
      pool.query(
        `SELECT (
          SELECT COUNT(*) FROM appointments
          WHERE barbershop_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled','no_show')
        ) + (
          SELECT COUNT(*) FROM walk_ins
          WHERE barbershop_id=$1 AND appointment_date=$2 AND status <> 'cancelled'
        ) as count`,
        [shopId, today]
      ),
      pool.query(
        `SELECT COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue
         FROM appointments WHERE barbershop_id=$1 AND appointment_date <= CURRENT_DATE`,
        [shopId]
      ),
      pool.query(
        `SELECT COALESCE(AVG(barbershop_rating),0)::numeric(3,2) as avg FROM ratings WHERE barbershop_id=$1`,
        [shopId]
      ),
      pool.query(
        `SELECT (
          SELECT COUNT(*) FROM appointments
          WHERE barbershop_id=$1 AND appointment_date=$2 AND status IN ('pending','confirmed','in_progress')
            AND COALESCE(is_event_booking, false) = false
        ) + (
          SELECT COUNT(*) FROM walk_ins
          WHERE barbershop_id=$1 AND appointment_date=$2 AND status IN ('waiting','in_progress')
        ) as count`,
        [shopId, today]
      ),
      pool.query(
        `SELECT TO_CHAR(DATE_TRUNC('month', appointment_date), 'Mon YYYY') as month,
          DATE_TRUNC('month', appointment_date) as month_start,
          COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue
         FROM appointments
         WHERE barbershop_id=$1 AND appointment_date >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY month, month_start ORDER BY month_start`,
        [shopId]
      ),
      pool.query(
        `SELECT EXTRACT(HOUR FROM appointment_time::time)::int as hour, COUNT(*)::int as count
         FROM appointments WHERE barbershop_id=$1 AND status NOT IN ('cancelled','no_show')
           AND COALESCE(is_event_booking, false) = false
         GROUP BY hour ORDER BY hour`,
        [shopId]
      ),
      pool.query(
        `SELECT s.name, COUNT(a.id)::int as count
         FROM appointments a JOIN services s ON s.id=a.service_id
         WHERE a.barbershop_id=$1 AND a.status NOT IN ('cancelled','no_show')
         GROUP BY s.id, s.name ORDER BY count DESC LIMIT 5`,
        [shopId]
      ),
      pool.query(
        `SELECT p.id as promo_id, p.name, COUNT(r.id)::int as redemption_count,
          COALESCE(SUM(r.points_spent), 0)::int as points_spent,
          COALESCE(SUM(r.promo_value), 0)::float as promo_value_redeemed
         FROM promo_redemptions r
         JOIN loyalty_promos p ON p.id = r.promo_id
         WHERE r.barbershop_id=$1
         GROUP BY p.id, p.name
         ORDER BY redemption_count DESC, p.name`,
        [shopId]
      ),
      pool.query(
        `SELECT b.id, b.name, b.photo_url,
          (
            SELECT COUNT(*) FROM appointments a
            WHERE a.barber_id=b.id AND a.status='completed'
          ) + (
            SELECT COUNT(*) FROM walk_ins w
            WHERE w.barber_id=b.id AND w.status='done'
          ) AS cuts,
          COALESCE((
            SELECT AVG(r.barber_rating) FROM ratings r
            WHERE r.barber_id=b.id AND r.barber_rating IS NOT NULL
          ), 0)::numeric(3,2) AS avg_rating,
          (
            SELECT COUNT(*) FROM ratings r
            WHERE r.barber_id=b.id AND r.barber_rating IS NOT NULL
          )::int AS rating_count,
          picked.service_name AS most_picked_service,
          COALESCE(picked.booking_count, 0)::int AS most_picked_count
         FROM barbers b
         LEFT JOIN LATERAL (
           SELECT services.service_name, SUM(services.booking_count)::int AS booking_count
           FROM (
             SELECT s.name AS service_name, COUNT(*)::int AS booking_count
             FROM appointments a
             JOIN services s ON s.id=a.service_id
             WHERE a.barber_id=b.id AND a.status NOT IN ('cancelled','no_show')
             GROUP BY s.name
             UNION ALL
             SELECT s.name AS service_name, COUNT(*)::int AS booking_count
             FROM walk_ins w
             JOIN services s ON s.id=w.service_id
             WHERE w.barber_id=b.id AND w.status <> 'cancelled'
             GROUP BY s.name
           ) services
           GROUP BY services.service_name
           ORDER BY booking_count DESC, services.service_name
           LIMIT 1
         ) picked ON true
         WHERE b.barbershop_id=$1
         ORDER BY cuts DESC, avg_rating DESC, b.name`,
        [shopId]
      )
    ]);
    res.json({
      today_appointments: parseInt(todayRes.rows[0].count),
      total_revenue: parseFloat(totalRevRes.rows[0].revenue),
      avg_rating: parseFloat(ratingRes.rows[0].avg),
      queue_count: parseInt(queueRes.rows[0].count),
      monthly_revenue: monthlyRes.rows,
      peak_hours: peakRes.rows,
      top_services: topSvcRes.rows,
      promo_impact: promoImpactRes.rows,
      barber_performance: barberPerformanceRes.rows
    });
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

// AUTH: change password
router.put('/me/password', authenticateBarbershop, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const shop = await pool.query('SELECT password FROM barbershops WHERE id=$1', [req.user.id]);
    if (!shop.rows.length) return res.status(404).json({ message: 'Not found' });
    const match = await bcrypt.compare(current_password, shop.rows[0].password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE barbershops SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
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

// AUTH: enable/disable Solo Operator Mode
router.put('/me/solo-mode', authenticateBarbershop, async (req, res) => {
  try {
    const { enabled } = req.body;
    const shopRes = await pool.query('SELECT is_solo, solo_barber_id FROM barbershops WHERE id = $1', [req.user.id]);
    if (!shopRes.rows.length) return res.status(404).json({ message: 'Not found' });
    const shop = shopRes.rows[0];

    if (enabled) {
      if (shop.is_solo) return res.json({ ok: true, is_solo: true });
      // Always create a fresh operator record for the owner, regardless of
      // how many barbers already exist on file — those remain untouched.
      const shopInfo = await pool.query('SELECT name, phone, logo_url FROM barbershops WHERE id = $1', [req.user.id]);
      const { name, phone, logo_url } = shopInfo.rows[0];
      const inserted = await pool.query(
        'INSERT INTO barbers (barbershop_id, name, phone, photo_url, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id',
        [req.user.id, name, phone || null, logo_url || null]
      );
      await pool.query('UPDATE barbershops SET is_solo = true, solo_barber_id = $2 WHERE id = $1', [req.user.id, inserted.rows[0].id]);
    } else {
      // Keep the operator's barber record on file (it simply becomes a
      // regular entry in the shop's barber list) and just turn off solo mode.
      await pool.query('UPDATE barbershops SET is_solo = false, solo_barber_id = NULL WHERE id = $1', [req.user.id]);
    }

    const result = await pool.query('SELECT * FROM barbershops WHERE id = $1', [req.user.id]);
    const updated = result.rows[0]; delete updated.password;
    res.json(updated);
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

// PUBLIC: get one barbershop with services + barbers + reviews
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
          SELECT json_build_object('id', s.id, 'name', s.name, 'price', s.price, 'duration_minutes', 30)
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

module.exports = router;
