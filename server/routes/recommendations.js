const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateCustomer } = require('../middleware/auth');

// Haversine distance helper (in km)
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

/**
 * GET /api/recommendations
 * Returns 5 categorized feed sections for the subscribed customer.
 * Falls back gracefully if no location is set (omits closest_shops section).
 */
router.get('/', authenticateCustomer, async (req, res) => {
  try {
    const customerId = req.user.id;

    // Fetch customer location & subscription status
    const custResult = await pool.query(
      `SELECT id, name, latitude, longitude, location_city, subscription_status FROM customers WHERE id = $1`,
      [customerId]
    );
    const customer = custResult.rows[0];
    // Check both customers table and active subscriptions in database
    const subResult = await pool.query(
      `SELECT id, status, expires_at FROM subscriptions WHERE subscriber_type='customer' AND subscriber_id=$1 AND status='active' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [customerId]
    );
    const isSubscriber = customer.subscription_status === 'active' || subResult.rows.length > 0;

    // Auto-sync customer status if active subscription exists
    if (subResult.rows.length > 0 && customer.subscription_status !== 'active') {
      await pool.query(`UPDATE customers SET subscription_status='active' WHERE id=$1`, [customerId]);
    }

    const customerLat = parseFloat(customer.latitude);
    const customerLon = parseFloat(customer.longitude);
    const hasLocation = !isNaN(customerLat) && !isNaN(customerLon);

    // ─────────────────────────────────────────────────────────────
    // BASE SHOP QUERY (with rating, review count, live queue)
    // ─────────────────────────────────────────────────────────────
    const shopsResult = await pool.query(`
      SELECT
        b.id, b.name, b.address, b.city, b.latitude, b.longitude,
        b.logo_url, b.cover_url, b.opening_time, b.closing_time,
        b.has_home_service, b.has_promos, b.is_solo,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count,
        (
          SELECT COUNT(*) FROM walk_ins w
          WHERE w.barbershop_id = b.id
            AND w.status IN ('waiting','in_progress')
            AND w.created_at::date = CURRENT_DATE
        ) + (
          SELECT COUNT(*) FROM appointments a
          WHERE a.barbershop_id = b.id
            AND a.status IN ('pending','confirmed','in_progress')
            AND a.appointment_date = CURRENT_DATE
        ) AS in_queue_count
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      WHERE b.is_active = true
        AND b.subscription_status = 'active'
      GROUP BY b.id
    `);
    const shops = shopsResult.rows;

    // Compute distances if customer has location
    const shopsWithDistance = shops.map((s) => {
      const dist = hasLocation ? haversine(customerLat, customerLon, parseFloat(s.latitude), parseFloat(s.longitude)) : null;
      const inQueue = parseInt(s.in_queue_count, 10) || 0;
      const isOpenNow = (() => {
        if (!s.opening_time || !s.closing_time) return null;
        const now = new Date();
        const [oh, om] = s.opening_time.split(':').map(Number);
        const [ch, cm] = s.closing_time.split(':').map(Number);
        const cur = now.getHours() * 60 + now.getMinutes();
        const open = oh * 60 + om;
        const close = ch * 60 + cm;
        return cur >= open && cur < close;
      })();
      return { ...s, distance_km: dist, in_queue_count: inQueue, is_open_now: isOpenNow };
    });

    // ─────────────────────────────────────────────────────────────
    // FEED 1: Closest Shops (subscribers with location only)
    // ─────────────────────────────────────────────────────────────
    let closest_shops = [];
    if (isSubscriber && hasLocation) {
      closest_shops = shopsWithDistance
        .filter((s) => s.distance_km !== null && s.distance_km <= 20)
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, 8);
    }

    // ─────────────────────────────────────────────────────────────
    // FEED 2: Trending Haircuts (highest booking velocity — 14 days)
    // ─────────────────────────────────────────────────────────────
    const trendingResult = await pool.query(`
      SELECT
        s.id, s.name, s.description, s.price, s.duration_minutes, s.image_url,
        s.category, s.is_home_service,
        b.id AS barber_id, b.name AS barber_name, b.photo_url AS barber_photo,
        bs.id AS barbershop_id, bs.name AS barbershop_name, bs.city,
        COUNT(a.id) AS booking_count,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) AS avg_rating
      FROM services s
      JOIN barbers b ON b.id = s.created_by_barber_id
      JOIN barbershops bs ON bs.id = b.barbershop_id
      LEFT JOIN appointments a ON a.service_id = s.id
        AND a.appointment_date >= CURRENT_DATE - INTERVAL '14 days'
        AND a.status != 'cancelled'
      LEFT JOIN ratings r ON r.barbershop_id = bs.id
      WHERE bs.is_active = true AND bs.subscription_status = 'active'
      GROUP BY s.id, b.id, bs.id
      HAVING COUNT(a.id) >= 0
      ORDER BY (COUNT(a.id) * 1.5 + COALESCE(AVG(r.barbershop_rating), 0)) DESC
      LIMIT 10
    `);
    const trending_haircuts = trendingResult.rows.map((row) => ({
      ...row,
      distance_km: hasLocation
        ? haversine(
            customerLat,
            customerLon,
            shopsWithDistance.find((s) => s.id === row.barbershop_id)?.latitude,
            shopsWithDistance.find((s) => s.id === row.barbershop_id)?.longitude
          )
        : null,
    }));

    // ─────────────────────────────────────────────────────────────
    // FEED 3: Top-Rated Services (highest avg satisfaction, min 3 reviews)
    // ─────────────────────────────────────────────────────────────
    const topServicesResult = await pool.query(`
      SELECT
        s.id, s.name, s.description, s.price, s.duration_minutes, s.image_url,
        s.category, s.is_home_service,
        b.id AS barber_id, b.name AS barber_name, b.photo_url AS barber_photo,
        bs.id AS barbershop_id, bs.name AS barbershop_name, bs.city,
        COALESCE(AVG(r.barbershop_rating), 0)::numeric(3,2) AS avg_rating,
        COUNT(DISTINCT r.id) AS review_count
      FROM services s
      JOIN barbers b ON b.id = s.created_by_barber_id
      JOIN barbershops bs ON bs.id = b.barbershop_id
      LEFT JOIN appointments a ON a.service_id = s.id AND a.status = 'completed'
      LEFT JOIN ratings r ON r.appointment_id = a.id
      WHERE bs.is_active = true AND bs.subscription_status = 'active'
      GROUP BY s.id, b.id, bs.id
      HAVING COALESCE(AVG(r.barbershop_rating), 0) >= 0
      ORDER BY AVG(r.barbershop_rating) DESC, COUNT(DISTINCT r.id) DESC
      LIMIT 10
    `);
    const top_rated_services = topServicesResult.rows;

    // ─────────────────────────────────────────────────────────────
    // FEED 4: Master Barbers (composite ranking formula)
    // ─────────────────────────────────────────────────────────────
    const masterBarbersResult = await pool.query(`
      SELECT
        b.id, b.name, b.photo_url, b.specialties, b.is_available,
        bs.id AS barbershop_id, bs.name AS barbershop_name, bs.city,
        bs.latitude, bs.longitude,
        COALESCE(b.rating, 0)::numeric(3,2) AS rating,
        COALESCE(COUNT(DISTINCT a.id), 0) AS total_cuts,
        COALESCE(COUNT(DISTINCT r.id), 0) AS review_count
      FROM barbers b
      JOIN barbershops bs ON bs.id = b.barbershop_id
      LEFT JOIN appointments a ON a.barber_id = b.id AND a.status = 'completed'
      LEFT JOIN barber_ratings r ON r.barber_id = b.id
      WHERE b.is_available = true AND bs.is_active = true AND bs.subscription_status = 'active'
      GROUP BY b.id, bs.id
      ORDER BY
        (COALESCE(b.rating, 0) * 0.6 + LOG(GREATEST(COUNT(DISTINCT a.id) + 1, 1)) * 0.4) DESC
      LIMIT 10
    `);
    const master_barbers = masterBarbersResult.rows.map((b) => ({
      ...b,
      distance_km: hasLocation
        ? haversine(customerLat, customerLon, parseFloat(b.latitude), parseFloat(b.longitude))
        : null,
    }));

    // ─────────────────────────────────────────────────────────────
    // FEED 5: Premier Barbershops (4.7+ rating, ≥10 reviews)
    // ─────────────────────────────────────────────────────────────
    const premierShops = shopsWithDistance
      .filter((s) => parseFloat(s.avg_rating) >= 4.0 && parseInt(s.review_count, 10) >= 2)
      .sort((a, b) => parseFloat(b.avg_rating) - parseFloat(a.avg_rating))
      .slice(0, 8);

    // ─────────────────────────────────────────────────────────────
    // FEED 6: Open Right Now (convenience feed)
    // ─────────────────────────────────────────────────────────────
    const open_now = shopsWithDistance
      .filter((s) => s.is_open_now === true)
      .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
      .slice(0, 8);

    // ─────────────────────────────────────────────────────────────
    // FEED 7: No Wait (empty queue shops)
    // ─────────────────────────────────────────────────────────────
    const no_wait_shops = shopsWithDistance
      .filter((s) => s.in_queue_count === 0 && s.is_open_now)
      .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999))
      .slice(0, 8);

    res.json({
      customer: {
        name: customer.name,
        has_location: hasLocation,
        location_city: customer.location_city,
        is_subscriber: isSubscriber,
      },
      feeds: {
        closest_shops,
        trending_haircuts,
        top_rated_services,
        master_barbers,
        premier_shops: premierShops,
        open_now,
        no_wait_shops,
      },
    });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
