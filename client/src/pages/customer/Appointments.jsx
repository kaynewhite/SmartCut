import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Scissors, Upload, Star } from 'lucide-react';
import styles from './Appointments.module.css';

const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };
const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };

export default function CustomerAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [ratingModal, setRatingModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [rating, setRating] = useState({ barbershop_rating: 5, barber_rating: 5, comment: '' });
  const [payFile, setPayFile] = useState(null);

  useEffect(() => { fetchAppointments(); }, []);

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/my');
      setAppointments(res.data);
    } catch {}
    setLoading(false);
  };

  const filtered = appointments.filter(a => {
    if (filter === 'active') return ['pending','confirmed','in_progress'].includes(a.status);
    if (filter === 'completed') return a.status === 'completed';
    if (filter === 'cancelled') return ['cancelled','no_show'].includes(a.status);
    return true;
  });

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
    try {
      const res = await api.get(`/barbershops/${appt.barbershop_id}`);
      setQrCode(res.data.shop.qr_code_url);
    } catch {}
  };

  const submitPayment = async () => {
    if (!payFile) return toast.error('Please select a payment proof image');
    const fd = new FormData();
    fd.append('proof', payFile);
    try {
      await api.post(`/appointments/${payModal.id}/payment-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment proof submitted!');
      setPayModal(null); setPayFile(null);
      fetchAppointments();
    } catch { toast.error('Upload failed'); }
  };

  const submitRating = async () => {
    try {
      await api.post('/ratings', { ...rating, appointment_id: ratingModal.id, barbershop_id: ratingModal.barbershop_id, barber_id: ratingModal.barber_id });
      toast.success('Rating submitted! +10 loyalty points');
      setRatingModal(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Rating failed'); }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1>My Appointments</h1></div>

        <div className={styles.filters}>
          {[['active','Active'],['completed','Completed'],['cancelled','Cancelled'],['all','All']].map(([v,l]) => (
            <button key={v} className={`${styles.filterBtn} ${filter === v ? styles.active : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>

        {loading ? <div className={styles.loading}>Loading...</div> :
          filtered.length === 0 ? <div className={styles.empty}><Scissors size={40} color="#374151" /><p>No appointments found.</p><Link to="/customer/explore" className={styles.bookBtn}>Book Now</Link></div> :
          <div className={styles.list}>
            {filtered.map(a => (
              <div key={a.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.shopInfo}>
                    <div className={styles.shopName}>{a.barbershop_name}</div>
                    <div className={styles.shopAddress}>{a.barbershop_address}</div>
                  </div>
                  <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <div className={styles.details}>
                  <div className={styles.detail}><Scissors size={14} /> {a.service_name} {a.barber_name ? `• ${a.barber_name}` : ''}</div>
                  <div className={styles.detail}><Calendar size={14} /> {a.appointment_date}</div>
                  <div className={styles.detail}><Clock size={14} /> {a.appointment_time?.substring(0,5)} {a.queue_number ? `• Queue #${a.queue_number}` : ''}</div>
                  <div className={styles.detail}><span className={styles.price}>₱{parseFloat(a.total_amount||0).toFixed(0)}</span>
                    <span className={`badge badge-${a.payment_status === 'paid' ? 'success' : a.payment_status === 'pending_verification' ? 'warning' : 'error'}`} style={{marginLeft:8}}>
                      {a.payment_status === 'paid' ? 'Paid' : a.payment_status === 'pending_verification' ? 'Verifying' : 'Unpaid'}
                    </span>
                  </div>
                </div>
                {a.notes && <div className={styles.notes}>Note: {a.notes}</div>}
                <div className={styles.actions}>
                  {['pending','confirmed'].includes(a.status) && a.payment_status === 'unpaid' && (
                    <button className={styles.payBtn} onClick={() => showPayModal(a)}><Upload size={14} /> Pay Now</button>
                  )}
                  {['pending','confirmed'].includes(a.status) && (
                    <button className={styles.cancelBtn} onClick={() => cancelAppointment(a.id)}>Cancel</button>
                  )}
                  {a.status === 'completed' && a.payment_status === 'paid' && (
                    <button className={styles.rateBtn} onClick={() => setRatingModal(a)}><Star size={14} /> Rate</button>
                  )}
                  <Link to={`/customer/queue/${a.barbershop_id}`} className={styles.queueBtn}>View Queue</Link>
                </div>
              </div>
            ))}
          </div>
        }

        {/* Payment Modal */}
        {payModal && (
          <div className={styles.modal}>
            <div className={styles.modalCard}>
              <h3>Pay for Appointment</h3>
              <p className={styles.modalSub}>Scan the QR code below and upload your proof of payment</p>
              {qrCode ? <img src={qrCode} alt="QR Code" className={styles.qrImg} /> : <div className={styles.noQr}>QR Code not uploaded by shop yet</div>}
              <div className={styles.uploadArea}>
                <label className={styles.uploadLabel}>
                  <Upload size={16} /> Upload Payment Screenshot
                  <input type="file" accept="image/*" onChange={e => setPayFile(e.target.files[0])} style={{display:'none'}} />
                </label>
                {payFile && <div className={styles.fileName}>{payFile.name}</div>}
              </div>
              <div className={styles.modalActions}>
                <button className={styles.submitBtn} onClick={submitPayment}>Submit Proof</button>
                <button className={styles.closeBtn2} onClick={() => { setPayModal(null); setPayFile(null); setQrCode(null); }}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {ratingModal && (
          <div className={styles.modal}>
            <div className={styles.modalCard}>
              <h3>Rate Your Experience</h3>
              <p className={styles.modalSub}>{ratingModal.barbershop_name}</p>
              <div className={styles.ratingGroup}>
                <label>Barbershop Rating</label>
                <div className={styles.starRow}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} type="button" onClick={() => setRating(r => ({...r, barbershop_rating: s}))}
                      className={s <= rating.barbershop_rating ? 'star-filled' : 'star-empty'} style={{background:'none',border:'none',fontSize:'24px'}}>★</button>
                  ))}
                </div>
              </div>
              {ratingModal.barber_id && (
                <div className={styles.ratingGroup}>
                  <label>Barber Rating</label>
                  <div className={styles.starRow}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => setRating(r => ({...r, barber_rating: s}))}
                        className={s <= rating.barber_rating ? 'star-filled' : 'star-empty'} style={{background:'none',border:'none',fontSize:'24px'}}>★</button>
                    ))}
                  </div>
                </div>
              )}
              <textarea className={styles.commentBox} placeholder="Share your experience..." value={rating.comment} onChange={e => setRating(r => ({...r, comment: e.target.value}))} rows={3} />
              <div className={styles.modalActions}>
                <button className={styles.submitBtn} onClick={submitRating}>Submit Rating</button>
                <button className={styles.closeBtn2} onClick={() => setRatingModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
