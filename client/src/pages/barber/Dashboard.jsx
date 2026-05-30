import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, ToggleLeft, ToggleRight, Star, CheckCircle, UserX, X, MessageSquare, PlayCircle, Users } from 'lucide-react';

const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };

export default function BarberDashboard() {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [liveQueue, setLiveQueue] = useState({ appointments: [], walk_ins: [] });
  const [reviewCount, setReviewCount] = useState(0);
  const [rateModal, setRateModal] = useState(null);
  const [rateForm, setRateForm] = useState({ rating: 5, comment: '' });
  const [tab, setTab] = useState('appointments');

  const fetchProfile = async () => {
    try {
      const res = await api.get('/barbers/me/profile');
      setProfile(res.data);
      return res.data;
    } catch {}
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/appointments/shop', { params: { date: today } });
      setAppointments(res.data || []);
    } catch {}
  };

  const fetchQueue = async (barbershopId) => {
    if (!barbershopId) return;
    try {
      const res = await api.get(`/queue/${barbershopId}`);
      setLiveQueue(res.data || { appointments: [], walk_ins: [] });
    } catch {}
  };

  const fetchReviewCount = async () => {
    try { const res = await api.get('/ratings/barber/me'); setReviewCount((res.data || []).length); } catch {}
  };

  useEffect(() => {
    fetchProfile().then(prof => {
      if (prof?.barbershop_id) fetchQueue(prof.barbershop_id);
    });
    fetchAppointments();
    fetchReviewCount();
    const interval = setInterval(() => {
      fetchAppointments();
      setProfile(p => {
        if (p?.barbershop_id) fetchQueue(p.barbershop_id);
        return p;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleAvail = async () => {
    try {
      const res = await api.patch('/barbers/me/toggle');
      setProfile(p => ({ ...p, is_available: res.data.is_available }));
      toast.success(res.data.is_available ? 'You are now available' : 'You are now unavailable');
    } catch { toast.error('Failed'); }
  };

  const updateApptStatus = async (appt, status) => {
    if (status === 'no_show' && !confirm('Mark as no-show? The customer will be notified.')) return;
    try {
      await api.patch(`/appointments/${appt.id}/status`, { status });
      toast.success('Updated');
      fetchAppointments();
      if (profile?.barbershop_id) fetchQueue(profile.barbershop_id);
      if (status === 'no_show' || status === 'completed') {
        setRateModal(appt);
        setRateForm({ rating: status === 'no_show' ? 1 : 5, comment: '' });
      }
    } catch { toast.error('Failed'); }
  };

  const updateWalkInStatus = async (id, status) => {
    try {
      await api.patch(`/queue/${id}/status`, { status });
      toast.success('Updated');
      if (profile?.barbershop_id) fetchQueue(profile.barbershop_id);
    } catch { toast.error('Failed'); }
  };

  const submitCustomerRating = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer-ratings', {
        customer_id: rateModal.customer_id,
        appointment_id: rateModal.id,
        barber_id: profile.id,
        rating: rateForm.rating,
        comment: rateForm.comment || null
      });
      toast.success('Customer rated');
      setRateModal(null);
    } catch { toast.error('Failed'); }
  };

  const todayActive = appointments.filter(a => ['pending','confirmed','in_progress'].includes(a.status));
  const completedToday = appointments.filter(a => a.status === 'completed').length;

  const myQueueAppts = liveQueue.appointments.filter(a => !profile || a.barber_id == profile.id || true);
  const myWalkIns = liveQueue.walk_ins.filter(w => !profile?.id || w.barber_id == profile.id);
  const totalQueueWaiting = liveQueue.appointments.filter(a => ['pending','confirmed'].includes(a.status)).length +
    liveQueue.walk_ins.filter(w => w.status === 'waiting').length;

  const renderApptCard = (a) => (
    <div key={a.id} style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#f0f0f0' }}>#{a.queue_number} · {a.customer_name}</div>
          <div style={{ fontSize: 13, color: '#8b92a9', marginTop: 4 }}>
            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{a.appointment_time?.substring(0, 5)} · {a.service_name}
          </div>
          {a.customer_no_show_count > 0 && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ {a.customer_no_show_count} prior no-shows</div>}
        </div>
        <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {a.status === 'pending' && <button onClick={() => updateApptStatus(a, 'confirmed')} style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Confirm</button>}
        {a.status === 'confirmed' && <button onClick={() => updateApptStatus(a, 'in_progress')} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Start</button>}
        {a.status === 'in_progress' && <button onClick={() => updateApptStatus(a, 'completed')} style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Complete</button>}
        {['pending', 'confirmed'].includes(a.status) && <button onClick={() => updateApptStatus(a, 'no_show')} style={{ padding: '6px 12px', background: '#7c2d12', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><UserX size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />No-Show</button>}
        {a.status === 'completed' && <button onClick={() => { setRateModal(a); setRateForm({ rating: 5, comment: '' }); }} style={{ padding: '6px 12px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}><Star size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Rate Customer</button>}
      </div>
    </div>
  );

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, color: '#f0f0f0' }}>Welcome, {profile?.name?.split(' ')[0] || 'Barber'} ✂️</h1>
            <p style={{ color: '#8b92a9', margin: '4px 0 0 0' }}>{profile?.barbershop_name}</p>
          </div>
          <button onClick={toggleAvail} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: profile?.is_available ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)', color: profile?.is_available ? '#16a34a' : '#ef4444', border: `1px solid ${profile?.is_available ? '#16a34a' : '#ef4444'}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {profile?.is_available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {profile?.is_available ? 'Available' : 'Unavailable'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Calendar size={24} color="#d4af37" />
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>{todayActive.length}</div><div style={{ fontSize: 12, color: '#8b92a9' }}>Active today</div></div>
          </div>
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <CheckCircle size={24} color="#16a34a" />
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>{completedToday}</div><div style={{ fontSize: 12, color: '#8b92a9' }}>Completed today</div></div>
          </div>
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Users size={24} color="#3b82f6" />
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>{totalQueueWaiting}</div><div style={{ fontSize: 12, color: '#8b92a9' }}>Shop queue</div></div>
          </div>
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Star size={24} color="#d4af37" />
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>{parseFloat(profile?.rating || 5).toFixed(1)}</div><div style={{ fontSize: 12, color: '#8b92a9' }}>Your rating</div></div>
          </div>
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <MessageSquare size={24} color="#d4af37" />
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>{reviewCount}</div><div style={{ fontSize: 12, color: '#8b92a9' }}>Reviews</div></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #2d3748', marginBottom: 20 }}>
          {[
            { k: 'appointments', label: "Today's Appointments", icon: Calendar },
            { k: 'queue', label: 'Live Queue', icon: Users },
          ].map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '12px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === k ? '#d4af37' : 'transparent'}`, color: tab === k ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontWeight: 600 }}>
              <Icon size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />{label}
            </button>
          ))}
        </div>

        {tab === 'appointments' && (
          <div>
            {todayActive.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#8b92a9' }}>No active appointments today</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {todayActive.map(a => renderApptCard(a))}
              </div>
            )}
            {completedToday > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ color: '#8b92a9', fontSize: 14, marginBottom: 12 }}>Completed today ({completedToday})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {appointments.filter(a => a.status === 'completed').map(a => renderApptCard(a))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'queue' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: '#f0f0f0', marginBottom: 12, fontSize: 15 }}>Appointment Queue (Today)</h3>
              {liveQueue.appointments.length === 0 ? (
                <div style={{ color: '#8b92a9', textAlign: 'center', padding: '24px 0' }}>No appointments in queue</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {liveQueue.appointments.map(a => (
                    <div key={a.id} style={{ background: '#1a2234', border: `1px solid ${a.status === 'in_progress' ? '#3b82f6' : '#2d3748'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>#{a.queue_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>Customer #{a.queue_number}</div>
                        <div style={{ color: '#8b92a9', fontSize: 12 }}>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''} · {a.appointment_time?.substring(0, 5)}</div>
                      </div>
                      <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                        {a.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ color: '#f0f0f0', marginBottom: 12, fontSize: 15 }}>Walk-in Queue</h3>
              {liveQueue.walk_ins.length === 0 ? (
                <div style={{ color: '#8b92a9', textAlign: 'center', padding: '24px 0' }}>No walk-ins in queue</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {liveQueue.walk_ins.map(w => (
                    <div key={w.id} style={{ background: '#1a2234', border: `1px solid ${w.status === 'in_progress' ? '#3b82f6' : '#2d3748'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>#{w.queue_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{w.customer_name} <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>(walk-in)</span></div>
                        <div style={{ color: '#8b92a9', fontSize: 12 }}>{w.service_name || '—'} {w.barber_name ? `· ${w.barber_name}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                          {w.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                        </span>
                        {w.status === 'waiting' && (
                          <button onClick={() => updateWalkInStatus(w.id, 'in_progress')} style={{ padding: '4px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PlayCircle size={11} /> Start
                          </button>
                        )}
                        {w.status === 'in_progress' && (
                          <button onClick={() => updateWalkInStatus(w.id, 'done')} style={{ padding: '4px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={11} /> Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {rateModal && (
        <div onClick={() => setRateModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitCustomerRating} style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 12, padding: 24, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#f0f0f0' }}>Rate {rateModal.customer_name}</h3>
              <X size={20} color="#8b92a9" style={{ cursor: 'pointer' }} onClick={() => setRateModal(null)} />
            </div>
            <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>How was this customer? Your rating helps other shops decide.</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} size={32} fill={n <= rateForm.rating ? '#d4af37' : 'transparent'} color="#d4af37" style={{ cursor: 'pointer' }} onClick={() => setRateForm(f => ({ ...f, rating: n }))} />
              ))}
            </div>
            <textarea value={rateForm.comment} onChange={e => setRateForm(f => ({ ...f, comment: e.target.value }))} rows={3} placeholder="Optional comment" style={{ width: '100%', background: '#0f1422', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6, marginBottom: 16, boxSizing: 'border-box', resize: 'none' }} />
            <button type="submit" style={{ width: '100%', padding: 12, background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Submit Rating</button>
          </form>
        </div>
      )}
    </Layout>
  );
}
