import { useState, useEffect } from 'react';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Calendar, Scissors, Star, MapPin } from 'lucide-react';
import styles from './History.module.css';

export default function CustomerHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/customers/me/history').then(res => setHistory(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Haircut History</h1>
          <p>All your past visits and services</p>
        </div>
        {loading ? <div className={styles.loading}>Loading...</div> :
          history.length === 0 ? <div className={styles.empty}><Scissors size={40} color="#374151" /><p>No history yet. Book your first appointment!</p></div> :
          <div className={styles.list}>
            {history.map(h => (
              <div key={h.id} className={styles.card}>
                <div className={styles.leftBar} />
                <div className={styles.content}>
                  <div className={styles.top}>
                    <div>
                      <div className={styles.shop}>{h.barbershop_name}</div>
                      <div className={styles.meta}><MapPin size={12} /> {h.barbershop_address}</div>
                    </div>
                    <div className={styles.date}><Calendar size={12} /> {h.appointment_date}</div>
                  </div>
                  <div className={styles.service}>
                    <Scissors size={14} /> {h.service_name} {h.barber_name ? `· ${h.barber_name}` : ''}
                  </div>
                  <div className={styles.price}>₱{parseFloat(h.price||0).toFixed(0)}</div>
                  {h.review && (
                    <div className={styles.review}>
                      <div className={styles.stars}>
                        {'★'.repeat(h.barbershop_rating || 0)}{'☆'.repeat(5 - (h.barbershop_rating || 0))}
                      </div>
                      <div className={styles.comment}>{h.review}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </Layout>
  );
}
