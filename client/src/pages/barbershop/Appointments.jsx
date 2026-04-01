import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import styles from './Appointments.module.css';

const STATUS_OPTS = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };
const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };

export default function BarbershopAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/appointments/barbershop', { params });
      setAppointments(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [dateFilter, statusFilter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success('Status updated');
      fetchAppointments();
    } catch { toast.error('Update failed'); }
  };

  const verifyPayment = async (id, approved) => {
    try {
      await api.patch(`/appointments/${id}/verify-payment`, { approved });
      toast.success(approved ? 'Payment approved' : 'Payment rejected');
      fetchAppointments();
    } catch { toast.error('Failed'); }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1>Appointments</h1></div>

        <div className={styles.filters}>
          <input type="date" className={styles.input} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <select className={styles.input} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button className={styles.clearBtn} onClick={() => { setDateFilter(''); setStatusFilter(''); }}>Clear Filters</button>
        </div>

        {loading ? <div className={styles.loading}>Loading...</div> :
          appointments.length === 0 ? <div className={styles.empty}><p>No appointments found.</p></div> :
          <div className={styles.list}>
            {appointments.map(a => (
              <div key={a.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.queueNum}>#{a.queue_number}</div>
                  <div className={styles.customerInfo}>
                    <div className={styles.customerName}>{a.customer_name}</div>
                    {a.customer_phone && <div className={styles.customerPhone}>{a.customer_phone}</div>}
                  </div>
                  <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <div className={styles.details}>
                  <span><Clock size={13} /> {a.appointment_time?.substring(0,5)}</span>
                  <span>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''}</span>
                  <span>{a.duration_minutes}min</span>
                  {a.is_home_service && <span className="badge badge-info">Home Service</span>}
                </div>
                {a.notes && <div className={styles.notes}>Note: {a.notes}</div>}
                <div className={styles.payInfo}>
                  <span className={`badge badge-${a.payment_status === 'paid' ? 'success' : a.payment_status === 'pending_verification' ? 'warning' : 'error'}`}>
                    Payment: {a.payment_status === 'paid' ? 'Paid' : a.payment_status === 'pending_verification' ? 'Verify' : 'Unpaid'}
                  </span>
                  {a.payment_proof_url && <a href={a.payment_proof_url} target="_blank" rel="noreferrer" className={styles.viewProof}>View Proof</a>}
                  {a.payment_status === 'pending_verification' && (
                    <div className={styles.payActions}>
                      <button className={styles.approveBtn} onClick={() => verifyPayment(a.id, true)}><CheckCircle size={14} /> Approve</button>
                      <button className={styles.rejectBtn} onClick={() => verifyPayment(a.id, false)}><XCircle size={14} /> Reject</button>
                    </div>
                  )}
                </div>
                <div className={styles.actions}>
                  <select className={styles.statusSelect} value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </Layout>
  );
}
