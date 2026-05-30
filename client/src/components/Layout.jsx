import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Scissors, Bell, LogOut, Menu, X, Home, Calendar, Clock, Star, User, Settings, Users, Briefcase, LayoutDashboard, MessageSquare, ChevronRight, Gift } from 'lucide-react';
import styles from './Layout.module.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [flash, setFlash] = useState(null);
  const prevUnreadRef = useRef(0);
  const prevIdsRef = useRef(new Set());

  const isShop = user?.type === 'barbershop';
  const isBarber = user?.type === 'barber';

  const customerLinks = [
    { to: '/customer/dashboard', icon: <Home size={18} />, label: 'Home' },
    { to: '/customer/explore', icon: <Scissors size={18} />, label: 'Explore' },
    { to: '/customer/appointments', icon: <Calendar size={18} />, label: 'Appointments' },
    { to: '/customer/history', icon: <Clock size={18} />, label: 'History' },
    { to: '/customer/profile', icon: <User size={18} />, label: 'Profile' },
  ];

  const shopLinks = [
    { to: '/barbershop/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/barbershop/appointments', icon: <Calendar size={18} />, label: 'Appointments' },
    { to: '/barbershop/queue', icon: <Clock size={18} />, label: 'Queue' },
    { to: '/barbershop/barbers', icon: <Users size={18} />, label: 'Barbers' },
    { to: '/barbershop/services', icon: <Briefcase size={18} />, label: 'Service Pricing' },
    { to: '/barbershop/promos', icon: <Gift size={18} />, label: 'Loyalty Promos' },
    { to: '/barbershop/reviews', icon: <MessageSquare size={18} />, label: 'Reviews' },
    { to: '/barbershop/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const barberLinks = [
    { to: '/barber/dashboard', icon: <LayoutDashboard size={18} />, label: 'My Dashboard' },
    { to: '/barber/services', icon: <Briefcase size={18} />, label: 'Services & Specialties' },
    { to: '/barber/reviews', icon: <MessageSquare size={18} />, label: 'My Reviews' },
    { to: '/barber/profile', icon: <User size={18} />, label: 'My Profile' },
  ];

  const links = isShop ? shopLinks : isBarber ? barberLinks : customerLinks;

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const notifs = res.data || [];
      const newUnread = notifs.filter(n => !n.is_read).length;
      const newIds = new Set(notifs.filter(n => !n.is_read).map(n => n.id));

      const freshNotifs = notifs.filter(n => !n.is_read && !prevIdsRef.current.has(n.id));
      if (freshNotifs.length > 0 && prevIdsRef.current.size > 0) {
        const latest = freshNotifs[0];
        setFlash(latest);
        setTimeout(() => setFlash(null), 5000);
      }

      prevIdsRef.current = newIds;
      prevUnreadRef.current = newUnread;
      setNotifications(notifs);
      setUnread(newUnread);
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {}
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const NOTIF_COLORS = {
    loyalty: '#d4af37',
    new_booking: '#3b82f6',
    payment_proof: '#8b5cf6',
    payment_verified: '#10b981',
    subscription: '#10b981',
    no_show: '#ef4444',
    report_response: '#f59e0b',
  };

  return (
    <div className={styles.layout}>
      {/* Flash banner for new notifications */}
      {flash && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
          background: NOTIF_COLORS[flash.type] || '#d4af37',
          color: '#fff', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          boxShadow: '0 2px 16px rgba(0,0,0,0.4)', animation: 'slideDown .3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{flash.title}</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{flash.message}</div>
            </div>
          </div>
          <button onClick={() => setFlash(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <Scissors size={22} color="#d4af37" />
            <span>SmartCut</span>
          </div>
          <button className={styles.closeBtn} onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.userInfo}>
          <div className={styles.avatar}>{user?.name?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div className={styles.userName}>{user?.name}</div>
            <div className={styles.userType}>{isShop ? 'Barbershop' : isBarber ? 'Barber' : 'Customer'}</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {links.map(link => {
            const [linkPath, linkQuery] = link.to.split('?');
            const currentFull = location.pathname + location.search;
            const isActive = linkQuery
              ? currentFull === link.to
              : (location.pathname === linkPath && !location.search);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                {link.icon}
                <span>{link.label}</span>
                {isActive && <ChevronRight size={14} className={styles.activeArrow} />}
              </Link>
            );
          })}
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>

      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className={styles.headerLogo}>
            <Scissors size={18} color="#d4af37" />
            <span>SmartCut</span>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.notifWrapper}>
              <button className={styles.notifBtn} onClick={() => setNotifOpen(!notifOpen)}>
                <Bell size={20} />
                {unread > 0 && <span className={styles.badge}>{unread}</span>}
              </button>
              {notifOpen && (
                <div className={styles.notifPanel}>
                  <div className={styles.notifHeader}>
                    <span>Notifications</span>
                    {unread > 0 && <button onClick={markAllRead} className={styles.markAllBtn}>Mark all read</button>}
                  </div>
                  <div className={styles.notifList}>
                    {notifications.length === 0 ? (
                      <div className={styles.noNotif}>No notifications</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`${styles.notifItem} ${!n.is_read ? styles.unread : ''}`} onClick={() => markRead(n.id)}>
                        <div className={styles.notifTitle}>{n.title}</div>
                        <div className={styles.notifMsg}>{n.message}</div>
                        <div className={styles.notifTime}>{new Date(n.created_at).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={styles.content}>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
