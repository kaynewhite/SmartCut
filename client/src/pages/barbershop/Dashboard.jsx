import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, DollarSign, Star, Users, TrendingUp, Clock, Gift, Scissors } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function BarbershopDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/barbershops/me/dashboard').then(res => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const peakHourCounts = new Map(stats?.peak_hours?.map(({ hour, count }) => [Number(hour), Number(count)]));
  const peakHourData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`,
    count: peakHourCounts.get(hour) || 0,
  }));

  if (loading) return <Layout><div style={{textAlign:'center',padding:'60px',color:'var(--text-muted)'}}>Loading...</div></Layout>;

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.welcome}>
          <div>
            <h1>Welcome, {user?.name}!</h1>
            <p>Here's your business overview for today</p>
          </div>
          <Link to="/barbershop/appointments" className={styles.viewBtn}>View Appointments</Link>
        </div>

        <div className={styles.statsGrid}>
          {[
            { icon: <Calendar size={22} />, num: stats?.today_appointments || 0, label: "Today's Bookings" },
            { icon: <DollarSign size={22} />, num: `₱${(stats?.total_revenue||0).toLocaleString()}`, label: 'Total Revenue' },
            { icon: <Star size={22} />, num: `${stats?.avg_rating||0} ★`, label: 'Avg Rating' },
            { icon: <Users size={22} />, num: stats?.queue_count || 0, label: 'In Queue Now' },
          ].map((s, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div>
                <div className={styles.statNum}>{s.num}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><TrendingUp size={16} /> Monthly Revenue</div>
            {stats?.monthly_revenue?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.monthly_revenue}>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#d4af37" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No revenue data yet</div>}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Clock size={16} /> Peak Hours</div>
            {stats?.peak_hours?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={peakHourData}>
                  <XAxis dataKey="hour" interval={2} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No data yet</div>}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Scissors size={16} /> Top Services</div>
            {stats?.top_services?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.top_services} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(value) => [`${value} bookings`, 'Bookings']}
                    contentStyle={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8 }}
                  />
                  <Bar dataKey="count" name="Bookings" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No service data yet</div>}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Gift size={16} /> Loyalty Promo Impact</div>
            {stats?.promo_impact?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.promo_impact} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const promo = payload[0].payload;
                      return (
                        <div style={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8, padding: '10px 12px', color: '#f0f0f0', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 5 }}>{promo.name}</div>
                          <div>{promo.redemption_count} redemptions</div>
                          <div>₱{Number(promo.promo_value_redeemed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value redeemed</div>
                          <div>{Number(promo.points_spent).toLocaleString()} points spent</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="redemption_count" name="Redemptions" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No loyalty promos have been redeemed yet</div>}
          </div>
        </div>

        {stats?.promo_impact?.length > 0 && (
          <div className={styles.topServices} style={{ marginTop: 16 }}>
            <div className={styles.chartTitle}>Promo Redemption Details</div>
            <div className={styles.servicesList}>
              {stats.promo_impact.map(promo => (
                <div key={promo.promo_id} className={styles.serviceRow}>
                  <span className={styles.svcName}>{promo.name}</span>
                  <span className={styles.svcCount}>
                    {promo.redemption_count} redemptions · ₱{Number(promo.promo_value_redeemed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value · {Number(promo.points_spent).toLocaleString()} points spent
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.topServices} style={{ marginTop: 16 }}>
          <div className={styles.chartTitle}><Users size={16} /> Barber Performance</div>
          {stats?.barber_performance?.length > 0 ? (
            <div className={styles.servicesList}>
              {stats.barber_performance.map(barber => (
                <div key={barber.id} className={styles.serviceRow}>
                  <span className={styles.svcName}>{barber.name}</span>
                  <span className={styles.svcCount}>
                    {barber.cuts} cuts · {Number(barber.avg_rating).toFixed(1)} ★ ({barber.rating_count} ratings) · Most picked: {barber.most_picked_service || '—'}
                    {barber.most_picked_service && ` (${barber.most_picked_count})`}
                  </span>
                </div>
              ))}
            </div>
          ) : <div className={styles.noData}>No barber performance data yet</div>}
        </div>
      </div>
    </Layout>
  );
}
