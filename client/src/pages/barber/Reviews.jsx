import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Star, MessageSquare } from 'lucide-react';

export default function BarberReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/ratings/barber/me')
      .then(res => setReviews(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avg = reviews.length ? (reviews.reduce((s, r) => s + (r.barber_rating || 0), 0) / reviews.length).toFixed(1) : null;

  return (
    <Layout>
      <div style={{ padding: 20 }}>
        <h1 style={{ color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={22} color="#d4af37" /> My Reviews
        </h1>
        <p style={{ color: '#8b92a9', marginTop: 4 }}>What customers are saying about your work</p>

        {avg && (
          <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16, marginBottom: 16, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Star size={28} color="#d4af37" />
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0' }}>
                {avg} <span style={{ fontSize: 14, color: '#8b92a9', fontWeight: 400 }}>/ 5.0</span>
              </div>
              <div style={{ fontSize: 12, color: '#8b92a9' }}>Based on {reviews.length} customer review{reviews.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {loading ? <div style={{ color: '#8b92a9', padding: 40, textAlign: 'center' }}>Loading...</div> :
          reviews.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: '#8b92a9' }}>No reviews yet</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, color: '#f0f0f0' }}>{r.customer_name || 'Customer'}</div>
                    <div style={{ color: '#d4af37' }}>{'★'.repeat(r.barber_rating)}{'☆'.repeat(5 - r.barber_rating)}</div>
                  </div>
                  {r.service_name && <div style={{ fontSize: 12, color: '#8b92a9', marginBottom: 6 }}>{r.service_name}</div>}
                  {r.comment && <div style={{ color: '#cbd5e1', fontSize: 14 }}>{r.comment}</div>}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
        }
      </div>
    </Layout>
  );
}
