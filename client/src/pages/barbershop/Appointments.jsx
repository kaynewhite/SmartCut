import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, UserX, Star, Ban, Users, Scissors } from 'lucide-react';
import styles from './Appointments.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

const STATUS_OPTS = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error', done:'success' };
const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show', done:'Done' };

export default function BarbershopAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [walkIns, setWalkIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'online' | 'walkin'
  const [banModal, setBanModal] = useState(null);
  const [banForm, setBanForm] = useState({ reason: '', duration_unit: 'days', duration_value: 7 });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/appointments/shop', { params });
      setAppointments(res.data.appointments || []);
      setWalkIns(res.data.walk_ins || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [dateFilter, statusFilter]);

  const updateStatus = async (id, status) => {
    if (status === 'no_show' && !confirm('Mark as no-show? The customer will be notified and their no-show count will increase.')) return;
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success(status === 'no_show' ? 'Marked as no-show.' : 'Status updated');
      fetchAppointments();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };

  const verifyPayment = async (id, approved) => {
    try {
      await api.patch(`/appointments/${id}/verify-payment`, { approved });
      toast.success(approved ? 'Payment approved' : 'Payment rejected');
      fetchAppointments();
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
      toast.success('Customer banned');
      setBanModal(null);
      setBanForm({ reason: '', duration_unit: 'days', duration_value: 7 });
    } catch { toast.error('Failed to ban'); }
  };

  // Apply type filter
  const showOnline = typeFilter === 'all' || typeFilter === 'online';
  const showWalkIn = typeFilter === 'all' || typeFilter === 'walkin';
  const visibleAppts = showOnline ? appointments : [];
  const visibleWalkIns = showWalkIn ? walkIns : [];
  const isEmpty = visibleAppts.length === 0 && visibleWalkIns.length === 0;

  const TYPE_BTNS = [
    { value: 'all', label: 'All', count: appointments.length + walkIns.length },
    { value: 'online', label: 'Online', count: appointments.length },
    { value: 'walkin', label: 'Walk-in', count: walkIns.length },
  ];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1>Appointments</h1></div>

        {/* Date & Status filters */}
        <div className={styles.filters} style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <input type="date" className={styles.input} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <select className={styles.input} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button className={styles.clearBtn} onClick={() => { setDateFilter(''); setStatusFilter(''); }}>Clear</button>
        </div>

        {/* Type filter tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {TYPE_BTNS.map(({ value, label, count }) => (
            <button key={value} onClick={() => setTypeFilter(value)} style={{ padding: '7px 16px', borderRadius: 20, border: `1px solid ${typeFilter === value ? '#d4af37' : '#1e2a3a'}`, background: typeFilter === value ? 'rgba(212,175,55,0.12)' : 'transparent', color: typeFilter === value ? '#d4af37' : '#6b7280', fontSize: 13, cursor: 'pointer', fontWeight: typeFilter === value ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              {value === 'online' ? <Scissors size={13} /> : value === 'walkin' ? <Users size={13} /> : null}
              {label}
              <span style={{ padding: '1px 7px', borderRadius: 99, background: typeFilter === value ? '#d4af37' : '#1e2a3a', color: typeFilter === value ? '#0f1422' : '#8b92a9', fontSize: 11, fontWeight: 700 }}>{count}</span>
            </button>
          ))}
        </div>

        {loading && <div className={styles.loading}>Loading...</div>}
        {!loading && isEmpty && <div className={styles.empty}><p>No appointments found.</p></div>}

        {!loading && !isEmpty && (
          <div>
            {/* Online / Booked Appointments */}
            {visibleAppts.length > 0 && (
              <div className={styles.list}>
                {typeFilter === 'all' && (
                  <div style={{ padding: '6px 0 10px', color: '#8b92a9', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scissors size={13} /> Online Bookings ({visibleAppts.length})
                  </div>
                )}
                {visibleAppts.map(a => (
                  <div key={a.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.queueNum} title={a.is_event_booking ? 'Full-day event reservation' : `Queue ${formatQueueNumber(a.queue_number)}`}>
                        {a.is_event_booking ? 'ALL DAY' : formatQueueNumber(a.queue_number)}
                      </div>
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
                      {!a.is_event_booking && <span><Clock size={13} /> {formatTime(a.appointment_time)}</span>}
                      <span><Scissors size={13} /> {a.is_event_booking ? `Full-day event booking${a.barber_name ? ` · ${a.barber_name}` : ''}` : `${a.service_name}${a.barber_name ? ` · ${a.barber_name}` : ''} · 30 min`}</span>
                      {a.is_home_service && <span className="badge badge-info">Home Service</span>}
                      {a.is_event_booking && <span className="badge badge-warning">Barber reserved all day</span>}
                      {a.is_event_booking && <span style={{ color: '#d4af37', fontWeight: 600 }}>₱{Number(a.total_amount || 0).toFixed(2)} event rate</span>}
                      {a.appointment_type === 'online' && !a.is_home_service && (
                        <span style={{ fontSize: 11, color: '#3b82f6', padding: '1px 7px', background: 'rgba(59,130,246,0.1)', borderRadius: 4 }}>In-Store</span>
                      )}
                    </div>
                    {a.is_home_service && (
                      <div className={styles.notes}>
                        {a.home_contact_name && <div>Contact: {a.home_contact_name}{a.home_contact_phone ? ` · ${a.home_contact_phone}` : ''}</div>}
                        {a.home_address && <div>Home address: {a.home_address}</div>}
                        {a.home_service_notes && <div>Instructions: {a.home_service_notes}</div>}
                      </div>
                    )}
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
                    <div className={styles.actions} style={{flexWrap:'wrap',gap:8}}>
                      <select className={styles.statusSelect} value={a.status} onChange={e => updateStatus(a.id, e.target.value)}>
                        {STATUS_OPTS.filter(s => s !== 'confirmed' || !a.barber_id || a.status === 'confirmed').map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      {['pending','confirmed','in_progress'].includes(a.status) && (
                        <button onClick={() => updateStatus(a.id, 'no_show')} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',background:'#7c2d12',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                          <UserX size={13}/> No-Show
                        </button>
                      )}
                      <button onClick={() => setBanModal(a)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',background:'#991b1b',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                        <Ban size={13}/> Ban
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Walk-in section */}
            {visibleWalkIns.length > 0 && (
              <div style={{ marginTop: visibleAppts.length > 0 ? 28 : 0 }}>
                {typeFilter === 'all' && (
                  <div style={{ padding: '6px 0 10px', color: '#f59e0b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} /> Walk-ins ({visibleWalkIns.length})
                  </div>
                )}
                <div className={styles.list}>
                  {visibleWalkIns.map(w => (
                    <div key={`wi-${w.id}`} className={styles.card} style={{borderColor:'rgba(245,158,11,0.25)'}}>
                      <div className={styles.cardTop}>
                        <div className={styles.queueNum}>
                          {formatQueueNumber(w.queue_number)}
                        </div>
                        <div className={styles.customerInfo}>
                          <div className={styles.customerName}>{w.customer_name || 'Walk-in Customer'}</div>
                          {w.barber_name && <div className={styles.customerPhone}><Scissors size={11} style={{verticalAlign:'middle',marginRight:3}}/>{w.barber_name}</div>}
                        </div>
                        <span className={`badge badge-${STATUS_COLOR[w.status] || 'warning'}`}>{STATUS_LABEL[w.status] || w.status}</span>
                        <span style={{ fontSize: 11, color: '#f59e0b' }}>Walk-in</span>
                      </div>
                      <div className={styles.details}>
                        <span><Clock size={13} /> {formatTime(w.appointment_time)} · 30 min</span>
                        <span>{w.service_name || 'No specific service'}</span>
                        {w.service_price && <span style={{color:'#d4af37',fontWeight:600}}>₱{parseFloat(w.service_price).toFixed(0)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ban Modal */}
        {banModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
            <div style={{background:'#1a2234',padding:24,borderRadius:10,maxWidth:440,width:'100%',border:'1px solid #ef4444'}}>
              <h3 style={{color:'#ef4444',marginTop:0}}><Ban size={18} style={{verticalAlign:'middle',marginRight:6}}/>Ban {banModal.customer_name}</h3>
              <p style={{color:'#8b92a9',fontSize:13}}>This customer will not be able to book at your shop during the ban period.</p>
              <form onSubmit={submitBan}>
                <div style={{marginBottom:14}}>
                  <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Reason</label>
                  <textarea value={banForm.reason} onChange={e => setBanForm(p => ({...p, reason: e.target.value}))} rows={2} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}} placeholder="e.g. Multiple no-shows" required/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div>
                    <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Duration</label>
                    <input type="number" min="1" value={banForm.duration_value} onChange={e => setBanForm(p => ({...p, duration_value: parseInt(e.target.value) || 1}))} disabled={banForm.duration_unit === 'forever'} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Unit</label>
                    <select value={banForm.duration_unit} onChange={e => setBanForm(p => ({...p, duration_unit: e.target.value}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}}>
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
