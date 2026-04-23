import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, User, Settings, ToggleLeft, ToggleRight, Star, CheckCircle, UserX, ListChecks, Save, Upload } from 'lucide-react';

const SPECIALTIES_OPTS = ['Low Fade','High Fade','Mid Fade','Skin Fade','Classic Cut','Crew Cut','Pompadour','Undercut','Buzz Cut','Beard Trim','Hot Towel Shave','Hair Design'];
const STATUS_LABEL = { pending:'Pending', confirmed:'Confirmed', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled', no_show:'No Show' };
const STATUS_COLOR = { pending:'warning', confirmed:'success', in_progress:'info', completed:'success', cancelled:'error', no_show:'error' };

export default function BarberDashboard() {
  const [tab, setTab] = useState('today');
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [profileForm, setProfileForm] = useState({ bio: '', phone: '', specialties: [], service_ids: [] });
  const [photoFile, setPhotoFile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/barbers/me/profile');
      setProfile(res.data);
      setProfileForm({
        bio: res.data.bio || '',
        phone: res.data.phone || '',
        specialties: res.data.specialties?.filter(Boolean) || [],
        service_ids: res.data.service_ids?.filter(Boolean) || []
      });
      // load shop services
      const sRes = await api.get('/services', { params: { barbershop_id: res.data.barbershop_id } });
      setServices(sRes.data || []);
    } catch {}
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/appointments/shop', { params: { date: today } });
      setAppointments(res.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchProfile();
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleAvail = async () => {
    try {
      const res = await api.patch('/barbers/me/toggle');
      setProfile(p => ({ ...p, is_available: res.data.is_available }));
      toast.success(res.data.is_available ? 'You are now available' : 'You are now unavailable');
    } catch { toast.error('Failed'); }
  };

  const updateApptStatus = async (id, status) => {
    if (status === 'no_show' && !confirm('Mark as no-show? Slot will be released.')) return;
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      toast.success('Updated');
      fetchAppointments();
    } catch { toast.error('Failed'); }
  };

  const toggleSpec = (sp) => setProfileForm(p => ({ ...p, specialties: p.specialties.includes(sp) ? p.specialties.filter(s => s !== sp) : [...p.specialties, sp] }));
  const toggleSvc = (id) => setProfileForm(p => ({ ...p, service_ids: p.service_ids.includes(id) ? p.service_ids.filter(s => s !== id) : [...p.service_ids, id] }));

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const fd = new FormData();
      fd.append('bio', profileForm.bio);
      fd.append('phone', profileForm.phone);
      fd.append('specialties', JSON.stringify(profileForm.specialties));
      fd.append('service_ids', JSON.stringify(profileForm.service_ids));
      if (photoFile) fd.append('photo', photoFile);
      await api.put('/barbers/me/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated');
      setPhotoFile(null);
      fetchProfile();
    } catch { toast.error('Update failed'); }
    finally { setSavingProfile(false); }
  };

  const todayAppts = appointments.filter(a => ['pending','confirmed','in_progress'].includes(a.status));
  const completedToday = appointments.filter(a => a.status === 'completed').length;

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
            <ListChecks size={24} color="#d4af37"/>
            <div><div style={{fontSize:24,fontWeight:700,color:'#f0f0f0'}}>{profile?.total_cuts || 0}</div><div style={{fontSize:12,color:'#8b92a9'}}>Total cuts</div></div>
          </div>
        </div>

        <div style={{display:'flex',gap:8,borderBottom:'1px solid #2d3748',marginBottom:20}}>
          {['today','profile'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{padding:'12px 20px',background:'none',border:'none',borderBottom:`2px solid ${tab===t?'#d4af37':'transparent'}`,color:tab===t?'#d4af37':'#8b92a9',cursor:'pointer',fontWeight:600,textTransform:'capitalize'}}>
              {t === 'today' ? <><Calendar size={14} style={{display:'inline',marginRight:6}}/>Today's Appointments</> : <><User size={14} style={{display:'inline',marginRight:6}}/>My Profile</>}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div>
            {todayAppts.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#8b92a9'}}>No appointments today</div> :
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {todayAppts.map(a => (
                  <div key={a.id} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,padding:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontWeight:700,color:'#f0f0f0'}}>#{a.queue_number} · {a.customer_name}</div>
                        <div style={{fontSize:13,color:'#8b92a9',marginTop:4}}><Clock size={12} style={{verticalAlign:'middle',marginRight:4}}/>{a.appointment_time?.substring(0,5)} · {a.service_name}</div>
                        {a.customer_no_show_count > 0 && <div style={{fontSize:11,color:'#ef4444',marginTop:4}}>⚠ {a.customer_no_show_count} prior no-shows</div>}
                      </div>
                      <span className={`badge badge-${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </div>
                    <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
                      {a.status === 'pending' && <button onClick={() => updateApptStatus(a.id, 'confirmed')} style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>Confirm</button>}
                      {a.status === 'confirmed' && <button onClick={() => updateApptStatus(a.id, 'in_progress')} style={{padding:'6px 12px',background:'#3b82f6',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>Start</button>}
                      {a.status === 'in_progress' && <button onClick={() => updateApptStatus(a.id, 'completed')} style={{padding:'6px 12px',background:'#16a34a',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}><CheckCircle size={12} style={{verticalAlign:'middle',marginRight:4}}/>Complete</button>}
                      {['pending','confirmed'].includes(a.status) && <button onClick={() => updateApptStatus(a.id, 'no_show')} style={{padding:'6px 12px',background:'#7c2d12',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}><UserX size={12} style={{verticalAlign:'middle',marginRight:4}}/>No-Show</button>}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {tab === 'profile' && profile && (
          <form onSubmit={saveProfile} style={{maxWidth:700}}>
            <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:20}}>
              <div style={{width:80,height:80,borderRadius:'50%',overflow:'hidden',background:'#2d3748',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,color:'#d4af37',fontWeight:700}}>
                {profile.photo_url ? <img src={profile.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : profile.name?.charAt(0)}
              </div>
              <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:6,cursor:'pointer',fontSize:13}}>
                <Upload size={13}/> {photoFile ? photoFile.name : 'Upload Photo'}
                <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={{display:'none'}}/>
              </label>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Phone</label>
              <input value={profileForm.phone} onChange={e => setProfileForm(p => ({...p, phone: e.target.value}))} placeholder="09XX XXX XXXX" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Bio</label>
              <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({...p, bio: e.target.value}))} rows={3} placeholder="Tell customers about yourself" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>My Specialties</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {SPECIALTIES_OPTS.map(sp => (
                  <button key={sp} type="button" onClick={() => toggleSpec(sp)} style={{padding:'6px 12px',border:`1px solid ${profileForm.specialties.includes(sp) ? '#d4af37' : '#2d3748'}`,background:profileForm.specialties.includes(sp) ? 'rgba(212,175,55,0.15)' : 'transparent',color:profileForm.specialties.includes(sp) ? '#d4af37' : '#8b92a9',borderRadius:6,cursor:'pointer',fontSize:12}}>
                    {sp}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Services I Offer</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {services.length === 0 ? <span style={{color:'#8b92a9',fontSize:13}}>No services in this shop yet</span> :
                  services.map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSvc(s.id)} style={{padding:'8px 12px',border:`1px solid ${profileForm.service_ids.includes(s.id) ? '#d4af37' : '#2d3748'}`,background:profileForm.service_ids.includes(s.id) ? 'rgba(212,175,55,0.15)' : 'transparent',color:profileForm.service_ids.includes(s.id) ? '#d4af37' : '#cbd5e1',borderRadius:6,cursor:'pointer',fontSize:12}}>
                      {s.name} · ₱{parseFloat(s.price).toFixed(0)}
                    </button>
                  ))}
              </div>
            </div>
            <button type="submit" disabled={savingProfile} style={{padding:'12px 24px',background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
              <Save size={14}/> {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
