import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import { Star, MapPin, Clock, Phone, Scissors, Users, ChevronRight } from 'lucide-react';
import styles from './BarbershopView.module.css';

export default function CustomerBarbershop() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('services');

  useEffect(() => {
    api.get(`/barbershops/${id}`).then(res => { setData(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading...</div></Layout>;
  if (!data) return <Layout><div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Barbershop not found.</div></Layout>;

  const { shop, barbers, services, reviews } = data;
  const categories = [...new Set(services.map(s => s.category))];

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.cover} style={shop.cover_url ? { backgroundImage: `url(${shop.cover_url})` } : {}}>
          <div className={styles.coverOverlay}>
            <div className={styles.shopHeader}>
              <div className={styles.shopLogo}>
                {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} /> : <Scissors size={28} color="#d4af37" />}
              </div>
              <div>
                <h1 className={styles.shopName}>{shop.name}</h1>
                <div className={styles.shopMeta}>
                  {shop.city && <span><MapPin size={13} /> {shop.city}</span>}
                  <span><Star size={13} fill="#f59e0b" color="#f59e0b" /> {parseFloat(shop.avg_rating).toFixed(1)} ({shop.review_count} reviews)</span>
                  {shop.opening_time && <span><Clock size={13} /> {shop.opening_time?.substring(0,5)} - {shop.closing_time?.substring(0,5)}</span>}
                </div>
              </div>
              <Link to={`/customer/book/${id}`} className={styles.bookBtn}>Book Now <ChevronRight size={16} /></Link>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {shop.description && <p className={styles.desc}>{shop.description}</p>}

          <div className={styles.tabs}>
            {['services','barbers','reviews','location'].map(t => (
              <button key={t} className={`${styles.tab} ${tab === t ? styles.active : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'services' && (
            <div>
              {categories.map(cat => (
                <div key={cat} className={styles.catGroup}>
                  <div className={styles.catTitle}>{cat}</div>
                  <div className={styles.serviceList}>
                    {services.filter(s => s.category === cat).map(s => (
                      <div key={s.id} className={styles.serviceCard}>
                        <div className={styles.svcImg}>
                          {s.image_url ? <img src={s.image_url} alt={s.name} /> : <Scissors size={20} color="#4b5563" />}
                        </div>
                        <div className={styles.svcInfo}>
                          <div className={styles.svcName}>{s.name}</div>
                          {s.description && <div className={styles.svcDesc}>{s.description}</div>}
                          <div className={styles.svcMeta}>
                            <span className={styles.svcPrice}>₱{parseFloat(s.price).toFixed(0)}</span>
                            <span className={styles.svcDuration}>{s.duration_minutes} min</span>
                            {s.is_home_service && <span className="badge badge-info">Home Service</span>}
                          </div>
                        </div>
                        <Link to={`/customer/book/${id}?service=${s.id}`} className={styles.bookSvcBtn}>Book</Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'barbers' && (
            <div className={styles.barberGrid}>
              {barbers.map(b => (
                <div key={b.id} className={styles.barberCard}>
                  <div className={styles.barberPhoto}>
                    {b.photo_url ? <img src={b.photo_url} alt={b.name} /> : b.name.charAt(0)}
                  </div>
                  <div className={styles.barberName}>{b.name}</div>
                  <div className={styles.barberRating}><Star size={12} fill="#f59e0b" color="#f59e0b" /> {parseFloat(b.avg_rating).toFixed(1)}</div>
                  {b.specialties?.filter(Boolean).length > 0 && (
                    <div className={styles.specialties}>
                      {b.specialties.filter(Boolean).map((sp, i) => <span key={i} className="badge badge-gold">{sp}</span>)}
                    </div>
                  )}
                  {b.bio && <div className={styles.bio}>{b.bio}</div>}
                  <span className={`badge ${b.is_available ? 'badge-success' : 'badge-error'}`}>{b.is_available ? 'Available' : 'Busy'}</span>
                </div>
              ))}
              {barbers.length === 0 && <div style={{color:'var(--text-muted)',padding:'20px'}}>No barbers listed yet.</div>}
            </div>
          )}

          {tab === 'reviews' && (
            <div className={styles.reviews}>
              {reviews.map(r => (
                <div key={r.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewAvatar}>{r.customer_name?.charAt(0)}</div>
                    <div>
                      <div className={styles.reviewName}>{r.customer_name}</div>
                      <div className={styles.stars}>{'★'.repeat(r.barbershop_rating)}{'☆'.repeat(5 - r.barbershop_rating)}</div>
                    </div>
                    <div className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  {r.comment && <div className={styles.reviewComment}>{r.comment}</div>}
                  {r.barber_name && <div className={styles.reviewBarber}>Barber: {r.barber_name} {'★'.repeat(r.barber_rating || 0)}</div>}
                </div>
              ))}
              {reviews.length === 0 && <div style={{color:'var(--text-muted)',padding:'20px',textAlign:'center'}}>No reviews yet. Be the first!</div>}
            </div>
          )}

          {tab === 'location' && (
            <div className={styles.locationTab}>
              {shop.latitude && shop.longitude ? (
                <Map
                  center={[shop.latitude, shop.longitude]}
                  zoom={16}
                  markers={[{
                    id: shop.id,
                    name: shop.name,
                    address: shop.address,
                    city: shop.city,
                    latitude: shop.latitude,
                    longitude: shop.longitude
                  }]}
                  height="400px"
                  interactive={false}
                />
              ) : (
                <div style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>
                  <MapPin size={40} />
                  <p>Location not set by the barbershop yet.</p>
                </div>
              )}
              <div className={styles.locationInfo}>
                <h3>Location Details</h3>
                {shop.address && <p><strong>Address:</strong> {shop.address}</p>}
                {shop.city && <p><strong>City:</strong> {shop.city}</p>}
                {shop.phone && <p><strong>Phone:</strong> {shop.phone}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
