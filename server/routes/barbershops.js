const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { authenticateBarbershop } = require('../middleware/auth');
const { createUpload, imageFileFilter, uploadedFileUrl } = require('../middleware/upload');
const upload = createUpload({ fileFilter: imageFileFilter });

function haversine(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

// PUBLIC: list barbershops — with smart filters, live queue stats, and sorting
router.get('/', async (req, res) => {
  try {
    const {
      search,
      city,
      specialty,
      category,
      has_home_service,
      has_promos,
      is_solo,
      min_rating,
      price_range,
      max_price,
      open_now,
      sort_by,
      lat,
      lng,
    } = req.query;

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const hasLocation = !isNaN(userLat) && !isNaN(userLng);

    const today = new Date().toISOString().split('T')[0];

    // Current time in HH:MM for open_now checking
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let query = `
      SELECT b.*,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) as avg_rating,
        COUNT(DISTINCT r.id) as review_count,
        (SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) as min_price,
        (SELECT MAX(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) as max_price,
        EXISTS(SELECT 1 FROM services WHERE barbershop_id = b.id AND is_active = true AND is_home_service = true) as has_home_service,
        EXISTS(SELECT 1 FROM loyalty_promos WHERE barbershop_id = b.id AND is_active = true) as has_promos,
        (
          (SELECT COUNT(*) FROM appointments WHERE barbershop_id = b.id AND appointment_date = '${today}' AND status IN ('pending','confirmed','in_progress')) +
          (SELECT COUNT(*) FROM walk_ins WHERE barbershop_id = b.id AND DATE(created_at) = '${today}' AND status IN ('waiting','in_progress'))
        )::int as in_queue_count,
        (SELECT COUNT(*) FROM barbers WHERE barbershop_id = b.id AND is_available = true)::int as active_barbers_count
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      WHERE b.is_active = true AND b.subscription_status = 'active'
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (b.name ILIKE $${params.length} OR b.description ILIKE $${params.length} OR b.address ILIKE $${params.length})`;
    }

    if (city) {
      params.push(`%${city}%`);
      query += ` AND b.city ILIKE $${params.length}`;
    }

    if (specialty) {
      params.push(`%${specialty}%`);
      query += ` AND b.id IN (
        SELECT bp.barbershop_id 
        FROM barbers bp 
        JOIN barber_specialties bs ON bs.barber_id = bp.id 
        WHERE bs.specialty ILIKE $${params.length}
      )`;
    }

    if (category) {
      params.push(`%${category}%`);
      query += ` AND b.id IN (
        SELECT s.barbershop_id 
        FROM services s 
        WHERE s.is_active = true AND s.category ILIKE $${params.length}
      )`;
    }

    if (has_home_service === 'true') {
      query += ` AND EXISTS(SELECT 1 FROM services WHERE barbershop_id = b.id AND is_active = true AND is_home_service = true)`;
    }

    if (has_promos === 'true') {
      query += ` AND EXISTS(SELECT 1 FROM loyalty_promos WHERE barbershop_id = b.id AND is_active = true)`;
    }

    if (is_solo === 'true') {
      query += ` AND b.is_solo = true`;
    }

    query += ' GROUP BY b.id';

    const havingClauses = [];

    if (min_rating) {
      havingClauses.push(`COALESCE(AVG(r.barbershop_rating), 0) >= ${parseFloat(min_rating)}`);
    }

    if (max_price) {
      params.push(max_price);
      havingClauses.push(`(SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) <= $${params.length}`);
    } else if (price_range === 'budget') {
      havingClauses.push(`(SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) <= 200`);
    } else if (price_range === 'mid') {
      havingClauses.push(`(SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) BETWEEN 200 AND 500`);
    } else if (price_range === 'premium') {
      havingClauses.push(`(SELECT MIN(price) FROM services WHERE barbershop_id = b.id AND is_active = true AND price IS NOT NULL) >= 500`);
    }

    if (havingClauses.length > 0) {
      query += ' HAVING ' + havingClauses.join(' AND ');
    }

    // Sorting
    switch (sort_by) {
      case 'popular':
        query += ' ORDER BY review_count DESC, avg_rating DESC';
        break;
      case 'price_asc':
        query += ' ORDER BY min_price ASC NULLS LAST, avg_rating DESC';
        break;
      case 'price_desc':
        query += ' ORDER BY min_price DESC NULLS LAST, avg_rating DESC';
        break;
      case 'shortest_queue':
        query += ' ORDER BY in_queue_count ASC, avg_rating DESC';
        break;
      case 'name':
        query += ' ORDER BY b.name ASC';
        break;
      case 'rating':
      default:
        query += ' ORDER BY avg_rating DESC, review_count DESC';
        break;
    }

    const result = await pool.query(query, params);

    let rows = result.rows.map(r => {
      delete r.password;

      // Determine open_now status
      const openTime = r.opening_time ? r.opening_time.substring(0, 5) : '08:00';
      const closeTime = r.closing_time ? r.closing_time.substring(0, 5) : '20:00';
      const isOpen = currentHHMM >= openTime && currentHHMM <= closeTime;

      const activeBarbers = r.active_barbers_count || 1;
      const estWait = Math.ceil((r.in_queue_count * 20) / Math.max(activeBarbers, 1));
      const dist = hasLocation && r.latitude && r.longitude
        ? haversine(userLat, userLng, parseFloat(r.latitude), parseFloat(r.longitude))
        : null;

      return {
        ...r,
        distance_km: dist,
        is_open_now: isOpen,
        est_wait_minutes: estWait,
      };
    });

    // If client requested open_now filter
    if (open_now === 'true') {
      rows = rows.filter(r => r.is_open_now);
    }

    // If sorting by closest distance
    if (sort_by === 'closest' && hasLocation) {
      rows.sort((a, b) => (a.distance_km ?? 99999) - (b.distance_km ?? 99999));
    }

    res.json(rows);
  } catch (err) {
    console.error('Error fetching barbershops:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// AUTH: dashboard stats (charts + KPIs)
router.get('/me/dashboard', authenticateBarbershop, async (req, res) => {
  try {
    const shopId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const [todayRes, totalRevRes, ratingRes, queueRes, monthlyRes, peakRes, topSvcRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled','no_show')`,
        [shopId, today]
      ),
      pool.query(
        `SELECT COALESCE(SUM(CASE WHEN payment_status='paid' THEN total_amount ELSE 0 END),0)::float as revenue FROM appointments WHERE barbershop_id=$1`,
        [shopId]
      ),
      pool.query(
        `SELECT COALESCE(AVG(barbershop_rating),0)::numeric(3,2) as avg FROM ratings WHERE barbershop_id=$1`,
        [shopId]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM appointments WHERE barbershop_id=$1 AND appointment_date=$2 AND status IN ('pending','confirmed','in_progress')`,
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
         GROUP BY hour ORDER BY hour`,
        [shopId]
      ),
      pool.query(
        `SELECT s.name, COUNT(a.id)::int as count
         FROM appointments a JOIN services s ON s.id=a.service_id
         WHERE a.barbershop_id=$1 AND a.status NOT IN ('cancelled','no_show')
         GROUP BY s.id, s.name ORDER BY count DESC LIMIT 5`,
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
      top_services: topSvcRes.rows
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
    const url = uploadedFileUrl(req.file);
    await pool.query('UPDATE barbershops SET logo_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ logo_url: url });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH: upload cover
router.post('/me/cover', authenticateBarbershop, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const url = uploadedFileUrl(req.file);
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

module.exports = router;
