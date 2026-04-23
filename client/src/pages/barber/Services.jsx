import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Save, Plus, X, Briefcase, Scissors } from 'lucide-react';

export default function BarberServicesPage() {
  const [profile, setProfile] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [serviceIds, setServiceIds] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [specSelect, setSpecSelect] = useState('');
  const [newSvc, setNewSvc] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/barbers/me/profile');
      setProfile(res.data);
      setSpecialties(res.data.specialties?.filter(Boolean) || []);
      setServiceIds(res.data.service_ids?.filter(Boolean) || []);
      const sRes = await api.get('/services/shop-all');
      setAllServices(sRes.data || []);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const addSpecialty = () => {
    const v = (specSelect || '').trim();
    if (!v) return toast.error('Pick a service first');
    if (specialties.some(s => s.toLowerCase() === v.toLowerCase())) return toast.error('Already added');
    setSpecialties([...specialties, v]);
    setSpecSelect('');
  };

  const offeredServiceNames = allServices
    .filter(s => serviceIds.includes(s.id))
    .map(s => s.name);
  const availableSpecOptions = offeredServiceNames.filter(
    n => !specialties.some(s => s.toLowerCase() === n.toLowerCase())
  );
  const removeSpec = sp => setSpecialties(specialties.filter(s => s !== sp));
  const toggleSvc = id => setServiceIds(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const save = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('bio', profile?.bio || '');
      fd.append('phone', profile?.phone || '');
      fd.append('specialties', JSON.stringify(specialties));
      fd.append('service_ids', JSON.stringify(serviceIds));
      await api.put('/barbers/me/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Saved');
      load();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const addService = async () => {
    if (!newSvc.name.trim()) return toast.error('Service name required');
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('name', newSvc.name);
      if (newSvc.description) fd.append('description', newSvc.description);
      const res = await api.post('/services/by-barber', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Service added — owner will set the price');
      setNewSvc({ name: '', description: '' });
      setServiceIds(p => [...new Set([...p, res.data.id])]);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  return (
    <Layout>
      <div style={{ padding: 20, maxWidth: 800 }}>
        <h1 style={{ color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Briefcase size={22} color="#d4af37" /> Services & Specialties
        </h1>
        <p style={{ color: '#8b92a9', marginTop: 4, marginBottom: 24 }}>List the services you offer and your specialties. The shop owner sets the prices.</p>

        <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <h3 style={{ margin: 0, color: '#f0f0f0', fontSize: 16, marginBottom: 4 }}>My Specialties</h3>
          <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 10px 0' }}>Pick from the services you offer below — these are the ones you're especially great at.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select
              id="spec-select"
              name="specialty"
              value={specSelect}
              onChange={e => setSpecSelect(e.target.value)}
              disabled={availableSpecOptions.length === 0}
              style={{ flex: 1, background: '#0f1422', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6 }}
            >
              <option value="">
                {offeredServiceNames.length === 0
                  ? '— Mark services you offer below first —'
                  : availableSpecOptions.length === 0
                    ? '— All offered services already added —'
                    : 'Choose a service to feature as a specialty'}
              </option>
              {availableSpecOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button type="button" onClick={addSpecialty} disabled={!specSelect} style={{ padding: '10px 16px', background: specSelect ? 'rgba(212,175,55,0.15)' : '#1a2234', color: specSelect ? '#d4af37' : '#6b7280', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, cursor: specSelect ? 'pointer' : 'not-allowed', fontWeight: 600 }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {specialties.length === 0 ? <span style={{ color: '#6b7280', fontSize: 13 }}>No specialties yet — pick what you're great at.</span> :
              specialties.map(sp => (
                <span key={sp} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, fontSize: 12 }}>
                  {sp}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeSpec(sp)} />
                </span>
              ))}
          </div>
        </div>

        <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <h3 style={{ margin: 0, color: '#f0f0f0', fontSize: 16, marginBottom: 6 }}>Services I Offer</h3>
          <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 12px 0' }}>Tap to mark which services you can perform.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allServices.length === 0 ? <span style={{ color: '#8b92a9', fontSize: 13 }}>No services in this shop yet — add one below.</span> :
              allServices.map(s => (
                <button key={s.id} type="button" onClick={() => toggleSvc(s.id)} style={{ padding: '8px 12px', border: `1px solid ${serviceIds.includes(s.id) ? '#d4af37' : '#2d3748'}`, background: serviceIds.includes(s.id) ? 'rgba(212,175,55,0.15)' : 'transparent', color: serviceIds.includes(s.id) ? '#d4af37' : '#cbd5e1', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  {s.name}{s.price ? ` · ₱${parseFloat(s.price).toFixed(0)}` : ' · price not set'}
                </button>
              ))}
          </div>
        </div>

        <button onClick={save} disabled={saving} style={{ padding: '12px 24px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 26 }}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Specialties & Selection'}
        </button>

        <div style={{ background: '#0f1422', border: '1px solid #2d3748', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Scissors size={18} color="#d4af37" />
            <h3 style={{ margin: 0, color: '#f0f0f0', fontSize: 16 }}>Add a Service You Offer</h3>
          </div>
          <p style={{ color: '#8b92a9', fontSize: 12, margin: '0 0 14px 0' }}>Add a new service for your shop (just the name). The shop owner will set the price before customers can book it.</p>
          <div style={{ marginBottom: 10 }}>
            <label htmlFor="svc-name" style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 4 }}>Service name</label>
            <input id="svc-name" name="svc_name" value={newSvc.name} onChange={e => setNewSvc(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Skin Fade" style={{ width: '100%', background: '#1a2234', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="svc-desc" style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 4 }}>Description (optional)</label>
            <input id="svc-desc" name="svc_desc" value={newSvc.description} onChange={e => setNewSvc(s => ({ ...s, description: e.target.value }))} placeholder="What's included" style={{ width: '100%', background: '#1a2234', border: '1px solid #2d3748', color: '#f0f0f0', padding: 10, borderRadius: 6 }} />
          </div>
          <button type="button" disabled={creating} onClick={addService} style={{ padding: '10px 18px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> {creating ? 'Adding...' : 'Add Service'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
