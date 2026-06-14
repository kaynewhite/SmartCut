import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { User, Gift, AlertCircle, CreditCard, Upload, CheckCircle, Clock, FileText, MessageSquare, ShieldAlert, MapIcon, Lock, Camera, Scissors } from 'lucide-react';

const TAB_LIST = ['profile', 'loyalty', 'subscription', 'reports'];

export default function CustomerProfile() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [loyalty, setLoyalty] = useState({ total_points: 0, shops: [] });
  const [saving, setSaving] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState({ report_type: 'feedback', subject: '', message: '' });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const avatarInputRef = useRef();

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

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/customers/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAvatarUrl(res.data.avatar_url);
      updateUser({ ...user, avatar_url: res.data.avatar_url });
      toast.success('Avatar updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setAvatarUploading(false); }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error('New passwords do not match');
    if (pwForm.new_password.length < 6) return toast.error('New password must be at least 6 characters');
    setPwSaving(true);
    try {
      await api.put('/customers/me/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to change password'); }
    finally { setPwSaving(false); }
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
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 12px', cursor: 'pointer' }} onClick={() => avatarInputRef.current?.click()}>
            {avatarUrl || user?.avatar_url ? (
              <img src={avatarUrl || user?.avatar_url} alt="Avatar" style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4af37' }} />
            ) : (
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '2px solid #d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#d4af37', fontWeight: 700 }}>
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f1827' }}>
              {avatarUploading ? <span style={{ fontSize: 10, color: '#0f1422' }}>…</span> : <Camera size={11} color="#0f1422" />}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleAvatarUpload(e.target.files[0])} />
          </div>
          <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
          <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 20, color: '#d4af37', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Gift size={12} /> {loyalty.total_points} pts total
            </span>
            <span style={{ padding: '4px 12px', background: subBadge.bg, border: `1px solid ${subBadge.border}`, borderRadius: 20, color: subBadge.color, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {subBadge.icon} {subBadge.label}
            </span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

            <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
              <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={16} color="#d4af37" /> Change Password
              </h2>
              <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 18 }}>Leave these blank if you don't want to change your password.</p>
              <form onSubmit={handlePwChange}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Current Password</label>
                  <input type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>New Password</label>
                  <input type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} required minLength={6} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', color: '#8b92a9', fontSize: 13, marginBottom: 6 }}>Confirm New Password</label>
                  <input type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} required style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '11px 13px', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" disabled={pwSaving} style={{ width: '100%', padding: '12px', background: pwSaving ? '#374151' : '#1e2a3a', color: pwSaving ? '#8b92a9' : '#f0f0f0', border: '1px solid #2d3748', borderRadius: 8, fontWeight: 600, cursor: pwSaving ? 'not-allowed' : 'pointer', fontSize: 15 }}>
                  {pwSaving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === 'loyalty' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Total points summary */}
            <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gift size={26} color="#d4af37" />
              </div>
              <div>
                <div style={{ color: '#8b92a9', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Loyalty Points</div>
                <div style={{ color: '#d4af37', fontWeight: 800, fontSize: 32, lineHeight: 1 }}>{loyalty.total_points}</div>
                <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>across {loyalty.shops?.length || 0} barbershop{(loyalty.shops?.length || 0) !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* Per-shop loyalty breakdown */}
            <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
              <h3 style={{ color: '#f0f0f0', fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>Points by Shop</h3>
              <p style={{ color: '#8b92a9', fontSize: 12, marginBottom: 16, marginTop: 0 }}>Points are earned per barbershop. Visit a shop's page to redeem promos.</p>
              {!loyalty.shops?.length ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#8b92a9', fontSize: 13 }}>
                  <Scissors size={32} color="#374151" style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                  <div>No loyalty points yet.</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Complete appointments to start earning points.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {loyalty.shops.map((shop, i) => (
                    <div key={shop.barbershop_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#0a1020', borderRadius: 10, border: '1px solid #1e2a3a' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {shop.barbershop_logo ? (
                          <img src={shop.barbershop_logo} alt={shop.barbershop_name} style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }} />
                        ) : (
                          <Scissors size={18} color="#d4af37" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop.barbershop_name}</div>
                        <div style={{ color: '#8b92a9', fontSize: 11, marginTop: 2 }}>Last visit: {new Date(shop.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ color: '#d4af37', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{shop.points}</div>
                        <div style={{ color: '#8b92a9', fontSize: 11, marginTop: 2 }}>pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'subscription' && (
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 22 }}>
            <h2 style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Subscription</h2>
            <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapIcon size={14} color="#d4af37" /> Subscribe to unlock map view and discover barbershops near you.
            </p>

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
