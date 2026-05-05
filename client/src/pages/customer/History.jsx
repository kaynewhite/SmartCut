import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Calendar, Scissors, Star, MapPin, User, Clock, Gift, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

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

export default function CustomerHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [ratingModal, setRatingModal] = useState(null);

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

  const STATUS_COLORS = { completed: '#10b981', cancelled: '#6b7280', no_show: '#ef4444' };

  if (loading) return <Layout><div style={{ textAlign: 'center', padding: 60, color: '#8b92a9' }}>Loading history...</div></Layout>;

  return (
    <Layout>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#f0f0f0', fontSize: 22, fontWeight: 700, margin: 0 }}>Haircut History</h1>
          <p style={{ color: '#8b92a9', fontSize: 13, marginTop: 6 }}>All your past visits ({history.length} total)</p>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Scissors size={44} color="#374151" style={{ marginBottom: 16 }} />
            <div style={{ color: '#f0f0f0', fontSize: 16, fontWeight: 500 }}>No history yet</div>
            <p style={{ color: '#8b92a9', marginTop: 8 }}>Book your first appointment to get started.</p>
            <Link to="/customer/explore" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', background: '#d4af37', color: '#0f1422', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>Find a Barbershop</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map(h => {
              const isOpen = expanded === h.id;
              const hasReview = !!h.barbershop_rating;
              return (
                <div key={h.id} style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 12, overflow: 'hidden', transition: 'all .2s' }}>
                  <div style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }} onClick={() => setExpanded(isOpen ? null : h.id)}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', background: '#1e2a3a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {h.barbershop_logo ? <img src={h.barbershop_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Scissors size={20} color="#4b5563" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 15 }}>{h.barbershop_name}</div>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${STATUS_COLORS[h.status] || '#6b7280'}18`, color: STATUS_COLORS[h.status] || '#6b7280', flexShrink: 0 }}>{h.status}</span>
                      </div>
                      <div style={{ color: '#d4af37', fontSize: 13, fontWeight: 600, marginTop: 2 }}>{h.service_name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                        <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {new Date(h.appointment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        {h.barber_name && <span style={{ color: '#8b92a9', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}><User size={11} /> {h.barber_name}</span>}
                        <span style={{ color: '#d4af37', fontSize: 13, fontWeight: 700 }}>₱{parseFloat(h.service_price || h.total_amount || 0).toFixed(0)}</span>
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
                          ['Category', h.service_category || '—'],
                          ['Location', h.barbershop_city || '—'],
                          ['Payment', h.payment_status || '—'],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{k}</div>
                            <div style={{ color: '#f0f0f0', fontSize: 13 }}>{v}</div>
                          </div>
                        ))}
                      </div>

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

                      {hasReview ? (
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
