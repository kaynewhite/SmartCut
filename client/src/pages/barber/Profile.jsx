import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Save, Upload, User } from 'lucide-react';

export default function BarberProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', phone: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/barbers/me/profile');
      setProfile(res.data);
      setForm({ bio: res.data.bio || '', phone: res.data.phone || '' });
    } catch {}
  };
  useEffect(() => { fetchProfile(); }, []);

  const save = async (e) => {
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
      toast.success('Profile updated');
      setPhotoFile(null);
      fetchProfile();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  if (!profile) return <Layout><div style={{ padding: 40, textAlign: 'center', color: '#8b92a9' }}>Loading...</div></Layout>;

  return (
    <Layout>
      <div style={{ padding: 20, maxWidth: 700 }}>
        <h1 style={{ color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <User size={22} color="#d4af37" /> My Profile
        </h1>
        <p style={{ color: '#8b92a9', marginTop: 4, marginBottom: 20 }}>Your photo, contact and bio shown to customers</p>

        <form onSubmit={save}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: '#2d3748', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#d4af37', fontWeight: 700 }}>
              {profile.photo_url ? <img src={profile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.name?.charAt(0)}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              <Upload size={13} /> {photoFile ? photoFile.name : 'Upload Photo'}
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={{ display: 'none' }} />
            </label>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="barber-phone" style={{ color: '#8b92a9', fontSize: 13, display: 'block', marginBottom: 6 }}>Phone</label>
            <input id="barber-phone" name="phone" autoComplete="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="09XX XXX XXXX" style={{ width: '100%', background: '#0f1422', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="barber-bio" style={{ color: '#8b92a9', fontSize: 13, display: 'block', marginBottom: 6 }}>Bio</label>
            <textarea id="barber-bio" name="bio" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={4} placeholder="Tell customers about yourself" style={{ width: '100%', background: '#0f1422', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6 }} />
          </div>
          <button type="submit" disabled={saving} style={{ padding: '12px 24px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
