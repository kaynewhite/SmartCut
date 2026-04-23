import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import toast from 'react-hot-toast';
import { Upload, Image, Settings2, Plus, Trash2, QrCode, ToggleLeft, ToggleRight, ChevronDown, MapPin } from 'lucide-react';
import styles from './Settings.module.css';

const PH_PAYMENT_TYPES = [
  { group: 'E-Wallets', options: ['GCash', 'Maya (PayMaya)', 'ShopeePay', 'GrabPay'] },
  { group: 'Banks', options: ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Landbank', 'PNB', 'Security Bank', 'RCBC', 'EastWest Bank', 'Chinabank', 'CIMB Bank', 'GoTyme Bank', 'SeaBank'] },
  { group: 'Other', options: ['Cash', 'Other'] },
];

const ALL_TYPES = PH_PAYMENT_TYPES.flatMap(g => g.options);

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
  const [form, setForm] = useState({ name:'', phone:'', address:'', city:'', description:'', opening_time:'08:00', closing_time:'20:00', latitude: null, longitude: null, downpayment_percent: 25 });
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState(null);

  const [payMethods, setPayMethods] = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [pmForm, setPmForm] = useState({ type:'GCash', account_name:'', account_number:'' });
  const [pmFile, setPmFile] = useState(null);
  const [pmSaving, setPmSaving] = useState(false);

  useEffect(() => {
    fetchShop();
    fetchPayMethods();
  }, []);

  const fetchShop = async () => {
    try {
      const res = await api.get('/barbershops/me/profile');
      setShop(res.data);
      setForm({ 
        name: res.data.name||'', 
        phone: res.data.phone||'', 
        address: res.data.address||'', 
        city: res.data.city||'', 
        description: res.data.description||'', 
        opening_time: res.data.opening_time?.substring(0,5)||'08:00', 
        closing_time: res.data.closing_time?.substring(0,5)||'20:00',
        latitude: res.data.latitude || null,
        longitude: res.data.longitude || null,
        downpayment_percent: res.data.downpayment_percent ?? 25
      });
      if (res.data.latitude && res.data.longitude) {
        setLocation([res.data.latitude, res.data.longitude]);
      }
    } catch {}
  };

  const fetchPayMethods = async () => {
    try {
      const res = await api.get('/payment-methods/me');
      setPayMethods(res.data);
    } catch {}
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSend = { ...form };
      if (location) {
        dataToSend.latitude = location[0];
        dataToSend.longitude = location[1];
      }
      const res = await api.put('/barbershops/me/profile', dataToSend);
      setShop(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await api.post('/barbershops/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShop(p => ({...p, logo_url: res.data.logo_url}));
      toast.success('Logo uploaded!');
    } catch { toast.error('Upload failed'); }
  };

  const openAddModal = () => {
    setPmForm({ type: 'GCash', account_name: '', account_number: '' });
    setPmFile(null);
    setAddModal(true);
  };

  const openEditModal = (pm) => {
    setPmForm({ type: pm.type, account_name: pm.account_name || '', account_number: pm.account_number || '' });
    setPmFile(null);
    setEditModal(pm);
  };

  const handleAddPayMethod = async (e) => {
    e.preventDefault();
    setPmSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', pmForm.type);
      fd.append('account_name', pmForm.account_name);
      fd.append('account_number', pmForm.account_number);
      if (pmFile) fd.append('qr_code', pmFile);
      await api.post('/payment-methods/me', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment method added!');
      setAddModal(false);
      fetchPayMethods();
    } catch { toast.error('Failed to add'); }
    finally { setPmSaving(false); }
  };

  const handleEditPayMethod = async (e) => {
    e.preventDefault();
    setPmSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', pmForm.type);
      fd.append('account_name', pmForm.account_name);
      fd.append('account_number', pmForm.account_number);
      if (pmFile) fd.append('qr_code', pmFile);
      await api.put(`/payment-methods/me/${editModal.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Payment method updated!');
      setEditModal(null);
      fetchPayMethods();
    } catch { toast.error('Failed to update'); }
    finally { setPmSaving(false); }
  };

  const togglePayMethod = async (id) => {
    try {
      await api.patch(`/payment-methods/me/${id}/toggle`);
      fetchPayMethods();
    } catch { toast.error('Failed'); }
  };

  const deletePayMethod = async (id) => {
    if (!confirm('Remove this payment method?')) return;
    try {
      await api.delete(`/payment-methods/me/${id}`);
      toast.success('Removed');
      fetchPayMethods();
    } catch { toast.error('Failed'); }
  };

  const set = f => e => setForm(p => ({...p, [f]: e.target.value}));

  const PayModal = ({ isEdit, onSubmit, onClose }) => (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h3>{isEdit ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
        <form onSubmit={onSubmit} className={styles.pmForm}>
          <div className={styles.field}>
            <label>Payment Type</label>
            <select className={styles.input} value={pmForm.type} onChange={e => setPmForm(p => ({...p, type: e.target.value}))}>
              {PH_PAYMENT_TYPES.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label>Account Name</label>
            <input className={styles.input} value={pmForm.account_name} onChange={e => setPmForm(p => ({...p, account_name: e.target.value}))} placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div className={styles.field}>
            <label>Account Number / Mobile Number</label>
            <input className={styles.input} value={pmForm.account_number} onChange={e => setPmForm(p => ({...p, account_number: e.target.value}))} placeholder="e.g. 09XX XXX XXXX or Acct #" />
          </div>
          <div className={styles.field}>
            <label>QR Code Image {isEdit && editModal?.qr_code_url && '(leave blank to keep current)'}</label>
            <label className={styles.fileLabel}>
              <Upload size={14} /> {pmFile ? pmFile.name : (isEdit && editModal?.qr_code_url ? 'Upload new QR (optional)' : 'Upload QR Code')}
              <input type="file" accept="image/*" onChange={e => setPmFile(e.target.files[0])} style={{display:'none'}} />
            </label>
            {isEdit && editModal?.qr_code_url && !pmFile && (
              <img src={editModal.qr_code_url} alt="Current QR" className={styles.qrThumb} />
            )}
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
                <div className={styles.field}>
                  <label>Required Downpayment % <span style={{color:'#d4af37',fontWeight:700}}>{form.downpayment_percent}%</span></label>
                  <input type="range" min="0" max="100" step="5" value={form.downpayment_percent} onChange={e => setForm(p => ({...p, downpayment_percent: parseInt(e.target.value)}))} style={{width:'100%'}} />
                  <small style={{color:'#8b92a9',fontSize:11}}>Customers will be required to pay this percentage upfront to confirm their booking and prevent prank bookings.</small>
                </div>
                <button className={styles.saveBtn} type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</button>
              </form>

              <div className={styles.mapSection}>
                <h3><MapPin size={18} /> Shop Location</h3>
                <p className={styles.hint}>Click on the map to set your barbershop's location. This will help customers find you.</p>
                <Map
                  center={location || [14.42, 121.45]}
                  zoom={13}
                  onLocationSelect={setLocation}
                  selectedLocation={location}
                  height="300px"
                />
                {location && (
                  <div className={styles.locationInfo}>
                    <small>Selected location: {location[0].toFixed(6)}, {location[1].toFixed(6)}</small>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Methods */}
            <div className={styles.section}>
              <div className={styles.pmHeader}>
                <h2><QrCode size={18} /> Payment Methods</h2>
                <button className={styles.addPmBtn} onClick={openAddModal}><Plus size={14} /> Add Method</button>
              </div>
              <p className={styles.hint}>Choose which payment options customers can use. Upload a QR code for each so customers can scan and pay.</p>

              {payMethods.length === 0 ? (
                <div className={styles.pmEmpty}>No payment methods added yet. Add GCash, Maya, or bank options.</div>
              ) : (
                <div className={styles.pmList}>
                  {payMethods.map(pm => (
                    <div key={pm.id} className={`${styles.pmCard} ${!pm.is_active ? styles.pmInactive : ''}`}>
                      <div className={styles.pmTag} style={{background: PM_COLORS[pm.type] || '#6b7280'}}>{pm.type}</div>
                      <div className={styles.pmInfo}>
                        {pm.account_name && <div className={styles.pmName}>{pm.account_name}</div>}
                        {pm.account_number && <div className={styles.pmNum}>{pm.account_number}</div>}
                        {!pm.qr_code_url && <div className={styles.pmNoQr}>No QR uploaded</div>}
                      </div>
                      {pm.qr_code_url && <img src={pm.qr_code_url} alt="QR" className={styles.pmQr} />}
                      <div className={styles.pmActions}>
                        <button className={styles.toggleBtn} onClick={() => togglePayMethod(pm.id)} title={pm.is_active ? 'Disable' : 'Enable'}>
                          {pm.is_active ? <ToggleRight size={20} color="#16a34a" /> : <ToggleLeft size={20} color="#6b7280" />}
                        </button>
                        <button className={styles.editPmBtn} onClick={() => openEditModal(pm)}>Edit</button>
                        <button className={styles.delPmBtn} onClick={() => deletePayMethod(pm.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.rightCol}>
            <div className={styles.section}>
              <h2><Image size={18} /> Shop Logo</h2>
              <div className={styles.uploadArea}>
                {shop?.logo_url ? <img src={shop.logo_url} alt="Logo" className={styles.logoPreview} /> : <div className={styles.uploadPlaceholder}><Image size={40} color="#4b5563" /><span>No logo</span></div>}
                <label className={styles.uploadBtn}>
                  <Upload size={14} /> {shop?.logo_url ? 'Update Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} style={{display:'none'}} />
                </label>
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
