import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Calendar, Clock, Star, Search, ArrowRight, Scissors, MapPin, Gift } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [recentShops, setRecentShops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [apptRes, shopsRes] = await Promise.all([
          api.get('/appointments/my'),
          api.get('/barbershops')
        ]);
        setAppointments(apptRes.data.slice(0, 3));
        setRecentShops(shopsRes.data.slice(0, 6));
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

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
            <Gift size={20} color="#d4af37" />
            <div>
              <div className={styles.statNum}>{user?.loyalty_points || 0}</div>
              <div className={styles.statLabel}>Loyalty Points</div>
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
            <h2>Available Barbershops</h2>
            <Link to="/customer/explore" className={styles.viewAll}>See All <ArrowRight size={14} /></Link>
          </div>
          {recentShops.length === 0 && !loading ? (
            <div className={styles.empty}><p>No barbershops available yet.</p></div>
          ) : (
            <div className={styles.shopGrid}>
              {recentShops.map(shop => (
                <Link key={shop.id} to={`/customer/barbershop/${shop.id}`} className={styles.shopCard}>
                  <div className={styles.shopCover}>
                    {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} /> : <Scissors size={32} color="#4b5563" />}
                  </div>
                  <div className={styles.shopInfo}>
                    <div className={styles.shopName}>{shop.name}</div>
                    <div className={styles.shopLocation}><MapPin size={12} /> {shop.city || shop.address || 'Location N/A'}</div>
                    <div className={styles.shopRating}>
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <span>{parseFloat(shop.avg_rating || 0).toFixed(1)}</span>
                      <span className={styles.reviewCount}>({shop.review_count || 0} reviews)</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
