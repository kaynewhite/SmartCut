import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Scissors, Upload, Star, CheckCircle, Home, Bell, X, ChevronDown } from 'lucide-react';
import styles from './Appointments.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

const STATUS_COLOR = { pending: 'warning', confirmed: 'success', in_progress: 'info', completed: 'success', cancelled: 'error', no_show: 'error' };
const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show' };

const TYPE_META = {
  online: { label: 'In-Store', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  home_service: { label: 'Home Service', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
};

const PM_COLORS = {
  'GCash': '#00a0e9', 'Maya (PayMaya)': '#00c28e', 'ShopeePay': '#ee4d2d', 'GrabPay': '#00b14f',
  'BDO': '#003f8a', 'BPI': '#bd1723', 'Metrobank': '#1c2b6b', 'UnionBank': '#f05a22',
  'Landbank': '#006837', 'PNB': '#003087', 'Security Bank': '#a50034',
  'RCBC': '#d10a10', 'EastWest Bank': '#f7941d', 'Chinabank': '#c8102e',
  'CIMB Bank': '#E22028', 'GoTyme Bank': '#1db954', 'SeaBank': '#2563eb',
  'Cash': '#16a34a', 'Other': '#6b7280',
};

export default function CustomerAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ratingModal, setRatingModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payMethods, setPayMethods] = useState([]);
  const [selectedPm, setSelectedPm] = useState(null);
  const [rating, setRating] = useState({ barbershop_rating: 5, barber_rating: 5, comment: '' });
  const [payFile, setPayFile] = useState(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [submittingPay, setSubmittingPay] = useState(false);

  useEffect(() => { fetchAppointments(); }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments/my');
      setAppointments(res.data);
    } catch {}
    setLoading(false);
  };

  const typeOf = (a) => a.is_home_service ? 'home_service' : 'online';

  const filtered = appointments.filter(a => {
    const statusMatch =
      statusFilter === 'active' ? ['pending', 'confirmed', 'in_progress'].includes(a.status) :
      statusFilter === 'completed' ? a.status === 'completed' :
      statusFilter === 'cancelled' ? ['cancelled', 'no_show'].includes(a.status) : true;
    const typeMatch =
      typeFilter === 'all' ? true :
      typeFilter === 'home' ? a.is_home_service :
      !a.is_home_service;
    return statusMatch && typeMatch;
  });

  const needsAction = appointments.filter(a =>
    a.status === 'completed' && (a.payment_status === 'unpaid' || (a.payment_status === 'paid' && !a.rating_id))
  );

  const cancelAppointment = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const showPayModal = async (appt) => {
    setPayModal(appt);
    setSelectedPm(null);
    setPayFile(null);
    try {
      const res = await api.get(`/payment-methods/barbershop/${appt.barbershop_id}`);
      setPayMethods(res.data);
      if (res.data.length === 1) setSelectedPm(res.data[0]);
    } catch { setPayMethods([]); }
  };

  const submitPayment = async () => {
    if (!selectedPm) return toast.error('Please select a payment method');
    if (!payFile) return toast.error('Please upload your payment proof');
    setSubmittingPay(true);
    const fd = new FormData();
    fd.append('proof', payFile);
    fd.append('payment_method', selectedPm.type);
    try {
      await api.post(`/appointments/${payModal.id}/payment-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment proof submitted! Waiting for verification.');
      setPayModal(null); setPayFile(null); setSelectedPm(null);
      fetchAppointments();
    } catch { toast.error('Upload failed'); }
    finally { setSubmittingPay(false); }
  };

  const submitRating = async () => {
    setSubmittingRating(true);
    try {
      await api.post('/ratings', { ...rating, appointment_id: ratingModal.id, barbershop_id: ratingModal.barbershop_id, barber_id: ratingModal.barber_id });
      toast.success('Rating submitted! +10 loyalty points');
      setRatingModal(null);
      fetchAppointments();
    } catch (err) { toast.error(err.response?.data?.message || 'Rating failed'); }
    finally { setSubmittingRating(false); }
  };

  const STATUS_FILTERS = [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' },
  ];
  const TYPE_FILTERS = [
    { value: 'all', label: 'All Types' },
    { value: 'instore', label: 'In-Store' },
    { value: 'home', label: 'Home Service' },
  ];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1>My Appointments</h1></div>

        {needsAction.length > 0 && statusFilter !== 'completed' && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setStatusFilter('completed')}>
            <Bell size={16} color="#d4af37" />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#d4af37', fontWeight: 600, fontSize: 13 }}>Action Required</div>
              <div style={{ color: '#8b92a9', fontSize: 12 }}>{needsAction.length} completed appointment{needsAction.length > 1 ? 's' : ''} — please pay and/or rate.</div>
            </div>
            <span style={{ color: '#d4af37', fontSize: 12, fontWeight: 600 }}>View →</span>
          </div>
        )}

        {/* Status filters */}
        <div className={styles.filters}>
          {STATUS_FILTERS.map(({ value, label }) => (
            <button key={value} className={`${styles.filterBtn} ${statusFilter === value ? styles.active : ''}`} onClick={() => setStatusFilter(value)}>
              {label}
              {value === 'completed' && needsAction.length > 0 && <span style={{ marginLeft: 6, background: '#d4af37', color: '#0f1422', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{needsAction.length}</span>}
            </button>
          ))}
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(({ value, label }) => (
            <button key={value} onClick={() => setTypeFilter(value)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${typeFilter === value ? '#d4af37' : '#1e2a3a'}`, background: typeFilter === value ? 'rgba(212,175,55,0.1)' : 'transparent', color: typeFilter === value ? '#d4af37' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: typeFilter === value ? 600 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? <div className={styles.loading}>Loading...</div> :
          filtered.length === 0 ? (
            <div className={styles.empty}>
              <Scissors size={40} color="#374151" />
              <p>No appointments found.</p>
              <Link to="/customer/explore" className={styles.bookBtn}>Book Now</Link>
            </div>
          ) : (
            <div className={styles.list}>
              {filtered.map(a => {
                const tm = TYPE_META[typeOf(a)] || TYPE_META.online;
                const needsPay = a.status === 'completed' && a.payment_status === 'unpaid';
                const needsRate = a.status === 'completed' && a.payment_status === 'paid' && !a.rating_id;

                return (
                  <div key={a.id} className={`${styles.card} ${needsPay || needsRate ? styles.cardHighlight : ''}`}>
                    <div className={styles.cardHeader}>
                      <div className={styles.shopInfo}>
                        <div className={styles.shopName}>{a.barbershop_name}</div>
                        <div className={styles.shopAddress}>{a.barbershop_address}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: tm.bg, color: tm.color }}>{tm.label}</span>
                      </div>
                    </div>

                    <div className={styles.details}>
                      <div className={styles.detail}><Scissors size={14} /> {a.service_name}{a.barber_name ? ` · ${a.barber_name}` : ''}</div>
                      <div className={styles.detail}><Calendar size={14} /> {new Date(a.appointment_date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className={styles.detail}>
                        <Clock size={14} /> {formatTime(a.appointment_time?.substring(0, 5))}
                        {a.queue_number && ['pending','confirmed','in_progress'].includes(a.status) && (
                          <span style={{ marginLeft: 8, padding: '1px 8px', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 4, color: '#d4af37', fontSize: 11, fontWeight: 600 }}>
                            Queue {formatQueueNumber(a.queue_number)}
                          </span>
                        )}
                      </div>
                      {a.is_home_service && a.home_address && (
                        <div className={styles.detail}><Home size={14} color="#8b5cf6" /> <span style={{ color: '#8b5cf6' }}>{a.home_address}</span></div>
                      )}
                      <div className={styles.detail}>
                        <span className={styles.price}>₱{parseFloat(a.total_amount || 0).toFixed(0)}</span>
                        <span className={`badge badge-${a.payment_status === 'paid' ? 'success' : a.payment_status === 'pending_verification' ? 'warning' : 'error'}`} style={{ marginLeft: 8 }}>
                          {a.payment_status === 'paid' ? 'Paid' : a.payment_status === 'pending_verification' ? 'Verifying' : 'Unpaid'}
                        </span>
                      </div>
                    </div>

                    {a.notes && <div className={styles.notes}>Note: {a.notes}</div>}

                    {needsPay && (
                      <div style={{ margin: '10px 0 6px', padding: '10px 12px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bell size={14} color="#d4af37" />
                        <div style={{ flex: 1, fontSize: 12, color: '#d4af37' }}>Your service is done! Please complete your payment.</div>
                      </div>
                    )}
                    {needsRate && (
                      <div style={{ margin: '10px 0 6px', padding: '10px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Star size={14} color="#10b981" />
                        <div style={{ flex: 1, fontSize: 12, color: '#10b981' }}>How was your experience? Leave a rating and earn +10 loyalty points.</div>
                      </div>
                    )}

                    <div className={styles.actions}>
                      {/* Pay ONLY after completion and when unpaid */}
                      {needsPay && (
                        <button className={styles.payBtn} onClick={() => showPayModal(a)} style={{ background: '#d4af37', color: '#0f1422', fontWeight: 700 }}>
                          <Upload size={14} /> Pay Now
                        </button>
                      )}
                      {needsRate && (
                        <button className={styles.rateBtn} onClick={() => { setRatingModal(a); setRating({ barbershop_rating: 5, barber_rating: 5, comment: '' }); }}>
                          <Star size={14} /> Rate
                        </button>
                      )}
                      {['pending', 'confirmed'].includes(a.status) && (
                        <button className={styles.cancelBtn} onClick={() => cancelAppointment(a.id)}>Cancel</button>
                      )}
                      {a.rating_id && <span style={{ color: '#10b981', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Rated</span>}
                      {['pending','confirmed','in_progress'].includes(a.status) && (
                        <Link to={`/customer/queue/${a.barbershop_id}`} className={styles.queueBtn}>View Queue</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        {/* Payment Modal */}
        {payModal && (
          <div className={styles.modal}>
            <div className={styles.modalCard} style={{ maxWidth: 520 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Pay for Service</h3>
                <button onClick={() => { setPayModal(null); setPayFile(null); setSelectedPm(null); setPayMethods([]); }} style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              <p className={styles.modalSub}>Total: <strong style={{ color: '#d4af37' }}>₱{parseFloat(payModal.total_amount || 0).toFixed(0)}</strong> — {payModal.barbershop_name}</p>

              {payMethods.length === 0 ? (
                <div className={styles.noQr}>This shop hasn't set up payment methods yet. Please contact them directly.</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>1. Choose payment method</div>
                  <div className={styles.pmGrid}>
                    {payMethods.map(pm => (
                      <button key={pm.id} type="button"
                        className={`${styles.pmOpt} ${selectedPm?.id === pm.id ? styles.pmOptActive : ''}`}
                        onClick={() => setSelectedPm(pm)}>
                        <span className={styles.pmTag} style={{ background: PM_COLORS[pm.type] || '#6b7280' }}>{pm.type}</span>
                        {selectedPm?.id === pm.id && <CheckCircle size={14} color="#16a34a" />}
                      </button>
                    ))}
                  </div>

                  {selectedPm && (
                    <div className={styles.pmDetail}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>2. Send to</div>
                      {selectedPm.account_name && <div className={styles.pmDetailRow}><span>Account Name:</span><strong>{selectedPm.account_name}</strong></div>}
                      {selectedPm.account_number && <div className={styles.pmDetailRow}><span>Account/Mobile:</span><strong>{selectedPm.account_number}</strong></div>}
                      {selectedPm.qr_code_url ? (
                        <img src={selectedPm.qr_code_url} alt="QR Code" className={styles.qrImg} />
                      ) : (
                        <div className={styles.noQr}>No QR uploaded — please send to the account above</div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px', color: 'var(--text-secondary)' }}>3. Upload payment proof</div>
                  <div className={styles.uploadArea}>
                    <label className={styles.uploadLabel}>
                      <Upload size={16} /> {payFile ? `✓ ${payFile.name}` : 'Upload Payment Screenshot'}
                      <input type="file" accept="image/*" onChange={e => setPayFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                  </div>
                </>
              )}

              <div className={styles.modalActions}>
                {payMethods.length > 0 && <button className={styles.submitBtn} onClick={submitPayment} disabled={submittingPay}>{submittingPay ? 'Submitting...' : 'Submit Proof'}</button>}
                <button className={styles.closeBtn2} onClick={() => { setPayModal(null); setPayFile(null); setSelectedPm(null); setPayMethods([]); }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {ratingModal && (
          <div className={styles.modal}>
            <div className={styles.modalCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}>Rate Your Experience</h3>
                <button onClick={() => setRatingModal(null)} style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              <p className={styles.modalSub}>{ratingModal.barbershop_name}</p>

              <div className={styles.ratingGroup}>
                <label>Barbershop Rating</label>
                <div className={styles.starRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" onClick={() => setRating(r => ({ ...r, barbershop_rating: s }))}
                      style={{ background: 'none', border: 'none', fontSize: '28px', color: s <= rating.barbershop_rating ? '#f59e0b' : '#374151', cursor: 'pointer', padding: '2px' }}>★</button>
                  ))}
                </div>
              </div>

              {ratingModal.barber_id && (
                <div className={styles.ratingGroup}>
                  <label>Barber Rating <span style={{ color: '#8b92a9', fontSize: 12 }}>({ratingModal.barber_name})</span></label>
                  <div className={styles.starRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} type="button" onClick={() => setRating(r => ({ ...r, barber_rating: s }))}
                        style={{ background: 'none', border: 'none', fontSize: '28px', color: s <= rating.barber_rating ? '#f59e0b' : '#374151', cursor: 'pointer', padding: '2px' }}>★</button>
                    ))}
                  </div>
                </div>
              )}

              <textarea className={styles.commentBox} placeholder="Share your experience (optional)..." value={rating.comment} onChange={e => setRating(r => ({ ...r, comment: e.target.value }))} rows={3} />

              <div style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#d4af37', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={13} /> +10 loyalty points for this shop upon rating
              </div>

              <div className={styles.modalActions}>
                <button className={styles.submitBtn} onClick={submitRating} disabled={submittingRating}>{submittingRating ? 'Submitting...' : 'Submit Rating'}</button>
                <button className={styles.closeBtn2} onClick={() => setRatingModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
