import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { Clock, Users, RefreshCw, CheckCircle } from 'lucide-react';
import styles from './QueueView.module.css';

const REFRESH_INTERVAL = 20; // seconds

export default function CustomerQueue() {
  const { shopId } = useParams();
  const { user } = useAuth();
  const [queue, setQueue] = useState({ walk_ins: [], appointments: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(null);

  const fetchQueue = async () => {
    try {
      const res = await api.get(`/queue/${shopId}`);
      setQueue(res.data);
      setLastUpdate(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, REFRESH_INTERVAL * 1000);
    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(countdownRef.current);
    };
  }, [shopId]);

  const myAppointment = queue.appointments.find(a => String(a.customer_id) === String(user?.id));

  // Dynamic position from backend (1 = first in line right now)
  const myPosition = myAppointment?.position ?? null;

  // People actively ahead of me (pending/confirmed before me + anyone in_progress before me)
  const peopleAhead = myPosition ? myPosition - 1 : null;

  // Estimated wait: sum duration_minutes of all appts ahead in queue
  const estWaitMinutes = (() => {
    if (!myAppointment) return null;
    const ahead = queue.appointments.filter(a =>
      (a.position || 0) < (myAppointment.position || 0) &&
      ['pending', 'confirmed', 'in_progress'].includes(a.status)
    );
    if (ahead.length === 0) return 0;
    return ahead.reduce((sum, a) => sum + (parseInt(a.duration_minutes) || 20), 0);
  })();

  const waitingAppts = queue.appointments.filter(a => ['pending','confirmed'].includes(a.status));
  const waitingWalkIns = queue.walk_ins.filter(w => w.status === 'waiting');
  const inProgressCount = queue.appointments.filter(a => a.status === 'in_progress').length +
    queue.walk_ins.filter(w => w.status === 'in_progress').length;
  const totalWaiting = waitingAppts.length + waitingWalkIns.length;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Live Queue</h1>
          <button className={styles.refreshBtn} onClick={fetchQueue}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <p className={styles.updated}>
          Updated {lastUpdate.toLocaleTimeString()} · auto-refreshes in {countdown}s
        </p>

        {/* MY POSITION CARD */}
        {myAppointment ? (
          <div style={{
            background: myAppointment.status === 'in_progress'
              ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))'
              : 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
            border: myAppointment.status === 'in_progress' ? '2px solid rgba(59,130,246,0.5)' : '2px solid rgba(212,175,55,0.5)',
            borderRadius: 14, padding: '18px 20px', marginBottom: 20
          }}>
            {myAppointment.status === 'in_progress' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={28} color="#3b82f6" />
                </div>
                <div>
                  <div style={{ color: '#3b82f6', fontWeight: 800, fontSize: 18 }}>✂️ You're being served now!</div>
                  <div style={{ color: '#8b92a9', fontSize: 13 }}>{myAppointment.service_name} {myAppointment.barber_name ? `· ${myAppointment.barber_name}` : ''}</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: '#d4af37', fontWeight: 700, fontSize: 12, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>📍 Your Position</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center', minWidth: 70 }}>
                    <div style={{ color: '#d4af37', fontWeight: 800, fontSize: 42, lineHeight: 1 }}>{myPosition}</div>
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 4 }}>
                      {myPosition === 1 ? '🎉 You\'re next!' : `in queue`}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 600, fontSize: 15 }}>
                      {myAppointment.service_name}
                      {myAppointment.barber_name && <span style={{ color: '#8b92a9', fontWeight: 400 }}> · {myAppointment.barber_name}</span>}
                    </div>
                    <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>
                      <Clock size={12} style={{ verticalAlign: 'middle' }} /> {myAppointment.appointment_time?.substring(0, 5)}
                    </div>
                    {peopleAhead > 0 && (
                      <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4 }}>
                        {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead of you
                      </div>
                    )}
                    {estWaitMinutes !== null && estWaitMinutes > 0 && (
                      <div style={{ color: '#f59e0b', fontSize: 13, marginTop: 4, fontWeight: 500 }}>
                        ⏱ ~{estWaitMinutes} min estimated wait
                      </div>
                    )}
                    {estWaitMinutes === 0 && (
                      <div style={{ color: '#10b981', fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                        🎉 You're next — please get ready!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          !loading && (
            <div style={{ padding: '14px 18px', background: 'rgba(107,114,128,0.06)', border: '1px solid #1e2a3a', borderRadius: 10, marginBottom: 20, color: '#6b7280', fontSize: 13 }}>
              Your appointment is not in the active queue. It may not be for today, or it has been completed.
            </div>
          )
        )}

        {/* STATS */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Users size={22} color="#d4af37" />
            <div>
              <div className={styles.statNum}>{totalWaiting}</div>
              <div className={styles.statLabel}>Waiting</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <CheckCircle size={22} color="#3b82f6" />
            <div>
              <div className={styles.statNum}>{inProgressCount}</div>
              <div className={styles.statLabel}>In Progress</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <Clock size={22} color="#f59e0b" />
            <div>
              <div className={styles.statNum}>
                {totalWaiting === 0 ? '0' : `~${queue.appointments.slice(0, totalWaiting).reduce((s, a) => s + (parseInt(a.duration_minutes) || 20), 0)}`}
              </div>
              <div className={styles.statLabel}>Est. Total Wait (min)</div>
            </div>
          </div>
        </div>

        {/* APPOINTMENT QUEUE */}
        {queue.appointments.length > 0 && (
          <div className={styles.section}>
            <h2>Appointment Queue</h2>
            <div className={styles.queueList}>
              {queue.appointments.map(a => {
                const isMe = String(a.customer_id) === String(user?.id);
                return (
                  <div
                    key={a.id}
                    className={`${styles.queueItem} ${a.status === 'in_progress' ? styles.inProgress : ''} ${isMe ? styles.myItem : ''}`}
                    style={isMe ? { border: '2px solid rgba(212,175,55,0.6)', background: 'rgba(212,175,55,0.07)' } : {}}
                  >
                    <div className={styles.queueNum} style={isMe ? { color: '#d4af37', fontWeight: 800 } : {}}>
                      {a.position}
                    </div>
                    <div className={styles.queueInfo}>
                      <div className={styles.queueName}>
                        {isMe ? '⭐ You' : `Customer #${a.position}`}
                      </div>
                      <div className={styles.queueMeta}>
                        {a.service_name} {a.barber_name ? `· ${a.barber_name}` : ''}
                      </div>
                      <div className={styles.queueTime}><Clock size={12} /> {a.appointment_time?.substring(0, 5)}</div>
                    </div>
                    <span className={`badge ${a.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                      {a.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WALK-IN QUEUE */}
        {queue.walk_ins.length > 0 && (
          <div className={styles.section}>
            <h2>Walk-in Queue</h2>
            <div className={styles.queueList}>
              {queue.walk_ins.map(w => (
                <div key={w.id} className={`${styles.queueItem} ${w.status === 'in_progress' ? styles.inProgress : ''}`}>
                  <div className={styles.queueNum}>{w.position}</div>
                  <div className={styles.queueInfo}>
                    <div className={styles.queueName}>Walk-in #{w.position}</div>
                    <div className={styles.queueMeta}>{w.service_name || 'Walk-in'} {w.barber_name ? `· ${w.barber_name}` : ''}</div>
                  </div>
                  <span className={`badge ${w.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>
                    {w.status === 'in_progress' ? '✂️ In Progress' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && queue.appointments.length === 0 && queue.walk_ins.length === 0 && (
          <div className={styles.empty}>
            <Users size={40} color="#374151" />
            <p>The queue is empty right now.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
