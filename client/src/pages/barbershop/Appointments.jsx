import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, UserX, Star, Ban } from 'lucide-react';
import styles from './Appointments.module.css';

const STATUS_OPTS = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };
const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };

export default function BarbershopAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [rateModal, setRateModal] = useState(null);
  const [rateForm, setRateForm] = useState({ rating: 5, comment: '' });
  const [banModal, setBanModal] = useState(null);
  const [banForm, setBanForm] = useState({ reason: '', duration_unit: 'days', duration_value: 7 });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/appointments/shop', { params });
      setAppointments(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [dateFilter, statusFilter]);

  const updateStatus = async (id, status) => {
    if (status === 'no_show' && !confirm('Mark as no-show? The customer will be notified, their no-show count will increase, and the slot will be released.')) return;
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success(status === 'no_show' ? 'Marked as no-show. Slot released.' : 'Status updated');
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

  const submitRating = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer-ratings', {
        customer_id: rateModal.customer_id,
        appointment_id: rateModal.id,
        barber_id: rateModal.barber_id,
        rating: rateForm.rating,
        comment: rateForm.comment
      });
      toast.success('Customer rated');
      setRateModal(null);
      setRateForm({ rating: 5, comment: '' });
    } catch { toast.error('Failed'); }
  };

  const submitBan = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bans', {
        customer_id: banModal.customer_id,
        reason: banForm.reason,
        duration_unit: banForm.duration_unit,
        duration_value: banForm.duration_value
      });
      toast.success(`Customer banned`);
      setBanModal(null);
      setBanForm({ reason: '', duration_unit: 'days', duration_value: 7 });
    } catch { toast.error('Failed to ban'); }
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
                    <div className={styles.customerName}>
                      {a.customer_name}
                      {a.customer_no_show_count > 0 && (
                        <span style={{marginLeft:8,fontSize:11,color:'#ef4444',fontWeight:600}}>
                          <AlertTriangle size={11} style={{verticalAlign:'middle'}}/> {a.customer_no_show_count} no-shows
                        </span>
                      )}
                      <span style={{marginLeft:8,fontSize:11,color:'#d4af37'}}>★ {parseFloat(a.customer_rating || 5).toFixed(1)}</span>
                    </div>
                    {a.customer_phone && <div className={styles.customerPhone}>{a.customer_phone}</div>}
                  </div>
                  <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <div className={styles.details}>
                  <span><Clock size={13} /> {a.appointment_time?.substring(0,5)}</span>
                  <span>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''}</span>
                  {a.is_home_service && <span className="badge badge-info">Home Service</span>}
                </div>
                {a.notes && <div className={styles.notes}>Note: {a.notes}</div>}
                <div className={styles.payInfo}>
                  <span className={`badge badge-${a.payment_status === 'paid' ? 'success' : a.payment_status === 'pending_verification' ? 'warning' : 'error'}`}>
                    Payment: {a.payment_status === 'paid' ? 'Paid' : a.payment_status === 'pending_verification' ? 'Verify' : 'Unpaid'}
                  </span>
                  {a.amount_paid > 0 && <span style={{fontSize:12,color:'#8b92a9'}}>₱{parseFloat(a.amount_paid).toFixed(2)} paid</span>}
                  {a.payment_proof_url && <a href={a.payment_proof_url} target="_blank" rel="noreferrer" className={styles.viewProof}>View Proof</a>}
                  {a.payment_status === 'pending_verification' && (
                    <div className={styles.payActions}>
                      <button className={styles.approveBtn} onClick={() => verifyPayment(a.id, true)}><CheckCircle size={14} /> Approve</button>
                      <button className={styles.rejectBtn} onClick={() => verifyPayment(a.id, false)}><XCircle size={14} /> Reject</button>
                    </div>
                  )}
                </div>
                <div className={styles.actions} style={{flexWrap:'wrap',gap:8}}>
                  <select className={styles.statusSelect} value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  {['pending','confirmed','in_progress'].includes(a.status) && (
                    <button onClick={() => updateStatus(a.id, 'no_show')} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',background:'#7c2d12',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                      <UserX size={13}/> No-Show
                    </button>
                  )}
                  <button onClick={() => setRateModal(a)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                    <Star size={13}/> Rate Customer
                  </button>
                  <button onClick={() => setBanModal(a)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',background:'#991b1b',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                    <Ban size={13}/> Ban
                  </button>
                </div>
              </div>
            ))}
          </div>
        }

        {rateModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
            <div style={{background:'#1a2234',padding:24,borderRadius:10,maxWidth:420,width:'100%',border:'1px solid #2d3748'}}>
              <h3 style={{color:'#d4af37',marginTop:0}}>Rate {rateModal.customer_name}</h3>
              <form onSubmit={submitRating}>
                <div style={{marginBottom:14}}>
                  <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Rating</label>
                  <div style={{display:'flex',gap:6}}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setRateForm(p => ({...p, rating: n}))} style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
                        <Star size={28} fill={n <= rateForm.rating ? '#d4af37' : 'none'} color="#d4af37" />
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Comment (optional)</label>
                  <textarea value={rateForm.comment} onChange={e => setRateForm(p => ({...p, comment: e.target.value}))} rows={3} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}} placeholder="On time, polite..."/>
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button type="submit" style={{flex:1,padding:'10px',background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer'}}>Submit Rating</button>
                  <button type="button" onClick={() => setRateModal(null)} style={{flex:1,padding:'10px',background:'transparent',color:'#8b92a9',border:'1px solid #2d3748',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {banModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
            <div style={{background:'#1a2234',padding:24,borderRadius:10,maxWidth:440,width:'100%',border:'1px solid #ef4444'}}>
              <h3 style={{color:'#ef4444',marginTop:0}}><Ban size={18} style={{verticalAlign:'middle',marginRight:6}}/>Ban {banModal.customer_name}</h3>
              <p style={{color:'#8b92a9',fontSize:13}}>This customer will not be able to book at your shop during the ban period.</p>
              <form onSubmit={submitBan}>
                <div style={{marginBottom:14}}>
                  <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Reason</label>
                  <textarea value={banForm.reason} onChange={e => setBanForm(p => ({...p, reason: e.target.value}))} rows={2} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}} placeholder="e.g. Multiple no-shows" required/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div>
                    <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Duration</label>
                    <input type="number" min="1" value={banForm.duration_value} onChange={e => setBanForm(p => ({...p, duration_value: parseInt(e.target.value) || 1}))} disabled={banForm.duration_unit === 'forever'} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
                  </div>
                  <div>
                    <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Unit</label>
                    <select value={banForm.duration_unit} onChange={e => setBanForm(p => ({...p, duration_unit: e.target.value}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                      <option value="forever">Forever</option>
                    </select>
                  </div>
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button type="submit" style={{flex:1,padding:'10px',background:'#ef4444',color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer'}}>Ban Customer</button>
                  <button type="button" onClick={() => setBanModal(null)} style={{flex:1,padding:'10px',background:'transparent',color:'#8b92a9',border:'1px solid #2d3748',borderRadius:6,cursor:'pointer'}}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
