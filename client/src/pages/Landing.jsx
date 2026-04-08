import { Link } from 'react-router-dom';
import { Scissors, Star, Calendar, Users, MapPin, ArrowRight, Shield, Zap } from 'lucide-react';
import styles from './Landing.module.css';

export default function Landing() {
  return (
    <div className={styles.page}>
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
            <p style={{ textAlign: 'center', color: '#8b92a9', marginTop: 24 }}>
              Log in to explore available barbershops and book your next appointment
            </p>
          </div>
        </div>
      </section>

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
              <li key={i}>
                <span className={styles.checkmark}>✓</span>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/barbershop/register" className={styles.btnPrimary}>
            Register Your Shop <ArrowRight size={16} />
          </Link>
        </div>
        <div className={styles.shopVisual}>
          <div className={styles.dashPreview}>
            <div className={styles.dashHeader}>Dashboard Overview</div>
            <p style={{ textAlign: 'center', color: '#8b92a9', padding: 24 }}>
              Register your barbershop to access real-time analytics, booking management, and queue tracking
            </p>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <Scissors size={48} color="#d4af37" />
        <h2>Ready to Experience SmartCut?</h2>
        <p>Join thousands of customers and barbershops already using SmartCut</p>
        <div className={styles.ctaBtns}>
          <Link to="/customer/register" className={styles.btnPrimary}>Start as Customer</Link>
          <Link to="/barbershop/register" className={styles.btnSecondary}>Register Shop</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <Scissors size={18} color="#d4af37" />
          <span>SmartCut</span>
        </div>
        <p>A Web-Based Service-Oriented Barbershop Operations & Customer Engagement Management System</p>
        <p style={{ marginTop: 8, color: '#4b5563', fontSize: 12 }}>© 2026 SmartCut. Laguna State Polytechnic University.</p>
      </footer>
    </div>
  );
}
