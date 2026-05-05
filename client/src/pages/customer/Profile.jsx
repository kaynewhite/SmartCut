import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { User, Gift, AlertCircle, CreditCard, Upload, CheckCircle, Clock, FileText, MessageSquare } from 'lucide-react';

const TAB_LIST = ['profile', 'loyalty', 'subscription', 'reports'];

export default function CustomerProfile() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [loyalty, setLoyalty] = useState({ total_points: 0, history: [] });
  const [saving, setSaving] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState({ report_type: 'feedback', subject: '', message: '' });
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    api.get('/customers/me/loyalty').then(res => setLoyalty(res.data)).catch(() => {});
    api.get('/subscriptions/status').then(res => setSubStatus(res.data)).catch(() => {});
    api.get('/admin/qr').then(res => setAdminQr(res.data)).catch(() => {});
    api.get('/reports/mine').then(res => setReports(res.data)).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/customers/me', form);
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handleSubRequest = async (e) => {
    e.preventDefault();
    if (!proofFile) return toast.error('Please upload your payment proof');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('proof', proofFile);
      await api.post('/subscriptions/request', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Subscription request submitted! Admin will review and approve within 24 hours.');
      const res = await api.get('/subscriptions/status');
      setSubStatus(res.data);
      setProofFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit'); }
    finally { setUploading(false); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportForm.subject || !reportForm.message) return toast.error('Subject and message required');
    setSubmittingReport(true);
    try {
      await api.post('/reports', reportForm);
      toast.success('Report submitted!');
      setReportForm({ report_type: 'feedback', subject: '', message: '' });
      const res = await api.get('/reports/mine');
      setReports(res.data);
    } catch { toast.error('Failed to submit'); }
    finally { setSubmittingReport(false); }
  };

  const STATUS_BADGE = {
    active: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: '● Active' },
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: '⏳ Pending Review' },
    inactive: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: '✕ Inactive' },
  };

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#d4af37', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
          <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 20, color: '#d4af37', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Gift size={12} /> {loyalty.total_points} pts total
            </span>
            {user?.subscription_status === 'active' && (
              <span style={{ padding: '4px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 20, color: '#10b981', fontSize: 12 }}>● Subscribed</span>
            )}
            {user?.no_show_count > 0 && (
              <span style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 20, color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {user.no_show_count} no-shows
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          {TAB_LIST.map((t, i) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '11px 6px', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', border: 'none', borderRight: i < TAB_LIST.length - 1 ? '1px solid #1e2a3a' : 'none', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, fontSize: 13, textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 18 }}>Edit Profile</h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Full Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="09XX XXX XXXX" style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px', background: saving ? '#374151' : '#d4af37', color: saving ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 15 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {tab === 'loyalty' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, margin: 0 }}>Loyalty Points</h2>
              <span style={{ color: '#d4af37', fontWeight: 700, fontSize: 20 }}>{loyalty.total_points} pts</span>
            </div>
            <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>Points are earned per barbershop. Visit individual shop pages to redeem promos.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loyalty.history?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#8b92a9', fontSize: 13 }}>No loyalty transactions yet</div>
              ) : loyalty.history?.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#0a1020', borderRadius: 8 }}>
                  <div>
                    <div style={{ color: '#f0f0f0', fontSize: 13 }}>{t.description || 'Points earned'}</div>
                    <div style={{ color: '#8b92a9', fontSize: 11, marginTop: 2 }}>{t.barbershop_name && `at ${t.barbershop_name} · `}{new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ color: t.points > 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 15 }}>
                    {t.points > 0 ? '+' : ''}{t.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'subscription' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Subscription</h2>
            <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 18 }}>Subscribe to unlock map view and discover barbershops near you.</p>

            {subStatus?.is_active ? (
              <div style={{ padding: 18, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <CheckCircle size={20} color="#10b981" />
                  <div style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>Subscription Active</div>
                </div>
                <div style={{ color: '#8b92a9', fontSize: 13 }}>
                  {subStatus.subscription?.expires_at && `Expires: ${new Date(subStatus.subscription.expires_at).toLocaleDateString()}`}
                </div>
              </div>
            ) : (
              <>
                {subStatus?.subscription?.status === 'pending' && (
                  <div style={{ padding: 14, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 600 }}>
                      <Clock size={16} /> Payment Pending Review
                    </div>
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>Admin will approve your subscription shortly.</div>
                  </div>
                )}

                {adminQr && (
                  <div style={{ padding: 16, background: '#0a1020', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: 4 }}>Pay via {adminQr.type}</div>
                    {adminQr.account_name && <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>{adminQr.account_name}</div>}
                    <img src={adminQr.qr_url} alt="Payment QR" style={{ maxWidth: 200, width: '100%', margin: '0 auto', display: 'block', borderRadius: 8, border: '1px solid #1e2a3a', background: '#fff', padding: 4 }} />
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 10 }}>Scan, pay, then upload your receipt below</div>
                  </div>
                )}

                <form onSubmit={handleSubRequest}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: proofFile ? '#10b981' : '#8b92a9', fontSize: 13 }}>
                      <Upload size={16} />
                      {proofFile ? `✓ ${proofFile.name}` : 'Upload payment receipt / screenshot'}
                      <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <button type="submit" disabled={uploading || !proofFile || subStatus?.subscription?.status === 'pending'} style={{ width: '100%', padding: '12px', background: uploading || !proofFile || subStatus?.subscription?.status === 'pending' ? '#374151' : '#d4af37', color: uploading || !proofFile || subStatus?.subscription?.status === 'pending' ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
                    {uploading ? 'Submitting...' : subStatus?.subscription?.status === 'pending' ? 'Request Already Submitted' : 'Submit Subscription Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Submit Feedback / Report</h2>
              <form onSubmit={handleReport}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Type</label>
                  <select value={reportForm.report_type} onChange={e => setReportForm(p => ({ ...p, report_type: e.target.value }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13 }}>
                    {['feedback', 'complaint', 'bug', 'other'].map(t => <option key={t} value={t} style={{ background: '#0a1020', textTransform: 'capitalize' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Subject</label>
                  <input value={reportForm.subject} onChange={e => setReportForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief summary" required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Message</label>
                  <textarea value={reportForm.message} onChange={e => setReportForm(p => ({ ...p, message: e.target.value }))} rows={4} required placeholder="Describe your experience or issue in detail..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={submittingReport} style={{ width: '100%', padding: '12px', background: submittingReport ? '#374151' : '#d4af37', color: submittingReport ? '#8b92a9' : '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <MessageSquare size={14} /> {submittingReport ? 'Submitting...' : 'Submit'}
                </button>
              </form>
            </div>

            {reports.length > 0 && (
              <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
                <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 14 }}>My Reports</h2>
                {reports.map(r => (
                  <div key={r.id} style={{ padding: '12px', background: '#0a1020', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 13 }}>{r.subject}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: r.status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: r.status === 'open' ? '#ef4444' : '#10b981' }}>{r.status}</span>
                    </div>
                    <div style={{ color: '#8b92a9', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                    {r.admin_response && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(212,175,55,0.05)', borderLeft: '2px solid #d4af37', fontSize: 12, color: '#8b92a9' }}>
                        <strong style={{ color: '#d4af37' }}>Admin reply:</strong> {r.admin_response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
