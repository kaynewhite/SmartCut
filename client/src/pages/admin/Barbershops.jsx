import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, ToggleLeft, ToggleRight, Eye } from 'lucide-react';

const TABS = ['all', 'pending', 'active', 'inactive'];

export default function AdminBarbershops() {
  const [shops, setShops] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);

  const fetchAll = async () => {
    try {
      const [shopsRes, subsRes] = await Promise.all([
        api.get('/admin/barbershops'),
        api.get('/admin/subscriptions', { params: { status: tab === 'pending' ? 'pending' : undefined } }),
      ]);
      setShops(shopsRes.data);
      setSubs(subsRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, [tab]);

  const handleSub = async (id, action) => {
    try {
      await api.patch(`/admin/subscriptions/${id}`, { action, admin_note: adminNote });
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected');
      setSelectedSub(null);
      setAdminNote('');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const toggleShop = async (id) => {
    try {
      const res = await api.patch(`/admin/barbershops/${id}/toggle`);
      toast.success(`${res.data.name} is now ${res.data.is_active ? 'active' : 'inactive'}`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const filteredShops = shops.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.city || '').toLowerCase().includes(search.toLowerCase()))
    && (tab === 'all' || tab === 'pending' || (tab === 'active' ? s.subscription_status === 'active' : s.subscription_status !== 'active'))
  );

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Barbershop Management</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: tab === t ? '#d4af37' : '#1e2a3a', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {t} {t === 'pending' && subs.filter(s => s.status === 'pending').length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{subs.filter(s => s.status === 'pending').length}</span>}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 8, padding: '8px 12px' }}>
            <Search size={15} color="#8b92a9" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shops..." style={{ background: 'none', border: 'none', color: '#f0f0f0', outline: 'none', fontSize: 13, width: 160 }} />
          </div>
        </div>

        {tab === 'pending' ? (
          <div>
            <h3 style={{ color: '#f0f0f0', marginBottom: 14 }}>Pending Subscription Requests</h3>
            {loading ? <div style={{ color: '#8b92a9' }}>Loading...</div> : subs.filter(s => s.status === 'pending').length === 0 ? (
              <div style={{ color: '#8b92a9', textAlign: 'center', padding: 40 }}>No pending subscription requests</div>
            ) : subs.filter(s => s.status === 'pending').map(s => (
              <div key={s.id} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 18, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16 }}>{s.subscriber_name}</div>
                    <div style={{ color: '#8b92a9', fontSize: 13 }}>{s.subscriber_email} · {s.subscriber_type}</div>
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>Submitted: {new Date(s.created_at).toLocaleString()}</div>
                  </div>
                  {s.payment_proof_url && (
                    <a href={s.payment_proof_url} target="_blank" rel="noreferrer">
                      <img src={s.payment_proof_url} alt="Payment proof" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #1e2a3a' }} />
                    </a>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                    <textarea value={selectedSub === s.id ? adminNote : ''} onChange={e => { setSelectedSub(s.id); setAdminNote(e.target.value); }} placeholder="Admin note (optional)..." rows={2} style={{ background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '8px 10px', borderRadius: 6, fontSize: 12, resize: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setSelectedSub(s.id); handleSub(s.id, 'approve'); }} style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button onClick={() => { setSelectedSub(s.id); handleSub(s.id, 'reject'); }} style={{ flex: 1, padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
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
                  {['Name', 'City', 'Email', 'Subscription', 'Barbers', 'Appointments', 'Active', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #1e2a3a', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>Loading...</td></tr>
                ) : filteredShops.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #0a1020' }}>
                    <td style={{ padding: '12px 10px', color: '#f0f0f0', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.city || '—'}</td>
                    <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.email}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, background: s.subscription_status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.subscription_status === 'active' ? '#10b981' : '#ef4444' }}>
                        {s.subscription_status || 'none'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.total_barbers}</td>
                    <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{s.total_appointments}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <button onClick={() => toggleShop(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {s.is_active ? <ToggleRight size={22} color="#10b981" /> : <ToggleLeft size={22} color="#6b7280" />}
                      </button>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <a href={`/customer/barbershop/${s.id}`} target="_blank" rel="noreferrer" style={{ color: '#d4af37', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={13} /> View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredShops.length === 0 && <div style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>No barbershops found</div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
