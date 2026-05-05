import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', form);
      login(res.data.token, res.data.user);
      toast.success('Welcome, Admin!');
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: 'rgba(212,175,55,0.1)', borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid rgba(212,175,55,0.3)' }}>
            <Shield size={28} color="#d4af37" />
          </div>
          <h1 style={{ color: '#f0f0f0', fontSize: 24, fontWeight: 700, margin: 0 }}>Admin Portal</h1>
          <p style={{ color: '#8b92a9', marginTop: 8, fontSize: 14 }}>SmartCut Administration</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Email Address</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="admin@smartcut.com"
              style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '12px 14px', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '12px 40px 12px 14px', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', background: loading ? '#6b7280' : 'linear-gradient(135deg,#d4af37,#a8841d)', color: loading ? '#f0f0f0' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#4b5563', fontSize: 12, marginTop: 20 }}>
          Not an admin? <a href="/" style={{ color: '#d4af37' }}>Back to SmartCut</a>
        </p>
      </div>
    </div>
  );
}
