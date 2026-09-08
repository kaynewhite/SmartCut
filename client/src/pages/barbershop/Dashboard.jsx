import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, DollarSign, Star, Users, TrendingUp, Clock } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function BarbershopDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/barbershops/me/dashboard').then(res => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
                <BarChart data={stats.monthly_revenue}>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#d4af37" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No revenue data yet</div>}
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Clock size={16} /> Peak Hours</div>
            {stats?.peak_hours?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.peak_hours.map(h => ({ hour: `${h.hour}:00`, count: parseInt(h.count) }))}>
                  <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1a2234', border: '1px solid #2d3748', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className={styles.noData}>No data yet</div>}
          </div>
        </div>

        <div className={styles.topServices}>
          <div className={styles.chartTitle}>Top Services</div>
          {stats?.top_services?.length > 0 ? (
            <div className={styles.servicesList}>
              {stats.top_services.map((s, i) => (
                <div key={i} className={styles.serviceRow}>
                  <span className={styles.rank}>#{i + 1}</span>
                  <span className={styles.svcName}>{s.name}</span>
                  <span className={styles.svcCount}>{s.count} bookings</span>
                </div>
              ))}
            </div>
          ) : <div className={styles.noData}>No service data yet</div>}
        </div>
      </div>
    </Layout>
  );
}
