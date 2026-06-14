import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map, { SINILOAN_CENTER, DEFAULT_ZOOM } from '../../components/Map';
import toast from 'react-hot-toast';
import {
  Upload, Image, Settings2, Plus, Trash2, QrCode, ToggleLeft, ToggleRight,
  MapPin, CreditCard, CheckCircle, Clock, MessageSquare, Gift,
  ShieldAlert, Send, Lock, User, ChevronRight
} from 'lucide-react';
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

const NAV_ITEMS = [
  { key: 'profile',      icon: User,         label: 'Shop Profile' },
  { key: 'location',     icon: MapPin,        label: 'Location' },
  { key: 'media',        icon: Image,         label: 'Logo & Media' },
  { key: 'payments',     icon: QrCode,        label: 'Payment Methods' },
  { key: 'loyalty',      icon: Gift,          label: 'Loyalty Points' },
  { key: 'security',     icon: Lock,          label: 'Security' },
  { key: 'subscription', icon: CreditCard,    label: 'Subscription' },
  { key: 'feedback',     icon: MessageSquare, label: 'Feedback' },
];

export default function BarbershopSettings() {
  const [active, setActive] = useState('profile');

  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', description: '', opening_time: '08:00', closing_time: '20:00', latitude: null, longitude: null });
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(null);
  const [savedLocation, setSavedLocation] = useState(null);
  const [savingLoc, setSavingLoc] = useState(false);

  const [payMethods, setPayMethods] = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [pmForm, setPmForm] = useState({ type: 'GCash', account_name: '', account_number: '' });
  const [pmFile, setPmFile] = useState(null);
  const [pmSaving, setPmSaving] = useState(false);

  const [subStatus, setSubStatus] = useState(null);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [reportForm, setReportForm] = useState({ report_type: 'feedback', subject: '', message: '' });
  const [submittingReport, setSubmittingReport] = useState(false);

  const [loyaltyForm, setLoyaltyForm] = useState({ loyalty_points_per_appointment: 1, loyalty_streak_bonus: 0, loyalty_streak_every: 5 });
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetchShop();
    fetchPayMethods();
    api.get('/subscriptions/status').then(r => setSubStatus(r.data)).catch(() => {});
    api.get('/admin/qr').then(r => setAdminQr(r.data)).catch(() => {});
  }, []);

  const fetchShop = async () => {
    try {
      const res = await api.get('/barbershops/me/profile');
      setShop(res.data);
      setForm({ name: res.data.name || '', phone: res.data.phone || '', address: res.data.address || '', city: res.data.city || '', description: res.data.description || '', opening_time: res.data.opening_time?.substring(0, 5) || '08:00', closing_time: res.data.closing_time?.substring(0, 5) || '20:00', latitude: res.data.latitude || null, longitude: res.data.longitude || null });
      setLoyaltyForm({ loyalty_points_per_appointment: res.data.loyalty_points_per_appointment ?? 1, loyalty_streak_bonus: res.data.loyalty_streak_bonus ?? 0, loyalty_streak_every: res.data.loyalty_streak_every ?? 5 });
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
    if (!file) return;
    const fd = new FormData(); fd.append('logo', file);
    try { const res = await api.post('/barbershops/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setShop(p => ({ ...p, logo_url: res.data.logo_url })); toast.success('Logo uploaded!'); }
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
    e.preventDefault(); setSubmittingReport(true);
    try { await api.post('/reports', reportForm); toast.success('Report submitted!'); setReportForm({ report_type: 'feedback', subject: '', message: '' }); }
    catch { toast.error('Failed'); }
    finally { setSubmittingReport(false); }
  };

  const handleSaveLoyalty = async (e) => {
    e.preventDefault(); setSavingLoyalty(true);
    try { await api.put('/barbershops/me/loyalty-settings', loyaltyForm); toast.success('Loyalty settings saved!'); }
    catch { toast.error('Failed to save loyalty settings'); }
    finally { setSavingLoyalty(false); }
  };

  const handleAppeal = async (e) => {
    e.preventDefault();
    if (!appealText.trim()) return toast.error('Please write your appeal message');
    setSubmittingAppeal(true);
    try {
      await api.post('/barbershops/me/appeal', { appeal_text: appealText });
      toast.success('Appeal submitted! Admin will review shortly.');
      setAppealText(''); fetchShop();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit appeal'); }
    finally { setSubmittingAppeal(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('New passwords do not match');
    if (pwForm.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    setPwSaving(true);
    try {
      await api.put('/barbershops/me/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to change password'); }
    finally { setPwSaving(false); }
  };

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const setLoy = f => e => setLoyaltyForm(p => ({ ...p, [f]: parseInt(e.target.value) || 0 }));

  const inp = { className: styles.input };
  const ta = { className: styles.textarea };

  const PayModal = ({ isEdit, onSubmit, onClose }) => (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h3>{isEdit ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
        <form onSubmit={onSubmit} className={styles.pmForm}>
          <div className={styles.field}><label>Payment Type</label>
            <select className={styles.input} value={pmForm.type} onChange={e => setPmForm(p => ({ ...p, type: e.target.value }))}>
              {PH_PAYMENT_TYPES.map(g => <optgroup key={g.group} label={g.group}>{g.options.map(o => <option key={o} value={o}>{o}</option>)}</optgroup>)}
            </select>
          </div>
          <div className={styles.field}><label>Account Name</label><input {...inp} value={pmForm.account_name} onChange={e => setPmForm(p => ({ ...p, account_name: e.target.value }))} placeholder="e.g. Juan Dela Cruz" /></div>
          <div className={styles.field}><label>Account Number / Mobile</label><input {...inp} value={pmForm.account_number} onChange={e => setPmForm(p => ({ ...p, account_number: e.target.value }))} placeholder="09XX XXX XXXX" /></div>
          <div className={styles.field}>
            <label>QR Code Image {isEdit && editModal?.qr_code_url && '(leave blank to keep current)'}</label>
            <label className={styles.fileLabel}><Upload size={14} /> {pmFile ? pmFile.name : (isEdit && editModal?.qr_code_url ? 'Upload new QR (optional)' : 'Upload QR Code')}<input type="file" accept="image/*" onChange={e => setPmFile(e.target.files[0])} style={{ display: 'none' }} /></label>
            {isEdit && editModal?.qr_code_url && !pmFile && <img src={editModal.qr_code_url} alt="Current QR" className={styles.qrThumb} />}
          </div>
          <div className={styles.modalActions}>
            <button className={styles.saveBtn} type="submit" disabled={pmSaving}>{pmSaving ? 'Saving...' : isEdit ? 'Update' : 'Add Method'}</button>
            <button className={styles.dangerBtn} type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );

  const activeLabel = NAV_ITEMS.find(n => n.key === active)?.label || 'Settings';

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1><Settings2 size={22} /> Settings</h1>
        </div>

        {/* Restriction notice */}
        {shop && !shop.is_active && (
          <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(239,68,68,0.07)', border: '2px solid #ef4444', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <ShieldAlert size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚠️ Your Shop is Restricted</div>
                <p style={{ color: '#8b92a9', fontSize: 13, margin: '0 0 8px' }}>Your barbershop is hidden from customers and cannot receive new bookings.</p>
                {shop.restriction_reason && <div style={{ background: '#0a1020', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}><div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Reason:</div><div style={{ color: '#f0f0f0', fontSize: 13 }}>{shop.restriction_reason}</div></div>}
                {shop.restriction_requirements && <div style={{ background: '#0a1020', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}><div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Requirements:</div><div style={{ color: '#f0f0f0', fontSize: 13 }}>{shop.restriction_requirements}</div></div>}
                {shop.appeal_status === 'pending' ? (
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={15} color="#f59e0b" /><span style={{ color: '#f59e0b', fontSize: 13 }}>Your appeal is under review.</span>
                  </div>
                ) : (
                  <form onSubmit={handleAppeal}>
                    {shop.appeal_status === 'rejected' && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 10 }}>❌ Previous appeal rejected. You may submit a new one.</div>}
                    <div style={{ color: '#8b92a9', fontSize: 12, marginBottom: 6 }}>Submit an appeal if you believe this restriction is a mistake:</div>
                    <textarea value={appealText} onChange={e => setAppealText(e.target.value)} rows={3} placeholder="Explain your situation..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }} />
                    <button type="submit" disabled={submittingAppeal} style={{ padding: '10px 20px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Send size={14} />{submittingAppeal ? 'Submitting...' : 'Submit Appeal'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile dropdown */}
        <select
          className={styles.mobileSelect}
          value={active}
          onChange={e => setActive(e.target.value)}
        >
          {NAV_ITEMS.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}
        </select>

        <div className={styles.layout}>
          {/* Sidebar */}
          <nav className={styles.sidebar}>
            {NAV_ITEMS.map((n, i) => {
              const Icon = n.icon;
              const isDiv = i === 5; // divider before Security
              return (
                <div key={n.key}>
                  {i === 5 && <div className={styles.navDivider} />}
                  <button
                    className={`${styles.navItem} ${active === n.key ? styles.active : ''}`}
                    onClick={() => setActive(n.key)}
                  >
                    <Icon size={15} className={styles.navIcon} />
                    {n.label}
                    {active === n.key && <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Content */}
          <div className={styles.panel}>

            {/* ── SHOP PROFILE ── */}
            {active === 'profile' && (
              <div className={styles.section}>
                <h2><User size={17} /> Shop Profile</h2>
                <p className={styles.sectionDesc}>Update your shop's name, contact info, hours, and description.</p>
                <form onSubmit={handleSave} className={styles.form}>
                  <div className={styles.field}><label>Shop Name *</label><input {...inp} value={form.name} onChange={set('name')} required /></div>
                  <div className={styles.row}>
                    <div className={styles.field}><label>Phone</label><input {...inp} value={form.phone} onChange={set('phone')} placeholder="09XX XXX XXXX" /></div>
                    <div className={styles.field}><label>City</label><input {...inp} value={form.city} onChange={set('city')} /></div>
                  </div>
                  <div className={styles.field}><label>Address</label><input {...inp} value={form.address} onChange={set('address')} /></div>
                  <div className={styles.field}><label>Description</label><textarea {...ta} value={form.description} onChange={set('description')} rows={3} /></div>
                  <div className={styles.row}>
                    <div className={styles.field}><label>Opening Time</label><input {...inp} type="time" value={form.opening_time} onChange={set('opening_time')} /></div>
                    <div className={styles.field}><label>Closing Time</label><input {...inp} type="time" value={form.closing_time} onChange={set('closing_time')} /></div>
                  </div>
                  <button className={styles.saveBtn} type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
                </form>
              </div>
            )}

            {/* ── LOCATION ── */}
            {active === 'location' && (
              <div className={styles.section}>
                <h2><MapPin size={17} /> Shop Location</h2>
                <p className={styles.sectionDesc}>Click on the map to place your shop's pin, then save the location.</p>
                <Map center={location || SINILOAN_CENTER} zoom={DEFAULT_ZOOM} onLocationSelect={setLocation} selectedLocation={location} height="360px" />
                {location && (
                  <div className={styles.locationInfo}>
                    Pin: {location[0].toFixed(6)}, {location[1].toFixed(6)}
                    {savedLocation && location[0] === savedLocation[0]
                      ? <span style={{ color: '#16a34a', marginLeft: 10 }}>✓ Saved</span>
                      : <span style={{ color: '#f59e0b', marginLeft: 10 }}>● Unsaved</span>}
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <button type="button" className={styles.saveBtn} style={{ background: '#16a34a', width: 'auto', padding: '11px 22px', display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={saveLocationOnly} disabled={savingLoc || !location}>
                    <MapPin size={14} />{savingLoc ? 'Saving...' : 'Save Location'}
                  </button>
                </div>
              </div>
            )}

            {/* ── MEDIA / LOGO ── */}
            {active === 'media' && (
              <div className={styles.section}>
                <h2><Image size={17} /> Logo & Media</h2>
                <p className={styles.sectionDesc}>Upload your shop logo. It appears on your profile and booking pages.</p>
                <div className={styles.logoWrap}>
                  {shop?.logo_url
                    ? <img src={shop.logo_url} alt="Logo" className={styles.logoImg} />
                    : <div className={styles.logoPlaceholder}><Image size={32} color="#4b5563" /></div>}
                  <div>
                    <label className={styles.uploadBtn}>
                      <Upload size={14} />{shop?.logo_url ? 'Replace Logo' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>PNG or JPG, max 5 MB</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── PAYMENT METHODS ── */}
            {active === 'payments' && (
              <div className={styles.section}>
                <div className={styles.pmHeader}>
                  <h2><QrCode size={17} /> Payment Methods</h2>
                  <button className={styles.addPmBtn} onClick={() => { setPmForm({ type: 'GCash', account_name: '', account_number: '' }); setPmFile(null); setAddModal(true); }}>
                    <Plus size={14} /> Add
                  </button>
                </div>
                <p className={styles.sectionDesc}>Add QR codes so customers can pay via GCash, Maya, or bank transfer.</p>
                {payMethods.length === 0
                  ? <div className={styles.pmEmpty}>No payment methods yet. Add one to let customers pay you.</div>
                  : (
                    <div className={styles.pmList}>
                      {payMethods.map(pm => (
                        <div key={pm.id} className={`${styles.pmCard} ${!pm.is_active ? styles.pmInactive : ''}`}>
                          <div className={styles.pmTag} style={{ background: PM_COLORS[pm.type] || '#6b7280' }}>{pm.type}</div>
                          <div className={styles.pmInfo}>
                            {pm.account_name && <div className={styles.pmName}>{pm.account_name}</div>}
                            {pm.account_number && <div className={styles.pmNum}>{pm.account_number}</div>}
                            {!pm.qr_code_url && <div className={styles.pmNoQr}>No QR uploaded</div>}
                          </div>
                          {pm.qr_code_url && <img src={pm.qr_code_url} alt="QR" className={styles.pmQr} />}
                          <div className={styles.pmActions}>
                            <button className={styles.toggleBtn} onClick={() => togglePayMethod(pm.id)}>{pm.is_active ? <ToggleRight size={20} color="#16a34a" /> : <ToggleLeft size={20} color="#6b7280" />}</button>
                            <button className={styles.editPmBtn} onClick={() => { setPmForm({ type: pm.type, account_name: pm.account_name || '', account_number: pm.account_number || '' }); setPmFile(null); setEditModal(pm); }}>Edit</button>
                            <button className={styles.delPmBtn} onClick={() => deletePayMethod(pm.id)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* ── LOYALTY POINTS ── */}
            {active === 'loyalty' && (
              <div className={styles.section}>
                <h2><Gift size={17} /> Loyalty Points</h2>
                <p className={styles.sectionDesc}>Configure how customers earn loyalty points at your shop.</p>
                <form onSubmit={handleSaveLoyalty} className={styles.form}>
                  <div className={styles.field}>
                    <label>Points per Completed Appointment</label>
                    <input {...inp} type="number" min="0" max="100" value={loyaltyForm.loyalty_points_per_appointment} onChange={setLoy('loyalty_points_per_appointment')} />
                    <small className={styles.hint}>Customers earn this many points for each completed visit.</small>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.field}>
                      <label>Streak Bonus Points</label>
                      <input {...inp} type="number" min="0" max="500" value={loyaltyForm.loyalty_streak_bonus} onChange={setLoy('loyalty_streak_bonus')} />
                      <small className={styles.hint}>Bonus on streak visits. Set 0 to disable.</small>
                    </div>
                    <div className={styles.field}>
                      <label>Streak Every N Visits</label>
                      <input {...inp} type="number" min="1" max="50" value={loyaltyForm.loyalty_streak_every} onChange={setLoy('loyalty_streak_every')} />
                      <small className={styles.hint}>Bonus triggers every N completed visits.</small>
                    </div>
                  </div>
                  {loyaltyForm.loyalty_streak_bonus > 0 && (
                    <div style={{ padding: '12px 16px', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 9, fontSize: 13, color: '#d4af37' }}>
                      Customers earn <strong>{loyaltyForm.loyalty_points_per_appointment} pts</strong> per visit + <strong>{loyaltyForm.loyalty_streak_bonus} bonus pts</strong> every {loyaltyForm.loyalty_streak_every} visits.
                    </div>
                  )}
                  <button className={styles.saveBtn} type="submit" disabled={savingLoyalty}>{savingLoyalty ? 'Saving...' : 'Save Loyalty Settings'}</button>
                </form>
              </div>
            )}

            {/* ── SECURITY ── */}
            {active === 'security' && (
              <div className={styles.section}>
                <h2><Lock size={17} /> Change Password</h2>
                <p className={styles.sectionDesc}>Update your login password. Choose something strong and unique.</p>
                <form onSubmit={handlePwChange} className={styles.form}>
                  <div className={styles.field}><label>Current Password</label><input {...inp} type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} required /></div>
                  <div className={styles.field}><label>New Password</label><input {...inp} type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} required minLength={6} /></div>
                  <div className={styles.field}><label>Confirm New Password</label><input {...inp} type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} required /></div>
                  <button className={styles.saveBtn} type="submit" disabled={pwSaving}>{pwSaving ? 'Updating...' : 'Update Password'}</button>
                </form>
              </div>
            )}

            {/* ── SUBSCRIPTION ── */}
            {active === 'subscription' && (
              <div className={styles.section}>
                <h2><CreditCard size={17} /> Subscription</h2>
                <p className={styles.sectionDesc}>An active subscription makes your shop visible to customers on the explore page.</p>

                {subStatus?.is_active ? (
                  <div className={`${styles.badgeRow} ${styles.badgeSuccess}`} style={{ marginBottom: 0 }}>
                    <CheckCircle size={17} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Subscription Active</div>
                      {subStatus.subscription?.expires_at && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Expires {new Date(subStatus.subscription.expires_at).toLocaleDateString()}</div>}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {subStatus?.subscription?.status === 'pending' && (
                      <div className={`${styles.badgeRow} ${styles.badgeWarn}`}><Clock size={16} /> Payment submitted — admin will review soon.</div>
                    )}
                    {adminQr && (
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>Pay via {adminQr.type}</div>
                        {adminQr.account_name && <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 12 }}>{adminQr.account_name}</div>}
                        <img src={adminQr.qr_url} alt="Payment QR" style={{ maxWidth: 180, width: '100%', margin: '0 auto', display: 'block', borderRadius: 10, border: '1px solid #1e2a3a', background: '#fff', padding: 6 }} />
                        <p style={{ color: '#8b92a9', fontSize: 12, marginTop: 12 }}>Scan and pay, then upload your receipt below</p>
                      </div>
                    )}
                    <form onSubmit={handleSubRequest}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 9, cursor: 'pointer', color: proofFile ? '#10b981' : '#8b92a9', fontSize: 13, marginBottom: 10 }}>
                        <Upload size={15} />{proofFile ? `✓ ${proofFile.name}` : 'Upload payment receipt'}
                        <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} style={{ display: 'none' }} />
                      </label>
                      <button type="submit" disabled={uploading || !proofFile || subStatus?.subscription?.status === 'pending'} className={styles.saveBtn}>
                        {uploading ? 'Submitting...' : subStatus?.subscription?.status === 'pending' ? 'Request Pending' : 'Submit Subscription Request'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── FEEDBACK ── */}
            {active === 'feedback' && (
              <div className={styles.section}>
                <h2><MessageSquare size={17} /> Feedback & Report</h2>
                <p className={styles.sectionDesc}>Send feedback or report an issue to the SmartCut admin team.</p>
                <form onSubmit={handleReport} className={styles.form}>
                  <div className={styles.field}>
                    <label>Type</label>
                    <select className={styles.input} value={reportForm.report_type} onChange={e => setReportForm(p => ({ ...p, report_type: e.target.value }))}>
                      {['feedback', 'complaint', 'bug', 'other'].map(t => <option key={t} value={t} style={{ background: '#1a2234' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}><label>Subject</label><input {...inp} value={reportForm.subject} onChange={e => setReportForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief summary" required /></div>
                  <div className={styles.field}><label>Message</label><textarea {...ta} value={reportForm.message} onChange={e => setReportForm(p => ({ ...p, message: e.target.value }))} rows={4} required placeholder="Describe your feedback or issue..." /></div>
                  <button className={styles.saveBtn} type="submit" disabled={submittingReport}>{submittingReport ? 'Submitting...' : 'Submit'}</button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>

      {addModal && <PayModal isEdit={false} onSubmit={handleAddPayMethod} onClose={() => setAddModal(false)} />}
      {editModal && <PayModal isEdit={true} onSubmit={handleEditPayMethod} onClose={() => setEditModal(null)} />}
    </Layout>
  );
}
