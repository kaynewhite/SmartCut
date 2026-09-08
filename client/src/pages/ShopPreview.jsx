import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { Scissors, Star, MapPin, Clock, Phone, ChevronRight, Users, ArrowLeft, User } from 'lucide-react';
import styles from './ShopPreview.module.css';

function StarRow({ value, size = 14 }) {
  const n = parseFloat(value) || 0;
  return (
    <span className={styles.stars}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} fill={i <= Math.round(n) ? '#d4af37' : 'none'} color="#d4af37" />
      ))}
    </span>
  );
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

const CATS = ['Haircut', 'Beard', 'Color', 'Treatment', 'Package', 'Other'];

export default function ShopPreview() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('services');
  const [catFilter, setCatFilter] = useState('All');

  useEffect(() => {
    api.get(`/barbershops/${id}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className={styles.splash}>
      <Scissors size={36} color="#d4af37" />
      <p>Loading…</p>
    </div>
  );
  if (!data) return (
    <div className={styles.splash}>
      <p style={{ color: '#8b92a9' }}>Shop not found.</p>
      <Link to="/" className={styles.backLink}><ArrowLeft size={15} /> Back to Home</Link>
    </div>
  );

  const { shop, barbers = [], services = [], reviews = [] } = data;
  const usedCats = ['All', ...new Set(services.map(s => s.category).filter(Boolean))];
  const filteredServices = catFilter === 'All' ? services : services.filter(s => s.category === catFilter);

  return (
    <div className={styles.page}>

      {/* ── Sticky top bar ── */}
      <nav className={styles.topbar}>
        <Link to="/" className={styles.backLink}><ArrowLeft size={16} /> Home</Link>
        <div className={styles.topbarLogo}><Scissors size={18} color="#d4af37" /> SmartCut</div>
        <div className={styles.topbarActions}>
          <Link to="/customer/login" className={styles.loginBtn}>Log in to Book</Link>
        </div>
      </nav>

      {/* ── Cover hero ── */}
      <div className={styles.cover} style={shop.cover_url ? { backgroundImage: `url(${shop.cover_url})` } : {}}>
        <div className={styles.coverOverlay}>
          <div className={styles.heroContent}>
            <div className={styles.logoWrap}>
              {shop.logo_url
                ? <img src={shop.logo_url} alt={shop.name} className={styles.logo} />
                : <div className={styles.logoFallback}>{shop.name?.charAt(0)}</div>}
            </div>
            <div className={styles.heroText}>
              <h1 className={styles.shopName}>{shop.name}</h1>
              <div className={styles.metaRow}>
                {shop.city && <span className={styles.metaItem}><MapPin size={13} />{shop.city}{shop.address ? `, ${shop.address}` : ''}</span>}
                <span className={styles.metaItem}><Star size={13} fill="#f59e0b" color="#f59e0b" /> {parseFloat(shop.avg_rating || 0).toFixed(1)} <span style={{ opacity: 0.6 }}>({shop.review_count} reviews)</span></span>
                {shop.opening_time && <span className={styles.metaItem}><Clock size={13} />{shop.opening_time?.slice(0,5)} – {shop.closing_time?.slice(0,5)}</span>}
                {shop.phone && <span className={styles.metaItem}><Phone size={13} />{shop.phone}</span>}
              </div>
            </div>
            <Link to="/customer/register" className={styles.bookBtn}>Book Now <ChevronRight size={16} /></Link>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Description pill */}
        {shop.description && (
          <div className={styles.descCard}>{shop.description}</div>
        )}

        {/* Tabs */}
        <div className={styles.tabs}>
          {['services', 'barbers', 'reviews'].map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
              {t === 'services' ? `Services (${services.length})` : t === 'barbers' ? `Barbers (${barbers.length})` : `Reviews (${reviews.length})`}
            </button>
          ))}
        </div>

        {/* ─ Services ─ */}
        {tab === 'services' && (
          <div>
            {usedCats.length > 2 && (
              <div className={styles.catRow}>
                {usedCats.map(c => (
                  <button key={c} className={`${styles.catBtn} ${catFilter === c ? styles.catActive : ''}`} onClick={() => setCatFilter(c)}>{c}</button>
                ))}
              </div>
            )}
            {filteredServices.length === 0 ? (
              <div className={styles.empty}><Scissors size={32} color="#2d3748" /><p>No services listed yet.</p></div>
            ) : (
              <div className={styles.serviceGrid}>
                {filteredServices.map(s => (
                  <div key={s.id} className={styles.serviceCard}>
                    {s.image_url
                      ? <img src={s.image_url} alt={s.name} className={styles.serviceImg} />
                      : <div className={styles.serviceImgFallback}><Scissors size={24} color="rgba(212,175,55,0.3)" /></div>}
                    <div className={styles.serviceBody}>
                      <div className={styles.serviceName}>{s.name}</div>
                      {s.category && <div className={styles.serviceCategory}>{s.category}</div>}
                      {s.description && <div className={styles.serviceDesc}>{s.description}</div>}
                      <div className={styles.serviceFooter}>
                        <span className={styles.servicePrice}>₱{parseFloat(s.price).toFixed(0)}</span>
                        {s.duration_minutes && <span className={styles.serviceDur}>{s.duration_minutes} min</span>}
                        {s.barber_name && <span className={styles.serviceBarber}>by {s.barber_name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─ Barbers ─ */}
        {tab === 'barbers' && (
          barbers.length === 0
            ? <div className={styles.empty}><Users size={32} color="#2d3748" /><p>No barbers listed.</p></div>
            : (
              <div className={styles.barberGrid}>
                {barbers.map(b => (
                  <div key={b.id} className={styles.barberCard}>
                    <div className={styles.barberPhotoWrap}>
                      {b.photo_url
                        ? <img src={b.photo_url} alt={b.name} className={styles.barberPhoto} />
                        : <div className={styles.barberPhotoFallback}><User size={28} color="#4b5563" /></div>}
                      <span className={`${styles.avail} ${b.is_available ? styles.availOn : styles.availOff}`}>
                        {b.is_available ? 'Available' : 'Busy'}
                      </span>
                    </div>
                    <div className={styles.barberInfo}>
                      <div className={styles.barberName}>{b.name}</div>
                      <div className={styles.barberRating}>
                        <StarRow value={b.avg_rating} size={12} />
                        <span>{parseFloat(b.avg_rating || 0).toFixed(1)}</span>
                        {parseInt(b.total_cuts) > 0 && <span className={styles.barberCuts}>{b.total_cuts} cuts</span>}
                      </div>
                      {b.bio && <p className={styles.barberBio}>{b.bio}</p>}
                      {Array.isArray(b.specialties) && b.specialties.filter(Boolean).length > 0 && (
                        <div className={styles.specialtyRow}>
                          {b.specialties.filter(Boolean).map((s, i) => <span key={i} className={styles.specialtyTag}>{s}</span>)}
                        </div>
                      )}
                      {Array.isArray(b.services) && b.services.filter(Boolean).length > 0 && (
                        <div className={styles.barberServices}>
                          {b.services.filter(Boolean).slice(0, 3).map((s, i) => (
                            <span key={i} className={styles.barberServiceTag}>{s.name} · ₱{parseFloat(s.price).toFixed(0)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
        )}

        {/* ─ Reviews ─ */}
        {tab === 'reviews' && (
          reviews.length === 0
            ? <div className={styles.empty}><Star size={32} color="#2d3748" /><p>No reviews yet.</p></div>
            : (
              <div>
                {/* Summary */}
                <div className={styles.reviewSummary}>
                  <div className={styles.ratingBig}>{parseFloat(shop.avg_rating || 0).toFixed(1)}</div>
                  <div>
                    <StarRow value={shop.avg_rating} size={18} />
                    <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>{shop.review_count} reviews</div>
                  </div>
                </div>
                <div className={styles.reviewList}>
                  {reviews.map(r => (
                    <div key={r.id} className={styles.reviewCard}>
                      <div className={styles.reviewHeader}>
                        <div className={styles.reviewAvatar}>{(r.customer_name || 'A').charAt(0).toUpperCase()}</div>
                        <div>
                          <div className={styles.reviewName}>{r.customer_name || 'Anonymous'}</div>
                          <div className={styles.reviewMeta}>
                            <StarRow value={r.barbershop_rating} size={12} />
                            <span className={styles.reviewTime}>{timeAgo(r.created_at)}</span>
                            {r.barber_name && <span className={styles.reviewBarber}>· {r.barber_name}</span>}
                          </div>
                        </div>
                      </div>
                      {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
        )}

        {/* ── Book CTA ── */}
        <div className={styles.ctaBar}>
          <div>
            <div className={styles.ctaTitle}>Ready to book at {shop.name}?</div>
            <div className={styles.ctaSub}>Create a free account or log in to schedule your appointment.</div>
          </div>
          <div className={styles.ctaBtns}>
            <Link to="/customer/register" className={styles.ctaPrimary}>Create Account <ChevronRight size={15} /></Link>
            <Link to="/customer/login" className={styles.ctaSecondary}>Log In</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
