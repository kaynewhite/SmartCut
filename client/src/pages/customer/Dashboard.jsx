import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Clock, Star, Search, ArrowRight, Scissors, MapPin, Gift, TrendingUp, Bell, ChevronRight } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function CustomerDashboard() {
  const { user, updateUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [promos, setPromos] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchAll = async () => {
    try {
      const [apptRes, topRes, promoRes, remRes] = await Promise.all([
        api.get('/appointments/my'),
        api.get('/appointments/top-services?limit=8'),
        api.get('/loyalty-promos'),
        api.get('/appointments/reminders')
      ]);
      setAppointments(apptRes.data.slice(0, 3));
      setTopServices(topRes.data || []);
      setPromos(promoRes.data || []);
      setReminders(remRes.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const upcoming = appointments.filter(a => ['pending','confirmed','in_progress'].includes(a.status));
  const statusColors = { pending: 'warning', confirmed: 'success', in_progress: 'info', completed: 'success', cancelled: 'error', no_show: 'error' };
  const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show' };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.welcome}>
          <div>
            <h1>Welcome, {user?.name?.split(' ')[0]}! ✂️</h1>
            <p>Find and book your next haircut</p>
          </div>
          <Link to="/customer/explore" className={styles.exploreBtn}>
            <Search size={16} /> Explore Barbershops
          </Link>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Calendar size={20} color="#d4af37" />
            <div>
              <div className={styles.statNum}>{upcoming.length}</div>
              <div className={styles.statLabel}>Upcoming</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <Star size={20} color="#d4af37" />
            <div>
              <div className={styles.statNum}>{user?.rating ? parseFloat(user.rating).toFixed(1) : '5.0'}</div>
              <div className={styles.statLabel}>Your Rating</div>
            </div>
          </div>
        </div>

        {reminders.length > 0 && (
          <div style={{background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.4)',borderRadius:8,padding:'14px 16px',marginBottom:20,display:'flex',gap:12,alignItems:'flex-start'}}>
            <Bell size={20} color="#f59e0b" style={{flexShrink:0,marginTop:2}} />
            <div style={{flex:1}}>
              <div style={{color:'#f59e0b',fontWeight:600,marginBottom:6}}>Upcoming reminder{reminders.length > 1 ? 's' : ''} (next 24h)</div>
              {reminders.map(r => (
                <div key={r.id} style={{fontSize:13,color:'#cbd5e1'}}>
                  <strong>{r.service_name}</strong> at <strong>{r.barbershop_name}</strong> on {r.appointment_date} at {r.appointment_time?.substring(0,5)}
                </div>
              ))}
            </div>
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Upcoming Appointments</h2>
            <Link to="/customer/appointments" className={styles.viewAll}>View All <ArrowRight size={14} /></Link>
          </div>
          {loading ? <div className={styles.loading}>Loading...</div> :
            upcoming.length === 0 ? (
              <div className={styles.empty}>
                <Scissors size={40} color="#374151" />
                <p>No upcoming appointments</p>
                <Link to="/customer/explore" className={styles.bookBtn}>Book Now</Link>
              </div>
            ) : (
              <div className={styles.apptList}>
                {upcoming.map(a => (
                  <div key={a.id} className={styles.apptCard}>
                    <div className={styles.apptLogo}>
                      {a.barbershop_logo ? <img src={a.barbershop_logo} alt="" /> : <Scissors size={20} color="#d4af37" />}
                    </div>
                    <div className={styles.apptInfo}>
                      <div className={styles.apptShop}>{a.barbershop_name}</div>
                      <div className={styles.apptService}>{a.service_name} {a.barber_name ? `• ${a.barber_name}` : ''}</div>
                      <div className={styles.apptTime}>
                        <Clock size={12} /> {a.appointment_date} at {a.appointment_time?.substring(0,5)}
                        {a.queue_number && <span> • Queue #{a.queue_number}</span>}
                      </div>
                    </div>
                    <span className={`badge badge-${statusColors[a.status]}`}>{statusLabels[a.status]}</span>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2><TrendingUp size={18} style={{display:'inline',verticalAlign:'-3px',marginRight:6,color:'#d4af37'}}/>Featured Services</h2>
            <Link to="/customer/explore" className={styles.viewAll}>Browse All <ArrowRight size={14} /></Link>
          </div>
          {topServices.length === 0 && !loading ? (
            <div className={styles.empty}><Scissors size={40} color="#374151"/><p>No services available yet.</p></div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16}}>
              {topServices.map(s => (
                <Link key={s.id} to={`/customer/barbershop/${s.barbershop_id}`} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,overflow:'hidden',textDecoration:'none',color:'inherit',transition:'transform .15s'}}>
                  {s.image_url ? <img src={s.image_url} alt={s.name} style={{width:'100%',height:140,objectFit:'cover'}}/>
                    : <div style={{height:140,background:'linear-gradient(135deg,#1a2234,#2d3748)',display:'flex',alignItems:'center',justifyContent:'center'}}><Scissors size={36} color="#d4af37"/></div>}
                  <div style={{padding:14}}>
                    <div style={{fontWeight:600,fontSize:14,color:'#f0f0f0'}}>{s.name}</div>
                    <div style={{fontSize:12,color:'#8b92a9',marginTop:3,display:'flex',alignItems:'center',gap:4}}><MapPin size={11}/>{s.barbershop_name}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
                      <span style={{color:'#d4af37',fontWeight:700,fontSize:15}}>₱{parseFloat(s.price).toFixed(0)}</span>
                      <span style={{fontSize:11,color:'#8b92a9'}}>{s.booking_count} booking{s.booking_count!==1?'s':''}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {promos.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2><Gift size={18} style={{display:'inline',verticalAlign:'-3px',marginRight:6,color:'#d4af37'}}/>Promos at Local Shops</h2>
              <span style={{fontSize:12,color:'#8b92a9'}}>Points are earned and redeemed per shop</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:16}}>
              {promos.map(p => (
                <Link key={p.id} to={`/customer/barbershop/${p.barbershop_id}`} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,overflow:'hidden',textDecoration:'none',color:'inherit'}}>
                  {p.image_url ? <img src={p.image_url} alt={p.name} style={{width:'100%',height:130,objectFit:'cover'}}/>
                    : <div style={{height:130,background:'linear-gradient(135deg,#d4af37,#a8841d)',display:'flex',alignItems:'center',justifyContent:'center'}}><Gift size={40} color="#0f1422"/></div>}
                  <div style={{padding:14}}>
                    <div style={{fontWeight:600,color:'#f0f0f0'}}>{p.name}</div>
                    <div style={{fontSize:12,color:'#8b92a9',marginTop:2}}>{p.barbershop_name}</div>
                    {p.description && <div style={{fontSize:12,color:'#cbd5e1',marginTop:6}}>{p.description}</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
                      <span style={{color:'#d4af37',fontWeight:700,fontSize:14,display:'inline-flex',alignItems:'center',gap:4}}><Gift size={12}/>{p.points_cost} pts</span>
                      <span style={{color:'#8b92a9',fontSize:12,display:'inline-flex',alignItems:'center',gap:2}}>View shop <ChevronRight size={12}/></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
