import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { User, Gift, AlertCircle } from 'lucide-react';
import styles from './Profile.module.css';

export default function CustomerProfile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [loyalty, setLoyalty] = useState({ total_points: 0, history: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers/me/loyalty').then(res => setLoyalty(res.data)).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/customers/me', form);
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>{user?.name?.charAt(0)?.toUpperCase()}</div>
          <div className={styles.name}>{user?.name}</div>
          <div className={styles.email}>{user?.email}</div>
          <div className={styles.badges}>
            <span className="badge badge-gold"><Gift size={12} /> {loyalty.total_points} pts</span>
            {user?.no_show_count > 0 && <span className="badge badge-error"><AlertCircle size={12} /> {user.no_show_count} No-shows</span>}
          </div>
        </div>

        <div className={styles.section}>
          <h2>Edit Profile</h2>
          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.field}>
              <label>Full Name</label>
              <input className={styles.input} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
            </div>
            <div className={styles.field}>
              <label>Phone</label>
              <input className={styles.input} value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="09XX XXX XXXX" />
            </div>
            <button className={styles.saveBtn} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>

        <div className={styles.section}>
          <h2><Gift size={18} /> Loyalty Points</h2>
          <div className={styles.pointsTotal}>Total: <span>{loyalty.total_points} points</span></div>
          <div className={styles.pointsList}>
            {loyalty.history.map(t => (
              <div key={t.id} className={styles.pointsRow}>
                <span>{t.description}</span>
                <span className={t.points > 0 ? styles.earned : styles.spent}>{t.points > 0 ? '+' : ''}{t.points} pts</span>
              </div>
            ))}
            {loyalty.history.length === 0 && <p style={{color:'var(--text-muted)',fontSize:13}}>No transactions yet.</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
