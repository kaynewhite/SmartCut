import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload, QrCode, Plus } from 'lucide-react';

const QR_TYPES = ['GCash', 'Maya', 'BDO', 'BPI', 'Bank Transfer', 'Other'];

export default function AdminSettings() {
  const [qrs, setQrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'GCash', account_name: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/qr').then(res => { setQrs(res.data ? [res.data] : []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a QR code image');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('qr', file);
      fd.append('type', form.type);
      fd.append('account_name', form.account_name);
      const res = await api.post('/admin/qr', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setQrs([res.data]);
      setFile(null);
      setForm({ type: 'GCash', account_name: '' });
      toast.success('Payment QR uploaded! Users can now see this to pay for subscriptions.');
    } catch { toast.error('Upload failed'); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 700 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Admin Settings</h1>
        <p style={{ color: '#8b92a9', marginBottom: 28 }}>Manage subscription payment QR codes that barbershops and customers use to pay.</p>

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ color: '#f0f0f0', fontSize: 17, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={18} color="#d4af37" /> Subscription Payment QR Code
          </h2>
          <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 20 }}>
            Upload your GCash / Maya / bank QR code. Barbershops and customers will scan this to pay for their subscription, then upload proof for you to approve.
          </p>

          {qrs.length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, background: '#0a1020', borderRadius: 10, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <img src={qrs[0].qr_url} alt="Current QR" style={{ width: 120, height: 120, objectFit: 'contain', border: '1px solid #1e2a3a', borderRadius: 8, background: '#fff' }} />
              <div>
                <div style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: 4 }}>Active QR Code</div>
                <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 16 }}>{qrs[0].type}</div>
                {qrs[0].account_name && <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>{qrs[0].account_name}</div>}
                <div style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 4, fontSize: 11, marginTop: 8, display: 'inline-block' }}>● Active</div>
              </div>
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ color: '#8b92a9', fontSize: 13, display: 'block', marginBottom: 6 }}>Payment Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14 }}>
                  {QR_TYPES.map(t => <option key={t} value={t} style={{ background: '#0a1020' }}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#8b92a9', fontSize: 13, display: 'block', marginBottom: 6 }}>Account Name</label>
                <input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} placeholder="e.g. SmartCut Inc." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#8b92a9', fontSize: 13, display: 'block', marginBottom: 6 }}>QR Code Image</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: '#8b92a9', fontSize: 13 }}>
                <Upload size={16} />
                {file ? file.name : (qrs.length > 0 ? 'Upload new QR to replace current' : 'Click to upload QR code image')}
                <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              {file && <div style={{ marginTop: 8, fontSize: 12, color: '#10b981' }}>✓ Ready to upload: {file.name}</div>}
            </div>
            <button type="submit" disabled={saving || !file} style={{ padding: '12px 24px', background: saving || !file ? '#374151' : '#d4af37', color: saving || !file ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving || !file ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <Plus size={14} /> {saving ? 'Uploading...' : qrs.length > 0 ? 'Replace QR Code' : 'Upload QR Code'}
            </button>
          </form>
        </div>

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 24 }}>
          <h2 style={{ color: '#f0f0f0', fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Subscription Pricing</h2>
          <div style={{ color: '#8b92a9', fontSize: 13, lineHeight: 1.7 }}>
            <p>Subscription pricing is communicated to users via the QR code description. Currently configured pricing:</p>
            <div style={{ background: '#0a1020', borderRadius: 8, padding: 16, marginTop: 10 }}>
              <div style={{ color: '#f0f0f0', marginBottom: 6 }}>• <strong>Barbershop subscription</strong>: 30 days access, set your price as needed</div>
              <div style={{ color: '#f0f0f0' }}>• <strong>Customer subscription</strong>: 30 days map access</div>
            </div>
            <p style={{ marginTop: 10 }}>Update pricing by editing this text or integrating with your billing system in the future.</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
