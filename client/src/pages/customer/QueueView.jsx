import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useShopQueueSocket, useCustomerSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import {
  Clock,
  Users,
  CheckCircle,
  Scissors,
  Calendar,
  AlertCircle,
  Sparkles,
  ChevronRight,
  User,
  Radio,
} from 'lucide-react';
import styles from './QueueView.module.css';
import { formatTime, formatQueueNumber } from '../../utils/time';

export default function CustomerQueue() {
  const { shopId } = useParams();
  const { user } = useAuth();
  const [queueData, setQueueData] = useState({
    unified_queue: [],
    appointments: [],
    walk_ins: [],
    chairs: [],
    stats: { total_waiting: 0, in_progress_count: 0, active_barbers_count: 0, est_wait_minutes: 0 },
  });
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('unified'); // 'unified' | 'chairs'

  const fetchInitialData = useCallback(async () => {
    try {
      const [qRes, sRes] = await Promise.all([
        api.get(`/queue/${shopId}`),
        api.get(`/barbershops/${shopId}`).catch(() => ({ data: { shop: null } })),
      ]);
      setQueueData(qRes.data);
      if (sRes.data.shop) setShop(sRes.data.shop);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [shopId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Real-time Shop Queue Updates via Socket.io
  const { isConnected } = useShopQueueSocket(shopId, {
    onQueueUpdate: (freshQueue) => {
      setQueueData(freshQueue);
    },
    onBarberStatus: () => {
      fetchInitialData();
    },
  });

  // Real-time Personal Customer Alerts
  useCustomerSocket(user?.id, {
    onCallToChair: (data) => {
      toast.success(data.message || "You're being served now!", { duration: 6000 });
      fetchInitialData();
    },
    onNextInQueue: (data) => {
      toast(data.message || "You're next in line! Please get ready.", {
        duration: 6000,
        style: { border: '1px solid #d4af37', color: '#d4af37', background: '#111827' },
      });
      fetchInitialData();
    },
    onApptUpdated: () => {
      fetchInitialData();
    },
  });

  const { unified_queue = [], chairs = [], stats = {} } = queueData;

  // Find user's active appointment in today's queue
  const myItem = unified_queue.find((item) => String(item.customer_id) === String(user?.id));
  const myPosition = myItem ? myItem.position : null;
  const peopleAhead = myPosition ? myPosition - 1 : null;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>{shop ? `${shop.name} — Live Queue` : 'Live Queue'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={styles.livePill}>
                <span className={styles.liveDot} />
                {isConnected ? 'Real-Time Sync Active' : 'Connecting...'}
              </span>
              <span style={{ fontSize: 12, color: '#8b92a9' }}>
                Today's Live Queue · No reload required
              </span>
            </div>
          </div>

          <Link
            to={`/customer/book/${shopId}`}
            style={{
              padding: '9px 16px',
              background: '#d4af37',
              color: '#0f1422',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 8,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Book Appointment <ChevronRight size={14} />
          </Link>
        </div>

        {/* MY POSITION HIGHLIGHT CARD */}
        {myItem && (
          <div
            style={{
              background:
                myItem.status === 'in_progress'
                  ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.05))'
                  : 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.05))',
              border:
                myItem.status === 'in_progress'
                  ? '2px solid rgba(59,130,246,0.6)'
                  : '2px solid rgba(212,175,55,0.6)',
              borderRadius: 16,
              padding: '20px',
              marginBottom: 20,
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            }}
          >
            {myItem.status === 'in_progress' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: 'rgba(59,130,246,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Scissors size={30} color="#3b82f6" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#3b82f6', fontWeight: 800, fontSize: 19, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scissors size={20} /> You're being served right now!
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 2 }}>
                    {myItem.service_name} {myItem.barber_name ? `with ${myItem.barber_name}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    color: '#d4af37',
                    fontWeight: 800,
                    fontSize: 11,
                    marginBottom: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} /> Your Live Queue Position
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      textAlign: 'center',
                      background: '#111827',
                      border: '1px solid rgba(212,175,55,0.3)',
                      borderRadius: 12,
                      padding: '12px 18px',
                      minWidth: 90,
                    }}
                  >
                    <div style={{ color: '#8b92a9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      Position
                    </div>
                    <div style={{ color: '#d4af37', fontWeight: 900, fontSize: 40, lineHeight: 1, marginTop: 4 }}>
                      #{myPosition}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16 }}>
                      {myItem.service_name}
                      {myItem.barber_name && (
                        <span style={{ color: '#8b92a9', fontWeight: 400 }}> · Barber: {myItem.barber_name}</span>
                      )}
                    </div>
                    <div style={{ color: '#8b92a9', fontSize: 13, marginTop: 4, display: 'flex', gap: 12 }}>
                      <span>
                        <Clock size={13} style={{ verticalAlign: 'middle' }} />{' '}
                        {myItem.time_display ? formatTime(myItem.time_display) : 'Walk-in'}
                      </span>
                      <span>
                        Token #{formatQueueNumber(myItem.queue_number)}
                      </span>
                    </div>

                    {peopleAhead > 0 ? (
                      <div style={{ color: '#f59e0b', fontSize: 13, marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={13} /> {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead of you in line
                      </div>
                    ) : (
                      <div style={{ color: '#10b981', fontSize: 13, marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Sparkles size={13} /> You're next in line — please be near the shop!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OVERALL STATS */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <Users size={24} color="#d4af37" />
            <div>
              <div className={styles.statNum}>{stats.total_waiting || 0}</div>
              <div className={styles.statLabel}>Waiting in Line</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <Scissors size={24} color="#3b82f6" />
            <div>
              <div className={styles.statNum}>{stats.in_progress_count || 0}</div>
              <div className={styles.statLabel}>In Chairs (Serving)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <Clock size={24} color="#f59e0b" />
            <div>
              <div className={styles.statNum}>~{stats.est_wait_minutes || 0}m</div>
              <div className={styles.statLabel}>Estimated Wait</div>
            </div>
          </div>
        </div>

        {/* VIEW TABS */}
        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'unified' ? styles.active : ''}`}
            onClick={() => setActiveTab('unified')}
          >
            <Users size={15} /> Unified Queue ({unified_queue.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'chairs' ? styles.active : ''}`}
            onClick={() => setActiveTab('chairs')}
          >
            <Scissors size={15} /> Barber Chairs ({chairs.length})
          </button>
        </div>

        {/* BARBER CHAIRS OVERVIEW */}
        {activeTab === 'chairs' && (
          <div>
            <div className={styles.chairsGrid}>
              {chairs.map((chair) => {
                const isServing = chair.status === 'serving';
                const isOffline = chair.status === 'offline';

                return (
                  <div key={chair.barber_id} className={styles.chairCard}>
                    <div className={styles.chairHeader}>
                      {chair.photo_url ? (
                        <img src={chair.photo_url} alt={chair.barber_name} className={styles.barberAvatar} />
                      ) : (
                        <div className={styles.barberAvatar}>{chair.barber_name.charAt(0)}</div>
                      )}
                      <div className={styles.chairInfo}>
                        <div className={styles.barberName}>{chair.barber_name}</div>
                        <span
                          className={`badge ${
                            isOffline ? 'badge-error' : isServing ? 'badge-info' : 'badge-success'
                          }`}
                          style={{ fontSize: 10, marginTop: 2 }}
                        >
                          {isOffline ? 'Offline' : isServing ? 'In Service' : 'Ready for Next'}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#1a2234',
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 12,
                        border: '1px solid #2d3748',
                      }}
                    >
                      <div style={{ color: '#8b92a9', fontSize: 11, marginBottom: 4, fontWeight: 700 }}>
                        NOW SERVING
                      </div>
                      {chair.current_serving ? (
                        <div style={{ fontWeight: 600, color: '#3b82f6' }}>
                          {String(chair.current_serving.customer_id) === String(user?.id)
                            ? 'You'
                            : chair.current_serving.customer_name || 'Customer'}{' '}
                          · {chair.current_serving.service_name}
                        </div>
                      ) : (
                        <div style={{ color: '#6b7280', fontStyle: 'italic' }}>Chair is currently open</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b92a9' }}>
                      <span>Waiting in this chair's queue:</span>
                      <strong style={{ color: '#f0f0f0' }}>{chair.waiting_count}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* UNIFIED LIVE QUEUE TIMELINE */}
        {activeTab === 'unified' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Today's Live Queue</h2>
              <span style={{ fontSize: 12, color: '#8b92a9' }}>Chronological sequence</span>
            </div>

            {loading ? (
              <div className={styles.empty}>
                <Scissors size={32} color="#d4af37" />
                <p>Loading live queue...</p>
              </div>
            ) : unified_queue.length === 0 ? (
              <div className={styles.empty}>
                <Users size={36} color="#374151" />
                <p style={{ fontWeight: 600 }}>The queue is empty right now.</p>
                <p style={{ fontSize: 12 }}>Be the first customer in line today!</p>
              </div>
            ) : (
              <div className={styles.queueList}>
                {unified_queue.map((item) => {
                  const isMe = String(item.customer_id) === String(user?.id);
                  const isInProgress = item.status === 'in_progress';

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`${styles.queueItem} ${isInProgress ? styles.inProgress : ''} ${
                        isMe ? styles.myItem : ''
                      }`}
                    >
                      <div className={styles.queueNumBadge}>
                        <span className={styles.queueNumLabel}>Pos</span>
                        <span className={styles.queueNumVal}>#{item.position}</span>
                      </div>

                      <div className={styles.queueInfo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={styles.queueName}>
                            {isMe ? 'You' : item.customer_name || `Customer #${item.position}`}
                          </span>
                          <span
                            className="badge badge-gold"
                            style={{ fontSize: 10, padding: '1px 6px' }}
                          >
                            {item.display_type}
                          </span>
                        </div>

                        <div className={styles.queueMeta}>
                          {item.service_name}
                          {item.barber_name && (
                            <span style={{ color: '#8b92a9' }}> · Barber: {item.barber_name}</span>
                          )}
                        </div>

                        <div className={styles.queueDetails}>
                          {item.time_display && (
                            <span>
                              <Clock size={11} style={{ verticalAlign: 'middle' }} /> {formatTime(item.time_display)}
                            </span>
                          )}
                          <span>Token #{formatQueueNumber(item.queue_number)}</span>
                          <span>~{item.duration_minutes || 25} min</span>
                        </div>
                      </div>

                      <span
                        className={`badge ${isInProgress ? 'badge-info' : 'badge-warning'}`}
                        style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
                      >
                        {isInProgress ? 'In Progress' : 'Waiting'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
