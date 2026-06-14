import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Gift, Plus, Edit2, Trash2, Upload, ToggleLeft, ToggleRight, X, Scissors, User } from 'lucide-react';

export default function BarbershopPromos() {
  const [promos, setPromos] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | promo object | null
  const [form, setForm] = useState({ name: '', description: '', points_cost: 10, barber_id: '' });
  const [imgFile, setImgFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchPromos = () => {
    api.get('/loyalty-promos/me').then(r => setPromos(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  const fetchBarbers = async () => {
    try {
      const profileRes = await api.get('/barbershops/me/profile');
      const shopId = profileRes.data.id;
      const bRes = await api.get('/barbers', { params: { barbershop_id: shopId } });
      setBarbers(bRes.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchPromos();
    fetchBarbers();
  }, []);

  const openAdd = () => { setForm({ name:'', description:'', points_cost: 10, barber_id: '' }); setImgFile(null); setModal('add'); };
  const openEdit = (p) => { setForm({ name: p.name, description: p.description || '', points_cost: p.points_cost, barber_id: p.barber_id ? String(p.barber_id) : '' }); setImgFile(null); setModal(p); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.points_cost || form.points_cost < 1) return toast.error('Points cost must be at least 1');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description || '');
      fd.append('points_cost', form.points_cost);
      fd.append('barber_id', form.barber_id || '');
      if (imgFile) fd.append('image', imgFile);
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (modal === 'add') await api.post('/loyalty-promos/me', fd, config);
      else await api.put(`/loyalty-promos/me/${modal.id}`, fd, config);
      toast.success('Promo saved');
      setModal(null);
      fetchPromos();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const togglePromo = async (p) => {
    try {
      const fd = new FormData();
      fd.append('is_active', !p.is_active);
      await api.put(`/loyalty-promos/me/${p.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchPromos();
    } catch { toast.error('Failed'); }
  };

  const delPromo = async (id) => {
    if (!confirm('Delete this promo? Customers will no longer see it.')) return;
    try { await api.delete(`/loyalty-promos/me/${id}`); toast.success('Deleted'); fetchPromos(); }
    catch { toast.error('Failed'); }
  };

  const selectedBarber = barbers.find(b => String(b.id) === String(form.barber_id));

  return (
    <Layout>
      <div style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:8}}>
          <h1 style={{margin:0,color:'#f0f0f0',display:'flex',alignItems:'center',gap:10}}><Gift size={24} color="#d4af37"/> Loyalty Promos</h1>
          <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer'}}>
            <Plus size={16}/> New Promo
          </button>
        </div>
        <p style={{color:'#8b92a9',marginTop:0,marginBottom:24}}>
          Create rewards your customers can buy with loyalty points. Customers earn 1 point per completed appointment.
        </p>

        {loading ? <div style={{textAlign:'center',padding:40,color:'#8b92a9'}}>Loading...</div> :
         promos.length === 0 ? (
          <div style={{textAlign:'center',padding:60,background:'#1a2234',border:'1px dashed #2d3748',borderRadius:10,color:'#8b92a9'}}>
            <Gift size={42} color="#374151" style={{marginBottom:10}}/>
            <p style={{margin:0}}>No promos yet. Tap <b>New Promo</b> to create one.</p>
          </div>
         ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
            {promos.map(p => (
              <div key={p.id} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,overflow:'hidden',opacity:p.is_active?1:0.55}}>
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{width:'100%',height:140,objectFit:'cover'}}/>
                  : <div style={{height:140,background:'linear-gradient(135deg,#1a2234,#2d3748)',display:'flex',alignItems:'center',justifyContent:'center'}}><Gift size={40} color="#d4af37"/></div>}
                <div style={{padding:14}}>
                  <div style={{fontWeight:700,color:'#f0f0f0',marginBottom:4}}>{p.name}</div>
                  {p.description && <div style={{fontSize:12,color:'#8b92a9',marginBottom:8}}>{p.description}</div>}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:4,fontWeight:700,fontSize:13}}>
                      <Gift size={12}/> {p.points_cost} pts
                    </div>
                    {p.barber_name ? (
                      <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:p.barber_available?'rgba(16,185,129,0.1)':'rgba(107,114,128,0.1)',border:`1px solid ${p.barber_available?'rgba(16,185,129,0.35)':'#374151'}`,borderRadius:4,fontSize:11,color:p.barber_available?'#10b981':'#8b92a9'}}>
                        <Scissors size={10}/> {p.barber_name} {p.barber_available?'· Available':'· Busy'}
                      </div>
                    ) : (
                      <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:'rgba(107,114,128,0.1)',border:'1px solid #374151',borderRadius:4,fontSize:11,color:'#6b7280'}}>
                        <User size={10}/> Any Barber
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                    <button onClick={() => togglePromo(p)} style={{padding:'6px 10px',background:'transparent',border:'1px solid #2d3748',color:p.is_active?'#16a34a':'#8b92a9',borderRadius:4,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      {p.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}{p.is_active ? 'Active' : 'Disabled'}
                    </button>
                    <button onClick={() => openEdit(p)} style={{padding:'6px 10px',background:'transparent',border:'1px solid #2d3748',color:'#cbd5e1',borderRadius:4,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Edit2 size={12}/> Edit
                    </button>
                    <button onClick={() => delPromo(p.id)} style={{padding:'6px 10px',background:'transparent',border:'1px solid #ef4444',color:'#ef4444',borderRadius:4,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
         )}
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:12,padding:24,maxWidth:500,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h3 style={{margin:0,color:'#f0f0f0'}}>{modal === 'add' ? 'Create Promo' : 'Edit Promo'}</h3>
              <X size={20} color="#8b92a9" style={{cursor:'pointer'}} onClick={() => setModal(null)}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Promo name *</label>
              <input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Free Beard Trim" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} placeholder="What does the customer get?" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,resize:'vertical',boxSizing:'border-box'}}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Points cost * <span style={{color:'#d4af37',fontWeight:700}}>{form.points_cost} pts</span></label>
              <input type="number" min="1" required value={form.points_cost} onChange={e => setForm(p => ({...p, points_cost: parseInt(e.target.value) || 0}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}}/>
              <small style={{color:'#8b92a9',fontSize:11}}>Customers earn 1 point per completed appointment.</small>
            </div>

            {/* Barber assignment */}
            <div style={{marginBottom:14}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>
                Assigned Barber <span style={{color:'#6b7280',fontWeight:400,fontSize:11}}>(optional — leave blank for any barber)</span>
              </label>
              <select value={form.barber_id} onChange={e => setForm(p => ({...p, barber_id: e.target.value}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6,boxSizing:'border-box'}}>
                <option value="">Any barber</option>
                {barbers.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.is_available ? '✓ Available' : '✗ Busy'}
                  </option>
                ))}
              </select>
              {selectedBarber && (
                <div style={{marginTop:8,padding:'8px 12px',background:selectedBarber.is_available?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${selectedBarber.is_available?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:6,display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                  <Scissors size={13} color={selectedBarber.is_available?'#10b981':'#ef4444'} />
                  <span style={{color:'#f0f0f0',fontWeight:600}}>{selectedBarber.name}</span>
                  <span style={{color:selectedBarber.is_available?'#10b981':'#ef4444'}}>
                    {selectedBarber.is_available ? '● Available now' : '● Currently busy'}
                  </span>
                </div>
              )}
            </div>

            <div style={{marginBottom:18}}>
              <label style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Image (optional)</label>
              <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:6,cursor:'pointer',fontSize:13}}>
                <Upload size={13}/> {imgFile ? imgFile.name : 'Upload image'}
                <input type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0])} style={{display:'none'}}/>
              </label>
            </div>

            <button type="submit" disabled={saving} style={{width:'100%',padding:12,background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',fontSize:15}}>
              {saving ? 'Saving...' : (modal === 'add' ? 'Create Promo' : 'Save Changes')}
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}
