import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, Trash2, ShieldOff, ShieldCheck, AlertTriangle, MessageSquare } from 'lucide-react';

const TABS = ['all', 'pending', 'active', 'restricted', 'appeals'];

export default function AdminBarbershops() {
  const [shops, setShops] = useState([]);
  const [subs, setSubs] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [restrictModal, setRestrictModal] = useState(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [restrictReqs, setRestrictReqs] = useState('');
  const [appealModal, setAppealModal] = useState(null);
  const [appealNote, setAppealNote] = useState('');

  const fetchAll = async () => {
    try {
      const [shopsRes, subsRes] = await Promise.all([
        api.get('/admin/barbershops'),
        api.get('/admin/subscriptions', { params: { type: 'barbershop' } }),
      ]);
      setShops(shopsRes.data);
      setSubs(subsRes.data);
      setAppeals(shopsRes.data.filter(s => s.appeal_status === 'pending'));
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleSub = async (id, action) => {
    try {
      await api.patch(`/admin/subscriptions/${id}`, { action, admin_note: adminNote });
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected');
      setSelectedSub(null); setAdminNote(''); fetchAll();
    } catch { toast.error('Failed'); }
  };

  const handleRestrict = async () => {
    if (!restrictModal) return;
    if (restrictModal.is_active && !restrictReason.trim()) {
      return toast.error('Please provide a reason for restricting this shop');
    }
    try {
      const res = await api.patch(`/admin/barbershops/${restrictModal.id}/restrict`, {
        reason: restrictReason, requirements: restrictReqs
      });
      toast.success(res.data.is_active ? `${res.data.name} restriction lifted` : `${res.data.name} has been restricted`);
      setRestrictModal(null); setRestrictReason(''); setRestrictReqs(''); fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleAppeal = async (shopId, action) => {
    try {
      await api.patch(`/admin/barbershops/${shopId}/appeal`, { action, admin_note: appealNote });
      toast.success(action === 'approve' ? 'Appeal approved — shop unrestricted' : 'Appeal rejected');
      setAppealModal(null); setAppealNote(''); fetchAll();
    } catch { toast.error('Failed'); }
  };

  const deleteShop = async (id) => {
    try {
      const res = await api.delete(`/admin/barbershops/${id}`);
      toast.success(`${res.data.name} permanently deleted`);
      setConfirmDelete(null); fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  const pendingCount = subs.filter(s => s.status === 'pending').length;
  const appealCount = appeals.length;

  const filteredShops = shops.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (tab === 'all') return true;
    if (tab === 'active') return s.is_active && s.subscription_status === 'active';
    if (tab === 'restricted') return !s.is_active;
    if (tab === 'appeals') return s.appeal_status === 'pending';
    return true;
  });

  const subColor = (s) => {
    if (s.subscription_status === 'active' && s.is_active) return { bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
    if (!s.is_active) return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    return { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' };
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Barbershop Management</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: tab === t ? '#d4af37' : '#1e2a3a', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {t === 'appeals' ? 'Appeals' : t}
              {t === 'pending' && pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{pendingCount}</span>}
              {t === 'appeals' && appealCount > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{appealCount}</span>}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 8, padding: '8px 12px' }}>
            <Search size={15} color="#8b92a9" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: 'none', border: 'none', color: '#f0f0f0', outline: 'none', fontSize: 13, width: 180 }} />
          </div>
        </div>

        {tab === 'pending' ? (
          <div>
            <h3 style={{ color: '#f0f0f0', marginBottom: 14 }}>Pending Subscription Requests</h3>
            {loading ? <div style={{ color: '#8b92a9' }}>Loading...</div> : subs.filter(s => s.status === 'pending').length === 0 ? (
              <div style={{ color: '#8b92a9', textAlign: 'center', padding: 40 }}>No pending requests</div>
            ) : subs.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16 }}>{s.subscriber_name}</div>
                    <div style={{ color: '#8b92a9', fontSize: 13 }}>{s.subscriber_email}</div>
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>Submitted: {new Date(s.created_at).toLocaleString()}</div>
                  </div>
                  {s.payment_proof_url && <a href={s.payment_proof_url} target="_blank" rel="noreferrer"><img src={s.payment_proof_url} alt="proof" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e2a3a' }} /></a>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                    <textarea value={selectedSub === s.id ? adminNote : ''} onChange={e => { setSelectedSub(s.id); setAdminNote(e.target.value); }} placeholder="Admin note (optional)" rows={2} style={{ background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '8px 10px', borderRadius: 6, fontSize: 12, resize: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleSub(s.id, 'approve')} style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><CheckCircle size={14} /> Approve</button>
                      <button onClick={() => handleSub(s.id, 'reject')} style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><XCircle size={14} /> Reject</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'appeals' ? (
          <div>
            <h3 style={{ color: '#f0f0f0', marginBottom: 14 }}>Pending Appeals</h3>
            {appeals.length === 0 ? <div style={{ color: '#8b92a9', textAlign: 'center', padding: 40 }}>No pending appeals</div> :
              appeals.map(s => (
                <div key={s.id} style={{ background: '#0f1827', border: '1px solid #f59e0b', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                      <div style={{ color: '#8b92a9', fontSize: 13 }}>{s.email}</div>
                      <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                        <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Restriction Reason</div>
                        <div style={{ color: '#f0f0f0', fontSize: 13 }}>{s.restriction_reason}</div>
                        {s.restriction_requirements && <><div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 4, marginTop: 8 }}>Requirements</div><div style={{ color: '#f0f0f0', fontSize: 13 }}>{s.restriction_requirements}</div></>}
                      </div>
                      <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                        <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Shop's Appeal</div>
                        <div style={{ color: '#f0f0f0', fontSize: 13 }}>{s.appeal_text}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                      <textarea value={appealModal === s.id ? appealNote : ''} onChange={e => { setAppealModal(s.id); setAppealNote(e.target.value); }} placeholder="Admin note to shop (optional)" rows={2} style={{ background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '8px 10px', borderRadius: 6, fontSize: 12, resize: 'none' }} />
                      <button onClick={() => handleAppeal(s.id, 'approve')} style={{ padding: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><CheckCircle size={14} /> Approve Appeal</button>
                      <button onClick={() => handleAppeal(s.id, 'reject')} style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><XCircle size={14} /> Reject Appeal</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#8b92a9' }}>
                  {['Name', 'City', 'Status', 'Barbers', 'Appointments', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #1e2a3a', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>Loading...</td></tr> :
                  filteredShops.length === 0 ? <tr><td colSpan={6} style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>No barbershops found</td></tr> :
                  filteredShops.map(s => {
                    const sc = subColor(s);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #0a1020' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ color: '#f0f0f0', fontWeight: 600 }}>{s.name}</div>
                          {!s.is_active && <div style={{ fontSize: 10, color: '#ef4444' }}>RESTRICTED{s.appeal_status === 'pending' ? ' · APPEAL PENDING' : ''}</div>}
                        </td>
                        <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.city || '—'}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, background: sc.bg, color: sc.color }}>
                            {!s.is_active ? 'Restricted' : s.subscription_status || 'none'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.total_barbers}</td>
                        <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.total_appointments}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => { setRestrictModal(s); setRestrictReason(s.restriction_reason || ''); setRestrictReqs(s.restriction_requirements || ''); }}
                              style={{ padding: '5px 10px', background: s.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${s.is_active ? '#ef4444' : '#10b981'}`, color: s.is_active ? '#ef4444' : '#10b981', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {s.is_active ? <><ShieldOff size={12} /> Restrict</> : <><ShieldCheck size={12} /> Lift</>}
                            </button>
                            <button onClick={() => setConfirmDelete(s)} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restrict Modal */}
      {restrictModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 28, maxWidth: 460, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              {restrictModal.is_active ? <ShieldOff size={22} color="#ef4444" /> : <ShieldCheck size={22} color="#10b981" />}
              <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>
                {restrictModal.is_active ? `Restrict ${restrictModal.name}` : `Lift Restriction on ${restrictModal.name}`}
              </h3>
            </div>
            {restrictModal.is_active ? (
              <>
                <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>
                  This will immediately hide the shop from all customers and prevent new bookings. The owner will be notified and may submit an appeal.
                </p>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 6 }}>Reason for restriction <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea value={restrictReason} onChange={e => setRestrictReason(e.target.value)} rows={3} placeholder="e.g. Multiple customer complaints, policy violations, etc." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 6 }}>Requirements to lift restriction <span style={{ color: '#6b7280' }}>(optional)</span></label>
                  <textarea value={restrictReqs} onChange={e => setRestrictReqs(e.target.value)} rows={2} placeholder="e.g. Resolve pending customer complaints, submit updated business documents..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleRestrict} style={{ flex: 1, padding: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Restrict Shop</button>
                  <button onClick={() => setRestrictModal(null)} style={{ flex: 1, padding: 12, background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>This will lift the restriction and make the shop visible to customers again.</p>
                {restrictModal.restriction_reason && (
                  <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(239,68,68,0.07)', borderRadius: 8, fontSize: 13, color: '#8b92a9' }}>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>Original reason: </span>{restrictModal.restriction_reason}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleRestrict} style={{ flex: 1, padding: 12, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Lift Restriction</button>
                  <button onClick={() => setRestrictModal(null)} style={{ flex: 1, padding: 12, background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0f1827', border: '1px solid #ef4444', borderRadius: 14, padding: 28, maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={22} color="#ef4444" />
              <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>Delete Barbershop</h3>
            </div>
            <p style={{ color: '#8b92a9', marginBottom: 6 }}>Permanently deleting:</p>
            <p style={{ color: '#f0f0f0', fontWeight: 700, marginBottom: 16 }}>{confirmDelete.name}</p>
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: '#ef4444' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ This will permanently delete:</div>
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                <li>All {confirmDelete.total_barbers} barber account(s) under this shop</li>
                <li>All services, appointments, and queue records</li>
                <li>All loyalty points and promo redemptions</li>
                <li>All ratings and reviews</li>
              </ul>
              <div style={{ marginTop: 8, color: '#8b92a9' }}>Customer accounts are preserved. This action cannot be undone.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteShop(confirmDelete.id)} style={{ flex: 1, padding: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete Permanently</button>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 12, background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
