import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Calendar, Clock, User, Scissors, Star, Home, ChevronDown, ChevronUp, Ban } from 'lucide-react';

const STATUS_META = {
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  no_show: { label: 'No-Show', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const TYPE_META = {
  online: { label: 'Online Booking', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  home_service: { label: 'Home Service', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  walk_in: { label: 'Walk-in', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

export default function BarberHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchHistory = async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await api.get('/appointments/shop/history', { params });
      setHistory(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [filter, dateFrom, dateTo]);

  const totalCompleted = history.filter(h => h.status === 'completed').length;
  const totalRevenue = history.filter(h => h.status === 'completed' && h.payment_status === 'paid').reduce((s, h) => s + parseFloat(h.service_price || h.total_amount || 0), 0);
  const avgRating = history.filter(h => h.barber_rating).length
    ? (history.filter(h => h.barber_rating).reduce((s, h) => s + h.barber_rating, 0) / history.filter(h => h.barber_rating).length).toFixed(1)
    : '—';

  return (
    <Layout>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, margin: 0 }}>My Service History</h1>
          <p style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>All your completed, cancelled, and no-show appointments</p>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Completed', value: totalCompleted, color: '#10b981' },
            { label: 'Revenue (paid)', value: `₱${totalRevenue.toFixed(0)}`, color: '#d4af37' },
            { label: 'Avg Rating', value: avgRating === '—' ? '—' : `${avgRating} ★`, color: '#f59e0b' },
            { label: 'Total Records', value: history.length, color: '#8b92a9' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ color: s.color, fontWeight: 700, fontSize: 20 }}>{s.value}</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { k: 'all', label: 'All' },
            { k: 'completed', label: 'Completed' },
            { k: 'cancelled', label: 'Cancelled' },
            { k: 'no_show', label: 'No-Show' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', borderColor: filter === f.k ? '#d4af37' : '#1e2a3a', background: filter === f.k ? 'rgba(212,175,55,0.1)' : 'transparent', color: filter === f.k ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 12 }}>{f.label}</button>
          ))}
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '6px 10px', background: '#0f1827', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 12 }} />
          <span style={{ color: '#6b7280', fontSize: 12 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '6px 10px', background: '#0f1827', border: '1px solid #1e2a3a', color: '#f0f0f0', borderRadius: 8, fontSize: 12 }} />
          {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>Clear dates</button>}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#8b92a9' }}>Loading history...</div> :
          history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>
              <Scissors size={44} color="#374151" style={{ marginBottom: 12 }} />
              <div style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 500 }}>No history found</div>
              <p style={{ marginTop: 6 }}>Your completed and past appointments will appear here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(h => {
                const isOpen = expanded === h.id;
                const sm = STATUS_META[h.status] || STATUS_META.completed;
                const tm = TYPE_META[h.appointment_type] || TYPE_META.online;
                return (
                  <div key={h.id} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }} onClick={() => setExpanded(isOpen ? null : h.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 15 }}>{h.customer_name}</div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: tm.bg, color: tm.color }}>{tm.label}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: sm.bg, color: sm.color }}>{sm.label}</span>
                          </div>
                        </div>
                        <div style={{ color: '#d4af37', fontSize: 13, fontWeight: 500, marginTop: 2 }}>{h.service_name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                          <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{new Date(h.appointment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          {h.appointment_time && <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{h.appointment_time?.substring(0, 5)}</span>}
                          {h.service_price && <span style={{ color: '#d4af37', fontSize: 13, fontWeight: 700 }}>₱{parseFloat(h.service_price).toFixed(0)}</span>}
                          {h.barber_rating && <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(h.barber_rating)}{'☆'.repeat(5 - h.barber_rating)}</span>}
                        </div>
                      </div>
                      <div style={{ color: '#4b5563', flexShrink: 0, marginTop: 2 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: '1px solid #1e2a3a', padding: '14px 18px', background: '#0a1020' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                          {[
                            ['Customer', h.customer_name],
                            ['Customer Rating', h.customer_rating ? `${parseFloat(h.customer_rating).toFixed(1)} ★` : '—'],
                            ['Service', h.service_name],
                            ['Category', h.service_category || '—'],
                            ['Price', h.service_price ? `₱${parseFloat(h.service_price).toFixed(0)}` : '—'],
                            ['Payment', h.payment_status || '—'],
                            ['Duration', h.duration_minutes ? `${h.duration_minutes} min` : '—'],
                            ['Type', tm.label],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{k}</div>
                              <div style={{ color: '#f0f0f0', fontSize: 13 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {h.home_address && (
                          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 13, color: '#8b92a9', display: 'flex', gap: 6 }}>
                            <Home size={13} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 2 }} />{h.home_address}
                          </div>
                        )}
                        {h.notes && (
                          <div style={{ marginBottom: 10, padding: '10px 12px', background: '#0f1827', borderRadius: 8, fontSize: 13, color: '#8b92a9' }}>
                            <span style={{ color: '#6b7280', fontSize: 11 }}>NOTES — </span>{h.notes}
                          </div>
                        )}
                        {h.review_comment && (
                          <div style={{ padding: '10px 12px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8 }}>
                            <div style={{ color: '#d4af37', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Customer Review</div>
                            {h.barber_rating && <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 4 }}>{'★'.repeat(h.barber_rating)}{'☆'.repeat(5 - h.barber_rating)}</div>}
                            <div style={{ color: '#8b92a9', fontSize: 12 }}>{h.review_comment}</div>
                          </div>
                        )}
                        {h.status === 'no_show' && (
                          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Ban size={13} color="#ef4444" />
                            <span style={{ color: '#ef4444', fontSize: 12 }}>Customer did not show up for this appointment.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </Layout>
  );
}
