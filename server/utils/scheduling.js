const SLOT_INTERVAL_MINUTES = 30;

function toMinutes(time) {
  const match = String(time || '').match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isWithinBookingWindow(date, today = new Date()) {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = Date.parse(`${date}T00:00:00.000Z`);
  const daysAhead = (target - start) / (24 * 60 * 60 * 1000);
  return daysAhead >= 0 && daysAhead <= 30;
}

async function getSchedule(db, barbershopId, barberId, date) {
  const result = await db.query(`
    SELECT a.appointment_time::text as appointment_time, 30 as duration_minutes,
      COALESCE(a.is_event_booking, false) as is_event_booking
    FROM appointments a
    WHERE a.barbershop_id = $1 AND a.appointment_date = $3
      AND a.status NOT IN ('cancelled', 'no_show')
      AND ($2::int IS NULL OR a.barber_id = $2 OR a.barber_id IS NULL)
    UNION ALL
    SELECT w.appointment_time::text as appointment_time, 30 as duration_minutes,
      false as is_event_booking
    FROM walk_ins w
    WHERE w.barbershop_id = $1 AND w.appointment_date = $3
      AND w.status <> 'cancelled'
      AND ($2::int IS NULL OR w.barber_id = $2 OR w.barber_id IS NULL)
  `, [barbershopId, barberId || null, date]);
  return result.rows.map(row => ({
    start: toMinutes(row.appointment_time),
    duration: Number(row.duration_minutes) || SLOT_INTERVAL_MINUTES,
    isEventBooking: row.is_event_booking
  })).filter(session => session.start !== null);
}

async function getBusinessHours(db, barbershopId) {
  const result = await db.query(
    'SELECT opening_time::text as opening_time, closing_time::text as closing_time FROM barbershops WHERE id = $1',
    [barbershopId]
  );
  if (!result.rows.length) throw new Error('Barbershop not found');
  return {
    open: toMinutes(result.rows[0].opening_time) ?? 8 * 60,
    close: toMinutes(result.rows[0].closing_time) ?? 20 * 60
  };
}

function overlaps(start, duration, session) {
  return start < session.start + session.duration && session.start < start + duration;
}

async function getBookedSlots(db, barbershopId, barberId, date, duration) {
  const [hours, schedule] = await Promise.all([
    getBusinessHours(db, barbershopId),
    getSchedule(db, barbershopId, barberId, date)
  ]);
  const bookedSlots = [];
  const hasEventBooking = schedule.some(session => session.isEventBooking);
  for (let start = hours.open; start + duration <= hours.close; start += SLOT_INTERVAL_MINUTES) {
    if (hasEventBooking || schedule.some(session => overlaps(start, duration, session))) {
      bookedSlots.push(formatTime(start));
    }
  }
  return bookedSlots;
}

async function isSlotAvailable(db, barbershopId, barberId, date, time, duration) {
  const [hours, schedule] = await Promise.all([
    getBusinessHours(db, barbershopId),
    getSchedule(db, barbershopId, barberId, date)
  ]);
  const start = toMinutes(time);
  if (start === null || start < hours.open || start + duration > hours.close ||
      (start - hours.open) % SLOT_INTERVAL_MINUTES !== 0) {
    return false;
  }
  if (schedule.some(session => session.isEventBooking)) return false;
  return !schedule.some(session => overlaps(start, duration, session));
}

async function isDateAvailable(db, barbershopId, barberId, date) {
  const schedule = await getSchedule(db, barbershopId, barberId, date);
  return schedule.length === 0;
}

module.exports = {
  SLOT_INTERVAL_MINUTES,
  getBookedSlots,
  isSlotAvailable,
  isDateAvailable,
  getBusinessHours,
  isValidDate,
  isWithinBookingWindow
};
