const pool = require('../db');

// Resolves the barber id a request should act as.
// - If the authenticated user is a barber, returns their own id.
// - If the authenticated user is a barbershop with solo mode enabled, returns
//   the id of the shop's single internal "operator" barber row.
// Throws { status, message } on failure so routes can respond appropriately.
async function resolveActingBarberId(req) {
  if (req.user.type === 'barber') return req.user.id;

  if (req.user.type === 'barbershop') {
    const shopRes = await pool.query('SELECT is_solo FROM barbershops WHERE id = $1', [req.user.id]);
    if (!shopRes.rows.length || !shopRes.rows[0].is_solo) {
      throw { status: 403, message: 'Enable Solo Operator Mode in Settings to use this feature.' };
    }
    const barberRes = await pool.query('SELECT id FROM barbers WHERE barbershop_id = $1 ORDER BY id LIMIT 1', [req.user.id]);
    if (!barberRes.rows.length) {
      throw { status: 404, message: 'Operator profile not found' };
    }
    return barberRes.rows[0].id;
  }

  throw { status: 403, message: 'Not authorized' };
}

module.exports = { resolveActingBarberId };
