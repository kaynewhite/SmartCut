import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Star, MessageSquare } from 'lucide-react';
import styles from './Reviews.module.css';

export default function BarbershopReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await api.get('/barbershops/me/profile');
        const id = profileRes.data.id;
        setShopId(id);
        const res = await api.get(`/ratings/barbershop/${id}`);
        setReviews(res.data);
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

  const avgRating = reviews.length > 0 ? (reviews.reduce((a, r) => a + (r.barbershop_rating||0), 0) / reviews.length).toFixed(1) : 0;

  const distrib = [5,4,3,2,1].map(s => ({ stars: s, count: reviews.filter(r => r.barbershop_rating === s).length }));

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}><h1><MessageSquare size={22} /> Reviews & Ratings</h1></div>

        <div className={styles.overview}>
          <div className={styles.bigRating}>
            <div className={styles.bigNum}>{avgRating}</div>
            <div className={styles.stars}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</div>
            <div className={styles.total}>{reviews.length} reviews</div>
          </div>
          <div className={styles.distrib}>
            {distrib.map(d => (
              <div key={d.stars} className={styles.distribRow}>
                <span className={styles.distribStars}>{d.stars} ★</span>
                <div className={styles.bar}>
                  <div className={styles.fill} style={{ width: reviews.length > 0 ? `${(d.count/reviews.length)*100}%` : '0%' }} />
                </div>
                <span className={styles.distribCount}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? <div className={styles.loading}>Loading...</div> :
          reviews.length === 0 ? <div className={styles.empty}><Star size={40} color="#374151" /><p>No reviews yet.</p></div> :
          <div className={styles.list}>
            {reviews.map(r => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.avatar}>{r.customer_name?.charAt(0)}</div>
                  <div className={styles.reviewerInfo}>
                    <div className={styles.reviewerName}>{r.customer_name}</div>
                    <div className={styles.reviewStars} style={{color:'#f59e0b'}}>{'★'.repeat(r.barbershop_rating)}{'☆'.repeat(5-r.barbershop_rating)}</div>
                  </div>
                  <div className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                {r.comment && <div className={styles.comment}>{r.comment}</div>}
                {r.barber_name && <div className={styles.barberReview}><Star size={12} color="#f59e0b" /> {r.barber_name}: {'★'.repeat(r.barber_rating||0)}</div>}
              </div>
            ))}
          </div>
        }
      </div>
    </Layout>
  );
}
