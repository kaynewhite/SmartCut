import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import { Search, Star, MapPin, Scissors, List, MapIcon, Lock, X, Upload } from 'lucide-react';
import styles from './Explore.module.css';

export default function CustomerExplore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [view, setView] = useState('list');
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);

  // Prefer live server status (subStatus) over stale localStorage value
  const isSubscribed = subStatus !== null
    ? subStatus.is_active === true
    : user?.subscription_status === 'active';

  useEffect(() => {
    api.get('/barbers/specialties').then(res => setSpecialtyOptions(res.data || [])).catch(() => {});
    api.get('/admin/qr').then(res => setAdminQr(res.data)).catch(() => {});
    api.get('/subscriptions/status').then(res => setSubStatus(res.data)).catch(() => {});
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (city) params.city = city;
      if (specialty) params.specialty = specialty;
      if (maxPrice) params.max_price = maxPrice;
      const res = await api.get('/barbershops', { params });
      setShops(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchShops(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetchShops(); };

  const handleMapClick = () => {
    if (!isSubscribed) { setShowSubModal(true); return; }
    setView('map');
  };

  const handleSubRequest = async (e) => {
    e.preventDefault();
    if (!proofFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('proof', proofFile);
      await api.post('/subscriptions/request', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const res = await api.get('/subscriptions/status');
      setSubStatus(res.data);
      setProofFile(null);
      alert('Subscription request submitted! Admin will review within 24 hours.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit');
    }
    setUploading(false);
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Explore Barbershops</h1>
          <p>Find the perfect barber near you</p>
        </div>

        <form className={styles.searchBox} onSubmit={handleSearch}>
          <div className={styles.searchRow}>
            <div className={styles.searchInput}>
              <Search size={16} color="#6b7280" />
              <input placeholder="Search barbershops..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className={styles.searchInput}>
              <MapPin size={16} color="#6b7280" />
              <input placeholder="City or area" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className={styles.searchInput}>
              <Scissors size={16} color="#6b7280" />
              <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'inherit', outline: 'none', width: '100%' }}>
                <option value="">All Specialties</option>
                {specialtyOptions.map(s => <option key={s} value={s} style={{ background: '#1a2234' }}>{s}</option>)}
              </select>
            </div>
            <div className={styles.searchInput}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>₱ Max</span>
              <input type="number" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </div>
        </form>

        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`} onClick={() => setView('list')}>
            <List size={16} /> List
          </button>
          <button className={`${styles.viewBtn} ${view === 'map' && isSubscribed ? styles.active : ''}`} onClick={handleMapClick}>
            {isSubscribed ? <MapIcon size={16} /> : <Lock size={16} />} Map
            {!isSubscribed && <span style={{ marginLeft: 4, fontSize: 10, padding: '1px 5px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', borderRadius: 4 }}>Subscribers</span>}
          </button>
        </div>

        {/* Map gated notice (inline when they try to switch view) */}
        {view === 'map' && !isSubscribed && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14 }}>
            <Lock size={44} color="#d4af37" style={{ marginBottom: 16 }} />
            <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Map View is for Subscribers</div>
            <p style={{ color: '#8b92a9', marginBottom: 20 }}>Subscribe to SmartCut to unlock the interactive map and discover barbershops near you.</p>
            <button onClick={() => setShowSubModal(true)} style={{ padding: '12px 28px', background: '#d4af37', color: '#0f1422', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 15 }}>Subscribe Now</button>
          </div>
        )}

        {view === 'list' && (
          loading ? (
            <div className={styles.loading}><Scissors size={32} color="#374151" /><p>Finding barbershops...</p></div>
          ) : shops.length === 0 ? (
            <div className={styles.empty}><Scissors size={40} color="#374151" /><p>No barbershops found. Try adjusting your search.</p></div>
          ) : (
            <div className={styles.grid}>
              {shops.map(shop => (
                <Link key={shop.id} to={`/customer/barbershop/${shop.id}`} className={styles.card}>
                  <div className={styles.cover}>
                    {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} /> : <Scissors size={36} color="#4b5563" />}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>{shop.name}</div>
                    <div className={styles.location}><MapPin size={12} /> {shop.city || shop.address || 'Location N/A'}</div>
                    <div className={styles.rating}>
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <span>{parseFloat(shop.avg_rating || 0).toFixed(1)}</span>
                      <span className={styles.reviews}>({shop.review_count || 0} reviews)</span>
                    </div>
                    {shop.description && <div className={styles.desc}>{shop.description.substring(0, 60)}...</div>}
                    {shop.min_price && <div className={styles.price}>From ₱{parseFloat(shop.min_price).toFixed(0)}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {view === 'map' && isSubscribed && (
          <div className={styles.mapContainer}>
            <Map
              markers={shops.filter(s => s.latitude && s.longitude).map(s => ({ id: s.id, name: s.name, address: s.address, city: s.city, latitude: s.latitude, longitude: s.longitude }))}
              height="600px"
              onMarkerClick={(marker) => navigate(`/customer/barbershop/${marker.id}`)}
            />
          </div>
        )}
      </div>

      {/* Subscription Modal */}
      {showSubModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#0f1827', border: '1px solid #1e2a3a', borderRadius: 14, padding: 28, maxWidth: 440, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapIcon size={22} color="#d4af37" />
                <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>Unlock Map View</h3>
              </div>
              <button onClick={() => setShowSubModal(false)} style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>

            {subStatus?.subscription?.status === 'pending' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>Subscription Pending Review</div>
                <p style={{ color: '#8b92a9', fontSize: 13 }}>Your subscription request has been submitted and is awaiting admin approval. You'll be notified once it's approved.</p>
                <button onClick={() => setShowSubModal(false)} style={{ marginTop: 16, padding: '10px 20px', background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Close</button>
              </div>
            ) : (
              <>
                <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>Subscribe to SmartCut to unlock the interactive map and browse barbershops by location. Subscriptions are ₱99/month.</p>

                {adminQr && (
                  <div style={{ background: '#0a1020', borderRadius: 10, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                    <div style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: 4 }}>Pay via {adminQr.type}</div>
                    {adminQr.account_name && <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>{adminQr.account_name}</div>}
                    <img src={adminQr.qr_url} alt="Payment QR" style={{ maxWidth: 160, width: '100%', margin: '0 auto', display: 'block', borderRadius: 8, border: '1px solid #1e2a3a', background: '#fff', padding: 4 }} />
                    <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 10 }}>Scan and pay, then upload your receipt below</div>
                  </div>
                )}

                <form onSubmit={handleSubRequest}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#0a1020', border: '1px dashed #1e2a3a', borderRadius: 8, cursor: 'pointer', color: proofFile ? '#10b981' : '#8b92a9', fontSize: 13, marginBottom: 12 }}>
                    <Upload size={15} /> {proofFile ? `✓ ${proofFile.name}` : 'Upload payment receipt'}
                    <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files[0])} style={{ display: 'none' }} />
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={uploading || !proofFile} style={{ flex: 1, padding: 12, background: proofFile ? '#d4af37' : '#374151', color: proofFile ? '#0f1422' : '#6b7280', border: 'none', borderRadius: 8, fontWeight: 700, cursor: proofFile ? 'pointer' : 'not-allowed' }}>
                      {uploading ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button type="button" onClick={() => setShowSubModal(false)} style={{ flex: 1, padding: 12, background: '#1e2a3a', color: '#8b92a9', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </form>
                <p style={{ color: '#6b7280', fontSize: 11, marginTop: 12, textAlign: 'center' }}>You can also manage your subscription in Profile → Subscription tab.</p>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
