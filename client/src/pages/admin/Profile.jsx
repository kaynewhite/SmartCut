import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { User, Lock, Eye, EyeOff, Save } from 'lucide-react';

const inp = {
  width: '100%', background: '#0a1020', border: '1px solid #1e2a3a',
  color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 15,
  boxSizing: 'border-box', outline: 'none',
};

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ cur: false, new: false, con: false });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api.get('/admin/me').then(res => {
      setProfile({ name: res.data.name || '', email: res.data.email || '' });
    }).catch(() => {});
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim() || !profile.email.trim()) return toast.error('Name and email are required');
    setSavingProfile(true);
    try {
      const res = await api.put('/admin/me', { name: profile.name, email: profile.email });
      updateUser({ ...user, name: res.data.name, email: res.data.email });
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSavingProfile(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.current_password) return toast.error('Current password required');
    if (pwForm.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('Passwords do not match');
    setSavingPw(true);
    try {
      await api.put('/admin/me/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password updated!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update password'); }
    finally { setSavingPw(false); }
  };

  const PwField = ({ label, fieldKey, showKey }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={showPw[showKey] ? 'text' : 'password'}
          value={pwForm[fieldKey]}
          onChange={e => setPwForm(p => ({ ...p, [fieldKey]: e.target.value }))}
          placeholder="••••••••"
          style={{ ...inp, paddingRight: 44 }}
        />
        <button type="button" onClick={() => setShowPw(p => ({ ...p, [showKey]: !p[showKey] }))}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}>
          {showPw[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: 600 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>My Profile</h1>
        <p style={{ color: '#8b92a9', marginBottom: 24, fontSize: 14 }}>Edit your admin account info and credentials</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #1e2a3a', paddingBottom: 0 }}>
          {[{ id: 'profile', icon: User, label: 'Profile' }, { id: 'password', icon: Lock, label: 'Password' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              background: 'none', border: 'none', color: tab === t.id ? '#d4af37' : '#8b92a9',
              borderBottom: `2px solid ${tab === t.id ? '#d4af37' : 'transparent'}`,
              fontWeight: tab === t.id ? 600 : 400, fontSize: 14, cursor: 'pointer',
              marginBottom: -1, transition: 'all .15s'
            }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 24 }}>
            <form onSubmit={saveProfile}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Full Name</label>
                <input
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  required
                  style={inp}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@example.com"
                  required
                  style={inp}
                />
              </div>
              <button type="submit" disabled={savingProfile} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                background: savingProfile ? '#374151' : '#d4af37', color: savingProfile ? '#8b92a9' : '#0f1422',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: savingProfile ? 'not-allowed' : 'pointer'
              }}>
                <Save size={15} /> {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}

        {tab === 'password' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 24 }}>
            <form onSubmit={savePassword}>
              <PwField label="Current Password" fieldKey="current_password" showKey="cur" />
              <PwField label="New Password (min 6 chars)" fieldKey="new_password" showKey="new" />
              <PwField label="Confirm New Password" fieldKey="confirm_password" showKey="con" />
              <button type="submit" disabled={savingPw} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
                background: savingPw ? '#374151' : '#d4af37', color: savingPw ? '#8b92a9' : '#0f1422',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: savingPw ? 'not-allowed' : 'pointer', marginTop: 8
              }}>
                <Lock size={15} /> {savingPw ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
