import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Clock, Users, RefreshCw } from 'lucide-react';
import styles from './QueueView.module.css';

export default function CustomerQueue() {
  const { shopId } = useParams();
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetch = async () => {
    try {
      const res = await api.get(`/queue/${shopId}`);
      setQueue(res.data);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  const totalWaiting = queue.walk_ins.filter(w => w.status === 'waiting').length + queue.appointments.filter(a => a.status === 'confirmed' || a.status === 'pending').length;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Live Queue</h1>
          <button className={styles.refreshBtn} onClick={fetch}><RefreshCw size={16} /> Refresh</button>
        </div>
        <p className={styles.updated}>Last updated: {lastUpdate.toLocaleTimeString()}</p>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Users size={24} color="#d4af37" />
            <div><div className={styles.statNum}>{totalWaiting}</div><div className={styles.statLabel}>In Queue</div></div>
          </div>
          <div className={styles.statCard}>
            <Clock size={24} color="#d4af37" />
            <div><div className={styles.statNum}>~{totalWaiting * 20}</div><div className={styles.statLabel}>Est. Wait (min)</div></div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>Appointments Queue</h2>
          {queue.appointments.length === 0 ? <div className={styles.empty}>No appointments in queue</div> :
            <div className={styles.queueList}>
              {queue.appointments.map((a, i) => (
                <div key={i} className={`${styles.queueItem} ${a.status === 'in_progress' ? styles.inProgress : ''}`}>
                  <div className={styles.queueNum}>#{a.queue_number}</div>
                  <div className={styles.queueInfo}>
                    <div className={styles.queueName}>{a.customer_name}</div>
                    <div className={styles.queueMeta}>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''}</div>
                    <div className={styles.queueTime}><Clock size={12} /> {a.appointment_time?.substring(0,5)}</div>
                  </div>
                  <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                    {a.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          }
        </div>

        <div className={styles.section}>
          <h2>Walk-in Queue</h2>
          {queue.walk_ins.length === 0 ? <div className={styles.empty}>No walk-ins in queue</div> :
            <div className={styles.queueList}>
              {queue.walk_ins.map((w, i) => (
                <div key={i} className={`${styles.queueItem} ${w.status === 'in_progress' ? styles.inProgress : ''}`}>
                  <div className={styles.queueNum}>#{w.queue_number}</div>
                  <div className={styles.queueInfo}>
                    <div className={styles.queueName}>{w.customer_name}</div>
                    <div className={styles.queueMeta}>{w.service_name} {w.barber_name ? `· ${w.barber_name}` : ''}</div>
                  </div>
                  <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                    {w.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          }
        </div>
      </div>
    </Layout>
  );
}
