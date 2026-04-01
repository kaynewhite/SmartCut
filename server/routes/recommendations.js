const express = require('express');
const router = express.Router();
const pool = require('../db');

// Recommendation system
// Parameters: specialty, ratings, availability, location, price
router.get('/', async (req, res) => {
  const { specialty, max_price, city, service_type, date, time } = req.query;
  try {
    let query = `
      SELECT DISTINCT b.id, b.name, b.address, b.city, b.description, b.logo_url,
             b.opening_time, b.closing_time,
             COALESCE(AVG(r.barbershop_rating), 0) as avg_rating,
             COUNT(DISTINCT r.id) as review_count,
             MIN(s.price) as min_price,
             MAX(s.price) as max_price
      FROM barbershops b
      LEFT JOIN ratings r ON r.barbershop_id = b.id
      LEFT JOIN services s ON s.barbershop_id = b.id AND s.is_active = true
      LEFT JOIN barbers bar ON bar.barbershop_id = b.id
      LEFT JOIN barber_specialties bs ON bs.barber_id = bar.id
      WHERE b.is_active = true
    `;
    const params = [];
    let idx = 1;

    if (city) {
      query += ` AND LOWER(b.city) LIKE LOWER($${idx++})`;
      params.push(`%${city}%`);
    }
    if (max_price) {
      query += ` AND s.price <= $${idx++}`;
      params.push(max_price);
    }
    if (specialty) {
      query += ` AND LOWER(bs.specialty) LIKE LOWER($${idx++})`;
      params.push(`%${specialty}%`);
    }
    if (service_type) {
      query += ` AND (LOWER(s.name) LIKE LOWER($${idx++}) OR LOWER(s.category) LIKE LOWER($${idx++}))`;
      params.push(`%${service_type}%`, `%${service_type}%`);
    }

    query += ` GROUP BY b.id ORDER BY avg_rating DESC, review_count DESC LIMIT 20`;

    const result = await pool.query(query, params);

    // Score and sort by all parameters
    const scored = result.rows.map(shop => {
      let score = 0;
      score += parseFloat(shop.avg_rating) * 20; // ratings weight: 20
      if (city && shop.city?.toLowerCase().includes(city.toLowerCase())) score += 30; // location weight: 30
      if (max_price && shop.min_price <= max_price) score += 15; // price weight: 15
      score += Math.min(parseInt(shop.review_count), 50); // reviews bonus
      return { ...shop, score };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json(scored);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get barber recommendations
router.get('/barbers', async (req, res) => {
  const { specialty, barbershop_id } = req.query;
  try {
    let query = `
      SELECT bar.*, b.name as barbershop_name, b.address as barbershop_address,
             COALESCE(AVG(r.barber_rating), 0) as avg_rating,
             COUNT(DISTINCT r.id) as review_count,
             ARRAY_AGG(DISTINCT bs.specialty) FILTER (WHERE bs.specialty IS NOT NULL) as specialties
      FROM barbers bar
      JOIN barbershops b ON b.id = bar.barbershop_id
      LEFT JOIN ratings r ON r.barber_id = bar.id
      LEFT JOIN barber_specialties bs ON bs.barber_id = bar.id
      WHERE b.is_active = true AND bar.is_available = true
    `;
    const params = [];
    let idx = 1;
    if (specialty) {
      query += ` AND LOWER(bs.specialty) LIKE LOWER($${idx++})`;
      params.push(`%${specialty}%`);
    }
    if (barbershop_id) {
      query += ` AND bar.barbershop_id = $${idx++}`;
      params.push(barbershop_id);
    }
    query += ` GROUP BY bar.id, b.id ORDER BY avg_rating DESC LIMIT 20`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
