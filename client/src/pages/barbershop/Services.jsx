import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Upload } from 'lucide-react';
import styles from './Services.module.css';

const CATEGORIES = ['haircut','beard','shave','massage','coloring','treatment','other'];

export default function BarbershopServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_minutes: 30, category: 'haircut', is_home_service: false, is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchServices = () => {
    api.get('/services/me').then(res => setServices(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchServices(); }, []);

  const openAdd = () => { setForm({ name: '', description: '', price: '', duration_minutes: 30, category: 'haircut', is_home_service: false, is_active: true }); setModal('add'); };
  const openEdit = (s) => { setForm({ name: s.name, description: s.description || '', price: s.price, duration_minutes: s.duration_minutes, category: s.category, is_home_service: s.is_home_service, is_active: s.is_active }); setModal(s.id); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'add') { await api.post('/services', form); toast.success('Service added!'); }
      else { await api.put(`/services/${modal}`, form); toast.success('Service updated!'); }
      setModal(null);
      fetchServices();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const deleteService = async (id) => {
    if (!confirm('Deactivate this service?')) return;
    try { await api.delete(`/services/${id}`); toast.success('Service deactivated'); fetchServices(); }
    catch { toast.error('Failed'); }
  };

  const uploadImage = async (serviceId, file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      await api.post(`/services/${serviceId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Image updated!');
      fetchServices();
    } catch { toast.error('Upload failed'); }
  };

  const set = f => e => setForm(p => ({...p, [f]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value}));

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Services</h1>
          <button className={styles.addBtn} onClick={openAdd}><Plus size={16} /> Add Service</button>
        </div>
        {loading ? <div className={styles.loading}>Loading...</div> :
          <div className={styles.list}>
            {services.length === 0 && <div className={styles.empty}><p>No services yet. Add your first service!</p></div>}
            {services.map(s => (
              <div key={s.id} className={`${styles.card} ${!s.is_active ? styles.inactive : ''}`}>
                <div className={styles.imgCol}>
                  {s.image_url ? <img src={s.image_url} alt={s.name} className={styles.svcImg} /> : <div className={styles.imgPlaceholder}>✂️</div>}
                  <label className={styles.imgUpload}><Upload size={12} /><input type="file" accept="image/*" onChange={e => uploadImage(s.id, e.target.files[0])} style={{display:'none'}} /></label>
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{s.name} {!s.is_active && <span className="badge badge-error">Inactive</span>}</div>
                  {s.description && <div className={styles.desc}>{s.description}</div>}
                  <div className={styles.meta}>
                    <span className={styles.price}>₱{parseFloat(s.price).toFixed(0)}</span>
                    <span className={styles.dur}>{s.duration_minutes} min</span>
                    <span className="badge badge-gold">{s.category}</span>
                    {s.is_home_service && <span className="badge badge-info">Home</span>}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => openEdit(s)}><Edit2 size={14} /></button>
                  {s.is_active && <button className={styles.delBtn} onClick={() => deleteService(s.id)}><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        }

        {modal && (
          <div className={styles.modalBg}>
            <div className={styles.modal}>
              <h3>{modal === 'add' ? 'Add Service' : 'Edit Service'}</h3>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}><label>Name *</label><input className={styles.input} value={form.name} onChange={set('name')} required /></div>
                <div className={styles.field}><label>Description</label><textarea className={styles.textarea} value={form.description} onChange={set('description')} rows={2} /></div>
                <div className={styles.row}>
                  <div className={styles.field}><label>Price (₱) *</label><input className={styles.input} type="number" step="0.01" value={form.price} onChange={set('price')} required /></div>
                  <div className={styles.field}><label>Duration (min)</label><input className={styles.input} type="number" value={form.duration_minutes} onChange={set('duration_minutes')} /></div>
                </div>
                <div className={styles.field}><label>Category</label>
                  <select className={styles.input} value={form.category} onChange={set('category')}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.checkRow}><input type="checkbox" checked={form.is_home_service} onChange={set('is_home_service')} /> Available as Home Service</div>
                <div className={styles.checkRow}><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Active</div>
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
