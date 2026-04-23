import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import styles from '../AuthForm.module.css';

export default function CustomerLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/customer/login', form);
      login(res.data.token, res.data.user);
      toast.success('Welcome back!');
      navigate('/customer/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
        <h1 className={styles.title}>Welcome Back</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cust-login-email">Email</label>
            <input id="cust-login-email" name="email" autoComplete="email" className={styles.input} type="email" placeholder="you@email.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cust-login-password">Password</label>
            <input id="cust-login-password" name="password" autoComplete="current-password" className={styles.input} type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required />
          </div>
          <button className={styles.btn} type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <div className={styles.switchLink}>
          Don't have an account? <Link to="/customer/register">Register</Link>
        </div>
        <div className={styles.switchLink} style={{marginTop:8}}>
          Are you a barbershop? <Link to="/barbershop/login">Login here</Link>
        </div>
      </div>
    </div>
  );
}
