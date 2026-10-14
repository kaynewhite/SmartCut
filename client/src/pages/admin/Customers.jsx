import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import { formatDate, formatDateTime, formatTime } from '../../utils/time';
import toast from 'react-hot-toast';
import { Search, ShieldOff, ShieldCheck, Trash2, CheckCircle, XCircle, Star, Eye, X } from 'lucide-react';
import { DetailsEmpty, DetailsGrid, DetailsSection, detailRecordStyle } from './DetailsView';

const TABS = ['all', 'pending', 'active', 'restricted'];

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchAll = async () => {
    try {
      const [custRes, subsRes] = await Promise.all([
        api.get('/admin/customers'),
        api.get('/admin/subscriptions', { params: { type: 'customer' } }),
      ]);
      setCustomers(custRes.data);
      setSubs(subsRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleSub = async (id, action) => {
    try {
      await api.patch(`/admin/subscriptions/${id}`, { action, admin_note: adminNote });
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected');
      setSelectedSub(null);
      setAdminNote('');
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const restrictCustomer = async (id) => {
    try {
      const res = await api.patch(`/admin/customers/${id}/restrict`);
      toast.success(`${res.data.name} is now ${res.data.subscription_status}`);
      fetchAll();
    } catch { toast.error('Failed'); }
  };

  const deleteCustomer = async (id) => {
    try {
      const res = await api.delete(`/admin/customers/${id}`);
      toast.success(`${res.data.name} deleted`);
      setConfirmDelete(null);
      fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  const viewCustomerDetails = async (id) => {
    setDetailsLoading(true);
    setCustomerDetails(null);
    try {
      const res = await api.get(`/admin/customers/${id}/details`);
      setCustomerDetails(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load customer details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const pendingCount = subs.filter(s => s.status === 'pending').length;

  const filtered = customers.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
    if (!matchSearch) return false;
    if (tab === 'all') return true;
    if (tab === 'pending') return true;
    if (tab === 'active') return c.subscription_status === 'active';
    if (tab === 'restricted') return c.subscription_status === 'restricted';
    return true;
  });

  const subColor = (status) => {
    if (status === 'active') return { bg: 'rgba(16,185,129,0.1)', color: '#10b981' };
    if (status === 'restricted') return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' };
    return { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' };
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Customer Management</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: tab === t ? '#d4af37' : '#1e2a3a', background: tab === t ? 'rgba(212,175,55,0.1)' : 'transparent', color: tab === t ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {t} {t === 'pending' && pendingCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{pendingCount}</span>}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 8, padding: '8px 12px' }}>
            <Search size={15} color="#8b92a9" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone..." style={{ background: 'none', border: 'none', color: '#f0f0f0', outline: 'none', fontSize: 13, width: 200 }} />
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
                    <div style={{ color: '#8b92a9', fontSize: 13 }}>{s.subscriber_email}</div>
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>Submitted: {formatDateTime(s.created_at)}</div>
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
                  {['Name', 'Email', 'Phone', 'Subscription', 'No-shows', 'Rating', 'Bookings', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #1e2a3a', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ color: '#8b92a9', textAlign: 'center', padding: 30 }}>No customers found</td></tr>
                ) : filtered.map(c => {
                  const sc = subColor(c.subscription_status);
                  const isRestricted = c.subscription_status === 'restricted';
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #0a1020' }}>
                      <td style={{ padding: '12px 10px', color: '#f0f0f0', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '12px 10px', color: '#8b92a9', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</td>
                      <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, background: sc.bg, color: sc.color }}>
                          {c.subscription_status || 'inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: c.no_show_count > 2 ? '#ef4444' : '#8b92a9' }}>{c.no_show_count || 0}</td>
                      <td style={{ padding: '12px 10px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={11} fill="#f59e0b" color="#f59e0b" />{parseFloat(c.rating || 5).toFixed(1)}
                      </td>
                      <td style={{ padding: '12px 10px', color: '#8b92a9' }}>{c.total_appointments}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => viewCustomerDetails(c.id)} title="View full customer details" style={{ padding: '5px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={12} /> Details
                          </button>
                          <button onClick={() => restrictCustomer(c.id)} title={isRestricted ? 'Unrestrict' : 'Restrict'} style={{ padding: '5px 10px', background: isRestricted ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isRestricted ? '#10b981' : '#ef4444'}`, color: isRestricted ? '#10b981' : '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isRestricted ? <><ShieldCheck size={12} /> Unrestrict</> : <><ShieldOff size={12} /> Restrict</>}
                          </button>
                          <button onClick={() => setConfirmDelete(c)} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
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

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0f1827', border: '1px solid #ef4444', borderRadius: 14, padding: 28, maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Trash2 size={22} color="#ef4444" />
              <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>Delete Customer</h3>
            </div>
            <p style={{ color: '#8b92a9', marginBottom: 6 }}>You are about to permanently delete:</p>
            <p style={{ color: '#f0f0f0', fontWeight: 700, marginBottom: 20 }}>{confirmDelete.name} ({confirmDelete.email})</p>
            <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 20 }}>⚠ This will delete all customer data and appointment history. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => deleteCustomer(confirmDelete.id)} style={{ flex: 1, padding: 12, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete Permanently</button>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 12, background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {(detailsLoading || customerDetails) && (
        <div onClick={() => { setCustomerDetails(null); setDetailsLoading(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 22, maxWidth: 800, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <h2 style={{ color: '#f0f0f0', fontSize: 18, margin: 0 }}>{customerDetails?.profile?.name || 'Customer Details'}</h2>
              <button onClick={() => { setCustomerDetails(null); setDetailsLoading(false); }} aria-label="Close details" style={{ background: 'none', border: 0, color: '#8b92a9', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            {detailsLoading && <div style={{ color: '#8b92a9', padding: 24, textAlign: 'center' }}>Loading customer details...</div>}
            {customerDetails && (
              <>
                <DetailsSection title="Profile">
                  <DetailsGrid items={[
                    ['Customer ID', customerDetails.profile.id],
                    ['Email', customerDetails.profile.email],
                    ['Phone', customerDetails.profile.phone],
                    ['Account created', formatDateTime(customerDetails.profile.created_at)],
                    ['Subscription status', customerDetails.profile.subscription_status],
                    ['Loyalty points', customerDetails.profile.loyalty_points],
                    ['Rating', Number(customerDetails.profile.rating || 0).toFixed(1)],
                    ['No-show count', customerDetails.profile.no_show_count],
                  ]} />
                  {customerDetails.profile.avatar_url && <a href={customerDetails.profile.avatar_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#60a5fa', fontSize: 12 }}>View customer avatar</a>}
                </DetailsSection>
                <DetailsSection title={`Subscription History (${customerDetails.subscriptions.length})`}>
                  {customerDetails.subscriptions.length ? customerDetails.subscriptions.map(sub => (
                    <div key={sub.id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Status', sub.status],
                        ['Submitted', formatDateTime(sub.created_at)],
                        ['Expires', sub.expires_at ? formatDateTime(sub.expires_at) : '—'],
                        ['Admin note', sub.admin_note],
                      ]} />
                      {sub.payment_proof_url && <a href={sub.payment_proof_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#60a5fa', fontSize: 12 }}>View payment proof</a>}
                    </div>
                  )) : <DetailsEmpty />}
                </DetailsSection>
                <DetailsSection title={`Bookings (${customerDetails.appointments.length})`}>
                  {customerDetails.appointments.length ? customerDetails.appointments.map(appt => (
                    <div key={appt.id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Booking', `#${appt.id} · Queue ${appt.queue_number ?? '—'}`],
                        ['Date & time', `${formatDate(appt.appointment_date)} · ${formatTime(appt.appointment_time)}`],
                        ['Barbershop', appt.barbershop_name],
                        ['Barber', appt.barber_name],
                        ['Service', appt.service_name],
                        ['Status', appt.status],
                        ['Payment', `${appt.payment_status} · ₱${Number(appt.total_amount || 0).toLocaleString()}`],
                        ['Home service', appt.is_home_service ? appt.home_address || 'Yes' : 'No'],
                        ['Notes', appt.notes],
                        ['Booked at', formatDateTime(appt.created_at)],
                      ]} />
                      {appt.payment_proof_url && <a href={appt.payment_proof_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#60a5fa', fontSize: 12 }}>View payment proof</a>}
                    </div>
                  )) : <DetailsEmpty>No bookings found.</DetailsEmpty>}
                </DetailsSection>
                <DetailsSection title={`Loyalty Transactions (${customerDetails.loyalty_transactions.length})`}>
                  {customerDetails.loyalty_transactions.length ? customerDetails.loyalty_transactions.map(tx => (
                    <div key={tx.id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Barbershop', tx.barbershop_name],
                        ['Type', tx.type],
                        ['Points', tx.points],
                        ['Description', tx.description],
                        ['Date', formatDateTime(tx.created_at)],
                      ]} />
                    </div>
                  )) : <DetailsEmpty>No loyalty transactions found.</DetailsEmpty>}
                </DetailsSection>
                <DetailsSection title={`Loyalty Balances (${customerDetails.loyalty_balances.length})`}>
                  {customerDetails.loyalty_balances.length ? customerDetails.loyalty_balances.map(balance => (
                    <div key={balance.barbershop_id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Barbershop', balance.barbershop_name],
                        ['Points balance', balance.points],
                        ['Last updated', formatDateTime(balance.updated_at)],
                      ]} />
                    </div>
                  )) : <DetailsEmpty>No shop loyalty balances found.</DetailsEmpty>}
                </DetailsSection>
                <DetailsSection title={`Promo Redemptions (${customerDetails.promo_redemptions.length})`}>
                  {customerDetails.promo_redemptions.length ? customerDetails.promo_redemptions.map(redemption => (
                    <div key={redemption.id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Promo', redemption.promo_name],
                        ['Barbershop', redemption.barbershop_name],
                        ['Status', redemption.status],
                        ['Points spent', redemption.points_spent],
                        ['Promo value', `₱${Number(redemption.promo_value || 0).toLocaleString()}`],
                        ['Redemption code', redemption.redemption_code],
                        ['Appointment ID', redemption.appointment_id],
                        ['Redeemed', formatDateTime(redemption.created_at)],
                      ]} />
                    </div>
                  )) : <DetailsEmpty>No promo redemptions found.</DetailsEmpty>}
                </DetailsSection>
                <DetailsSection title={`Shop Bans (${customerDetails.bans.length})`}>
                  {customerDetails.bans.length ? customerDetails.bans.map(ban => (
                    <div key={ban.id} style={detailRecordStyle}>
                      <DetailsGrid items={[
                        ['Barbershop', ban.barbershop_name],
                        ['Reason', ban.reason],
                        ['Banned until', ban.banned_until ? formatDateTime(ban.banned_until) : 'Indefinite'],
                        ['Created', formatDateTime(ban.created_at)],
                      ]} />
                    </div>
                  )) : <DetailsEmpty>No shop bans found.</DetailsEmpty>}
                </DetailsSection>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
