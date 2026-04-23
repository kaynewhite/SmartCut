import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Gift, Plus, Edit2, Trash2, Upload, ToggleLeft, ToggleRight, X } from 'lucide-react';

export default function BarbershopPromos() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | promo object | null
  const [form, setForm] = useState({ name: '', description: '', points_cost: 10 });
  const [imgFile, setImgFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchPromos = () => {
    api.get('/loyalty-promos/me').then(r => setPromos(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(fetchPromos, []);

  const openAdd = () => { setForm({ name:'', description:'', points_cost: 10 }); setImgFile(null); setModal('add'); };
  const openEdit = (p) => { setForm({ name: p.name, description: p.description || '', points_cost: p.points_cost }); setImgFile(null); setModal(p); };

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
          Set the points cost — it's up to you how much each promo costs.
        </p>

        {loading ? <div style={{textAlign:'center',padding:40,color:'#8b92a9'}}>Loading...</div> :
         promos.length === 0 ? (
          <div style={{textAlign:'center',padding:60,background:'#1a2234',border:'1px dashed #2d3748',borderRadius:10,color:'#8b92a9'}}>
            <Gift size={42} color="#374151" style={{marginBottom:10}}/>
            <p style={{margin:0}}>No promos yet. Tap <b>New Promo</b> to create one.</p>
          </div>
         ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
            {promos.map(p => (
              <div key={p.id} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:10,overflow:'hidden',opacity:p.is_active?1:0.55}}>
                {p.image_url ? <img src={p.image_url} alt={p.name} style={{width:'100%',height:140,objectFit:'cover'}}/>
                  : <div style={{height:140,background:'linear-gradient(135deg,#1a2234,#2d3748)',display:'flex',alignItems:'center',justifyContent:'center'}}><Gift size={40} color="#d4af37"/></div>}
                <div style={{padding:14}}>
                  <div style={{fontWeight:700,color:'#f0f0f0',marginBottom:4}}>{p.name}</div>
                  {p.description && <div style={{fontSize:12,color:'#8b92a9',marginBottom:8}}>{p.description}</div>}
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:4,fontWeight:700,fontSize:13}}>
                    <Gift size={12}/> {p.points_cost} pts
                  </div>
                  <div style={{display:'flex',gap:6,marginTop:12,flexWrap:'wrap'}}>
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
          <form onClick={e => e.stopPropagation()} onSubmit={submit} style={{background:'#1a2234',border:'1px solid #2d3748',borderRadius:12,padding:24,maxWidth:480,width:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h3 style={{margin:0,color:'#f0f0f0'}}>{modal === 'add' ? 'Create Promo' : 'Edit Promo'}</h3>
              <X size={20} color="#8b92a9" style={{cursor:'pointer'}} onClick={() => setModal(null)}/>
            </div>
            <div style={{marginBottom:14}}>
              <label htmlFor="promo-name" style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Promo name *</label>
              <input id="promo-name" name="name" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Free Beard Trim" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label htmlFor="promo-desc" style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Description</label>
              <textarea id="promo-desc" name="description" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} placeholder="What does the customer get?" style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label htmlFor="promo-cost" style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Points cost * <span style={{color:'#d4af37',fontWeight:700}}>{form.points_cost} pts</span></label>
              <input id="promo-cost" name="points_cost" type="number" min="1" required value={form.points_cost} onChange={e => setForm(p => ({...p, points_cost: parseInt(e.target.value) || 0}))} style={{width:'100%',background:'#0f1422',border:'1px solid #2d3748',color:'#f0f0f0',padding:10,borderRadius:6}}/>
              <small style={{color:'#8b92a9',fontSize:11}}>Customers earn 1 point per completed appointment.</small>
            </div>
            <div style={{marginBottom:18}}>
              <label htmlFor="promo-img" style={{color:'#8b92a9',fontSize:13,display:'block',marginBottom:6}}>Image (optional)</label>
              <label htmlFor="promo-img" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(212,175,55,0.15)',color:'#d4af37',border:'1px solid rgba(212,175,55,0.4)',borderRadius:6,cursor:'pointer',fontSize:13}}>
                <Upload size={13}/> {imgFile ? imgFile.name : 'Upload image'}
              </label>
              <input id="promo-img" name="image" type="file" accept="image/*" onChange={e => setImgFile(e.target.files[0])} style={{display:'none'}}/>
            </div>
            <button type="submit" disabled={saving} style={{width:'100%',padding:12,background:'#d4af37',color:'#0f1422',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer'}}>
              {saving ? 'Saving...' : (modal === 'add' ? 'Create Promo' : 'Save Changes')}
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}
