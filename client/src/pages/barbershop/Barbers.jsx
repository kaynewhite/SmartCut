import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Star, Upload, Mail, Lock, KeyRound, X } from 'lucide-react';
import styles from './Barbers.module.css';

export default function BarbershopBarbers() {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', bio: '', specialties: [], is_available: true, email: '', password: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [specInput, setSpecInput] = useState('');

  const fetchBarbers = () => {
    api.get('/barbers/me').then(res => setBarbers(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchBarbers(); }, []);

  const openAdd = () => {
    setForm({ name: '', phone: '', bio: '', specialties: [], is_available: true, email: '', password: '' });
    setPhotoFile(null);
    setSpecInput('');
    setModal('add');
  };
  const openEdit = (b) => {
    setForm({ name: b.name, phone: b.phone || '', bio: b.bio || '', specialties: b.specialties?.filter(Boolean) || [], is_available: b.is_available, email: b.email || '', password: '' });
    setPhotoFile(null);
    setSpecInput('');
    setModal(b.id);
  };

  const addSpecialty = () => {
    const v = specInput.trim();
    if (!v) return;
    if (form.specialties.some(s => s.toLowerCase() === v.toLowerCase())) { setSpecInput(''); return; }
    setForm(p => ({ ...p, specialties: [...p.specialties, v] }));
    setSpecInput('');
  };
  const removeSpecialty = (sp) => setForm(p => ({ ...p, specialties: p.specialties.filter(s => s !== sp) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('phone', form.phone || '');
      fd.append('bio', form.bio || '');
      fd.append('specialties', form.specialties.join(','));
      fd.append('is_available', form.is_available);
      if (form.email) fd.append('email', form.email);
      if (form.password) fd.append('password', form.password);
      if (photoFile) fd.append('photo', photoFile);
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (modal === 'add') {
        await api.post('/barbers', fd, config);
        toast.success('Barber added' + (form.email ? ' with login account' : ''));
      } else {
        await api.put(`/barbers/${modal}`, fd, config);
        toast.success('Barber updated!');
      }
      setModal(null);
      fetchBarbers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteBarber = async (id) => {
    if (!confirm('Delete this barber?')) return;
    try {
      await api.delete(`/barbers/${id}`);
      toast.success('Barber removed');
      fetchBarbers();
    } catch { toast.error('Failed (may have appointments)'); }
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
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{b.name}</div>
                  <div className={styles.rating}><Star size={13} fill="#f59e0b" color="#f59e0b" /> {parseFloat(b.avg_rating||0).toFixed(1)} · {b.total_cuts} cuts</div>
                  {b.email && <div style={{fontSize:11,color:'#8b92a9',display:'flex',alignItems:'center',gap:4,marginTop:2}}><Mail size={11}/>{b.email}{b.has_account ? <span style={{color:'#16a34a',marginLeft:4}}>✓ Account</span> : null}</div>}
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
                  <label><Upload size={12} style={{display:'inline',marginRight:4}}/>Photo</label>
                  <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} className={styles.input} />
                  {photoFile && <small style={{color:'#8b92a9'}}>{photoFile.name}</small>}
                </div>
                <div className={styles.field}>
                  <label>Specialties (type your own and press Enter)</label>
                  <div style={{display:'flex',gap:6}}>
                    <input
                      className={styles.input}
                      value={specInput}
                      onChange={e => setSpecInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                      placeholder="e.g. Skin Fade, Korean Two-Block, Beard Sculpting"
                    />
                    <button type="button" className={styles.addBtn} onClick={addSpecialty}><Plus size={14}/> Add</button>
                  </div>
                  {form.specialties.length > 0 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
                      {form.specialties.map(sp => (
                        <span key={sp} className="badge badge-gold" style={{display:'inline-flex',alignItems:'center',gap:4}}>
                          {sp}
                          <button type="button" onClick={() => removeSpecialty(sp)} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',padding:0,display:'inline-flex'}}>
                            <X size={11}/>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{padding:'14px',background:'rgba(212,175,55,0.08)',border:'1px dashed rgba(212,175,55,0.4)',borderRadius:6,marginTop:8}}>
                  <div style={{color:'#d4af37',fontWeight:600,marginBottom:8,fontSize:13}}><KeyRound size={13} style={{display:'inline',marginRight:4}}/>Barber Login Account (optional)</div>
                  <div style={{fontSize:12,color:'#8b92a9',marginBottom:10}}>Give this barber their own login so they can manage their bio, specialties, and view their appointments.</div>
                  <div className={styles.field}>
                    <label><Mail size={11} style={{display:'inline',marginRight:4}}/>Email</label>
                    <input className={styles.input} type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="barber@email.com" />
                  </div>
                  <div className={styles.field}>
                    <label><Lock size={11} style={{display:'inline',marginRight:4}}/>{modal === 'add' ? 'Password (min 6 chars)' : 'New Password (leave blank to keep)'}</label>
                    <input className={styles.input} type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="••••••" />
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
