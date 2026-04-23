import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, ToggleLeft, ToggleRight, Star, CheckCircle, UserX, X, MessageSquare, CalendarDays } from 'lucide-react';

const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };

const VALID_TABS = ['today','upcoming'];

export default function BarberDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [tab, setTabState] = useState(VALID_TABS.includes(urlTab) ? urlTab : 'today');
  useEffect(() => {
    const t = searchParams.get('tab');
    if (VALID_TABS.includes(t)) setTabState(t);
    else if (!t) setTabState('today');
  }, [searchParams]);
  const setTab = (t) => {
    setTabState(t);
    if (t === 'today') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: t }, { replace: true });
  };

  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [rateModal, setRateModal] = useState(null);
  const [rateForm, setRateForm] = useState({ rating: 5, comment: '' });

  const fetchProfile = async () => {
    try { const res = await api.get('/barbers/me/profile'); setProfile(res.data); } catch {}
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/appointments/shop', { params: { date: today } });
      setAppointments(res.data || []);
    } catch {}
  };

  const fetchUpcoming = async () => {
    try {
      const res = await api.get('/appointments/shop');
      const today = new Date().toISOString().split('T')[0];
      const future = (res.data || []).filter(a =>
        a.appointment_date >= today && ['pending','confirmed'].includes(a.status)
      ).sort((a,b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
      setUpcoming(future);
    } catch {}
  };

  const fetchReviewCount = async () => {
    try { const res = await api.get('/ratings/barber/me'); setReviewCount((res.data || []).length); } catch {}
  };

  useEffect(() => {
    fetchProfile();
    fetchAppointments();
    fetchUpcoming();
    fetchReviewCount();
    const interval = setInterval(() => { fetchAppointments(); fetchUpcoming(); }, 30000);
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
    if (status === 'no_show' && !confirm('Mark as no-show? Slot will be released and you can rate the customer.')) return;
    try {
      await api.patch(`/appointments/${appt.id}/status`, { status });
      toast.success('Updated');
      fetchAppointments();
      fetchUpcoming();
      if (status === 'no_show' || status === 'completed') {
        setRateModal(appt);
        setRateForm({ rating: status === 'no_show' ? 1 : 5, comment: '' });
      }
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

  const todayAppts = appointments.filter(a => ['pending','confirmed','in_progress'].includes(a.status));
  const completedToday = appointments.filter(a => a.status === 'completed').length;

  const renderApptCard = (a, showDate = false) => (
    <div key={a.id} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontWeight:700,color:'#f0f0f0'}}>#{a.queue_number} · {a.customer_name}</div>
          <div style={{fontSize:13,color:'#8b92a9',marginTop:4}}>
            {showDate && <><CalendarDays size={12} style={{verticalAlign:'middle',marginRight:4}}/>{a.appointment_date} · </>}
            <Clock size={12} style={{verticalAlign:'middle',marginRight:4}}/>{a.appointment_time?.substring(0,5)} · {a.service_name}
          </div>
          {a.customer_no_show_count > 0 && <div style={{fontSize:11,color:'#ef4444',marginTop:4}}>⚠ {a.customer_no_show_count} prior no-shows · ★ {parseFloat(a.customer_rating || 5).toFixed(1)}</div>}
        </div>
        <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
      </div>
      <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
        {a.status === 'pending' && <button onClick={() => updateApptStatus(a, 'confirmed')} style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>Confirm</button>}
        {a.status === 'confirmed' && <button onClick={() => updateApptStatus(a, 'in_progress')} style={{padding:'6px 12px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>Start</button>}
        {a.status === 'in_progress' && <button onClick={() => updateApptStatus(a, 'completed')} style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}><CheckCircle size={12} style={{verticalAlign:'middle',marginRight:4}}/>Complete</button>}
        {['pending','confirmed'].includes(a.status) && <button onClick={() => updateApptStatus(a, 'no_show')} style={{padding:'6px 12px',background:'#7c2d12',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}><UserX size={12} style={{verticalAlign:'middle',marginRight:4}}/>No-Show</button>}
        {a.status === 'completed' && <button onClick={() => { setRateModal(a); setRateForm({ rating: 5, comment: '' }); }} style={{padding:'6px 12px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}><Star size={12} style={{verticalAlign:'middle',marginRight:4}}/>Rate Customer</button>}
      </div>
    </div>
  );

  return (
    <Layout>
      <div style={{padding:'20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16,marginBottom:20}}>
          <div>
            <h1 style={{margin:0,color:'#f0f0f0'}}>Welcome, {profile?.name?.split(' ')[0] || 'Barber'} ✂️</h1>
            <p style={{color:'#8b92a9',margin:'4px 0 0 0'}}>{profile?.barbershop_name}</p>
          </div>
          <button onClick={toggleAvail} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:profile?.is_available ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',color:profile?.is_available ? '#16a34a' : '#ef4444',border:`1px solid ${profile?.is_available ? '#16a34a' : '#ef4444'}`,borderRadius:8,cursor:'pointer',fontWeight:600}}>
            {profile?.is_available ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
            {profile?.is_available ? 'Available' : 'Unavailable'}
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:24}}>
          <div style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16,display:'flex',gap:12,alignItems:'center'}}>
            <Calendar size={24} color="#d4af37"/>
            <div><div style={{fontSize:24,fontWeight:700,color:'#f0f0f0'}}>{todayAppts.length}</div><div style={{fontSize:12,color:'#8b92a9'}}>Today's queue</div></div>
          </div>
          <div style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16,display:'flex',gap:12,alignItems:'center'}}>
            <CheckCircle size={24} color="#16a34a"/>
            <div><div style={{fontSize:24,fontWeight:700,color:'#f0f0f0'}}>{completedToday}</div><div style={{fontSize:12,color:'#8b92a9'}}>Completed today</div></div>
          </div>
          <div style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16,display:'flex',gap:12,alignItems:'center'}}>
            <Star size={24} color="#d4af37"/>
            <div><div style={{fontSize:24,fontWeight:700,color:'#f0f0f0'}}>{parseFloat(profile?.rating || 5).toFixed(1)}</div><div style={{fontSize:12,color:'#8b92a9'}}>Your rating</div></div>
          </div>
          <div style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16,display:'flex',gap:12,alignItems:'center'}}>
            <MessageSquare size={24} color="#d4af37"/>
            <div><div style={{fontSize:24,fontWeight:700,color:'#f0f0f0'}}>{reviewCount}</div><div style={{fontSize:12,color:'#8b92a9'}}>Reviews</div></div>
          </div>
        </div>

        <div style={{display:'flex',gap:8,borderBottom:'1px solid #2d3748',marginBottom:20,flexWrap:'wrap'}}>
          {[
            { k:'today', label:"Today's Appointments", icon: Calendar },
            { k:'upcoming', label:'Upcoming', icon: CalendarDays },
          ].map(({k,label,icon:Icon}) => (
            <button key={k} onClick={() => setTab(k)} style={{padding:'12px 20px',background:'none',border:'none',borderBottom:`2px solid ${tab===k?'#d4af37':'transparent'}`,color:tab===k?'#d4af37':'#8b92a9',cursor:'pointer',fontWeight:600}}>
              <Icon size={14} style={{display:'inline',marginRight:6,verticalAlign:'middle'}}/>{label}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div>
            {todayAppts.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#8b92a9'}}>No appointments today</div> :
              <div style={{display:'flex',flexDirection:'column',gap:12}}>{todayAppts.map(a => renderApptCard(a))}</div>
            }
            {appointments.filter(a => a.status === 'completed').length > 0 && (
              <div style={{marginTop:24}}>
                <h3 style={{color:'#8b92a9',fontSize:14,marginBottom:12}}>Completed today</h3>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>{appointments.filter(a => a.status === 'completed').map(a => renderApptCard(a))}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'upcoming' && (
          <div>
            {upcoming.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#8b92a9'}}>No upcoming appointments</div> :
              <div style={{display:'flex',flexDirection:'column',gap:12}}>{upcoming.map(a => renderApptCard(a, true))}</div>
            }
          </div>
        )}
      </div>

      {rateModal && (
        <div onClick={() => setRateModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
          <form onClick={e => e.stopPropagation()} onSubmit={submitCustomerRating} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:12,padding:24,maxWidth:420,width:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h3 style={{margin:0,color:'#f0f0f0'}}>Rate {rateModal.customer_name}</h3>
              <X size={20} color="#8b92a9" style={{cursor:'pointer'}} onClick={() => setRateModal(null)}/>
            </div>
            <p style={{color:'#8b92a9',fontSize:13,marginBottom:16}}>How was this customer? Your rating helps other shops decide.</p>
            <div style={{display:'flex',gap:6,marginBottom:16,justifyContent:'center'}}>
              {[1,2,3,4,5].map(n => (
                <Star key={n} size={32} fill={n <= rateForm.rating ? '#d4af37' : 'transparent'} color="#d4af37" style={{cursor:'pointer'}} onClick={() => setRateForm(f => ({...f, rating: n}))}/>
              ))}
            </div>
            <textarea value={rateForm.comment} onChange={e => setRateForm(f => ({...f, comment: e.target.value}))} rows={3} placeholder="Optional comment" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,marginBottom:16}}/>
            <button type="submit" style={{width:'100%',padding:12,background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer'}}>Submit Rating</button>
          </form>
        </div>
      )}
    </Layout>
  );
}
