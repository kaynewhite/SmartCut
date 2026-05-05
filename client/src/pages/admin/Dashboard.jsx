import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import { Store, Users, Calendar, Clock, FileText, TrendingUp, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, color = '#d4af37', sub }) => (
  <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: '20px 22px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ color: '#8b92a9', fontSize: 13 }}>{label}</span>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </div>
    </div>
    <div style={{ color: '#f0f0f0', fontSize: 28, fontWeight: 700 }}>{value}</div>
    {sub && <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [pendingSubs, setPendingSubs] = useState([]);
  const [openReports, setOpenReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [dashRes, subsRes, repsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/subscriptions', { params: { status: 'pending' } }),
        api.get('/admin/reports', { params: { status: 'open' } }),
      ]);
      setData(dashRes.data);
      setPendingSubs(subsRes.data.slice(0, 5));
      setOpenReports(repsRes.data.slice(0, 5));
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSub = async (id, action) => {
    try {
      await api.patch(`/admin/subscriptions/${id}`, { action });
      toast.success(action === 'approve' ? 'Subscription approved!' : 'Subscription rejected');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  if (loading) return <AdminLayout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading dashboard...</div></AdminLayout>;

  const { stats, recent_shops } = data || {};

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 24, fontWeight: 700, margin: 0 }}>Dashboard</h1>
          <p style={{ color: '#8b92a9', marginTop: 6 }}>Overview of SmartCut platform activity</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard icon={Store} label="Total Barbershops" value={stats?.total_barbershops || 0} />
          <StatCard icon={Users} label="Total Customers" value={stats?.total_customers || 0} color="#10b981" />
          <StatCard icon={Calendar} label="Today's Bookings" value={stats?.today_appointments || 0} color="#6366f1" />
          <StatCard icon={TrendingUp} label="Active Subscriptions" value={stats?.active_subscriptions || 0} color="#f59e0b" sub={`Shops: ${stats?.active_shop_subs || 0} · Customers: ${stats?.active_customer_subs || 0}`} />
          <StatCard icon={Clock} label="Pending Subs" value={stats?.pending_subscriptions || 0} color="#f97316" />
          <StatCard icon={FileText} label="Open Reports" value={stats?.open_reports || 0} color="#ef4444" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 16 }}>Pending Subscriptions</h3>
              <Link to="/admin/barbershops" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ChevronRight size={14} /></Link>
            </div>
            {pendingSubs.length === 0 ? (
              <div style={{ color: '#8b92a9', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No pending subscriptions</div>
            ) : pendingSubs.map(s => (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #1e2a3a', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{s.subscriber_name}</div>
                  <div style={{ color: '#8b92a9', fontSize: 12 }}>{s.subscriber_type} · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                {s.payment_proof_url && (
                  <a href={s.payment_proof_url} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: 12 }}>Proof</a>
                )}
                <button onClick={() => handleSub(s.id, 'approve')} style={{ padding: '5px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', color: '#10b981', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />Approve
                </button>
                <button onClick={() => handleSub(s.id, 'reject')} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                  <XCircle size={12} style={{ display: 'inline', marginRight: 4 }} />Reject
                </button>
              </div>
            ))}
          </div>

          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 16 }}>Open Reports</h3>
              <Link to="/admin/reports" style={{ color: '#d4af37', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ChevronRight size={14} /></Link>
            </div>
            {openReports.length === 0 ? (
              <div style={{ color: '#8b92a9', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No open reports</div>
            ) : openReports.map(r => (
              <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #1e2a3a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{r.subject}</span>
                  <span style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 4, fontSize: 11 }}>{r.report_type}</span>
                </div>
                <div style={{ color: '#8b92a9', fontSize: 12 }}>by {r.reporter_name} · {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20, marginTop: 20 }}>
          <h3 style={{ color: '#f0f0f0', margin: '0 0 16px', fontSize: 16 }}>Recently Registered Barbershops</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#8b92a9', textAlign: 'left' }}>
                  {['Name', 'City', 'Status', 'Appointments', 'Registered'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #1e2a3a', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recent_shops || []).map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #0a1020' }}>
                    <td style={{ padding: '10px', color: '#f0f0f0', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '10px', color: '#8b92a9' }}>{s.city || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: s.subscription_status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.subscription_status === 'active' ? '#10b981' : '#ef4444' }}>
                        {s.subscription_status || 'inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#8b92a9' }}>{s.total_appointments}</td>
                    <td style={{ padding: '10px', color: '#8b92a9' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
