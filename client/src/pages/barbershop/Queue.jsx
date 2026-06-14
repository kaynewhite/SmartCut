import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, PlayCircle, RefreshCw, X, Users, Clock } from 'lucide-react';
import styles from './Queue.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

const REFRESH_INTERVAL = 20000;

export default function BarbershopQueue() {
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ customer_name: '', service_id: '', barber_id: '' });
  const [shopId, setShopId] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchQueue = async (id) => {
    const sid = id || shopId;
    if (!sid) return;
    try {
      const res = await api.get(`/queue/${sid}`);
      setQueue(res.data);
      setLastRefresh(new Date());
    } catch {}
  };

  const fetchData = async () => {
    try {
      const profileRes = await api.get('/barbershops/me/profile');
      const id = profileRes.data.id;
      setShopId(id);
      const [qRes, sRes, bRes] = await Promise.all([
        api.get(`/queue/${id}`),
        api.get('/services/me'),
        api.get('/barbers', { params: { barbershop_id: id } })
      ]);
      setQueue(qRes.data);
      setServices(sRes.data);
      setBarbers(bRes.data);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setShopId(id => { if (id) fetchQueue(id); return id; });
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const openAddModal = () => {
    setForm({ customer_name: '', service_id: '', barber_id: '' });
    setAddModal(true);
  };

  const handleBarberChange = (barber_id) => {
    setForm(p => ({ ...p, barber_id, service_id: '' }));
  };

  const filteredServices = form.barber_id
    ? services.filter(s => !s.created_by_barber_id || String(s.created_by_barber_id) === String(form.barber_id))
    : services;

  const addWalkIn = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) return toast.error('Customer name required');
    try {
      await api.post('/queue', form);
      toast.success('Walk-in added to queue!');
      setAddModal(false);
      setForm({ customer_name: '', service_id: '', barber_id: '' });
      fetchQueue();
    } catch { toast.error('Failed'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/queue/${id}/status`, { status });
      fetchQueue();
    } catch { toast.error('Failed'); }
  };

  const waitingAppts = queue.appointments.filter(a => ['confirmed','pending'].includes(a.status));
  const waitingWalkIns = queue.walk_ins.filter(w => w.status === 'waiting');
  const totalWaiting = waitingAppts.length + waitingWalkIns.length;
  const inProgress =
    queue.walk_ins.filter(w => w.status === 'in_progress').length +
    queue.appointments.filter(a => a.status === 'in_progress').length;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1>Queue Management</h1>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
              Auto-refreshes every 20s · Last: {formatTime(lastRefresh.toTimeString().substring(0,5))}
            </div>
          </div>
          <div className={styles.headerBtns}>
            <button className={styles.refreshBtn} onClick={() => fetchQueue()}>
              <RefreshCw size={15} />
            </button>
            <button className={styles.addBtn} onClick={openAddModal}>
              <Plus size={16} /> Add Walk-in
            </button>
          </div>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statNum}>{totalWaiting}</div>
            <div className={styles.statLabel}>Waiting</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{inProgress}</div>
            <div className={styles.statLabel}>In Progress</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>{queue.appointments.length + queue.walk_ins.length}</div>
            <div className={styles.statLabel}>Total</div>
          </div>
        </div>

        <div className={styles.sections}>
          {/* Appointment Queue */}
          <div className={styles.section}>
            <h2>Booked Appointments <span style={{ fontSize: 13, color: '#8b92a9', fontWeight: 400 }}>({queue.appointments.length})</span></h2>
            {queue.appointments.length === 0 ? (
              <div className={styles.empty}>No appointments in queue right now</div>
            ) : (
              queue.appointments.map(a => (
                <div key={a.id} className={`${styles.item} ${a.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum} title={`Queue ${formatQueueNumber(a.queue_number)}`}>
                    {formatQueueNumber(a.position)}
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>
                      {a.customer_name || `Customer ${formatQueueNumber(a.position)}`}
                    </div>
                    <div className={styles.itemMeta}>
                      {a.service_name}{a.barber_name ? ` · ${a.barber_name}` : ''} · {formatTime(a.appointment_time?.substring(0,5))}
                      {a.duration_minutes && <span style={{ color: '#4b5563' }}> · {a.duration_minutes} min</span>}
                    </div>
                  </div>
                  <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                    {a.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Walk-in Queue */}
          <div className={styles.section}>
            <h2>Walk-ins <span style={{ fontSize: 13, color: '#8b92a9', fontWeight: 400 }}>({queue.walk_ins.length})</span></h2>
            {queue.walk_ins.length === 0 ? (
              <div className={styles.empty}>No walk-ins · <button onClick={openAddModal} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Add one</button></div>
            ) : (
              queue.walk_ins.map(w => (
                <div key={w.id} className={`${styles.item} ${w.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum}>{formatQueueNumber(w.position)}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{w.customer_name}</div>
                    <div className={styles.itemMeta}>
                      {w.service_name || 'Walk-in'}{w.barber_name ? ` · ${w.barber_name}` : ''}
                      {w.duration_minutes && <span style={{ color: '#4b5563' }}> · {w.duration_minutes} min</span>}
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                      {w.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
                    </span>
                    {w.status === 'waiting' && (
                      <button className={styles.startBtn} onClick={() => updateStatus(w.id, 'in_progress')} title="Start service">
                        <PlayCircle size={14} />
                      </button>
                    )}
                    {w.status === 'in_progress' && (
                      <button className={styles.doneBtn} onClick={() => updateStatus(w.id, 'done')} title="Mark done">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => updateStatus(w.id, 'cancelled')} title="Remove from queue" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}>
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
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Add Walk-in Customer</h3>
                <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b92a9', padding: 4 }}><X size={18} /></button>
              </div>
              <form onSubmit={addWalkIn} className={styles.form}>
                <div className={styles.field}>
                  <label>Customer Name *</label>
                  <input className={styles.input} value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="e.g. Juan dela Cruz" required autoFocus />
                </div>
                <div className={styles.field}>
                  <label>Barber <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 11 }}>(select to filter services)</span></label>
                  <select className={styles.input} value={form.barber_id} onChange={e => handleBarberChange(e.target.value)}>
                    <option value="">Any available barber</option>
                    {barbers.filter(b => b.is_available).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Service {form.barber_id && <span style={{ color: '#d4af37', fontSize: 11 }}>(filtered)</span>}</label>
                  <select className={styles.input} value={form.service_id} onChange={e => setForm(p => ({ ...p, service_id: e.target.value }))}>
                    <option value="">No specific service</option>
                    {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name} — ₱{parseFloat(s.price || 0).toFixed(0)}</option>)}
                  </select>
                  {form.barber_id && filteredServices.length === 0 && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>No services for this barber. Try "Any barber".</div>
                  )}
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.saveBtn} type="submit">Add to Queue</button>
                  <button className={styles.cancelBtn} type="button" onClick={() => setAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
