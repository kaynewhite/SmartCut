import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import styles from '../AuthForm.module.css';

export default function BarbershopRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '', city: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/barbershop/register', form);
      login(res.data.token, res.data.user);
      toast.success('Barbershop registered! Welcome to SmartCut!');
      navigate('/barbershop/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => e => setForm(p => ({...p, [field]: e.target.value}));

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.back} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Back to Home
        </button>
        <div className={styles.logo}><Scissors size={22} /> SmartCut</div>
        <div className={styles.subtitle}>Barbershop Portal</div>
        <h1 className={styles.title}>Register Your Shop</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label className={styles.label}>Barbershop Name</label>
            <input className={styles.input} type="text" placeholder="Juan's Barber Shop" value={form.name} onChange={set('name')} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="shop@email.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Phone</label>
            <input className={styles.input} type="tel" placeholder="09XX XXX XXXX" value={form.phone} onChange={set('phone')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>City</label>
            <input className={styles.input} type="text" placeholder="e.g. Siniloan, Laguna" value={form.city} onChange={set('city')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Address</label>
            <input className={styles.input} type="text" placeholder="Street, Barangay" value={form.address} onChange={set('address')} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Description (optional)</label>
            <textarea className={styles.textarea} placeholder="Tell customers about your shop..." value={form.description} onChange={set('description')} rows={3} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} />
          </div>
          <button className={styles.btn} type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register Shop'}</button>
        </form>
        <div className={styles.switchLink}>
          Already registered? <Link to="/barbershop/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
