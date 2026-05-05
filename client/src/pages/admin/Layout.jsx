import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Store, FileText, Settings, LogOut, Menu, X, Shield, UserCog } from 'lucide-react';

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/barbershops', icon: Store, label: 'Barbershops' },
  { to: '/admin/reports', icon: FileText, label: 'Reports' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/admin-login'); };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080e1a', fontFamily: 'Inter, sans-serif' }}>
      {/* Desktop sidebar */}
      <aside className="admin-sidebar" style={{
        width: 240, background: '#0f1827', borderRight: '1px solid #1e2a3a',
        display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100, overflowY: 'auto'
      }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #1e2a3a', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#d4af37" />
            <div>
              <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 16 }}>SmartCut</div>
              <div style={{ color: '#8b92a9', fontSize: 11 }}>Admin Portal</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(n => (
            <Link key={n.to} to={n.to} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, marginBottom: 4, textDecoration: 'none',
              color: isActive(n.to) ? '#d4af37' : '#8b92a9',
              background: isActive(n.to) ? 'rgba(212,175,55,0.1)' : 'transparent',
              fontWeight: isActive(n.to) ? 600 : 400, transition: 'all .15s', fontSize: 14
            }}>
              <n.icon size={17} />
              {n.label}
            </Link>
          ))}
          <Link to="/admin/profile" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 8, marginBottom: 4, textDecoration: 'none',
            color: isActive('/admin/profile') ? '#d4af37' : '#8b92a9',
            background: isActive('/admin/profile') ? 'rgba(212,175,55,0.1)' : 'transparent',
            fontWeight: isActive('/admin/profile') ? 600 : 400, transition: 'all .15s', fontSize: 14
          }}>
            <UserCog size={17} />
            My Profile
          </Link>
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid #1e2a3a', flexShrink: 0 }}>
          <div style={{ padding: '8px 12px', marginBottom: 4 }}>
            <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ color: '#8b92a9', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '10px 12px', background: 'transparent', border: 'none',
            color: '#ef4444', cursor: 'pointer', borderRadius: 8, fontSize: 14
          }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="admin-topbar" style={{
        display: 'none', position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: '#0f1827', borderBottom: '1px solid #1e2a3a',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 200
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={20} color="#d4af37" />
          <span style={{ color: '#d4af37', fontWeight: 700 }}>SmartCut Admin</span>
        </div>
        <button onClick={() => setMenuOpen(m => !m)} style={{ background: 'none', border: 'none', color: '#f0f0f0', cursor: 'pointer', padding: 4 }}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, background: '#0f1827',
          zIndex: 199, padding: '8px', borderBottom: '1px solid #1e2a3a',
          maxHeight: 'calc(100vh - 56px)', overflowY: 'auto'
        }}>
          {[...NAV, { to: '/admin/profile', icon: UserCog, label: 'My Profile' }].map(n => (
            <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px',
              borderRadius: 8, marginBottom: 2, textDecoration: 'none',
              color: isActive(n.to) ? '#d4af37' : '#8b92a9',
              background: isActive(n.to) ? 'rgba(212,175,55,0.1)' : 'transparent',
              fontSize: 15
            }}>
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '13px 14px', background: 'transparent', border: 'none',
            color: '#ef4444', cursor: 'pointer', borderRadius: 8, fontSize: 15
          }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}

      <main className="admin-main" style={{ marginLeft: 240, flex: 1, minHeight: '100vh', padding: '28px 24px', overflowX: 'hidden' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-topbar { display: flex !important; }
          .admin-main { margin-left: 0 !important; padding: 68px 14px 24px !important; }
        }
        @media (max-width: 480px) {
          .admin-main { padding: 68px 10px 20px !important; }
        }
      `}</style>
    </div>
  );
}
