import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import styles from '../AuthForm.module.css';

export default function CustomerRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return setError('All fields are required');
    }
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const res = await api.post('/auth/customer/register', form);
      login(res.data.token, res.data.user);
      toast.success('Account created! Welcome to SmartCut!');
      navigate('/customer/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.back} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Back to Home
        </button>
        <div className={styles.logo}><Scissors size={22} /> SmartCut</div>
        <div className={styles.subtitle}>Customer Portal</div>
        <h1 className={styles.title}>Create Account</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="r-name">Full Name</label>
            <input id="r-name" name="name" autoComplete="name" className={styles.input} type="text"
              placeholder="Juan Dela Cruz" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="r-email">Email</label>
            <input id="r-email" name="email" autoComplete="email" className={styles.input} type="email"
              placeholder="you@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="r-phone">Phone (optional)</label>
            <input id="r-phone" name="phone" autoComplete="tel" className={styles.input} type="tel"
              placeholder="09XX XXX XXXX" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="r-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="r-password" name="password" autoComplete="new-password"
                className={styles.input} type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6}
                style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div className={styles.switchLink}>
          Already have an account? <Link to="/customer/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
