const { Server } = require('socket.io');
const pool = require('./db');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    // Room subscriptions
    socket.on('join:shop', (shopId) => {
      if (shopId) {
        socket.join(`shop:${shopId}`);
      }
    });

    socket.on('leave:shop', (shopId) => {
      if (shopId) {
        socket.leave(`shop:${shopId}`);
      }
    });

    socket.on('join:barber', (barberId) => {
      if (barberId) {
        socket.join(`barber:${barberId}`);
      }
    });

    socket.on('leave:barber', (barberId) => {
      if (barberId) {
        socket.leave(`barber:${barberId}`);
      }
    });

    socket.on('join:customer', (customerId) => {
      if (customerId) {
        socket.join(`customer:${customerId}`);
      }
    });

    socket.on('leave:customer', (customerId) => {
      if (customerId) {
        socket.leave(`customer:${customerId}`);
      }
    });

    socket.on('join:explore', () => {
      socket.join('explore');
    });

    socket.on('leave:explore', () => {
      socket.leave('explore');
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToShop(shopId, event, data) {
  if (io && shopId) {
    io.to(`shop:${shopId}`).emit(event, data);
  }
}

function emitToBarber(barberId, event, data) {
  if (io && barberId) {
    io.to(`barber:${barberId}`).emit(event, data);
  }
}

function emitToCustomer(customerId, event, data) {
  if (io && customerId) {
    io.to(`customer:${customerId}`).emit(event, data);
  }
}

function emitToExplore(event, data) {
  if (io) {
    io.to('explore').emit(event, data);
  }
}

/**
 * Builds and broadcasts a complete, clean, unified queue state for a barbershop.
 */
async function broadcastQueueUpdate(shopId) {
  if (!io || !shopId) return;
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch appointments
    const apptRes = await pool.query(
      `SELECT a.id, a.queue_number, a.status, a.appointment_time, a.customer_id,
              a.is_home_service, a.total_amount, a.notes,
              c.name as customer_name, c.avatar_url as customer_avatar,
              s.id as service_id, s.name as service_name, COALESCE(s.duration_minutes, 25) as duration_minutes,
              br.id as barber_id, br.name as barber_name, br.photo_url as barber_photo
       FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN services s ON s.id = a.service_id
       LEFT JOIN barbers br ON br.id = a.barber_id
       WHERE a.barbershop_id = $1
         AND a.appointment_date = $2
         AND a.status IN ('pending', 'confirmed', 'in_progress')
       ORDER BY a.queue_number ASC, a.appointment_time ASC`,
      [shopId, today]
    );

    // 2. Fetch walk-ins
    const walkInRes = await pool.query(
      `SELECT w.id, w.queue_number, w.status, w.customer_name, w.created_at,
              s.id as service_id, s.name as service_name, COALESCE(s.duration_minutes, 25) as duration_minutes,
              br.id as barber_id, br.name as barber_name, br.photo_url as barber_photo
       FROM walk_ins w
       LEFT JOIN services s ON s.id = w.service_id
       LEFT JOIN barbers br ON br.id = w.barber_id
       WHERE w.barbershop_id = $1
         AND w.status IN ('waiting', 'in_progress')
         AND DATE(w.created_at) = $2
       ORDER BY w.queue_number ASC, w.created_at ASC`,
      [shopId, today]
    );

    // 3. Fetch active barbers for chair overview
    const barbersRes = await pool.query(
      `SELECT id, name, photo_url, is_available, rating
       FROM barbers
       WHERE barbershop_id = $1
       ORDER BY id ASC`,
      [shopId]
    );

    // Merge and compute unified queue with true sequential positions
    const rawUnified = [
      ...apptRes.rows.map((a) => ({
        ...a,
        type: 'appointment',
        display_type: a.is_home_service ? 'Home Service' : 'Appointment',
        sort_key: a.status === 'in_progress' ? 0 : 1,
        time_display: a.appointment_time ? a.appointment_time.substring(0, 5) : null,
      })),
      ...walkInRes.rows.map((w) => ({
        ...w,
        type: 'walk_in',
        display_type: 'Walk-in',
        sort_key: w.status === 'in_progress' ? 0 : 1,
        time_display: new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    ];

    // Sort: In-progress items first, then by queue_number
    rawUnified.sort((a, b) => {
      if (a.sort_key !== b.sort_key) return a.sort_key - b.sort_key;
      return (a.queue_number || 0) - (b.queue_number || 0);
    });

    const unified_queue = rawUnified.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));

    // Build Chairs View
    const chairs = barbersRes.rows.map((barber) => {
      const currentServing = unified_queue.find(
        (q) => String(q.barber_id) === String(barber.id) && q.status === 'in_progress'
      );
      const waitingList = unified_queue.filter(
        (q) =>
          String(q.barber_id) === String(barber.id) &&
          (q.status === 'waiting' || q.status === 'confirmed' || q.status === 'pending')
      );

      return {
        barber_id: barber.id,
        barber_name: barber.name,
        photo_url: barber.photo_url,
        is_available: barber.is_available,
        status: !barber.is_available ? 'offline' : currentServing ? 'serving' : 'available',
        current_serving: currentServing || null,
        next_up: waitingList[0] || null,
        waiting_count: waitingList.length,
      };
    });

    const waitingItems = unified_queue.filter(
      (item) => item.status === 'waiting' || item.status === 'confirmed' || item.status === 'pending'
    );
    const inProgressItems = unified_queue.filter((item) => item.status === 'in_progress');

    const totalEstWait = waitingItems.reduce(
      (sum, item) => sum + (parseInt(item.duration_minutes, 10) || 25),
      0
    );

    const activeBarbersCount = barbersRes.rows.filter((b) => b.is_available).length || 1;
    const estWaitMinutes = Math.ceil(totalEstWait / Math.max(activeBarbersCount, 1));

    const payload = {
      barbershop_id: parseInt(shopId, 10),
      timestamp: new Date().toISOString(),
      unified_queue,
      appointments: apptRes.rows,
      walk_ins: walkInRes.rows,
      chairs,
      stats: {
        total_waiting: waitingItems.length,
        in_progress_count: inProgressItems.length,
        active_barbers_count: activeBarbersCount,
        est_wait_minutes: estWaitMinutes,
      },
    };

    // Emit to shop room
    io.to(`shop:${shopId}`).emit('QUEUE_UPDATED', payload);

    // Also update explore room with shop's updated queue count
    io.to('explore').emit('SHOP_QUEUE_COUNTER_UPDATED', {
      barbershop_id: parseInt(shopId, 10),
      in_queue_count: waitingItems.length + inProgressItems.length,
      est_wait_minutes: estWaitMinutes,
    });
  } catch (err) {
    console.error('Error broadcasting queue update:', err);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToShop,
  emitToBarber,
  emitToCustomer,
  emitToExplore,
  broadcastQueueUpdate,
};
