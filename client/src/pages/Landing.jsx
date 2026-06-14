import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Scissors, Star, Calendar, Users, MapPin, ArrowRight, Shield, Zap, TrendingUp, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import styles from './Landing.module.css';

/* ─── Barbershop silhouette SVG icons ─── */
const ScissorsIcon = ({ size = 60 }) => (
  <svg width={size} height={size * 100 / 60} viewBox="0 0 60 100" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="16" cy="81" r="13" strokeWidth="2.5" /><circle cx="16" cy="81" r="6" strokeWidth="1.5" />
    <circle cx="44" cy="81" r="13" strokeWidth="2.5" /><circle cx="44" cy="81" r="6" strokeWidth="1.5" />
    <line x1="16" y1="68" x2="30" y2="42" strokeWidth="2.5" /><line x1="44" y1="68" x2="30" y2="42" strokeWidth="2.5" />
    <path d="M30 42 L11 5" strokeWidth="2" /><path d="M30 42 L49 5" strokeWidth="2" />
    <circle cx="30" cy="42" r="3.5" fill="currentColor" stroke="none" />
  </svg>
);
const CombIcon = ({ size = 88 }) => (
  <svg width={size} height={size * 36 / 88} viewBox="0 0 88 36" fill="none" stroke="currentColor" strokeLinecap="round">
    <rect x="2" y="2" width="84" height="18" rx="4" strokeWidth="2.5" />
    {[8, 18, 28, 38, 48, 58, 68, 78].map(x => <rect key={x} x={x} y="19" width="5" height="14" rx="2.5" fill="currentColor" stroke="none" />)}
  </svg>
);
const RazorIcon = ({ size = 100 }) => (
  <svg width={size} height={size * 32 / 100} viewBox="0 0 100 32" fill="none" stroke="currentColor" strokeLinejoin="round">
    <path d="M10 16 L23 2 Q27 0 31 0 L69 0 Q73 0 77 2 L90 16 L77 30 Q73 32 69 32 L31 32 Q27 32 23 30 Z" strokeWidth="2.5" />
    <ellipse cx="50" cy="16" rx="22" ry="9" strokeWidth="1.5" />
  </svg>
);
const BarberPoleIcon = ({ size = 80 }) => (
  <svg width={size * 26 / 80} height={size} viewBox="0 0 26 80" fill="none" stroke="currentColor" strokeLinecap="round">
    <rect x="3" y="8" width="20" height="64" rx="10" strokeWidth="2" />
    <ellipse cx="13" cy="8" rx="11" ry="4" strokeWidth="2" />
    <ellipse cx="13" cy="72" rx="11" ry="4" strokeWidth="2" />
    <path d="M4 26 Q13 22 22 18" strokeWidth="1.8" /><path d="M4 44 Q13 40 22 36" strokeWidth="1.8" /><path d="M4 62 Q13 58 22 54" strokeWidth="1.8" />
  </svg>
);

const BG_ICONS = [
  { Icon: ScissorsIcon,   size: 105, left: '2%',   top: '10%', rotate: -32, anim: 'floatA', delay: '0s'   },
  { Icon: CombIcon,       size: 90,  right: '3%',  top: '7%',  rotate:  18, anim: 'floatB', delay: '1.5s' },
  { Icon: RazorIcon,      size: 84,  left: '4%',   top: '37%', rotate:  48, anim: 'floatC', delay: '3s'   },
  { Icon: BarberPoleIcon, size: 80,  right: '4%',  top: '27%', rotate:  -9, anim: 'floatA', delay: '2s'   },
  { Icon: ScissorsIcon,   size: 52,  left: '47%',  top: '3%',  rotate:  65, anim: 'floatB', delay: '0.8s' },
  { Icon: CombIcon,       size: 65,  right: '7%',  top: '54%', rotate: -44, anim: 'floatC', delay: '4s'   },
  { Icon: RazorIcon,      size: 60,  left: '3%',   top: '61%', rotate: -24, anim: 'floatA', delay: '1s'   },
  { Icon: ScissorsIcon,   size: 78,  right: '2%',  top: '71%', rotate:  20, anim: 'floatB', delay: '5s'   },
  { Icon: BarberPoleIcon, size: 68,  left: '44%',  top: '77%', rotate:  13, anim: 'floatC', delay: '2.5s' },
  { Icon: CombIcon,       size: 95,  left: '2%',   top: '84%', rotate:  30, anim: 'floatA', delay: '3.5s' },
];

function StarRating({ rating, size = 13 }) {
  const val = parseFloat(rating) || 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size} fill={n <= Math.round(val) ? '#d4af37' : 'none'} color="#d4af37" />
      ))}
    </span>
  );
}

export default function Landing() {
  const [topServices, setTopServices] = useState([]);
  const [topShops, setTopShops] = useState([]);

  useEffect(() => {
    api.get('/appointments/top-services?limit=6').then(r => setTopServices(r.data || [])).catch(() => {});
    api.get('/barbershops').then(r => setTopShops((r.data || []).slice(0, 6))).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>

      {/* ─── Background silhouettes ─── */}
      <div className={styles.bgLayer} aria-hidden="true">
        {BG_ICONS.map((item, i) => (
          <div key={i} className={styles[item.anim]} style={{ position: 'absolute', left: item.left, right: item.right, top: item.top, animationDelay: item.delay }}>
            <div style={{ transform: `rotate(${item.rotate}deg)`, color: '#d4af37', opacity: 0.055 }}>
              <item.Icon size={item.size} />
            </div>
          </div>
        ))}
      </div>

      {/* ─── Navbar ─── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <Scissors size={24} color="#d4af37" />
          <span>SmartCut</span>
        </div>
        <div className={styles.navLinks}>
          <Link to="/customer/login" className={styles.navBtn}>Customer Login</Link>
          <Link to="/barbershop/login" className={styles.navBtnOutline}>Barbershop Login</Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <Scissors size={14} />
            <span>The Smart Way to Get a Cut</span>
          </div>
          <h1 className={styles.heroTitle}>
            Find the Perfect<br />
            <span className={styles.gold}>Barber for You</span>
          </h1>
          <p className={styles.heroDesc}>
            Book appointments, skip the wait, and discover the best barbershops near you.
            SmartCut connects customers with top-rated barbers.
          </p>
          <div className={styles.heroBtns}>
            <Link to="/customer/register" className={styles.btnPrimary}>
              Get Started <ArrowRight size={16} />
            </Link>
            <Link to="/barbershop/register" className={styles.btnSecondary}>
              Register Your Shop
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroCard}>
            <div className={styles.cardHeader}>
              <Scissors size={20} color="#d4af37" />
              <span>SmartCut</span>
            </div>
            {/* Stats strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {[
                { label: 'Active Shops', value: topShops.length > 0 ? `${topShops.length}+` : '—' },
                { label: 'Easy Booking', value: '4 Steps' },
                { label: 'Live Queue', value: 'Real-time' },
                { label: 'Loyalty Points', value: 'Rewards' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 16 }}>{s.value}</div>
                  <div style={{ color: '#8b92a9', fontSize: 11, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <Link to="/customer/register" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: '12px', background: '#d4af37', color: '#0a0e1a', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Create Free Account <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Top Barbershops ─── */}
      {topShops.length > 0 && (
        <section style={{ padding: '80px 60px', background: 'rgba(212,175,55,0.03)', borderTop: '1px solid rgba(212,175,55,0.08)', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className={styles.sectionLabel}><Star size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Featured</div>
                <h2 style={{ fontSize: 36, fontWeight: 700, color: '#f0f0f0', margin: 0, lineHeight: 1.15 }}>Top Barbershops</h2>
              </div>
              <Link to="/customer/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#d4af37', fontSize: 14, fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid rgba(212,175,55,0.4)', paddingBottom: 2 }}>
                Browse All <ChevronRight size={14} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {topShops.map(shop => (
                <Link key={shop.id} to={`/shop/${shop.id}`} style={{ textDecoration: 'none', display: 'block', background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.35)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  {/* Cover / banner */}
                  <div style={{ height: 120, background: 'linear-gradient(135deg, #1a2234 0%, #0f1827 100%)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {shop.cover_url
                      ? <img src={shop.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      : <Scissors size={36} color="rgba(212,175,55,0.2)" />}
                    {/* Logo bubble */}
                    <div style={{ position: 'absolute', bottom: -22, left: 20, width: 50, height: 50, borderRadius: '50%', border: '3px solid #111827', background: shop.logo_url ? '#fff' : 'rgba(212,175,55,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#d4af37' }}>
                      {shop.logo_url ? <img src={shop.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : shop.name?.charAt(0)}
                    </div>
                  </div>
                  <div style={{ padding: '28px 20px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#f0f0f0', marginBottom: 4 }}>{shop.name}</div>
                    {shop.city && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8b92a9', fontSize: 12, marginBottom: 10 }}>
                        <MapPin size={11} />{shop.city}{shop.address ? `, ${shop.address}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StarRating rating={shop.avg_rating} />
                        <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 13 }}>{parseFloat(shop.avg_rating || 0).toFixed(1)}</span>
                        {parseInt(shop.review_count) > 0 && <span style={{ color: '#6b7280', fontSize: 11 }}>({shop.review_count})</span>}
                      </div>
                      {shop.min_price && (
                        <span style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>from ₱{parseFloat(shop.min_price).toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Top Services ─── */}
      {topServices.length > 0 && (
        <section style={{ padding: '80px 60px', background: '#0f1422', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div style={{ marginBottom: 40 }}>
              <div className={styles.sectionLabel}><TrendingUp size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Most Booked</div>
              <h2 style={{ fontSize: 36, fontWeight: 700, color: '#f0f0f0', margin: 0, lineHeight: 1.15 }}>Popular Services</h2>
              <p style={{ color: '#8b92a9', marginTop: 10, fontSize: 15 }}>Based on real booking counts across our barbershops</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
              {topServices.map(s => (
                <Link to="/customer/login" key={s.id} style={{ textDecoration: 'none', background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden', display: 'block', transition: 'transform 0.2s, border-color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}>
                  {s.image_url
                    ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 130, objectFit: 'cover' }} />
                    : <div style={{ height: 130, background: 'linear-gradient(135deg,#1a2234,#0f1827)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Scissors size={36} color="rgba(212,175,55,0.25)" /></div>}
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, color: '#f0f0f0', fontSize: 14, marginBottom: 3 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{s.barbershop_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 15 }}>₱{parseFloat(s.price).toFixed(0)}</span>
                      <span style={{ fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6 }}>{s.booking_count} bookings</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Features ─── */}
      <section className={styles.features}>
        <div className={styles.sectionLabel}>Why SmartCut?</div>
        <h2 className={styles.sectionTitle}>Everything You Need<br />in One Platform</h2>
        <div className={styles.featureGrid}>
          {[
            { icon: <Calendar size={28} />, title: 'Easy Booking', desc: 'Book appointments with your preferred barber in seconds. Real-time availability shown.' },
            { icon: <Shield size={28} />, title: 'GCash, Maya & More', desc: 'Pay via GCash, Maya, BDO, BPI, and other Philippine payment methods. Scan QR and upload proof.' },
            { icon: <Users size={28} />, title: 'Queue Management', desc: 'See real-time queue status. Walk in and track your position from your phone.' },
            { icon: <MapPin size={28} />, title: 'Nearby Shops', desc: 'Discover barbershops in your area with full profiles, services, and reviews.' },
            { icon: <Star size={28} />, title: 'Ratings & Reviews', desc: 'Read honest reviews and rate your experience. Earn loyalty points on every visit.' },
            { icon: <Zap size={28} />, title: 'Instant Notifications', desc: 'Get alerts for booking confirmations, reminders, and queue updates.' },
          ].map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Shop Section ─── */}
      <section className={styles.shopSection}>
        <div className={styles.shopContent}>
          <div className={styles.sectionLabel}>For Barbershops</div>
          <h2 className={styles.sectionTitle}>Grow Your Business<br />with SmartCut</h2>
          <ul className={styles.shopList}>
            {[
              'Manage appointments and walk-ins in one place',
              'Real-time queue system for your customers',
              'Analytics dashboard with peak hours and revenue',
              'Set up GCash, Maya, BDO, BPI and other payment QRs',
              'Manage your barbers, services, and schedules',
              'Build your reputation with customer reviews',
            ].map((item, i) => (
              <li key={i}><span className={styles.checkmark}>✓</span>{item}</li>
            ))}
          </ul>
          <Link to="/barbershop/register" className={styles.btnPrimary}>
            Register Your Shop <ArrowRight size={16} />
          </Link>
        </div>
        <div className={styles.shopVisual}>
          <div className={styles.dashPreview}>
            <div className={styles.dashHeader}>Dashboard Overview</div>
            <p style={{ textAlign: 'center', color: '#8b92a9', padding: 24, fontSize: 14 }}>
              Register your barbershop to access real-time analytics, booking management, and queue tracking.
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className={styles.cta}>
        <Scissors size={48} color="#d4af37" />
        <h2>Ready to Experience SmartCut?</h2>
        <p>Join customers and barbershops already using SmartCut</p>
        <div className={styles.ctaBtns}>
          <Link to="/customer/register" className={styles.btnPrimary}>Start as Customer</Link>
          <Link to="/barbershop/register" className={styles.btnSecondary}>Register Shop</Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}><Scissors size={18} color="#d4af37" /><span>SmartCut</span></div>
        <p>A Web-Based Service-Oriented Barbershop Operations & Customer Engagement Management System</p>
        <p style={{ marginTop: 8, color: '#4b5563', fontSize: 12 }}>© 2026 SmartCut. Laguna State Polytechnic University.</p>
      </footer>
    </div>
  );
}
