import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Star, Upload } from 'lucide-react';
import styles from './Barbers.module.css';

const SPECIALTIES_OPTS = ['Low Fade', 'High Fade', 'Mid Fade', 'Skin Fade', 'Classic Cut', 'Crew Cut', 'Pompadour', 'Undercut', 'Buzz Cut', 'Beard Trim', 'Hot Towel Shave', 'Hair Design'];

export default function BarbershopBarbers() {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', bio: '', specialties: [], is_available: true });
  const [saving, setSaving] = useState(false);

  const fetchBarbers = () => {
    api.get('/barbers').then(res => setBarbers(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchBarbers(); }, []);

  const openAdd = () => { setForm({ name: '', phone: '', bio: '', specialties: [], is_available: true }); setModal('add'); };
  const openEdit = (b) => { setForm({ name: b.name, phone: b.phone || '', bio: b.bio || '', specialties: b.specialties?.filter(Boolean) || [], is_available: b.is_available }); setModal(b.id); };

  const toggleSpecialty = (sp) => setForm(p => ({ ...p, specialties: p.specialties.includes(sp) ? p.specialties.filter(s => s !== sp) : [...p.specialties, sp] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/barbers', form);
        toast.success('Barber added!');
      } else {
        await api.put(`/barbers/${modal}`, form);
        toast.success('Barber updated!');
      }
      setModal(null);
      fetchBarbers();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const deleteBarber = async (id) => {
    if (!confirm('Delete this barber?')) return;
    try {
      await api.delete(`/barbers/${id}`);
      toast.success('Barber removed');
      fetchBarbers();
    } catch { toast.error('Failed'); }
  };

  const uploadPhoto = async (barberId, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.post(`/barbers/${barberId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Photo updated!');
      fetchBarbers();
    } catch { toast.error('Upload failed'); }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Barbers</h1>
          <button className={styles.addBtn} onClick={openAdd}><Plus size={16} /> Add Barber</button>
        </div>

        {loading ? <div className={styles.loading}>Loading...</div> :
          barbers.length === 0 ? <div className={styles.empty}><p>No barbers yet. Add your first barber!</p></div> :
          <div className={styles.grid}>
            {barbers.map(b => (
              <div key={b.id} className={styles.card}>
                <div className={styles.photoWrapper}>
                  {b.photo_url ? <img src={b.photo_url} alt={b.name} className={styles.photo} /> : <div className={styles.photoPlaceholder}>{b.name.charAt(0)}</div>}
                  <label className={styles.photoUpload}>
                    <Upload size={12} />
                    <input type="file" accept="image/*" onChange={e => uploadPhoto(b.id, e.target.files[0])} style={{display:'none'}} />
                  </label>
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{b.name}</div>
                  <div className={styles.rating}><Star size={13} fill="#f59e0b" color="#f59e0b" /> {parseFloat(b.avg_rating||0).toFixed(1)} · {b.total_cuts} cuts</div>
                  {b.phone && <div className={styles.phone}>{b.phone}</div>}
                  {b.bio && <div className={styles.bio}>{b.bio}</div>}
                  {b.specialties?.filter(Boolean).length > 0 && (
                    <div className={styles.tags}>
                      {b.specialties.filter(Boolean).map((sp, i) => <span key={i} className="badge badge-gold">{sp}</span>)}
                    </div>
                  )}
                  <span className={`badge ${b.is_available ? 'badge-success' : 'badge-error'}`}>{b.is_available ? 'Available' : 'Unavailable'}</span>
                </div>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => openEdit(b)}><Edit2 size={14} /></button>
                  <button className={styles.delBtn} onClick={() => deleteBarber(b.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        }

        {modal && (
          <div className={styles.modalBg}>
            <div className={styles.modal}>
              <h3>{modal === 'add' ? 'Add Barber' : 'Edit Barber'}</h3>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}><label>Name *</label><input className={styles.input} value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required /></div>
                <div className={styles.field}><label>Phone</label><input className={styles.input} value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="09XX XXX XXXX" /></div>
                <div className={styles.field}><label>Bio</label><textarea className={styles.textarea} value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))} rows={2} /></div>
                <div className={styles.field}>
                  <label>Specialties</label>
                  <div className={styles.specsGrid}>
                    {SPECIALTIES_OPTS.map(sp => (
                      <button key={sp} type="button" className={`${styles.specBtn} ${form.specialties.includes(sp) ? styles.specActive : ''}`} onClick={() => toggleSpecialty(sp)}>{sp}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.checkRow}>
                    <input type="checkbox" checked={form.is_available} onChange={e => setForm(p => ({...p, is_available: e.target.checked}))} />
                    Available for bookings
                  </label>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.saveBtn} type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button className={styles.cancelBtn} type="button" onClick={() => setModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
