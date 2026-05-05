import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scissors, ArrowLeft, Mail, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import styles from '../AuthForm.module.css';

const useClerkSignUp = () => {
  try {
    const { useSignUp } = require('@clerk/clerk-react');
    return useSignUp();
  } catch {
    return { isLoaded: true, signUp: null };
  }
};

export default function CustomerRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [step, setStep] = useState('form'); // form | verify | done
  const [otp, setOtp] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  let clerkSignUp = null;
  let clerkLoaded = true;
  try {
    const { useSignUp } = require('@clerk/clerk-react');
    const su = useSignUp();
    clerkSignUp = su?.signUp;
    clerkLoaded = su?.isLoaded !== false;
  } catch {}

  const clerkEnabled = !!clerkSignUp && !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return setError('All fields are required');
    }
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);

    try {
      if (clerkEnabled) {
        // Step 1: start Clerk sign-up to send email verification code
        await clerkSignUp.create({
          emailAddress: form.email.toLowerCase(),
          password: form.password,
        });
        await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStep('verify');
        toast.success('Verification code sent to your email!');
      } else {
        // No Clerk — register directly
        const res = await api.post('/auth/customer/register', form);
        login(res.data.token, res.data.user);
        toast.success('Account created! Welcome to SmartCut!');
        navigate('/customer/dashboard');
      }
    } catch (err) {
      const msg = err?.errors?.[0]?.message || err.response?.data?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return setError('Enter the 6-digit code sent to your email');
    setLoading(true);
    setError('');
    try {
      // Verify OTP with Clerk
      const result = await clerkSignUp.attemptEmailAddressVerification({ code: otp });
      if (result.status !== 'complete') {
        setError('Verification failed. Please try again.');
        setLoading(false);
        return;
      }
      // Email verified — register in our own backend
      const res = await api.post('/auth/customer/register', form);
      login(res.data.token, res.data.user);
      toast.success('Email verified! Welcome to SmartCut!');
      navigate('/customer/dashboard');
    } catch (err) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message
        || err.response?.data?.message || 'Verification failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      toast.success('Code resent!');
    } catch {
      toast.error('Could not resend code');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.back} onClick={() => step === 'verify' ? setStep('form') : navigate('/')}>
          <ArrowLeft size={14} /> {step === 'verify' ? 'Back' : 'Back to Home'}
        </button>
        <div className={styles.logo}><Scissors size={22} /> SmartCut</div>
        <div className={styles.subtitle}>Customer Portal</div>

        {step === 'form' && (
          <>
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
              {clerkEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981', marginTop: -4, marginBottom: 4 }}>
                  <CheckCircle size={13} /> Email verification enabled
                </div>
              )}
              <button className={styles.btn} type="submit" disabled={loading || !clerkLoaded}>
                {loading ? 'Please wait...' : clerkEnabled ? 'Send Verification Code' : 'Create Account'}
              </button>
            </form>
            <div className={styles.switchLink}>
              Already have an account? <Link to="/customer/login">Login</Link>
            </div>
          </>
        )}

        {step === 'verify' && (
          <>
            <h1 className={styles.title}>Verify Your Email</h1>
            <div style={{ textAlign: 'center', margin: '16px 0 20px' }}>
              <Mail size={40} color="#d4af37" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: '#8b92a9', fontSize: 14, lineHeight: 1.5 }}>
                We sent a 6-digit code to<br />
                <strong style={{ color: '#f0f0f0' }}>{form.email}</strong>
              </p>
            </div>
            <form className={styles.form} onSubmit={handleVerify}>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.field}>
                <label className={styles.label}>Verification Code</label>
                <input
                  className={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
                />
              </div>
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
              <button type="button" onClick={resendCode}
                style={{ background: 'none', border: 'none', color: '#d4af37', fontSize: 13, cursor: 'pointer', marginTop: 8, width: '100%' }}>
                Didn't get the code? Resend
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
