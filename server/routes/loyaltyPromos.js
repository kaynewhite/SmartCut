const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const { authenticateBarbershop, authenticateCustomer } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `promo_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUBLIC: list active promos (optionally filter by shop)
router.get('/', async (req, res) => {
  try {
    const { barbershop_id } = req.query;
    let q = `SELECT p.*, b.name as barbershop_name, b.logo_url as barbershop_logo, b.city as barbershop_city
             FROM loyalty_promos p JOIN barbershops b ON b.id = p.barbershop_id
             WHERE p.is_active = true AND b.is_active = true`;
    const params = [];
    if (barbershop_id) { params.push(barbershop_id); q += ` AND p.barbershop_id = $1`; }
    q += ' ORDER BY p.points_cost ASC, p.id DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): list my promos
router.get('/me', authenticateBarbershop, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM loyalty_promos WHERE barbershop_id = $1 ORDER BY id DESC', [req.user.id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): create
router.post('/me', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, points_cost } = req.body;
    if (!name || !points_cost) return res.status(400).json({ message: 'Name and points cost are required' });
    const cost = parseInt(points_cost);
    if (isNaN(cost) || cost < 1) return res.status(400).json({ message: 'Points cost must be at least 1' });
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const r = await pool.query(
      `INSERT INTO loyalty_promos (barbershop_id, name, description, points_cost, image_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, name, description || null, cost, image_url]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// AUTH (OWNER): update
router.put('/me/:id', authenticateBarbershop, upload.single('image'), async (req, res) => {
  try {
    const { name, description, points_cost, is_active } = req.body;
    const existing = await pool.query('SELECT * FROM loyalty_promos WHERE id = $1 AND barbershop_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Not found' });
    const image_url = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].image_url;
    const r = await pool.query(
      `UPDATE loyalty_promos SET name=$1, description=$2, points_cost=$3, image_url=$4, is_active=$5
       WHERE id=$6 AND barbershop_id=$7 RETURNING *`,
      [name || existing.rows[0].name, description ?? existing.rows[0].description,
       points_cost ? parseInt(points_cost) : existing.rows[0].points_cost,
       image_url,
       is_active !== undefined ? (is_active === 'true' || is_active === true) : existing.rows[0].is_active,
       req.params.id, req.user.id]
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
      `INSERT INTO promo_redemptions (customer_id, promo_id, barbershop_id, points_spent, redemption_code) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, promo.id, promo.barbershop_id, promo.points_cost, code]
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
