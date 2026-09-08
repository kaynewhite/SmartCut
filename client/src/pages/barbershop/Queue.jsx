import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, PlayCircle, X, Users, Clock, Scissors, Calendar, Sparkles } from 'lucide-react';
import { useShopQueueSocket } from '../../context/SocketContext';
import styles from './Queue.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

export default function BarbershopQueue() {
  const [queue, setQueue] = useState({
    unified_queue: [],
    appointments: [],
    walk_ins: [],
    chairs: [],
    stats: { total_waiting: 0, in_progress_count: 0 },
  });
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ customer_name: '', service_id: '', barber_id: '' });
  const [shopId, setShopId] = useState(null);

  const fetchQueue = useCallback(async (id) => {
    const sid = id || shopId;
    if (!sid) return;
    try {
      const res = await api.get(`/queue/${sid}`);
      setQueue(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [shopId]);

  const fetchData = async () => {
    try {
      const profileRes = await api.get('/barbershops/me/profile');
      const id = profileRes.data.id;
      setShopId(id);
      const [qRes, sRes, bRes] = await Promise.all([
        api.get(`/queue/${id}`),
        api.get('/services/me'),
        api.get('/barbers', { params: { barbershop_id: id } }),
      ]);
      setQueue(qRes.data);
      setServices(sRes.data || []);
      setBarbers(bRes.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time Queue Socket Sync
  const { isConnected } = useShopQueueSocket(shopId, {
    onQueueUpdate: (data) => {
      setQueue(data);
    },
    onBarberStatus: () => {
      fetchData();
    },
  });

  const openAddModal = () => {
    setForm({ customer_name: '', service_id: '', barber_id: '' });
    setAddModal(true);
  };

  const handleBarberChange = (barber_id) => {
    setForm((p) => ({ ...p, barber_id, service_id: '' }));
  };

  const filteredServices = form.barber_id
    ? services.filter((s) => !s.created_by_barber_id || String(s.created_by_barber_id) === String(form.barber_id))
    : services;

  const addWalkIn = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) return toast.error('Customer name required');
    try {
      await api.post('/queue', form);
      toast.success('Walk-in added to queue!');
      setAddModal(false);
      setForm({ customer_name: '', service_id: '', barber_id: '' });
    } catch {
      toast.error('Failed to add walk-in');
    }
  };

  const updateWalkInStatus = async (id, status) => {
    try {
      await api.patch(`/queue/${id}/status`, { status });
      toast.success(`Walk-in marked as ${status === 'done' ? 'completed' : status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const updateApptStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success(`Appointment status updated to ${status}`);
    } catch {
      toast.error('Failed to update appointment');
    }
  };

  const { appointments = [], walk_ins = [], chairs = [], stats = {} } = queue;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1>Queue Management</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                  padding: '3px 10px',
                  borderRadius: 14,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                  }}
                />
                {isConnected ? 'Real-Time Sync Active' : 'Connecting...'}
              </span>
              <span style={{ fontSize: 12, color: '#8b92a9' }}>
                Instant queue sync across all barber chairs & customer screens
              </span>
            </div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.addBtn} onClick={openAddModal}>
              <Plus size={16} /> Add Walk-in
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statNum}>{stats.total_waiting || 0}</div>
            <div className={styles.statLabel}>Waiting in Line</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{stats.in_progress_count || 0}</div>
            <div className={styles.statLabel}>In Chairs (Cutting)</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>~{stats.est_wait_minutes || 0}m</div>
            <div className={styles.statLabel}>Est. Wait Time</div>
          </div>
        </div>

        {/* CHAIR OVERVIEW */}
        {chairs.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scissors size={16} color="#d4af37" /> Barber Chairs Status
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {chairs.map((chair) => (
                <div
                  key={chair.barber_id}
                  style={{
                    background: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: 12,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#f0f0f0', fontSize: 14 }}>{chair.barber_name}</span>
                    <span
                      className={`badge ${
                        chair.status === 'offline'
                          ? 'badge-error'
                          : chair.status === 'serving'
                          ? 'badge-info'
                          : 'badge-success'
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {chair.status === 'offline' ? 'Offline' : chair.status === 'serving' ? 'Cutting' : 'Ready'}
                    </span>
                  </div>

                  <div style={{ background: '#1a2234', borderRadius: 8, padding: 8, fontSize: 11, color: '#cbd5e1' }}>
                    {chair.current_serving ? (
                      <div>
                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>Now: </span>
                        {chair.current_serving.customer_name || 'Customer'} ({chair.current_serving.service_name})
                      </div>
                    ) : (
                      <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Chair available</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.sections}>
          {/* APPOINTMENT QUEUE */}
          <div className={styles.section}>
            <h2>
              Booked Appointments{' '}
              <span style={{ fontSize: 13, color: '#8b92a9', fontWeight: 400 }}>({appointments.length})</span>
            </h2>
            {appointments.length === 0 ? (
              <div className={styles.empty}>No booked appointments in queue for today</div>
            ) : (
              appointments.map((a) => (
                <div key={a.id} className={`${styles.item} ${a.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum} title={`Queue ${formatQueueNumber(a.queue_number)}`}>
                    #{a.queue_number}
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>
                      {a.customer_name || 'Customer'}
                    </div>
                    <div className={styles.itemMeta}>
                      {a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''} ·{' '}
                      {a.appointment_time ? formatTime(a.appointment_time.substring(0, 5)) : ''}
                      {a.duration_minutes && <span style={{ color: '#4b5563' }}> · {a.duration_minutes}m</span>}
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                      {a.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                    </span>
                    {a.status !== 'in_progress' && (
                      <button
                        className={styles.startBtn}
                        onClick={() => updateApptStatus(a.id, 'in_progress')}
                        title="Start Service"
                      >
                        <PlayCircle size={14} /> Start
                      </button>
                    )}
                    {a.status === 'in_progress' && (
                      <button
                        className={styles.doneBtn}
                        onClick={() => updateApptStatus(a.id, 'completed')}
                        title="Mark Completed"
                      >
                        <CheckCircle size={14} /> Complete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* WALK-IN QUEUE */}
          <div className={styles.section}>
            <h2>
              Walk-in Customers{' '}
              <span style={{ fontSize: 13, color: '#8b92a9', fontWeight: 400 }}>({walk_ins.length})</span>
            </h2>
            {walk_ins.length === 0 ? (
              <div className={styles.empty}>
                No walk-ins ·{' '}
                <button
                  onClick={openAddModal}
                  style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Add one
                </button>
              </div>
            ) : (
              walk_ins.map((w) => (
                <div key={w.id} className={`${styles.item} ${w.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum}>#{w.queue_number}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{w.customer_name}</div>
                    <div className={styles.itemMeta}>
                      {w.service_name || 'Walk-in'} {w.barber_name ? `· ${w.barber_name}` : ''}
                      {w.duration_minutes && <span style={{ color: '#4b5563' }}> · {w.duration_minutes}m</span>}
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                      {w.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                    </span>
                    {w.status === 'waiting' && (
                      <button
                        className={styles.startBtn}
                        onClick={() => updateWalkInStatus(w.id, 'in_progress')}
                        title="Start Service"
                      >
                        <PlayCircle size={14} /> Start
                      </button>
                    )}
                    {w.status === 'in_progress' && (
                      <button
                        className={styles.doneBtn}
                        onClick={() => updateWalkInStatus(w.id, 'done')}
                        title="Mark Done"
                      >
                        <CheckCircle size={14} /> Complete
                      </button>
                    )}
                    <button
                      onClick={() => updateWalkInStatus(w.id, 'cancelled')}
                      title="Remove from queue"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Walk-in Modal */}
        {addModal && (
          <div className={styles.modalBg} onClick={() => setAddModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, color: '#f0f0f0' }}>Add Walk-in Customer</h3>
                <button
                  onClick={() => setAddModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b92a9', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={addWalkIn} className={styles.form}>
                <div className={styles.field}>
                  <label>Customer Name *</label>
                  <input
                    className={styles.input}
                    value={form.customer_name}
                    onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                    placeholder="e.g. Juan dela Cruz"
                    required
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    Assign Barber <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 11 }}>(optional)</span>
                  </label>
                  <select
                    className={styles.input}
                    value={form.barber_id}
                    onChange={(e) => handleBarberChange(e.target.value)}
                  >
                    <option value="">Any available barber</option>
                    {barbers
                      .filter((b) => b.is_available)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Select Service</label>
                  <select
                    className={styles.input}
                    value={form.service_id}
                    onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
                  >
                    <option value="">Standard Walk-in</option>
                    {filteredServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — ₱{parseFloat(s.price || 0).toFixed(0)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.saveBtn} type="submit">
                    Add to Live Queue
                  </button>
                  <button className={styles.cancelBtn} type="button" onClick={() => setAddModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
