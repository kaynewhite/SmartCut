import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Scissors, User, Home, ChevronRight, AlertCircle, Info } from 'lucide-react';
import styles from './Booking.module.css';

const TIMES = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

export default function CustomerBooking() {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    service_id: searchParams.get('service') || '',
    barber_id: '',
    appointment_date: '',
    appointment_time: '',
    is_home_service: false,
    home_address: '',
    notes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const shopRes = await api.get(`/barbershops/${shopId}`);
        setShop(shopRes.data.shop);
        setServices(shopRes.data.services);
        setBarbers(shopRes.data.barbers);
      } catch { toast.error('Could not load barbershop info'); }
      setLoading(false);
    };
    fetchData();
  }, [shopId]);

  useEffect(() => {
    if (!form.appointment_date) return;
    api.get('/appointments/available-slots', { params: { barbershop_id: shopId, barber_id: form.barber_id || undefined, date: form.appointment_date } })
      .then(res => setBookedSlots(res.data.booked_slots || []))
      .catch(() => {});
  }, [form.appointment_date, form.barber_id]);

  const set = (field) => (e) => setForm(p => ({...p, [field]: e.target?.value ?? e}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.service_id || !form.appointment_date || !form.appointment_time) {
      return toast.error('Please fill in all required fields');
    }
    setSubmitting(true);
    try {
      await api.post('/appointments', { ...form, barbershop_id: shopId });
      toast.success('Appointment booked! Check your appointments for details.');
      navigate('/customer/appointments');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <Layout><div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading...</div></Layout>;

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Book Appointment</h1>
          {shop && <p>at <strong>{shop.name}</strong></p>}
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Service */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}><Scissors size={16} /> Select Service</div>
            <div className={styles.serviceGrid}>
              {services.map(s => (
                <div key={s.id} className={`${styles.serviceOpt} ${form.service_id == s.id ? styles.selected : ''}`} onClick={() => setForm(p => ({...p, service_id: s.id, is_home_service: s.is_home_service && p.is_home_service}))}>
                  <div className={styles.svcName}>{s.name}</div>
                  <div className={styles.svcMeta}><span>₱{parseFloat(s.price).toFixed(0)}</span> · {s.duration_minutes}min</div>
                  {s.is_home_service && <span className="badge badge-info" style={{fontSize:'10px'}}>Home</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Barber */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}><User size={16} /> Select Barber (optional)</div>
            <div className={styles.barberGrid}>
              <div className={`${styles.barberOpt} ${!form.barber_id ? styles.selected : ''}`} onClick={() => setForm(p => ({...p, barber_id: ''}))}>
                <div className={styles.barberAvatar}>?</div>
                <div className={styles.barberName}>Any Available</div>
              </div>
              {barbers.filter(b => b.is_available).map(b => (
                <div key={b.id} className={`${styles.barberOpt} ${form.barber_id == b.id ? styles.selected : ''}`} onClick={() => setForm(p => ({...p, barber_id: b.id}))}>
                  <div className={styles.barberAvatar}>{b.photo_url ? <img src={b.photo_url} alt={b.name} /> : b.name.charAt(0)}</div>
                  <div className={styles.barberName}>{b.name}</div>
                  <div className={styles.barberRating}>★ {parseFloat(b.avg_rating || 0).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}><Calendar size={16} /> Date & Time</div>
            <div className={styles.dateTimeRow}>
              <div className={styles.field}>
                <label>Date *</label>
                <input type="date" min={minDate} value={form.appointment_date} onChange={set('appointment_date')} className={styles.input} required />
              </div>
            </div>
            {form.appointment_date && (
              <div className={styles.timeGrid}>
                {TIMES.map(t => {
                  const booked = bookedSlots.includes(t);
                  return (
                    <button key={t} type="button" disabled={booked}
                      className={`${styles.timeSlot} ${form.appointment_time === t ? styles.timeSelected : ''} ${booked ? styles.timeBooked : ''}`}
                      onClick={() => !booked && setForm(p => ({...p, appointment_time: t}))}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Home Service */}
          {services.find(s => s.id == form.service_id)?.is_home_service && (
            <div className={styles.section}>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.is_home_service} onChange={e => setForm(p => ({...p, is_home_service: e.target.checked}))} />
                <Home size={14} /> Request Home Service
              </label>
              {form.is_home_service && (
                <input className={styles.input} placeholder="Your home address" value={form.home_address} onChange={set('home_address')} style={{marginTop:'10px'}} />
              )}
            </div>
          )}

          {/* Notes */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Notes (optional)</div>
            <textarea className={styles.textarea} placeholder="Any special requests? e.g. 'Low fade, keep sides clean'" value={form.notes} onChange={set('notes')} rows={3} />
          </div>

          {/* Booking Rules */}
          <div style={{background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.3)',borderRadius:8,padding:'14px 16px',marginTop:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8,color:'#d4af37',fontWeight:600,marginBottom:8,fontSize:14}}>
              <Info size={16} /> Booking Rules
            </div>
            <ul style={{margin:0,paddingLeft:20,fontSize:13,color:'#cbd5e1',lineHeight:1.7}}>
              <li>You can have only <strong>one active appointment</strong> at a time. Complete or cancel it before booking another.</li>
              <li>A <strong>{shop?.downpayment_percent ?? 25}% downpayment</strong> is required to confirm your booking and avoid prank bookings.</li>
              <li>If you fail to show up, your slot is auto-released and you'll receive a no-show mark. Repeated no-shows may lead to a ban.</li>
              <li>Be courteous to barbers — they will rate you as well.</li>
            </ul>
          </div>

          {/* Summary */}
          {form.service_id && form.appointment_date && form.appointment_time && (
            <div className={styles.summary}>
              <div className={styles.summaryTitle}>Booking Summary</div>
              <div className={styles.summaryRow}><span>Service</span><strong>{services.find(s => s.id == form.service_id)?.name}</strong></div>
              <div className={styles.summaryRow}><span>Price</span><strong className={styles.gold}>₱{parseFloat(services.find(s => s.id == form.service_id)?.price || 0).toFixed(0)}</strong></div>
              <div className={styles.summaryRow}><span>Date & Time</span><strong>{form.appointment_date} at {form.appointment_time}</strong></div>
              {form.barber_id && <div className={styles.summaryRow}><span>Barber</span><strong>{barbers.find(b => b.id == form.barber_id)?.name}</strong></div>}
              <div className={styles.summaryRow} style={{borderTop:'1px dashed #2d3748',paddingTop:8,marginTop:4}}>
                <span style={{color:'#d4af37'}}><AlertCircle size={13} style={{verticalAlign:'middle',marginRight:4}}/>Required Downpayment ({shop?.downpayment_percent ?? 25}%)</span>
                <strong className={styles.gold}>₱{(parseFloat(services.find(s => s.id == form.service_id)?.price || 0) * (shop?.downpayment_percent ?? 25) / 100).toFixed(2)}</strong>
              </div>
              <div className={styles.summaryNote}>After booking, upload your downpayment proof on the Appointments page using your shop's QR.</div>
            </div>
          )}

          <button className={styles.submitBtn} type="submit" disabled={submitting}>
            {submitting ? 'Booking...' : <><span>Confirm Booking</span><ChevronRight size={16} /></>}
          </button>
        </form>
      </div>
    </Layout>
  );
}
