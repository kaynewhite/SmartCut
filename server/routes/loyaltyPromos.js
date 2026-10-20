const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateBarbershop, authenticateCustomer } = require('../middleware/auth');
const { createUpload } = require('../utils/upload');
const upload = createUpload();

// PUBLIC: list active promos (optionally filter by shop)
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    let q = `SELECT p.*, s.name as service_name, s.price as service_price,
             b.name as barbershop_name, b.logo_url as barbershop_logo, b.city as barbershop_city,
             br.name as barber_name, br.photo_url as barber_photo, br.is_available as barber_available
             FROM loyalty_promos p
             JOIN barbershops b ON b.id = p.barbershop_id
             LEFT JOIN services s ON s.id = p.service_id
             LEFT JOIN barbers br ON br.id = p.barber_id
             WHERE p.is_active = true AND b.is_active = true`;
    const params = [];
    if (barbershop_id) { params.push(barbershop_id); q += ` AND p.barbershop_id = $1`; }
    q += ' ORDER BY p.points_cost ASC, p.id DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): list my promos (includes barber info)
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.*, s.name as service_name, s.price as service_price,
        br.name as barber_name, br.is_available as barber_available
       FROM loyalty_promos p
       LEFT JOIN services s ON s.id = p.service_id
       LEFT JOIN barbers br ON br.id = p.barber_id
       WHERE p.barbershop_id = $1 ORDER BY p.id DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): create
router.post('/me', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, points_cost, real_price, barber_id, service_id } = req.body;
    if (!name || !points_cost || real_price === undefined || real_price === '') {
      return res.status(400).json({ message: 'Name, points cost, and real price are required' });
    }
    const cost = parseInt(points_cost);
    if (isNaN(cost) || cost < 1) return res.status(400).json({ message: 'Points cost must be at least 1' });
    const realPrice = Number(real_price);
    if (!Number.isFinite(realPrice) || realPrice <= 0 || realPrice > 99999999.99) {
      return res.status(400).json({ message: 'Real price must be greater than 0 and no more than 99,999,999.99' });
    }
    const image_url = req.file ? req.file.path : null;
    const barberId = barber_id && barber_id !== '' ? parseInt(barber_id) : null;
    const serviceId = service_id && service_id !== '' ? parseInt(service_id) : null;
    if (barberId !== null && !Number.isInteger(barberId)) return res.status(400).json({ message: 'Invalid barber' });
    if (serviceId && !Number.isInteger(serviceId)) return res.status(400).json({ message: 'Invalid service' });
    if (barberId) {
      const barberCheck = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [barberId, req.user.id]);
      if (!barberCheck.rows.length) return res.status(400).json({ message: 'Barber does not belong to this shop' });
    }
    if (serviceId) {
      if (!barberId) return res.status(400).json({ message: 'Choose a barber for the reward service' });
      const serviceCheck = await pool.query(
        `SELECT s.id FROM services s
         JOIN barber_services bs ON bs.service_id=s.id AND bs.barber_id=$2
         WHERE s.id=$1 AND s.barbershop_id=$3 AND s.is_active=true AND s.price IS NOT NULL`,
        [serviceId, barberId, req.user.id]
      );
      if (!serviceCheck.rows.length) return res.status(400).json({ message: 'Service is not offered by this barber at your shop' });
    }
    const r = await pool.query(
      `INSERT INTO loyalty_promos (barbershop_id, name, description, points_cost, real_price, image_url, barber_id, service_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name, description || null, cost, realPrice, image_url, barberId, serviceId]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): update
router.put('/me/:id', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, points_cost, real_price, is_active, barber_id, service_id } = req.body;
    const existing = await pool.query('SELECT * FROM loyalty_promos WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    let realPrice = existing.rows[0].real_price;
    if (real_price !== undefined) {
      realPrice = Number(real_price);
      if (!Number.isFinite(realPrice) || realPrice <= 0 || realPrice > 99999999.99) {
        return res.status(400).json({ message: 'Real price must be greater than 0 and no more than 99,999,999.99' });
      }
    }
    const image_url = req.file ? req.file.path : existing.rows[0].image_url;
    const barberId = barber_id === '' ? null : (barber_id !== undefined ? parseInt(barber_id) : existing.rows[0].barber_id);
    const serviceId = service_id === '' ? null : (service_id !== undefined ? parseInt(service_id) : existing.rows[0].service_id);
    if (barberId !== null && !Number.isInteger(barberId)) return res.status(400).json({ message: 'Invalid barber' });
    if (serviceId !== null && !Number.isInteger(serviceId)) return res.status(400).json({ message: 'Invalid service' });
    if (barberId) {
      const barberCheck = await pool.query('SELECT id FROM barbers WHERE id=$1 AND barbershop_id=$2', [barberId, req.user.id]);
      if (!barberCheck.rows.length) return res.status(400).json({ message: 'Barber does not belong to this shop' });
    }
    if (serviceId) {
      if (!barberId) return res.status(400).json({ message: 'Choose a barber for the reward service' });
      const serviceCheck = await pool.query(
        `SELECT s.id FROM services s
         JOIN barber_services bs ON bs.service_id=s.id AND bs.barber_id=$2
         WHERE s.id=$1 AND s.barbershop_id=$3 AND s.is_active=true AND s.price IS NOT NULL`,
        [serviceId, barberId, req.user.id]
      );
      if (!serviceCheck.rows.length) return res.status(400).json({ message: 'Service is not offered by this barber at your shop' });
    }
    const r = await pool.query(
      `UPDATE loyalty_promos SET name=$1, description=$2, points_cost=$3, image_url=$4, is_active=$5, barber_id=$6, real_price=$7, service_id=$8
       WHERE id=$9 AND barbershop_id=$10 RETURNING *`,
      [name || existing.rows[0].name, description ?? existing.rows[0].description,
       points_cost ? parseInt(points_cost) : existing.rows[0].points_cost,
       image_url,
       is_active !== undefined ? (is_active === 'true' || is_active === true) : existing.rows[0].is_active,
       barberId !== undefined ? barberId : existing.rows[0].barber_id,
       realPrice, serviceId, req.params.id, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): delete
router.delete('/me/:id', authenticateBarbershop, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM loyalty_promos WHERE id = $1 AND barbershop_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH (CUSTOMER): get my points balance at a specific shop
router.get('/balance/:shopId', authenticateCustomer, async (req, res) => {
  try {
    const r = await pool.query('SELECT points FROM customer_shop_loyalty WHERE customer_id = $1 AND barbershop_id = $2',
      [req.user.id, req.params.shopId]);
    res.json({ barbershop_id: parseInt(req.params.shopId), points: r.rows[0]?.points || 0 });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH (CUSTOMER): redeem a promo (uses points earned at THAT shop only)
router.post('/:id/redeem', authenticateCustomer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const promoR = await client.query('SELECT * FROM loyalty_promos WHERE id = $1 AND is_active = true', [req.params.id]);
    if (!promoR.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Promo not available' }); }
    const promo = promoR.rows[0];
    const balR = await client.query(
      'SELECT points FROM customer_shop_loyalty WHERE customer_id = $1 AND barbershop_id = $2 FOR UPDATE',
      [req.user.id, promo.barbershop_id]
    );
    const balance = balR.rows[0]?.points || 0;
    if (balance < promo.points_cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Not enough points at this shop. You have ${balance}, need ${promo.points_cost}.` });
    }
    const code = 'PR' + Math.random().toString(36).slice(2, 8).toUpperCase();
    await client.query(
      `INSERT INTO customer_shop_loyalty (customer_id, barbershop_id, points, updated_at)
       VALUES ($1,$2,-$3,NOW())
       ON CONFLICT (customer_id, barbershop_id) DO UPDATE SET points = customer_shop_loyalty.points - $3, updated_at = NOW()`,
      [req.user.id, promo.barbershop_id, promo.points_cost]
    );
    await client.query(`INSERT INTO loyalty_transactions (customer_id, barbershop_id, points, type, description) VALUES ($1,$2,$3,'spent',$4)`,
      [req.user.id, promo.barbershop_id, -promo.points_cost, `Redeemed: ${promo.name}`]);
    const redR = await client.query(
      `INSERT INTO promo_redemptions (customer_id, promo_id, barbershop_id, points_spent, promo_value, redemption_code)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, promo.id, promo.barbershop_id, promo.points_cost, promo.real_price, code]
    );
    await client.query(
      `INSERT INTO notifications (recipient_type, recipient_id, title, message, type, related_id) VALUES ('barbershop',$1,'Promo Redeemed',$2,'promo_redeem',$3)`,
      [promo.barbershop_id, `A customer redeemed "${promo.name}" with code ${code}`, redR.rows[0].id]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...redR.rows[0], promo_name: promo.name });
  } catch (err) { await client.query('ROLLBACK'); console.error(err); res.status(500).json({ message: 'Server error' }); }
  finally { client.release(); }
});

// AUTH (CUSTOMER): list my redemptions
router.get('/redemptions/me', authenticateCustomer, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT r.*, p.name as promo_name, p.image_url as promo_image, b.name as barbershop_name
      FROM promo_redemptions r
      LEFT JOIN loyalty_promos p ON p.id = r.promo_id
      LEFT JOIN barbershops b ON b.id = r.barbershop_id
      WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
