import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Clock, Users, RefreshCw, MapPin } from 'lucide-react';
import styles from './QueueView.module.css';

export default function CustomerQueue() {
  const { shopId } = useParams();
  const { user } = useAuth();
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchQueue = async () => {
    try {
      const res = await api.get(`/queue/${shopId}`);
      setQueue(res.data);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [shopId]);

  const myAppointment = queue.appointments.find(a => String(a.customer_id) === String(user?.id));

  const activeAppts = queue.appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');
  const waitingAppts = activeAppts.filter(a => ['pending', 'confirmed'].includes(a.status));
  const waitingWalkIns = queue.walk_ins.filter(w => w.status === 'waiting');
  const totalWaiting = waitingAppts.length + waitingWalkIns.length;

  const myPosition = myAppointment
    ? activeAppts.filter(a => (a.queue_number || 0) < (myAppointment.queue_number || 0) && ['pending','confirmed'].includes(a.status)).length + 1
    : null;

  const estWait = myPosition ? myPosition * 20 : null;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Live Queue</h1>
          <button className={styles.refreshBtn} onClick={fetchQueue}><RefreshCw size={16} /> Refresh</button>
        </div>
        <p className={styles.updated}>Last updated: {lastUpdate.toLocaleTimeString()}</p>

        {myAppointment && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
            border: '2px solid rgba(212,175,55,0.5)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 20
          }}>
            <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📍 Your Position</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#d4af37', fontWeight: 800, fontSize: 36 }}>#{myPosition}</div>
                <div style={{ color: '#8b92a9', fontSize: 12 }}>in queue</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f0f0f0', fontWeight: 600 }}>Queue #{myAppointment.queue_number}</div>
                <div style={{ color: '#8b92a9', fontSize: 13 }}>{myAppointment.service_name} {myAppointment.barber_name ? `· ${myAppointment.barber_name}` : ''}</div>
                <div style={{ color: '#8b92a9', fontSize: 13 }}><Clock size={12} style={{ verticalAlign: 'middle' }} /> {myAppointment.appointment_time?.substring(0, 5)}</div>
                {estWait && <div style={{ color: '#f59e0b', fontSize: 12, marginTop: 4 }}>~{estWait} min estimated wait</div>}
              </div>
              <span className={`badge ${myAppointment.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: 12 }}>
                {myAppointment.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
              </span>
            </div>
          </div>
        )}

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
          {activeAppts.length === 0 ? <div className={styles.empty}>No appointments in queue</div> :
            <div className={styles.queueList}>
              {activeAppts.map((a, i) => {
                const isMe = String(a.customer_id) === String(user?.id);
                return (
                  <div key={i} className={`${styles.queueItem} ${a.status === 'in_progress' ? styles.inProgress : ''} ${isMe ? styles.myItem : ''}`}
                    style={isMe ? { border: '2px solid rgba(212,175,55,0.6)', background: 'rgba(212,175,55,0.07)' } : {}}>
                    <div className={styles.queueNum} style={isMe ? { color: '#d4af37', fontWeight: 800 }:{}}>#{a.queue_number}</div>
                    <div className={styles.queueInfo}>
                      <div className={styles.queueName}>{isMe ? '⭐ You' : `Customer #${a.queue_number}`}</div>
                      <div className={styles.queueMeta}>{a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''}</div>
                      <div className={styles.queueTime}><Clock size={12} /> {a.appointment_time?.substring(0, 5)}</div>
                    </div>
                    <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                      {a.status === 'in_progress' ? 'In Progress' : 'Waiting'}
                    </span>
                  </div>
                );
              })}
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
                    <div className={styles.queueName}>Walk-in #{w.queue_number}</div>
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
