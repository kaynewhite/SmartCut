import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import styles from '../AuthForm.module.css';

export default function CustomerRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
            <label className={styles.label} htmlFor="cust-reg-name">Full Name</label>
            <input id="cust-reg-name" name="name" autoComplete="name" className={styles.input} type="text" placeholder="Juan Dela Cruz" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cust-reg-email">Email</label>
            <input id="cust-reg-email" name="email" autoComplete="email" className={styles.input} type="email" placeholder="you@email.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cust-reg-phone">Phone (optional)</label>
            <input id="cust-reg-phone" name="phone" autoComplete="tel" className={styles.input} type="tel" placeholder="09XX XXX XXXX" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cust-reg-password">Password</label>
            <input id="cust-reg-password" name="password" autoComplete="new-password" className={styles.input} type="password" placeholder="Min 6 characters" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required minLength={6} />
          </div>
          <button className={styles.btn} type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</button>
        </form>
        <div className={styles.switchLink}>
          Already have an account? <Link to="/customer/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
