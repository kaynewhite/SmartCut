import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map, { SINILOAN_CENTER, DEFAULT_ZOOM } from '../../components/Map';
import toast from 'react-hot-toast';
import { Upload, Image, Settings2, Plus, Trash2, QrCode, ToggleLeft, ToggleRight, MapPin, CreditCard, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import styles from './Settings.module.css';

const PH_PAYMENT_TYPES = [
  { group: 'E-Wallets', options: ['GCash', 'Maya (PayMaya)', 'ShopeePay', 'GrabPay'] },
  { group: 'Banks', options: ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Landbank', 'PNB', 'Security Bank', 'RCBC', 'EastWest Bank', 'Chinabank', 'CIMB Bank', 'GoTyme Bank', 'SeaBank'] },
  { group: 'Other', options: ['Cash', 'Other'] },
];

const PM_COLORS = {
  'GCash': '#00a0e9', 'Maya (PayMaya)': '#00c28e', 'ShopeePay': '#ee4d2d', 'GrabPay': '#00b14f',
  'BDO': '#003f8a', 'BPI': '#bd1723', 'Metrobank': '#1c2b6b', 'UnionBank': '#f05a22',
  'Landbank': '#006837', 'PNB': '#003087', 'Security Bank': '#a50034',
  'RCBC': '#d10a10', 'EastWest Bank': '#f7941d', 'Chinabank': '#c8102e',
  'CIMB Bank': '#E22028', 'GoTyme Bank': '#1db954', 'SeaBank': '#2563eb',
  'Cash': '#16a34a', 'Other': '#6b7280',
};

export default function BarbershopSettings() {
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name:'', phone:'', address:'', city:'', description:'', opening_time:'08:00', closing_time:'20:00', latitude: null, longitude: null });
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(null);
  const [savedLocation, setSavedLocation] = useState(null);
  const [savingLoc, setSavingLoc] = useState(false);
  const [payMethods, setPayMethods] = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [pmForm, setPmForm] = useState({ type:'GCash', account_name:'', account_number:'' });
  const [pmFile, setPmFile] = useState(null);
  const [pmSaving, setPmSaving] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reportForm, setReportForm] = useState({ report_type: 'feedback', subject: '', message: '' });
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    fetchShop();
    fetchPayMethods();
    api.get('/subscriptions/status').then(res => setSubStatus(res.data)).catch(() => {});
    api.get('/admin/qr').then(res => setAdminQr(res.data)).catch(() => {});
  }, []);

  const fetchShop = async () => {
    try {
      const res = await api.get('/barbershops/me/profile');
      setShop(res.data);
      setForm({ name:res.data.name||'', phone:res.data.phone||'', address:res.data.address||'', city:res.data.city||'', description:res.data.description||'', opening_time:res.data.opening_time?.substring(0,5)||'08:00', closing_time:res.data.closing_time?.substring(0,5)||'20:00', latitude:res.data.latitude||null, longitude:res.data.longitude||null });
      if (res.data.latitude && res.data.longitude) {
        const loc = [parseFloat(res.data.latitude), parseFloat(res.data.longitude)];
        setLocation(loc); setSavedLocation(loc);
      }
    } catch {}
  };

  const fetchPayMethods = async () => {
    try { const res = await api.get('/payment-methods/me'); setPayMethods(res.data); } catch {}
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const data = { ...form };
      if (location) { data.latitude = location[0]; data.longitude = location[1]; }
      const res = await api.put('/barbershops/me/profile', data);
      setShop(res.data);
      if (location) setSavedLocation(location);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const saveLocationOnly = async () => {
    if (!location) return toast.error('Click on the map to pick a location first');
    setSavingLoc(true);
    try {
      const res = await api.put('/barbershops/me/profile', { ...form, latitude: location[0], longitude: location[1] });
      setShop(res.data); setForm(p => ({ ...p, latitude: location[0], longitude: location[1] })); setSavedLocation(location);
      toast.success('Location saved!');
    } catch { toast.error('Failed to save location'); }
    finally { setSavingLoc(false); }
  };

  const uploadLogo = async (file) => {
    const fd = new FormData(); fd.append('logo', file);
    try { const res = await api.post('/barbershops/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShop(p => ({...p, logo_url: res.data.logo_url})); toast.success('Logo uploaded!'); }
    catch { toast.error('Upload failed'); }
  };

  const handleAddPayMethod = async (e) => {
    e.preventDefault(); setPmSaving(true);
    try {
      const fd = new FormData(); fd.append('type', pmForm.type); fd.append('account_name', pmForm.account_name); fd.append('account_number', pmForm.account_number);
      if (pmFile) fd.append('qr_code', pmFile);
      await api.post('/payment-methods/me', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment method added!'); setAddModal(false); fetchPayMethods();
    } catch { toast.error('Failed to add'); }
    finally { setPmSaving(false); }
  };

  const handleEditPayMethod = async (e) => {
    e.preventDefault(); setPmSaving(true);
    try {
      const fd = new FormData(); fd.append('type', pmForm.type); fd.append('account_name', pmForm.account_name); fd.append('account_number', pmForm.account_number);
      if (pmFile) fd.append('qr_code', pmFile);
      await api.put(`/payment-methods/me/${editModal.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Updated!'); setEditModal(null); fetchPayMethods();
    } catch { toast.error('Failed to update'); }
    finally { setPmSaving(false); }
  };

  const togglePayMethod = async (id) => { try { await api.patch(`/payment-methods/me/${id}/toggle`); fetchPayMethods(); } catch { toast.error('Failed'); } };
  const deletePayMethod = async (id) => { if (!confirm('Remove this payment method?')) return; try { await api.delete(`/payment-methods/me/${id}`); toast.success('Removed'); fetchPayMethods(); } catch { toast.error('Failed'); } };

  const handleSubRequest = async (e) => {
    e.preventDefault();
    if (!proofFile) return toast.error('Please upload payment proof');
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('proof', proofFile);
      await api.post('/subscriptions/request', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Subscription request submitted! Admin will review within 24 hours.');
      const res = await api.get('/subscriptions/status'); setSubStatus(res.data); setProofFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    finally { setUploading(false); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setSubmittingReport(true);
    try { await api.post('/reports', reportForm); toast.success('Report submitted!'); setReportForm({ report_type: 'feedback', subject: '', message: '' }); }
    catch { toast.error('Failed'); }
    finally { setSubmittingReport(false); }
  };

  const set = f => e => setForm(p => ({...p, [f]: e.target.value}));

  const PayModal = ({ isEdit, onSubmit, onClose }) => (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h3>{isEdit ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
        <form onSubmit={onSubmit} className={styles.pmForm}>
          <div className={styles.field}><label>Payment Type</label>
            <select className={styles.input} value={pmForm.type} onChange={e => setPmForm(p => ({...p, type: e.target.value}))}>
              {PH_PAYMENT_TYPES.map(g => <optgroup key={g.group} label={g.group}>{g.options.map(o => <option key={o} value={o}>{o}</option>)}</optgroup>)}
            </select>
          </div>
          <div className={styles.field}><label>Account Name</label><input className={styles.input} value={pmForm.account_name} onChange={e => setPmForm(p => ({...p, account_name: e.target.value}))} placeholder="e.g. Juan Dela Cruz" /></div>
          <div className={styles.field}><label>Account Number / Mobile</label><input className={styles.input} value={pmForm.account_number} onChange={e => setPmForm(p => ({...p, account_number: e.target.value}))} placeholder="09XX XXX XXXX" /></div>
          <div className={styles.field}>
            <label>QR Code Image {isEdit && editModal?.qr_code_url && '(leave blank to keep current)'}</label>
            <label className={styles.fileLabel}><Upload size={14} /> {pmFile ? pmFile.name : (isEdit && editModal?.qr_code_url ? 'Upload new QR (optional)' : 'Upload QR Code')}<input type="file" accept="image/*" onChange={e => setPmFile(e.target.files[0])} style={{display:'none'}} /></label>
            {isEdit && editModal?.qr_code_url && !pmFile && <img src={editModal.qr_code_url} alt="Current QR" className={styles.qrThumb} />}
          </div>
          <div className={styles.modalActions}>
            <button className={styles.saveBtn} type="submit" disabled={pmSaving}>{pmSaving ? 'Saving...' : isEdit ? 'Update' : 'Add Method'}</button>
            <button className={styles.cancelBtn} type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1><Settings2 size={24} /> Settings</h1></div>

        {/* Subscription Banner */}
        {subStatus && (
          <div style={{ marginBottom: 20, padding: 16, background: subStatus.is_active ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${subStatus.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {subStatus.is_active ? <CheckCircle size={18} color="#10b981" /> : <CreditCard size={18} color="#ef4444" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: subStatus.is_active ? '#10b981' : '#ef4444', fontSize: 15 }}>
                  {subStatus.is_active ? 'Subscription Active — Your shop is visible to customers' : 'No Active Subscription — Your shop is hidden from customers'}
                </div>
                {!subStatus.is_active && <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 2 }}>Subscribe to become visible on the explore page and receive bookings.</div>}
                {subStatus.subscription?.expires_at && <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 2 }}>Expires: {new Date(subStatus.subscription.expires_at).toLocaleDateString()}</div>}
              </div>
              {!subStatus.is_active && subStatus.subscription?.status !== 'pending' && (
                <a href="#subscription" style={{ padding: '8px 16px', background: '#d4af37', color: '#0f1422', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Subscribe Now</a>
              )}
              {subStatus.subscription?.status === 'pending' && (
                <span style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: 6, fontSize: 12 }}><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />Pending Review</span>
              )}
            </div>
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <div className={styles.section}>
              <h2>Shop Profile</h2>
              <form onSubmit={handleSave} className={styles.form}>
                <div className={styles.field}><label>Shop Name *</label><input className={styles.input} value={form.name} onChange={set('name')} required /></div>
                <div className={styles.field}><label>Phone</label><input className={styles.input} value={form.phone} onChange={set('phone')} placeholder="09XX XXX XXXX" /></div>
                <div className={styles.field}><label>City</label><input className={styles.input} value={form.city} onChange={set('city')} /></div>
                <div className={styles.field}><label>Address</label><input className={styles.input} value={form.address} onChange={set('address')} /></div>
                <div className={styles.field}><label>Description</label><textarea className={styles.textarea} value={form.description} onChange={set('description')} rows={3} /></div>
                <div className={styles.row}>
                  <div className={styles.field}><label>Opening Time</label><input className={styles.input} type="time" value={form.opening_time} onChange={set('opening_time')} /></div>
                  <div className={styles.field}><label>Closing Time</label><input className={styles.input} type="time" value={form.closing_time} onChange={set('closing_time')} /></div>
                </div>
                <button className={styles.saveBtn} type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
              </form>

              <div className={styles.mapSection}>
                <h3><MapPin size={18} /> Shop Location</h3>
                <p className={styles.hint}>Click on the map to drop your pin, then press Save Location.</p>
                <Map center={location || SINILOAN_CENTER} zoom={DEFAULT_ZOOM} onLocationSelect={setLocation} selectedLocation={location} height="300px" />
                {location && <div className={styles.locationInfo}><small>Pin: {location[0].toFixed(6)}, {location[1].toFixed(6)}{savedLocation && location[0] === savedLocation[0] ? <span style={{color:'#16a34a',marginLeft:8}}>✓ Saved</span> : <span style={{color:'#f59e0b',marginLeft:8}}>● Unsaved</span>}</small></div>}
                <button type="button" className={styles.saveBtn} style={{marginTop:10,background:'#16a34a'}} onClick={saveLocationOnly} disabled={savingLoc||!location}><MapPin size={14} style={{display:'inline',marginRight:6}}/>{savingLoc ? 'Saving...' : 'Save Location'}</button>
              </div>
            </div>

            {/* Payment Methods */}
            <div className={styles.section}>
              <div className={styles.pmHeader}>
                <h2><QrCode size={18} /> Payment Methods</h2>
                <button className={styles.addPmBtn} onClick={() => { setPmForm({ type:'GCash', account_name:'', account_number:'' }); setPmFile(null); setAddModal(true); }}><Plus size={14} /> Add</button>
              </div>
              <p className={styles.hint}>Add QR codes so customers can pay via GCash, Maya, or bank transfer.</p>
              {payMethods.length === 0 ? <div className={styles.pmEmpty}>No payment methods yet.</div> : (
                <div className={styles.pmList}>
                  {payMethods.map(pm => (
                    <div key={pm.id} className={`${styles.pmCard} ${!pm.is_active ? styles.pmInactive : ''}`}>
                      <div className={styles.pmTag} style={{background:PM_COLORS[pm.type]||'#6b7280'}}>{pm.type}</div>
                      <div className={styles.pmInfo}>
                        {pm.account_name && <div className={styles.pmName}>{pm.account_name}</div>}
                        {pm.account_number && <div className={styles.pmNum}>{pm.account_number}</div>}
                        {!pm.qr_code_url && <div className={styles.pmNoQr}>No QR uploaded</div>}
                      </div>
                      {pm.qr_code_url && <img src={pm.qr_code_url} alt="QR" className={styles.pmQr} />}
                      <div className={styles.pmActions}>
                        <button className={styles.toggleBtn} onClick={() => togglePayMethod(pm.id)}>{pm.is_active ? <ToggleRight size={20} color="#16a34a" /> : <ToggleLeft size={20} color="#6b7280" />}</button>
                        <button className={styles.editPmBtn} onClick={() => { setPmForm({ type:pm.type, account_name:pm.account_name||'', account_number:pm.account_number||'' }); setPmFile(null); setEditModal(pm); }}>Edit</button>
                        <button className={styles.delPmBtn} onClick={() => deletePayMethod(pm.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription */}
            <div className={styles.section} id="subscription">
              <h2><CreditCard size={18} /> Subscription</h2>
              <p className={styles.hint}>An active subscription makes your shop visible to customers on the explore page.</p>
              {subStatus?.is_active ? (
                <div style={{ padding: 14, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={18} color="#10b981" />
                  <div style={{ color: '#10b981', fontWeight: 600 }}>Subscription Active{subStatus.subscription?.expires_at ? ` · Expires ${new Date(subStatus.subscription.expires_at).toLocaleDateString()}` : ''}</div>
                </div>
              ) : (
                <>
                  {subStatus?.subscription?.status === 'pending' && (
                    <div style={{ padding: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 14, color: '#f59e0b', fontSize: 13 }}>
                      <Clock size={14} style={{ display: 'inline', marginRight: 6 }} />Payment submitted — admin will approve soon.
                    </div>
                  )}
                  {adminQr && (
                    <div style={{ background: '#0a1020', borderRadius: 10, padding: 16, marginBottom: 14, textAlign: 'center' }}>
                      <div style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: 4 }}>Pay via {adminQr.type}</div>
                      {adminQr.account_name && <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>{adminQr.account_name}</div>}
                      <img src={adminQr.qr_url} alt="Payment QR" style={{ maxWidth: 180, width: '100%', margin: '0 auto', display: 'block', borderRadius: 8, border: '1px solid #1e2a3a', background: '#fff', padding: 4 }} />
                      <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 10 }}>Scan and pay, then upload your receipt below</div>
                    </div>
                  )}
                  <form onSubmit={handleSubRequest}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: proofFile ? '#10b981' : '#8b92a9', fontSize: 13, marginBottom: 10 }}>
                      <Upload size={15} /> {proofFile ? `✓ ${proofFile.name}` : 'Upload payment receipt'}
                      <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <button type="submit" disabled={uploading || !proofFile || subStatus?.subscription?.status === 'pending'} className={styles.saveBtn}>
                      {uploading ? 'Submitting...' : subStatus?.subscription?.status === 'pending' ? 'Request Pending' : 'Submit Subscription Request'}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Report */}
            <div className={styles.section}>
              <h2><MessageSquare size={18} /> Feedback / Report</h2>
              <form onSubmit={handleReport} className={styles.form}>
                <div className={styles.field}>
                  <label>Type</label>
                  <select className={styles.input} value={reportForm.report_type} onChange={e => setReportForm(p => ({ ...p, report_type: e.target.value }))}>
                    {['feedback','complaint','bug','other'].map(t => <option key={t} value={t} style={{ background: '#1a2234' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className={styles.field}><label>Subject</label><input className={styles.input} value={reportForm.subject} onChange={e => setReportForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief summary" required /></div>
                <div className={styles.field}><label>Message</label><textarea className={styles.textarea} value={reportForm.message} onChange={e => setReportForm(p => ({ ...p, message: e.target.value }))} rows={3} required placeholder="Describe your feedback or issue..." /></div>
                <button className={styles.saveBtn} type="submit" disabled={submittingReport}>{submittingReport ? 'Submitting...' : 'Submit'}</button>
              </form>
            </div>
          </div>

          <div className={styles.rightCol}>
            <div className={styles.section}>
              <h2><Image size={18} /> Shop Logo</h2>
              <div className={styles.uploadArea}>
                {shop?.logo_url ? <img src={shop.logo_url} alt="Logo" className={styles.logoPreview} /> : <div className={styles.uploadPlaceholder}><Image size={40} color="#4b5563" /><span>No logo</span></div>}
                <label className={styles.uploadBtn}><Upload size={14} /> {shop?.logo_url ? 'Update Logo' : 'Upload Logo'}<input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} style={{display:'none'}} /></label>
              </div>
            </div>
          </div>
        </div>

        {addModal && <PayModal isEdit={false} onSubmit={handleAddPayMethod} onClose={() => setAddModal(false)} />}
        {editModal && <PayModal isEdit={true} onSubmit={handleEditPayMethod} onClose={() => setEditModal(null)} />}
      </div>
    </Layout>
  );
}
