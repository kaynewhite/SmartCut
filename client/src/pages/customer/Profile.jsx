import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { User, Gift, AlertCircle, CreditCard, Upload, CheckCircle, Clock, FileText, MessageSquare, ShieldAlert, MapIcon } from 'lucide-react';

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

  // Determine subscription display
  const subState = subStatus?.is_active ? 'active'
    : subStatus?.subscription?.status === 'pending' ? 'pending'
    : user?.subscription_status === 'restricted' ? 'restricted'
    : 'inactive';

  const SUB_BADGE = {
    active:     { bg: 'rgba(16,185,129,0.12)', border: '#10b981', color: '#10b981', icon: <CheckCircle size={13} />, label: 'Active Subscriber' },
    pending:    { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', color: '#f59e0b', icon: <Clock size={13} />, label: 'Pending Approval' },
    restricted: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', color: '#ef4444', icon: <ShieldAlert size={13} />, label: 'Account Restricted' },
    inactive:   { bg: 'rgba(107,114,128,0.1)', border: '#374151', color: '#6b7280', icon: <CreditCard size={13} />, label: 'Not Subscribed' },
  };
  const subBadge = SUB_BADGE[subState];

  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {/* Profile header */}
        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 24, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28, color: '#d4af37', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
          <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            {/* Loyalty points */}
            <span style={{ padding: '4px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 20, color: '#d4af37', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Gift size={12} /> {loyalty.total_points} pts total
            </span>
            {/* Subscription status badge */}
            <span style={{ padding: '4px 12px', background: subBadge.bg, border: `1px solid ${subBadge.border}`, borderRadius: 20, color: subBadge.color, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {subBadge.icon} {subBadge.label}
            </span>
            {/* No-show badge */}
            {user?.no_show_count > 0 && (
              <span style={{ padding: '4px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 20, color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {user.no_show_count} no-shows
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
          {TAB_LIST.map((t, i) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '11px 6px', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', border: 'none', borderRight: i < TAB_LIST.length - 1 ? '1px solid #1e2a3a' : 'none', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontWeight: tab === t ? 600 : 400, fontSize: 13, textTransform: 'capitalize' }}>
              {t}
              {t === 'subscription' && subState !== 'active' && subState !== 'inactive' && (
                <span style={{ marginLeft: 4, width: 7, height: 7, borderRadius: '50%', background: subState === 'pending' ? '#f59e0b' : '#ef4444', display: 'inline-block', verticalAlign: 'middle' }} />
              )}
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
              {!loyalty.history?.length ? (
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
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Subscription</h2>
            <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapIcon size={14} color="#d4af37" /> Subscribe to unlock map view and discover barbershops near you.
            </p>

            {/* Status Card */}
            <div style={{ padding: '14px 18px', background: subBadge.bg, border: `1px solid ${subBadge.border}`, borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>
                {subState === 'active' ? '✅' : subState === 'pending' ? '⏳' : subState === 'restricted' ? '⛔' : '🔒'}
              </div>
              <div>
                <div style={{ color: subBadge.color, fontWeight: 700, fontSize: 15 }}>
                  {subState === 'active' ? 'Subscription Active' : subState === 'pending' ? 'Payment Under Review' : subState === 'restricted' ? 'Account Restricted' : 'Not Subscribed'}
                </div>
                <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 2 }}>
                  {subState === 'active' && subStatus?.subscription?.expires_at && `Expires: ${new Date(subStatus.subscription.expires_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                  {subState === 'pending' && 'Your payment proof has been submitted. Admin will verify within 24 hours.'}
                  {subState === 'restricted' && 'Your account has been restricted. Please contact support.'}
                  {subState === 'inactive' && 'Subscribe below to get full access to SmartCut features.'}
                </div>
              </div>
            </div>

            {(subState === 'inactive') && (
              <>
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
                  <button type="submit" disabled={uploading || !proofFile} style={{ width: '100%', padding: '12px', background: proofFile ? '#d4af37' : '#374151', color: proofFile ? '#0f1422' : '#6b7280', border: 'none', borderRadius: 8, fontWeight: 700, cursor: proofFile ? 'pointer' : 'not-allowed', fontSize: 15 }}>
                    {uploading ? 'Submitting...' : 'Submit Subscription Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Submit Feedback / Report</h2>
              <form onSubmit={handleReport}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 12, marginBottom: 6 }}>Type</label>
                  <select value={reportForm.report_type} onChange={e => setReportForm(p => ({ ...p, report_type: e.target.value }))} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    {['feedback', 'complaint', 'bug', 'other'].map(t => <option key={t} value={t} style={{ background: '#1a2234' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 12, marginBottom: 6 }}>Subject</label>
                  <input value={reportForm.subject} onChange={e => setReportForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief summary" required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 12, marginBottom: 6 }}>Message</label>
                  <textarea value={reportForm.message} onChange={e => setReportForm(p => ({ ...p, message: e.target.value }))} rows={3} required placeholder="Describe your feedback or issue..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={submittingReport} style={{ width: '100%', padding: '12px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: submittingReport ? 'not-allowed' : 'pointer', fontSize: 15 }}>
                  {submittingReport ? 'Submitting...' : 'Submit'}
                </button>
              </form>
            </div>
            {reports.length > 0 && (
              <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
                <h3 style={{ color: '#f0f0f0', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>My Reports</h3>
                {reports.map(r => (
                  <div key={r.id} style={{ padding: '12px 14px', background: '#0a1020', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 13 }}>{r.subject}</div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: r.status === 'open' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: r.status === 'open' ? '#f59e0b' : '#10b981' }}>{r.status}</span>
                    </div>
                    <div style={{ color: '#8b92a9', fontSize: 12 }}>{r.message}</div>
                    {r.admin_response && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6 }}>
                        <div style={{ color: '#d4af37', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Admin Response</div>
                        <div style={{ color: '#8b92a9', fontSize: 12 }}>{r.admin_response}</div>
                      </div>
                    )}
                    <div style={{ color: '#374151', fontSize: 11, marginTop: 6 }}>{new Date(r.created_at).toLocaleDateString()}</div>
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
