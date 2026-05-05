import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Save, Upload, User, Lock, Eye, EyeOff } from 'lucide-react';

export default function BarberProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', phone: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('profile');

  const [accountForm, setAccountForm] = useState({ email: '', current_password: '', new_password: '', confirm_password: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/barbers/me/profile');
      setProfile(res.data);
      setForm({ bio: res.data.bio || '', phone: res.data.phone || '' });
      setAccountForm(p => ({ ...p, email: res.data.email || '' }));
    } catch {}
  };
  useEffect(() => { fetchProfile(); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('bio', form.bio);
      fd.append('phone', form.phone);
      fd.append('specialties', JSON.stringify(profile?.specialties?.filter(Boolean) || []));
      fd.append('service_ids', JSON.stringify(profile?.service_ids?.filter(Boolean) || []));
      if (photoFile) fd.append('photo', photoFile);
      await api.put('/barbers/me/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated!');
      setPhotoFile(null);
      fetchProfile();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (accountForm.new_password && accountForm.new_password !== accountForm.confirm_password) {
      return toast.error('New passwords do not match');
    }
    if (accountForm.new_password && accountForm.new_password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setSavingAccount(true);
    try {
      const payload = {};
      if (accountForm.email !== profile?.email) payload.email = accountForm.email;
      if (accountForm.current_password) payload.current_password = accountForm.current_password;
      if (accountForm.new_password) payload.new_password = accountForm.new_password;
      await api.put('/barbers/me/account', payload);
      toast.success('Account credentials updated!');
      setAccountForm(p => ({ ...p, current_password: '', new_password: '', confirm_password: '' }));
      fetchProfile();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSavingAccount(false); }
  };

  if (!profile) return <Layout><div style={{ padding: 40, textAlign: 'center', color: '#8b92a9' }}>Loading...</div></Layout>;

  const PwField = ({ label, field }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={showPw[field] ? 'text' : 'password'} value={accountForm[field === 'current' ? 'current_password' : field === 'new' ? 'new_password' : 'confirm_password']}
          onChange={e => setAccountForm(p => ({ ...p, [field === 'current' ? 'current_password' : field === 'new' ? 'new_password' : 'confirm_password']: e.target.value }))}
          style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 40px 10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          placeholder="••••••••" />
        <button type="button" onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 0 }}>
          {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div style={{ maxWidth: 680, padding: '20px 16px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: '#1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#d4af37', fontWeight: 700, margin: '0 auto 10px', border: '2px solid rgba(212,175,55,0.3)' }}>
            {profile.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.name?.charAt(0)}
          </div>
          <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 18 }}>{profile.name}</div>
          <div style={{ color: '#8b92a9', fontSize: 13 }}>{profile.barbershop_name}</div>
        </div>

        <div style={{ display: 'flex', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          {[['profile', 'Profile & Photo'], ['account', 'Account & Password']].map(([t, l], i) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '11px', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', border: 'none', borderRight: i === 0 ? '1px solid #1e2a3a' : 'none', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, fontSize: 13 }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}><User size={16} color="#d4af37" /> Profile Info</h2>
            <form onSubmit={saveProfile}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#d4af37', fontWeight: 700, flexShrink: 0 }}>
                  {profile.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.name?.charAt(0)}
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(212,175,55,0.1)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                  <Upload size={13} /> {photoFile ? photoFile.name : 'Change Photo'}
                  <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={{ display: 'none' }} />
                </label>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="09XX XXX XXXX" style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Bio</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={4} placeholder="Tell customers about yourself and your experience..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px', background: saving ? '#374151' : '#d4af37', color: saving ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
        )}

        {tab === 'account' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={16} color="#d4af37" /> Account Credentials</h2>
            <p style={{ color: '#8b92a9', fontSize: 13, margin: '0 0 18px' }}>Update your login email and password</p>
            <form onSubmit={saveAccount}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Email Address</label>
                <input type="email" value={accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: '#0a1020', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ color: '#8b92a9', fontSize: 12, marginBottom: 12 }}>Leave password fields blank to keep your current password</div>
                <PwField label="Current Password" field="current" />
                <PwField label="New Password" field="new" />
                <PwField label="Confirm New Password" field="confirm" />
              </div>
              <button type="submit" disabled={savingAccount} style={{ width: '100%', padding: '12px', background: savingAccount ? '#374151' : '#d4af37', color: savingAccount ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: savingAccount ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Save size={14} /> {savingAccount ? 'Saving...' : 'Update Credentials'}
              </button>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
