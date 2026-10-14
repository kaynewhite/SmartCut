import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, PlayCircle, RefreshCw, X, Clock } from 'lucide-react';
import styles from './Queue.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

const REFRESH_INTERVAL = 20000;

export default function BarbershopQueue() {
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [services, setServices] = useState([]);
  const [barberServices, setBarberServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ customer_name: '', service_id: '', barber_id: '', appointment_date: '', appointment_time: '' });
  const [shopId, setShopId] = useState(null);
  const [shopHours, setShopHours] = useState({ opening_time: '08:00', closing_time: '20:00' });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const todayDate = new Date().toISOString().split('T')[0];
  const lastBookableDate = new Date();
  lastBookableDate.setUTCDate(lastBookableDate.getUTCDate() + 30);
  const maxBookableDate = lastBookableDate.toISOString().split('T')[0];

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
      setShopHours({
        opening_time: profileRes.data.opening_time?.substring(0, 5) || '08:00',
        closing_time: profileRes.data.closing_time?.substring(0, 5) || '20:00'
      });
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
    setForm({
      customer_name: '',
      service_id: '',
      barber_id: '',
      appointment_date: todayDate,
      appointment_time: ''
    });
    setAddModal(true);
  };

  const handleBarberChange = (barber_id) => {
    setForm(p => ({ ...p, barber_id, service_id: '', appointment_time: '' }));
  };

  useEffect(() => {
    if (!form.barber_id) {
      setBarberServices(services.filter(service => service.is_active && service.price !== null));
      setServicesLoading(false);
      return;
    }
    let active = true;
    setServicesLoading(true);
    api.get(`/services/by-barber/${form.barber_id}`)
      .then(res => { if (active) setBarberServices(res.data || []); })
      .catch(() => { if (active) { setBarberServices([]); toast.error('Could not load this barber’s services'); } })
      .finally(() => { if (active) setServicesLoading(false); });
    return () => { active = false; };
  }, [form.barber_id, services]);

  const filteredServices = barberServices;

  useEffect(() => {
    if (!addModal || !shopId || !form.appointment_date) return;
    if (form.appointment_date > maxBookableDate) {
      setBookedSlots([]);
      return;
    }
    let active = true;
    setBookedSlots([]);
    api.get('/appointments/available-slots', {
      params: {
        barbershop_id: shopId,
        barber_id: form.barber_id || undefined,
        date: form.appointment_date,
      }
    }).then(res => {
      if (active) setBookedSlots(res.data.booked_slots || []);
    }).catch(() => {
      if (active) toast.error('Could not load available walk-in times');
    });
    return () => { active = false; };
  }, [addModal, shopId, form.appointment_date, form.barber_id, maxBookableDate]);

  const walkInSlots = () => {
    const [openHour, openMinute] = shopHours.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = shopHours.closing_time.split(':').map(Number);
    const open = openHour * 60 + openMinute;
    const close = closeHour * 60 + closeMinute;
    const slots = [];
    for (let start = open; start + 30 <= close; start += 30) {
      slots.push(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`);
    }
    return slots;
  };
  const availableWalkInSlots = walkInSlots().filter(time => !bookedSlots.includes(time));

  const addWalkIn = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) return toast.error('Customer name required');
    if (!form.appointment_time) return toast.error('Select an available session time');
    try {
      await api.post('/queue', form);
      toast.success('Walk-in session scheduled!');
      setAddModal(false);
      setForm({ customer_name: '', service_id: '', barber_id: '', appointment_date: '', appointment_time: '' });
      fetchQueue();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to schedule walk-in'); }
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
  const queueEntries = [
    ...queue.appointments.map(entry => ({ ...entry, entryType: 'online' })),
    ...queue.walk_ins.map(entry => ({ ...entry, entryType: 'walk_in' }))
  ].sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)) ||
    Number(a.queue_number) - Number(b.queue_number));

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1>Queue Management</h1>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
              Polls every 20s · Last: {formatTime(lastRefresh.toTimeString().substring(0,5))}
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
          <div className={styles.section}>
            <h2>Today's Sessions <span style={{ fontSize: 13, color: '#8b92a9', fontWeight: 400 }}>({queueEntries.length})</span></h2>
            {queueEntries.length === 0 ? (
              <div className={styles.empty}>No sessions scheduled · <button onClick={openAddModal} style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Add a walk-in</button></div>
            ) : (
              queueEntries.map(entry => (
                <div key={`${entry.entryType}-${entry.id}`} className={`${styles.item} ${entry.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum} title={`Queue ${formatQueueNumber(entry.queue_number)}`}>
                    {formatQueueNumber(entry.queue_number)}
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{entry.customer_name || 'Customer'}</div>
                    <div className={styles.itemMeta}>
                      {entry.service_name || 'Walk-in'}{entry.barber_name ? ` · ${entry.barber_name}` : ''} · {formatTime(entry.appointment_time)}
                      <span style={{ color: '#4b5563' }}> · 30 min</span>
                    </div>
                  </div>
                  <span className={`badge ${entry.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                    {entry.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
                  </span>
                  <span className={`badge ${entry.entryType === 'walk_in' ? 'badge-warning' : 'badge-info'}`}>
                    {entry.entryType === 'walk_in' ? 'Walk-in' : 'Online'}
                  </span>
                  {entry.entryType === 'walk_in' && <div className={styles.itemActions}>
                    {entry.status === 'waiting' && (
                      <button className={styles.startBtn} onClick={() => updateStatus(entry.id, 'in_progress')} title="Start service">
                        <PlayCircle size={14} />
                      </button>
                    )}
                    {entry.status === 'in_progress' && (
                      <button className={styles.doneBtn} onClick={() => updateStatus(entry.id, 'done')} title="Mark done">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => updateStatus(entry.id, 'cancelled')} title="Remove from queue" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px' }}>
                      <X size={14} />
                    </button>
                  </div>}
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
                  <select className={styles.input} value={form.service_id} onChange={e => setForm(p => ({ ...p, service_id: e.target.value }))} disabled={servicesLoading}>
                    <option value="">{servicesLoading ? 'Loading barber services…' : 'No specific service'}</option>
                    {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name} — ₱{parseFloat(s.price || 0).toFixed(0)}</option>)}
                  </select>
                  {form.barber_id && filteredServices.length === 0 && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>No services for this barber. Try "Any barber".</div>
                  )}
                </div>
                <div className={styles.field}>
                  <label>Session Date *</label>
                  <input
                    className={`${styles.input} ${styles.walkInDate}`}
                    type="date"
                    min={todayDate}
                    max={maxBookableDate}
                    value={form.appointment_date}
                    onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value, appointment_time: '' }))}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>30-minute Session Time *</label>
                  <div className={styles.timeSlots} role="group" aria-label="Available session times">
                    {form.appointment_date && availableWalkInSlots.map(time => (
                      <button
                        key={time}
                        type="button"
                        className={`${styles.timeSlot} ${form.appointment_time === time ? styles.selectedTimeSlot : ''}`}
                        aria-pressed={form.appointment_time === time}
                        onClick={() => setForm(p => ({ ...p, appointment_time: time }))}
                      >
                        {formatTime(time)}
                      </button>
                    ))}
                    {form.appointment_date && availableWalkInSlots.length === 0 && (
                      <span className={styles.noAvailableTimes}>No available times for this date.</span>
                    )}
                    {!form.appointment_date && <span className={styles.noAvailableTimes}>Choose a date to see available times.</span>}
                  </div>
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
