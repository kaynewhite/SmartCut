import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Scissors, User, ChevronRight, ChevronLeft, CheckCircle, Star, Upload, Info, Home, Phone, MapPin } from 'lucide-react';
import { formatTime } from '../../utils/time';
import { useAuth } from '../../context/AuthContext';

function TimeSlot({ time, booked, selected, onClick }) {
  return (
    <button type="button" onClick={booked ? undefined : onClick} disabled={booked} style={{
      padding: '9px 12px', borderRadius: 8, border: `1px solid ${booked ? '#1e2a3a' : selected ? '#d4af37' : '#2d3748'}`,
      background: booked ? '#0a1020' : selected ? 'rgba(212,175,55,0.15)' : 'transparent',
      color: booked ? '#374151' : selected ? '#d4af37' : '#cbd5e1',
      cursor: booked ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: selected ? 600 : 400, minWidth: 72
    }}>
      {formatTime(time)}{booked && <span style={{ fontSize: 10, color: '#4b5563', display: 'block' }}>taken</span>}
    </button>
  );
}

export default function CustomerBooking() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [bookingAtHome, setBookingAtHome] = useState(null);
  const [homeServiceType, setHomeServiceType] = useState(null);
  const [homeContactName, setHomeContactName] = useState(user?.name || '');
  const [homeContactPhone, setHomeContactPhone] = useState(user?.phone || '');
  const [homeAddress, setHomeAddress] = useState('');
  const [homeServiceNotes, setHomeServiceNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [shopPayMethods, setShopPayMethods] = useState([]);
  const [eventDates, setEventDates] = useState([]);
  const [loadingEventDates, setLoadingEventDates] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [shopRes, barberRes, pmRes, customerRes] = await Promise.all([
          api.get(`/barbershops/${shopId}`),
          api.get('/barbers', { params: { barbershop_id: shopId } }),
          api.get(`/payment-methods/${shopId}`).catch(() => ({ data: [] })),
          api.get('/customers/me').catch(() => ({ data: null }))
        ]);
        setShop(shopRes.data.shop);
        const avail = (barberRes.data || []).filter(b => b.is_available);
        setBarbers(avail);
        setShopPayMethods(pmRes.data || []);
        setHomeContactName(customerRes.data?.name || user?.name || '');
        setHomeContactPhone(customerRes.data?.phone || user?.phone || '');
      } catch { toast.error('Could not load barbershop info'); }
      setLoading(false);
    };
    load();
  }, [shopId, user?.name, user?.phone]);

  useEffect(() => {
    if (!selectedBarber) { setServices([]); return; }
    api.get(`/services/by-barber/${selectedBarber.id}`)
      .then(res => setServices(res.data || []))
      .catch(() => setServices([]));
  }, [selectedBarber]);

  useEffect(() => {
    if (!selectedDate || (bookingAtHome && homeServiceType === 'event')) {
      setBookedSlots([]);
      return;
    }
    let active = true;
    setBookedSlots([]);
    api.get('/appointments/available-slots', {
      params: {
        barbershop_id: shopId,
        barber_id: selectedBarber?.id,
        service_id: selectedService?.id,
        date: selectedDate
      }
    }).then(res => {
      if (active) setBookedSlots(res.data.booked_slots || []);
    }).catch(() => {
      if (active) toast.error('Could not load available times');
    });
    return () => { active = false; };
  }, [selectedDate, selectedBarber, selectedService, shopId, bookingAtHome, homeServiceType]);

  useEffect(() => {
    if (!bookingAtHome || homeServiceType !== 'event' || !selectedBarber) {
      setEventDates([]);
      return;
    }
    let active = true;
    setLoadingEventDates(true);
    api.get('/appointments/available-event-dates', {
      params: { barbershop_id: shopId, barber_id: selectedBarber.id }
    }).then(res => {
      if (active) setEventDates(res.data || []);
    }).catch(() => {
      if (active) {
        setEventDates([]);
        toast.error('Could not load available event dates');
      }
    }).finally(() => {
      if (active) setLoadingEventDates(false);
    });
    return () => { active = false; };
  }, [bookingAtHome, homeServiceType, selectedBarber, shopId]);

  const generateSlots = () => {
    if (!shop) return [];
    const open = shop.opening_time?.substring(0, 5) || '08:00';
    const close = shop.closing_time?.substring(0, 5) || '20:00';
    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    const slots = [];
    const closeMinutes = closeH * 60 + closeM;
    for (let start = openH * 60 + openM; start + 30 <= closeMinutes; start += 30) {
      const h = Math.floor(start / 60), m = start % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
  };

  const isEventBooking = bookingAtHome && homeServiceType === 'event';
  const steps = [
    { key: 'location', label: 'Booking Type' },
    ...(bookingAtHome ? [{ key: 'homeType', label: 'Home Service' }] : []),
    { key: 'barber', label: 'Barber' },
    { key: isEventBooking ? 'services' : 'service', label: isEventBooking ? 'Services' : 'Service' },
    { key: 'date', label: isEventBooking ? 'Event Date' : 'Date & Time' },
    ...(bookingAtHome ? [{ key: 'details', label: 'Customer Details' }] : []),
    { key: 'confirm', label: 'Confirm' }
  ];
  const currentStep = steps[step]?.key;
  const confirmStep = steps.length - 1;
  const availableServices = bookingAtHome && !isEventBooking
    ? services.filter(service => service.is_home_service)
    : services;

  const canProceed = () => {
    if (currentStep === 'location') return bookingAtHome !== null;
    if (currentStep === 'homeType') return !!homeServiceType;
    if (currentStep === 'barber') return !!selectedBarber;
    if (currentStep === 'service') return !!selectedService;
    if (currentStep === 'services') return true;
    if (currentStep === 'date') return !!selectedDate && (isEventBooking
      ? eventDates.includes(selectedDate)
      : !!selectedTime);
    if (currentStep === 'details') {
      return !!homeContactName.trim() && !!homeContactPhone.trim() && !!homeAddress.trim();
    }
    return true;
  };

  const handleBook = async () => {
    if (bookingAtHome && (!homeContactName.trim() || !homeContactPhone.trim() || !homeAddress.trim())) {
      toast.error('Enter your name, phone number, and home-service address');
      return;
    }
    if (isEventBooking && !eventDates.includes(selectedDate)) {
      toast.error('That event date is no longer available. Please choose another date.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/appointments', {
        barbershop_id: shopId, barber_id: selectedBarber?.id,
        service_id: isEventBooking ? null : selectedService?.id, appointment_date: selectedDate,
        appointment_time: isEventBooking ? null : selectedTime + ':00', notes,
        is_home_service: bookingAtHome,
        home_service_type: bookingAtHome ? homeServiceType : null,
        home_address: bookingAtHome ? homeAddress.trim() : null,
        home_contact_name: bookingAtHome ? homeContactName.trim() : null,
        home_contact_phone: bookingAtHome ? homeContactPhone.trim() : null,
        home_service_notes: bookingAtHome ? homeServiceNotes.trim() : null
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
  const maxDate = new Date();
  maxDate.setUTCDate(maxDate.getUTCDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading...</div></Layout>;
  if (!shop) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Barbershop not found.</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Book Appointment</h1>
          <p style={{ color: '#8b92a9', fontSize: 13, margin: 0 }}>at <strong style={{ color: '#d4af37' }}>{shop.name}</strong></p>

          <div style={{ display: 'flex', marginTop: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #1e2a3a' }}>
            {steps.map((s, i) => (
              <div key={s.key} style={{ flex: 1, padding: '10px 4px', textAlign: 'center', background: i < step ? 'rgba(16,185,129,0.05)' : i === step ? 'rgba(212,175,55,0.12)' : '#0f1827', borderRight: i < steps.length - 1 ? '1px solid #1e2a3a' : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? '#10b981' : i === step ? 'rgba(212,175,55,0.3)' : '#1e2a3a', fontSize: 11, color: i < step ? '#fff' : i === step ? '#d4af37' : '#8b92a9', fontWeight: 700 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, color: i === step ? '#d4af37' : i < step ? '#10b981' : '#8b92a9', whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20, minHeight: 280 }}>

          {/* Step 0: Booking type */}
          {currentStep === 'location' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Where would you like your appointment?</h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>Choose how you want to receive this service.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { home: false, icon: <Scissors size={22} />, title: 'At the barbershop', description: 'Visit the shop for your appointment.' },
                  { home: true, icon: <Home size={22} />, title: 'Home service', description: 'Have the barber come to your address.' }
                ].map(option => (
                  <button key={String(option.home)} type="button" onClick={() => {
                    setBookingAtHome(option.home);
                    setHomeServiceType(null);
                    setSelectedBarber(null);
                    setSelectedService(null);
                    setSelectedDate('');
                    setSelectedTime('');
                  }} style={{
                    padding: 18, borderRadius: 10, border: `1.5px solid ${bookingAtHome === option.home ? '#d4af37' : '#1e2a3a'}`,
                    background: bookingAtHome === option.home ? 'rgba(212,175,55,0.08)' : '#0a1020',
                    color: '#f0f0f0', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}>
                    <span style={{ color: '#d4af37' }}>{option.icon}</span>
                    <span>
                      <strong style={{ display: 'block', marginBottom: 5 }}>{option.title}</strong>
                      <span style={{ color: '#8b92a9', fontSize: 12 }}>{option.description}</span>
                    </span>
                    {bookingAtHome === option.home && <CheckCircle size={18} color="#d4af37" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'homeType' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>What kind of home service do you need?</h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>Personal bookings are for an individual appointment. Event bookings reserve the barber for the full day.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {[
                  { type: 'personal', icon: <User size={22} />, title: 'Personal', description: 'Book a regular home-service appointment and choose a service and time.' },
                  { type: 'event', icon: <Calendar size={22} />, title: 'Event', description: 'Reserve the barber for the whole day at your event.' }
                ].map(option => (
                  <button key={option.type} type="button" onClick={() => {
                    setHomeServiceType(option.type);
                    setSelectedBarber(null);
                    setSelectedService(null);
                    setSelectedDate('');
                    setSelectedTime('');
                  }} style={{
                    padding: 18, borderRadius: 10, border: `1.5px solid ${homeServiceType === option.type ? '#d4af37' : '#1e2a3a'}`,
                    background: homeServiceType === option.type ? 'rgba(212,175,55,0.08)' : '#0a1020',
                    color: '#f0f0f0', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}>
                    <span style={{ color: '#d4af37' }}>{option.icon}</span>
                    <span>
                      <strong style={{ display: 'block', marginBottom: 5 }}>{option.title}</strong>
                      <span style={{ color: '#8b92a9', fontSize: 12 }}>{option.description}</span>
                    </span>
                    {homeServiceType === option.type && <CheckCircle size={18} color="#d4af37" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Barber selection */}
          {currentStep === 'barber' && (
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
                  <div key={b.id} onClick={() => { setSelectedBarber(b); setSelectedService(null); setSelectedDate(''); setSelectedTime(''); }} style={{
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

          {currentStep === 'service' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scissors size={16} color="#d4af37" /> Choose a Service
              </h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>
                {bookingAtHome ? 'Home-service options' : 'Services'} offered by {selectedBarber?.name}
              </p>
              {availableServices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <Scissors size={40} color="#374151" style={{ marginBottom: 14 }} />
                  <div style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 500 }}>
                    {bookingAtHome ? 'No home services available' : 'No services listed'}
                  </div>
                  <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>
                    {bookingAtHome ? 'Choose another barber or book at the barbershop.' : `${selectedBarber?.name} hasn't added any services yet.`}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {availableServices.map(s => (
                    <div key={s.id} onClick={() => { setSelectedService(s); setSelectedTime(''); }} style={{
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
                          <span style={{ color: '#8b92a9', fontSize: 12 }}>30 min</span>
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

          {currentStep === 'services' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {selectedBarber?.name}'s services
              </h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>
                This is a full-day event reservation, so no individual service is selected.
              </p>
              {services.length === 0 ? (
                <div style={{ color: '#8b92a9', textAlign: 'center', padding: 24 }}>This barber has no listed services.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {services.map(service => (
                    <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, background: '#0a1020', border: '1px solid #1e2a3a', borderRadius: 8 }}>
                      <span style={{ color: '#f0f0f0', fontWeight: 600 }}>{service.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {Number(selectedBarber?.event_price) > 0 ? (
                <div style={{ marginTop: 14, color: '#d4af37', fontWeight: 700 }}>Full-day event rate: ₱{Number(selectedBarber.event_price).toFixed(2)}</div>
              ) : (
                <div style={{ marginTop: 14, color: '#f59e0b', fontSize: 13 }}>This barber’s event rate has not been set by the barbershop yet.</div>
              )}
            </div>
          )}

          {/* Date and time selection */}
          {currentStep === 'date' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={16} color="#d4af37" /> {isEventBooking ? 'Choose an available event date' : 'Pick Date & Time'}
              </h2>
              {isEventBooking ? (
                <>
                  <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 14px' }}>Event bookings reserve the selected barber for the entire day. Dates with appointments or walk-ins are unavailable.</p>
                  {loadingEventDates ? (
                    <div style={{ color: '#8b92a9', padding: 20, textAlign: 'center' }}>Checking available dates...</div>
                  ) : eventDates.length === 0 ? (
                    <div style={{ color: '#8b92a9', padding: 20, textAlign: 'center' }}>No full-day dates are currently available for this barber.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                      {eventDates.map(date => (
                        <button key={date} type="button" onClick={() => { setSelectedDate(date); setSelectedTime(''); }}
                          style={{ padding: 12, borderRadius: 8, border: `1px solid ${selectedDate === date ? '#d4af37' : '#2d3748'}`, background: selectedDate === date ? 'rgba(212,175,55,0.12)' : '#0a1020', color: selectedDate === date ? '#d4af37' : '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>
                          {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 8 }}>Date</label>
                <input type="date" min={minDateStr} max={maxDateStr} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }}
                  style={{ background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '12px 14px', borderRadius: 8, fontSize: 15, width: '100%', boxSizing: 'border-box' }} />
              </div>
              {selectedDate && (
                <div>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>
                    <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />Available Times
                    <span style={{ color: '#4b5563', marginLeft: 8, fontSize: 11 }}>({shop.opening_time?.substring(0, 5)} - {shop.closing_time?.substring(0, 5)})</span>
                    <span style={{ color: '#4b5563', marginLeft: 8, fontSize: 11 }}>· 30-minute session</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {generateSlots().map(t => (
                      <TimeSlot key={t} time={t} booked={bookedSlots.includes(t)} selected={selectedTime === t} onClick={() => setSelectedTime(t)} />
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {currentStep === 'details' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Home-service details</h2>
              <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 16px' }}>The barber will use these details to contact you and reach your location.</p>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Contact name <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <User size={15} color="#8b92a9" style={{ position: 'absolute', left: 12, top: 13 }} />
                <input value={homeContactName} onChange={e => setHomeContactName(e.target.value)} required autoComplete="name"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 14 }} />
              </div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Phone number <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <Phone size={15} color="#8b92a9" style={{ position: 'absolute', left: 12, top: 13 }} />
                <input type="tel" value={homeContactPhone} onChange={e => setHomeContactPhone(e.target.value)} required autoComplete="tel"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 36px', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 14 }} />
              </div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Complete address <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <MapPin size={15} color="#8b92a9" style={{ position: 'absolute', left: 12, top: 13 }} />
                <textarea value={homeAddress} onChange={e => setHomeAddress(e.target.value)} required autoComplete="street-address" rows={3}
                  placeholder="House/building, street, barangay, city"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
              </div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Landmark or instructions (optional)</label>
              <textarea value={homeServiceNotes} onChange={e => setHomeServiceNotes(e.target.value)} rows={2}
                placeholder="Nearby landmark, gate instructions, or other helpful details"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
            </div>
          )}

          {/* Final step: Confirm */}
          {currentStep === 'confirm' && (
            <div>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Confirm Your Booking</h2>
              <div style={{ background: '#0a1020', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                {[
                  ['Shop', shop.name],
                  ['Barber', selectedBarber?.name],
                  ['Service', isEventBooking ? 'Full-day event booking' : selectedService?.name],
                  ['Price', `₱${Number(isEventBooking ? selectedBarber?.event_price : selectedService?.price || 0).toFixed(2)}`],
                  ...(bookingAtHome ? [['Booking Type', 'Home Service']] : []),
                  ...(isEventBooking ? [['Home Service Type', 'Event (full day)']] : []),
                  ...(bookingAtHome ? [['Contact', homeContactName], ['Phone', homeContactPhone]] : []),
                  ...(bookingAtHome && homeAddress ? [['Home Address', homeAddress]] : []),
                  ['Date', selectedDate],
                  ...(!isEventBooking ? [['Time', formatTime(selectedTime)]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #1e2a3a' }}>
                    <span style={{ color: '#8b92a9', fontSize: 13 }}>{k}</span>
                    <span style={{ color: k === 'Price' ? '#d4af37' : '#f0f0f0', fontWeight: 600, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>

              {bookingAtHome && homeServiceNotes && (
                <div style={{ color: '#8b92a9', fontSize: 12, marginBottom: 12 }}>Home-service instructions: {homeServiceNotes}</div>
              )}

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
          {step < confirmStep ? (
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
