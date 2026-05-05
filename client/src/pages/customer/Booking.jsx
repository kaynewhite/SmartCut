import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Scissors, User, ChevronRight, ChevronLeft, CheckCircle, Star, Upload, Info } from 'lucide-react';

const STEPS = ['Barber', 'Service', 'Date & Time', 'Confirm'];

function TimeSlot({ time, booked, selected, onClick }) {
  return (
    <button type="button" onClick={booked ? undefined : onClick} disabled={booked} style={{
      padding: '9px 12px', borderRadius: 8, border: `1px solid ${booked ? '#1e2a3a' : selected ? '#d4af37' : '#2d3748'}`,
      background: booked ? '#0a1020' : selected ? 'rgba(212,175,55,0.15)' : 'transparent',
      color: booked ? '#374151' : selected ? '#d4af37' : '#cbd5e1',
      cursor: booked ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: selected ? 600 : 400, minWidth: 72
    }}>
      {time}{booked && <span style={{ fontSize: 10, color: '#4b5563', display: 'block' }}>taken</span>}
    </button>
  );
}

export default function CustomerBooking() {
  const { shopId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [shop, setShop] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [shopPayMethods, setShopPayMethods] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [shopRes, barberRes, pmRes] = await Promise.all([
          api.get(`/barbershops/${shopId}`),
          api.get('/barbers', { params: { barbershop_id: shopId } }),
          api.get(`/payment-methods/${shopId}`).catch(() => ({ data: [] }))
        ]);
        setShop(shopRes.data.shop);
        const avail = (barberRes.data || []).filter(b => b.is_available);
        setBarbers(avail);
        setShopPayMethods(pmRes.data || []);
      } catch { toast.error('Could not load barbershop info'); }
      setLoading(false);
    };
    load();
  }, [shopId]);

  useEffect(() => {
    if (!selectedBarber) { setServices([]); return; }
    api.get(`/services/by-barber/${selectedBarber.id}`)
      .then(res => setServices(res.data || []))
      .catch(() => setServices([]));
  }, [selectedBarber]);

  useEffect(() => {
    if (!selectedDate) return;
    api.get('/appointments/available-slots', {
      params: { barbershop_id: shopId, barber_id: selectedBarber?.id, date: selectedDate }
    }).then(res => setBookedSlots(res.data.booked_slots || [])).catch(() => {});
  }, [selectedDate, selectedBarber]);

  const generateSlots = () => {
    if (!shop) return [];
    const open = shop.opening_time?.substring(0, 5) || '08:00';
    const close = shop.closing_time?.substring(0, 5) || '20:00';
    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    const slots = [];
    let h = openH, m = openM;
    while (h < closeH || (h === closeH && m < closeM)) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      m += 30; if (m >= 60) { h++; m -= 60; }
    }
    return slots;
  };

  const canProceed = () => {
    if (step === 0) return !!selectedBarber;
    if (step === 1) return !!selectedService;
    if (step === 2) return !!selectedDate && !!selectedTime;
    return true;
  };

  const handleBook = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/appointments', {
        barbershop_id: shopId, barber_id: selectedBarber?.id,
        service_id: selectedService?.id, appointment_date: selectedDate,
        appointment_time: selectedTime + ':00', notes
      });
      if (proofFile) {
        const fd = new FormData();
        fd.append('proof', proofFile);
        if (paymentMethod) fd.append('payment_method', paymentMethod);
        await api.post(`/appointments/${res.data.id}/payment-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});
      }
      toast.success('Appointment booked successfully!');
      navigate('/customer/appointments');
    } catch (err) { toast.error(err.response?.data?.message || 'Booking failed'); }
    finally { setSubmitting(false); }
  };

  const minDateStr = new Date().toISOString().split('T')[0];

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading...</div></Layout>;
  if (!shop) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Barbershop not found.</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Book Appointment</h1>
          <p style={{ color: '#8b92a9', fontSize: 13, margin: 0 }}>at <strong style={{ color: '#d4af37' }}>{shop.name}</strong></p>

          <div style={{ display: 'flex', marginTop: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #1e2a3a' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, padding: '10px 4px', textAlign: 'center', background: i < step ? 'rgba(16,185,129,0.05)' : i === step ? 'rgba(212,175,55,0.12)' : '#0f1827', borderRight: i < STEPS.length - 1 ? '1px solid #1e2a3a' : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? '#10b981' : i === step ? 'rgba(212,175,55,0.3)' : '#1e2a3a', fontSize: 11, color: i < step ? '#fff' : i === step ? '#d4af37' : '#8b92a9', fontWeight: 700 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, color: i === step ? '#d4af37' : i < step ? '#10b981' : '#8b92a9', whiteSpace: 'nowrap' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20, minHeight: 280 }}>

          {/* Step 0: Barber */}
          {step === 0 && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={16} color="#d4af37" /> Choose Your Barber
              </h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>Only available barbers are shown</p>
              {barbers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Scissors size={40} color="#374151" style={{ marginBottom: 14 }} />
                  <div style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 500 }}>No barbers available right now</div>
                  <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>All barbers at this shop are currently unavailable. Please check back later.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  {barbers.map(b => (
                    <div key={b.id} onClick={() => setSelectedBarber(b)} style={{
                      padding: 14, borderRadius: 10, border: `1.5px solid ${selectedBarber?.id === b.id ? '#d4af37' : '#1e2a3a'}`,
                      background: selectedBarber?.id === b.id ? 'rgba(212,175,55,0.08)' : '#0a1020',
                      cursor: 'pointer', textAlign: 'center', transition: 'all .15s'
                    }}>
                      <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', overflow: 'hidden', border: `2px solid ${selectedBarber?.id === b.id ? '#d4af37' : 'transparent'}` }}>
                        {b.photo_url ? <img src={b.photo_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 20 }}>{b.name.charAt(0)}</span>}
                      </div>
                      <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                      <div style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                        <Star size={11} fill="#f59e0b" /> {parseFloat(b.avg_rating || 0).toFixed(1)}
                      </div>
                      {b.services?.length > 0 && <div style={{ color: '#8b92a9', fontSize: 11, marginTop: 4 }}>{b.services.length} service{b.services.length !== 1 ? 's' : ''}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Service */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scissors size={16} color="#d4af37" /> Choose a Service
              </h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>Services offered by {selectedBarber?.name}</p>
              {services.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Scissors size={40} color="#374151" style={{ marginBottom: 14 }} />
                  <div style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 500 }}>No services listed</div>
                  <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>{selectedBarber?.name} hasn't added any services yet.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {services.map(s => (
                    <div key={s.id} onClick={() => setSelectedService(s)} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 10,
                      border: `1.5px solid ${selectedService?.id === s.id ? '#d4af37' : '#1e2a3a'}`,
                      background: selectedService?.id === s.id ? 'rgba(212,175,55,0.08)' : '#0a1020',
                      cursor: 'pointer', transition: 'all .15s'
                    }}>
                      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#1e2a3a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.image_url ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Scissors size={22} color="#4b5563" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                        {s.description && <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 2 }}>{s.description}</div>}
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
                          <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 15 }}>₱{parseFloat(s.price).toFixed(0)}</span>
                          <span style={{ color: '#8b92a9', fontSize: 12 }}>{s.duration_minutes} min</span>
                          {s.is_home_service && <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid #6366f1', borderRadius: 4, fontSize: 10, padding: '1px 6px' }}>Home</span>}
                        </div>
                      </div>
                      {selectedService?.id === s.id && <CheckCircle size={20} color="#d4af37" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="#d4af37" /> Pick Date & Time
              </h2>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 8 }}>Date</label>
                <input type="date" min={minDateStr} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                  style={{ background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '12px 14px', borderRadius: 8, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
              </div>
              {selectedDate && (
                <div>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>
                    <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Available Times
                    <span style={{ color: '#4b5563', marginLeft: 8, fontSize: 11 }}>({shop.opening_time?.substring(0, 5)} - {shop.closing_time?.substring(0, 5)})</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {generateSlots().map(t => (
                      <TimeSlot key={t} time={t} booked={bookedSlots.includes(t)} selected={selectedTime === t} onClick={() => setSelectedTime(t)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Confirm Your Booking</h2>
              <div style={{ background: '#0a1020', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                {[
                  ['Shop', shop.name],
                  ['Barber', selectedBarber?.name],
                  ['Service', selectedService?.name],
                  ['Price', `₱${parseFloat(selectedService?.price || 0).toFixed(0)}`],
                  ['Date', selectedDate],
                  ['Time', selectedTime],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #1e2a3a' }}>
                    <span style={{ color: '#8b92a9', fontSize: 13 }}>{k}</span>
                    <span style={{ color: k === 'Price' ? '#d4af37' : '#f0f0f0', fontWeight: 600, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Special requests..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: 14 }}>
                <div style={{ color: '#d4af37', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>💳 Upload Payment (Optional)</div>
                <div style={{ color: '#8b92a9', fontSize: 12, marginBottom: 10 }}>Scan the shop's payment QR and upload proof to get confirmed faster.</div>
                {shopPayMethods.filter(p => p.is_active && p.qr_code_url).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 8 }}>
                      <option value="">Select payment method...</option>
                      {shopPayMethods.filter(p => p.is_active).map(p => <option key={p.id} value={p.type} style={{ background: '#0a1020' }}>{p.type} – {p.account_name}</option>)}
                    </select>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: proofFile ? '#10b981' : '#8b92a9', fontSize: 13 }}>
                  <Upload size={15} />
                  {proofFile ? `✓ ${proofFile.name}` : 'Upload payment receipt'}
                  <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ marginTop: 14, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, color: '#6366f1', fontSize: 12, lineHeight: 1.6 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>You may only have one active appointment at a time. Missing your appointment without cancelling may result in a no-show mark.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '13px', background: '#1e2a3a', color: '#f0f0f0', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canProceed()} style={{ flex: 2, padding: '13px', background: canProceed() ? 'linear-gradient(135deg,#d4af37,#a8841d)' : '#1e2a3a', color: canProceed() ? '#0f1422' : '#4b5563', border: 'none', borderRadius: 10, fontWeight: 700, cursor: canProceed() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15 }}>
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleBook} disabled={submitting} style={{ flex: 2, padding: '13px', background: submitting ? '#374151' : 'linear-gradient(135deg,#d4af37,#a8841d)', color: submitting ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 10, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15 }}>
              <CheckCircle size={16} /> {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
