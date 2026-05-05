import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, Save, Trash2, Edit2, X, Scissors, Upload, ToggleLeft, ToggleRight, Star } from 'lucide-react';

const CATEGORIES = ['haircut', 'beard', 'shave', 'color', 'treatment', 'kids', 'other'];

function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price || '',
    duration_minutes: service?.duration_minutes || 30,
    category: service?.category || 'haircut',
    is_home_service: service?.is_home_service || false,
    is_active: service?.is_active !== false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!service?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Service name required');
    if (!form.price || parseFloat(form.price) <= 0) return toast.error('Price must be greater than 0');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);
      await onSave(fd, isEdit ? service.id : null);
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>{isEdit ? 'Edit Service' : 'Add New Service'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Service Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Skin Fade" required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Price (₱) *</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Duration (min)</label>
              <input type="number" min="5" step="5" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0a1020', textTransform: 'capitalize' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="What does this service include?" style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Service Image</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: imageFile ? '#10b981' : '#8b92a9', fontSize: 13 }}>
                <Upload size={15} />
                {imageFile ? `✓ ${imageFile.name}` : (isEdit && service?.image_url ? 'Upload new image (replaces current)' : 'Upload service image')}
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              {isEdit && service?.image_url && !imageFile && (
                <img src={service.image_url} alt="Current" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 8, border: '1px solid #1e2a3a' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#8b92a9', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_home_service} onChange={e => setForm(p => ({ ...p, is_home_service: e.target.checked }))} />
                Home service available
              </label>
              {isEdit && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#8b92a9', fontSize: 13 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Active (visible to customers)
                </label>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', background: saving ? '#374151' : '#d4af37', color: saving ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15 }}>
              {saving ? 'Saving...' : isEdit ? 'Update Service' : 'Add Service'}
            </button>
            <button type="button" onClick={onClose} style={{ padding: '12px 16px', background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BarberServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [specSelect, setSpecSelect] = useState('');
  const [savingSpecs, setSavingSpecs] = useState(false);

  const load = async () => {
    try {
      const [svcRes, profileRes] = await Promise.all([
        api.get('/services/mine'),
        api.get('/barbers/me/profile'),
      ]);
      setServices(svcRes.data || []);
      setSpecialties(profileRes.data.specialties?.filter(Boolean) || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (fd, id) => {
    if (id) await api.put(`/services/by-barber/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    else await api.post('/services/by-barber', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    toast.success(id ? 'Service updated!' : 'Service added!');
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service? This cannot be undone.')) return;
    try {
      await api.delete(`/services/by-barber/${id}`);
      toast.success('Deleted');
      load();
    } catch { toast.error('Cannot delete (may have appointments)'); }
  };

  const offeredNames = services.filter(s => s.is_active).map(s => s.name);
  const availableSpecOpts = offeredNames.filter(n => !specialties.some(s => s.toLowerCase() === n.toLowerCase()));

  const addSpec = () => {
    const v = specSelect.trim();
    if (!v) return;
    if (specialties.some(s => s.toLowerCase() === v.toLowerCase())) return toast.error('Already added');
    setSpecialties([...specialties, v]);
    setSpecSelect('');
  };

  const saveSpecs = async () => {
    setSavingSpecs(true);
    try {
      const fd = new FormData();
      fd.append('specialties', JSON.stringify(specialties));
      await api.put('/barbers/me/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Specialties saved!');
    } catch { toast.error('Failed'); }
    finally { setSavingSpecs(false); }
  };

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading...</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 760, padding: '20px 16px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scissors size={20} color="#d4af37" /> My Services
            </h1>
            <p style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>You own, price, and manage your own services</p>
          </div>
          <button onClick={() => setModal({})} style={{ padding: '10px 18px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, whiteSpace: 'nowrap' }}>
            <Plus size={16} /> Add Service
          </button>
        </div>

        {services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12 }}>
            <Scissors size={44} color="#374151" style={{ marginBottom: 16 }} />
            <div style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 500 }}>No services yet</div>
            <p style={{ color: '#8b92a9', marginTop: 8 }}>Add your first service — you control the name, price, and photo.</p>
            <button onClick={() => setModal({})} style={{ marginTop: 14, padding: '10px 20px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
              Add First Service
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
            {services.map(s => (
              <div key={s.id} style={{ background: '#0f1827', border: `1px solid ${s.is_active ? '#1e2a3a' : '#0a1020'}`, borderRadius: 12, overflow: 'hidden', opacity: s.is_active ? 1 : 0.6 }}>
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 100, background: 'linear-gradient(135deg,#1a2234,#0f1422)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scissors size={32} color="#2d3748" />
                  </div>
                )}
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                    {!s.is_active && <span style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, fontSize: 10 }}>Hidden</span>}
                  </div>
                  {s.description && <div style={{ color: '#8b92a9', fontSize: 12, marginBottom: 8 }}>{s.description}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 18 }}>₱{parseFloat(s.price).toFixed(0)}</span>
                      <span style={{ color: '#8b92a9', fontSize: 12, marginLeft: 8 }}>{s.duration_minutes} min</span>
                    </div>
                    <span style={{ padding: '2px 8px', background: '#1e2a3a', color: '#8b92a9', borderRadius: 4, fontSize: 11, textTransform: 'capitalize' }}>{s.category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setModal(s)} style={{ flex: 1, padding: '8px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(s.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, cursor: 'pointer' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={16} color="#d4af37" /> My Specialties
          </h3>
          <p style={{ color: '#8b92a9', fontSize: 13, margin: '0 0 14px' }}>Highlight what you're especially great at from your active services.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={specSelect} onChange={e => setSpecSelect(e.target.value)} disabled={availableSpecOpts.length === 0} style={{ flex: 1, background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
              <option value="">{availableSpecOpts.length === 0 ? '— Add active services first —' : 'Choose specialty...'}</option>
              {availableSpecOpts.map(n => <option key={n} value={n} style={{ background: '#0a1020' }}>{n}</option>)}
            </select>
            <button onClick={addSpec} disabled={!specSelect} style={{ padding: '10px 16px', background: specSelect ? 'rgba(212,175,55,0.15)' : '#1e2a3a', border: '1px solid rgba(212,175,55,0.3)', color: specSelect ? '#d4af37' : '#6b7280', borderRadius: 8, cursor: specSelect ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {specialties.length === 0 ? <span style={{ color: '#6b7280', fontSize: 13 }}>No specialties yet</span> :
              specialties.map(sp => (
                <span key={sp} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(212,175,55,0.1)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6, fontSize: 13 }}>
                  {sp}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSpecialties(specialties.filter(s => s !== sp))} />
                </span>
              ))}
          </div>
          <button onClick={saveSpecs} disabled={savingSpecs} style={{ padding: '10px 20px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: savingSpecs ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> {savingSpecs ? 'Saving...' : 'Save Specialties'}
          </button>
        </div>
      </div>

      {modal !== null && (
        <ServiceModal service={modal?.id ? modal : undefined} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </Layout>
  );
}
