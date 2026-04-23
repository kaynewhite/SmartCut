import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Edit2, Save, Upload, ToggleLeft, ToggleRight, Briefcase, AlertCircle } from 'lucide-react';
import styles from './Services.module.css';

const CATEGORIES = ['haircut', 'beard', 'shave', 'massage', 'coloring', 'treatment', 'other'];

export default function BarbershopServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ price: '', duration_minutes: 30, category: 'haircut' });
  const [saving, setSaving] = useState(false);

  const fetchServices = () => {
    api.get('/services/me')
      .then(res => setServices(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchServices(); }, []);

  const startEdit = (s) => {
    setEditing(s.id);
    setForm({
      price: s.price ?? '',
      duration_minutes: s.duration_minutes || 30,
      category: s.category || 'haircut',
    });
  };

  const saveEdit = async (s) => {
    if (!form.price || parseFloat(form.price) <= 0) return toast.error('Set a valid price first');
    setSaving(true);
    try {
      await api.put(`/services/${s.id}`, {
        price: form.price,
        duration_minutes: form.duration_minutes,
        category: form.category,
      });
      toast.success('Saved');
      setEditing(null);
      fetchServices();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (s) => {
    try {
      await api.put(`/services/${s.id}`, { is_active: !s.is_active });
      fetchServices();
    } catch { toast.error('Failed'); }
  };

  const uploadImage = async (serviceId, file) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      await api.post(`/services/${serviceId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Image updated');
      fetchServices();
    } catch { toast.error('Upload failed'); }
  };

  const unpriced = services.filter(s => s.price === null || s.price === undefined);

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1><Briefcase size={20} style={{verticalAlign:'-3px',marginRight:6,color:'#d4af37'}}/>Service Pricing</h1>
        </div>
        <p style={{color:'#8b92a9',marginTop:0,marginBottom:16,fontSize:13}}>
          Your barbers add the services they offer. Set a price for each so customers can book it.
        </p>

        {unpriced.length > 0 && (
          <div style={{display:'flex',gap:10,padding:'12px 14px',background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.4)',borderRadius:8,marginBottom:16}}>
            <AlertCircle size={18} color="#f59e0b" style={{flexShrink:0}}/>
            <div style={{color:'#f59e0b',fontSize:13}}>
              {unpriced.length} service{unpriced.length>1?'s':''} need{unpriced.length>1?'':'s'} a price before customers can book.
            </div>
          </div>
        )}

        {loading ? <div className={styles.loading}>Loading...</div> :
          services.length === 0 ? (
            <div className={styles.empty}><p>No services yet. Your barbers will add the services they offer here.</p></div>
          ) : (
            <div className={styles.list}>
              {services.map(s => (
                <div key={s.id} className={`${styles.card} ${!s.is_active ? styles.inactive : ''}`}>
                  <div className={styles.imgCol}>
                    {s.image_url ? <img src={s.image_url} alt={s.name} className={styles.svcImg} /> : <div className={styles.imgPlaceholder}>✂️</div>}
                    <label className={styles.imgUpload}>
                      <Upload size={12} />
                      <input type="file" accept="image/*" onChange={e => uploadImage(s.id, e.target.files[0])} style={{display:'none'}} />
                    </label>
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>
                      {s.name} {!s.is_active && <span className="badge badge-error">Inactive</span>}
                      {(s.price === null || s.price === undefined) && <span className="badge badge-warning" style={{marginLeft:6}}>No price set</span>}
                    </div>
                    {s.description && <div className={styles.desc}>{s.description}</div>}
                    {editing === s.id ? (
                      <div style={{display:'grid',gridTemplateColumns:'120px 110px 130px',gap:8,marginTop:10,alignItems:'end'}}>
                        <div>
                          <label htmlFor={`price-${s.id}`} style={{fontSize:11,color:'#8b92a9',display:'block'}}>Price (₱)</label>
                          <input id={`price-${s.id}`} type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:6,borderRadius:6,fontSize:13}}/>
                        </div>
                        <div>
                          <label htmlFor={`dur-${s.id}`} style={{fontSize:11,color:'#8b92a9',display:'block'}}>Duration (min)</label>
                          <input id={`dur-${s.id}`} type="number" min="5" value={form.duration_minutes} onChange={e => setForm(p => ({...p, duration_minutes: parseInt(e.target.value) || 30}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:6,borderRadius:6,fontSize:13}}/>
                        </div>
                        <div>
                          <label htmlFor={`cat-${s.id}`} style={{fontSize:11,color:'#8b92a9',display:'block'}}>Category</label>
                          <select id={`cat-${s.id}`} value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:6,borderRadius:6,fontSize:13}}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.meta}>
                        <span className={styles.price}>{s.price ? `₱${parseFloat(s.price).toFixed(0)}` : '—'}</span>
                        <span className={styles.dur}>{s.duration_minutes} min</span>
                        <span className="badge badge-gold">{s.category}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.toggleBtn || ''} onClick={() => toggleActive(s)} title={s.is_active ? 'Disable' : 'Enable'} style={{background:'none',border:'none',cursor:'pointer'}}>
                      {s.is_active ? <ToggleRight size={20} color="#16a34a" /> : <ToggleLeft size={20} color="#6b7280" />}
                    </button>
                    {editing === s.id ? (
                      <button className={styles.editBtn} disabled={saving} onClick={() => saveEdit(s)}><Save size={14}/></button>
                    ) : (
                      <button className={styles.editBtn} onClick={() => startEdit(s)}><Edit2 size={14}/></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </Layout>
  );
}
