import { useState, useEffect } from 'react';
import AdminLayout from './Layout';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { CheckCircle, MessageSquare } from 'lucide-react';

const STATUS_COLORS = { open: '#ef4444', reviewed: '#f59e0b', resolved: '#10b981', closed: '#6b7280' };
const TYPE_COLORS = { bug: '#6366f1', feedback: '#10b981', complaint: '#ef4444', other: '#8b92a9' };

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState('');
  const [newStatus, setNewStatus] = useState('reviewed');
  const [saving, setSaving] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await api.get('/admin/reports', { params: filter !== 'all' ? { status: filter } : {} });
      setReports(res.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); fetchReports(); }, [filter]);

  const handleRespond = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/admin/reports/${selected.id}`, { status: newStatus, admin_response: response });
      toast.success('Response sent!');
      setSelected(null);
      setResponse('');
      fetchReports();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1000 }}>
        <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Reports & Feedback</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['open', 'reviewed', 'resolved', 'all'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: filter === s ? '#d4af37' : '#1e2a3a', background: filter === s ? 'rgba(212,175,55,0.1)' : 'transparent', color: filter === s ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>

        {loading ? <div style={{ color: '#8b92a9', textAlign: 'center', padding: 40 }}>Loading...</div> :
          reports.length === 0 ? <div style={{ color: '#8b92a9', textAlign: 'center', padding: 40 }}>No reports found</div> :
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => (
                <div key={r.id} onClick={() => { setSelected(r); setResponse(r.admin_response || ''); setNewStatus(r.status); }}
                  style={{ background: selected?.id === r.id ? 'rgba(212,175,55,0.05)' : '#0f1827', border: `1px solid ${selected?.id === r.id ? '#d4af37' : '#1e2a3a'}`, borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'all .15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 14 }}>{r.subject}</div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${TYPE_COLORS[r.report_type] || '#6b7280'}18`, color: TYPE_COLORS[r.report_type] || '#6b7280' }}>{r.report_type}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${STATUS_COLORS[r.status] || '#6b7280'}18`, color: STATUS_COLORS[r.status] || '#6b7280' }}>{r.status}</span>
                    </div>
                  </div>
                  <div style={{ color: '#8b92a9', fontSize: 12 }}>
                    by {r.reporter_name || 'Unknown'} ({r.reporter_type}) · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{r.message?.substring(0, 100)}{r.message?.length > 100 ? '...' : ''}</div>
                  {r.admin_response && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(212,175,55,0.05)', borderLeft: '2px solid #d4af37', fontSize: 12, color: '#8b92a9' }}>
                      <strong style={{ color: '#d4af37' }}>Admin:</strong> {r.admin_response}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {selected && (
              <div style={{ width: 320, background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
                <h3 style={{ color: '#f0f0f0', margin: '0 0 12px', fontSize: 16 }}>Respond</h3>
                <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 12 }}>
                  <strong style={{ color: '#f0f0f0' }}>{selected.subject}</strong><br />
                  {selected.message}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 6 }}>Status</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}>
                    {['reviewed', 'resolved', 'closed'].map(s => <option key={s} value={s} style={{ background: '#0a1020' }}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: '#8b92a9', fontSize: 12, display: 'block', marginBottom: 6 }}>Admin Response</label>
                  <textarea value={response} onChange={e => setResponse(e.target.value)} rows={4} placeholder="Type your response..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <button onClick={handleRespond} disabled={saving} style={{ width: '100%', padding: '10px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <MessageSquare size={14} /> {saving ? 'Sending...' : 'Send Response'}
                </button>
                <button onClick={() => setSelected(null)} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', marginTop: 8, fontSize: 13 }}>Cancel</button>
              </div>
            )}
          </div>
        }
      </div>
    </AdminLayout>
  );
}
