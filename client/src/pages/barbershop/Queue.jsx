import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, CheckCircle, PlayCircle, RefreshCw } from 'lucide-react';
import styles from './Queue.module.css';

export default function BarbershopQueue() {
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ customer_name: '', service_id: '', barber_id: '' });
  const [shopId, setShopId] = useState(null);

  const fetchData = async () => {
    try {
      const profileRes = await api.get('/barbershops/me/profile');
      const id = profileRes.data.id;
      setShopId(id);
      const [qRes, sRes, bRes] = await Promise.all([
        api.get(`/queue/${id}`),
        api.get('/services/me'),
        api.get('/barbers')
      ]);
      setQueue(qRes.data);
      setServices(sRes.data);
      setBarbers(bRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addWalkIn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/queue', form);
      toast.success('Walk-in added to queue!');
      setAddModal(false);
      setForm({ customer_name: '', service_id: '', barber_id: '' });
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/queue/${id}/status`, { status });
      toast.success('Status updated');
      fetchData();
    } catch { toast.error('Failed'); }
  };

  const totalWaiting = queue.walk_ins.filter(w => w.status === 'waiting').length + queue.appointments.filter(a => ['confirmed','pending'].includes(a.status)).length;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Queue Management</h1>
          <div className={styles.headerBtns}>
            <button className={styles.refreshBtn} onClick={fetchData}><RefreshCw size={16} /></button>
            <button className={styles.addBtn} onClick={() => setAddModal(true)}><Plus size={16} /> Add Walk-in</button>
          </div>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}><div className={styles.statNum}>{totalWaiting}</div><div className={styles.statLabel}>Currently Waiting</div></div>
          <div className={styles.stat}><div className={styles.statNum}>{queue.walk_ins.filter(w => w.status === 'in_progress').length + queue.appointments.filter(a => a.status === 'in_progress').length}</div><div className={styles.statLabel}>In Progress</div></div>
        </div>

        <div className={styles.sections}>
          <div className={styles.section}>
            <h2>Appointment Queue (Today)</h2>
            {queue.appointments.length === 0 ? <div className={styles.empty}>No appointments today</div> :
              queue.appointments.map((a, i) => (
                <div key={i} className={`${styles.item} ${a.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum}>#{a.queue_number}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{a.customer_name}</div>
                    <div className={styles.itemMeta}>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''} · {a.appointment_time?.substring(0,5)}</div>
                  </div>
                  <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>{a.status === 'in_progress' ? 'In Progress' : 'Waiting'}</span>
                </div>
              ))
            }
          </div>

          <div className={styles.section}>
            <h2>Walk-in Queue</h2>
            {queue.walk_ins.length === 0 ? <div className={styles.empty}>No walk-ins in queue</div> :
              queue.walk_ins.map(w => (
                <div key={w.id} className={`${styles.item} ${w.status === 'in_progress' ? styles.inProg : ''}`}>
                  <div className={styles.qNum}>#{w.queue_number}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{w.customer_name}</div>
                    <div className={styles.itemMeta}>{w.service_name || 'Walk-in'} {w.barber_name ? `· ${w.barber_name}` : ''}</div>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>{w.status === 'in_progress' ? 'In Progress' : 'Waiting'}</span>
                    {w.status === 'waiting' && <button className={styles.startBtn} onClick={() => updateStatus(w.id, 'in_progress')}><PlayCircle size={14} /></button>}
                    {w.status === 'in_progress' && <button className={styles.doneBtn} onClick={() => updateStatus(w.id, 'done')}><CheckCircle size={14} /></button>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {addModal && (
          <div className={styles.modalBg}>
            <div className={styles.modal}>
              <h3>Add Walk-in Customer</h3>
              <form onSubmit={addWalkIn} className={styles.form}>
                <div className={styles.field}><label>Customer Name</label><input className={styles.input} value={form.customer_name} onChange={e => setForm(p => ({...p, customer_name: e.target.value}))} placeholder="Walk-in customer name" /></div>
                <div className={styles.field}><label>Service</label>
                  <select className={styles.input} value={form.service_id} onChange={e => setForm(p => ({...p, service_id: e.target.value}))}>
                    <option value="">Select service</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - ₱{parseFloat(s.price).toFixed(0)}</option>)}
                  </select>
                </div>
                <div className={styles.field}><label>Barber</label>
                  <select className={styles.input} value={form.barber_id} onChange={e => setForm(p => ({...p, barber_id: e.target.value}))}>
                    <option value="">Any available</option>
                    {barbers.filter(b => b.is_available).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
