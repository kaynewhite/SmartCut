import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Scissors, Star, MapPin, User, Clock, Gift, ChevronDown, ChevronUp, MessageSquare, Home, Ban } from 'lucide-react';

function RatingModal({ appt, onClose, onSubmit }) {
  const [shopRating, setShopRating] = useState(5);
  const [barberRating, setBarberRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({ barbershop_rating: shopRating, barber_rating: appt.barber_id ? barberRating : null, comment });
      onClose();
    } finally { setSaving(false); }
  };

  const Stars = ({ value, onChange }) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
          <Star size={24} fill={n <= value ? '#f59e0b' : 'none'} color={n <= value ? '#f59e0b' : '#4b5563'} />
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
        <h3 style={{ color: '#f0f0f0', margin: '0 0 6px', fontSize: 18 }}>Rate Your Experience</h3>
        <p style={{ color: '#8b92a9', fontSize: 13, margin: '0 0 20px' }}>at {appt.barbershop_name}</p>
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 8 }}>Shop Rating</div>
          <Stars value={shopRating} onChange={setShopRating} />
        </div>
        {appt.barber_id && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 8 }}>Barber Rating ({appt.barber_name})</div>
            <Stars value={barberRating} onChange={setBarberRating} />
          </div>
        )}
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 8 }}>Comment (optional)</div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Share your experience..." style={{ width: '100%', background: '#0a1020', border: '1px solid #1e2a3a', color: '#f0f0f0', padding: '10px 12px', borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '12px', background: '#d4af37', color: '#0f1422', border: 'none', borderRadius: 8, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Submitting...' : 'Submit Review'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_META = {
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  no_show: { label: 'Ghosted (No-Show)', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function CustomerHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [ratingModal, setRatingModal] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchHistory = () => {
    api.get('/appointments/history').then(res => setHistory(res.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchHistory(); }, []);

  const handleRateSubmit = async (data) => {
    const appt = ratingModal;
    try {
      await api.post('/barber-ratings/rate-barbershop', {
        appointment_id: appt.id,
        barbershop_id: appt.barbershop_id,
        barber_id: appt.barber_id,
        ...data
      });
      toast.success('Review submitted! Thank you.');
      fetchHistory();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit review'); throw err; }
  };

  const filtered = history.filter(h => filter === 'all' || h.status === filter);

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading history...</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, margin: 0 }}>Haircut History</h1>
          <p style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>{history.length} total visits</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { k: 'all', label: 'All' },
            { k: 'completed', label: 'Completed' },
            { k: 'cancelled', label: 'Cancelled' },
            { k: 'no_show', label: 'Ghosted' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', borderColor: filter === f.k ? '#d4af37' : '#1e2a3a', background: filter === f.k ? 'rgba(212,175,55,0.1)' : 'transparent', color: filter === f.k ? '#d4af37' : '#8b92a9', cursor: 'pointer', fontSize: 12 }}>
              {f.label}
              <span style={{ marginLeft: 5, fontSize: 11, color: '#6b7280' }}>
                ({f.k === 'all' ? history.length : history.filter(h => h.status === f.k).length})
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Scissors size={44} color="#374151" style={{ marginBottom: 16 }} />
            <div style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 500 }}>No history yet</div>
            <p style={{ color: '#8b92a9', marginTop: 8 }}>Book your first appointment to get started.</p>
            <Link to="/customer/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', background: '#d4af37', color: '#0f1422', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>Find a Barbershop</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(h => {
              const isOpen = expanded === h.id;
              const hasReview = !!h.barbershop_rating;
              const sm = STATUS_META[h.status] || STATUS_META.completed;
              const isHomeService = h.is_home_service || h.service_is_home;
              const appointmentType = isHomeService ? 'Home Service' : 'In-Shop';

              return (
                <div key={h.id} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, overflow: 'hidden', transition: 'all .2s' }}>
                  <div style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }} onClick={() => setExpanded(isOpen ? null : h.id)}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', background: '#1e2a3a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {h.barbershop_logo ? <img src={h.barbershop_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Scissors size={20} color="#4b5563" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 15 }}>{h.barbershop_name}</div>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: sm.bg, color: sm.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{sm.label}</span>
                      </div>
                      <div style={{ color: '#d4af37', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                        {h.service_name}
                        {isHomeService && <span style={{ marginLeft: 6, fontSize: 11, color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: 4 }}><Home size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />Home</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                        <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {new Date(h.appointment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {h.barber_name && <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} /> {h.barber_name}</span>}
                        {h.status === 'completed' && <span style={{ color: '#d4af37', fontSize: 13, fontWeight: 700 }}>₱{parseFloat(h.service_price || h.total_amount || 0).toFixed(0)}</span>}
                        {h.loyalty_points_earned && <span style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><Gift size={11} /> +{h.loyalty_points_earned} pts</span>}
                      </div>
                    </div>
                    <div style={{ color: '#4b5563', flexShrink: 0 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #1e2a3a', padding: '16px 18px', background: '#0a1020' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        {[
                          ['Date', new Date(h.appointment_date).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })],
                          ['Time', h.appointment_time?.substring(0, 5)],
                          ['Duration', h.duration_minutes ? `${h.duration_minutes} min` : '—'],
                          ['Type', appointmentType],
                          ['Category', h.service_category || '—'],
                          ['Location', h.barbershop_city || '—'],
                          ['Payment', h.payment_status || '—'],
                          ['Status', sm.label],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{k}</div>
                            <div style={{ color: k === 'Status' ? sm.color : '#f0f0f0', fontSize: 13 }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {h.home_address && (
                        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 13, color: '#8b92a9', display: 'flex', gap: 6 }}>
                          <Home size={13} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>{h.home_address}</span>
                        </div>
                      )}

                      {h.notes && (
                        <div style={{ marginBottom: 12, padding: '10px 12px', background: '#0f1827', borderRadius: 8, fontSize: 13, color: '#8b92a9' }}>
                          <strong style={{ color: '#6b7280', fontSize: 11 }}>NOTES </strong>{h.notes}
                        </div>
                      )}

                      {h.customer_rating_received && (
                        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 8 }}>
                          <div style={{ color: '#d4af37', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Your barber rated you</div>
                          <div style={{ color: '#f59e0b', fontSize: 13 }}>{'★'.repeat(h.customer_rating_received)}{'☆'.repeat(5 - h.customer_rating_received)}</div>
                          {h.customer_rating_comment && <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>{h.customer_rating_comment}</div>}
                        </div>
                      )}

                      {h.status === 'completed' && (
                        hasReview ? (
                          <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                            <div style={{ color: '#10b981', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Your Review</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span style={{ color: '#f59e0b', fontSize: 13 }}>Shop: {'★'.repeat(h.barbershop_rating)}{'☆'.repeat(5 - h.barbershop_rating)}</span>
                              {h.barber_rating && <span style={{ color: '#f59e0b', fontSize: 13 }}>Barber: {'★'.repeat(h.barber_rating)}{'☆'.repeat(5 - h.barber_rating)}</span>}
                            </div>
                            {h.review_comment && <div style={{ color: '#8b92a9', fontSize: 12 }}>{h.review_comment}</div>}
                          </div>
                        ) : (
                          <button onClick={() => setRatingModal(h)} style={{ width: '100%', padding: '10px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Star size={14} /> Leave a Review
                          </button>
                        )
                      )}

                      {h.status === 'no_show' && (
                        <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Ban size={14} color="#ef4444" />
                          <span style={{ color: '#ef4444', fontSize: 12 }}>You were marked as no-show for this appointment.</span>
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

      {ratingModal && (
        <RatingModal appt={ratingModal} onClose={() => setRatingModal(null)} onSubmit={handleRateSubmit} />
      )}
    </Layout>
  );
}
