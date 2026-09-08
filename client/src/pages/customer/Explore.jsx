import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useExploreSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import {
  Search,
  Star,
  MapPin,
  Scissors,
  List,
  MapIcon,
  Lock,
  X,
  Upload,
  ArrowUpDown,
  Clock,
  Home,
  Gift,
  User,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Users,
  CheckCircle,
  Check,
} from 'lucide-react';
import styles from './Explore.module.css';

export default function CustomerExplore() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [openNow, setOpenNow] = useState(false);
  const [homeService, setHomeService] = useState(false);
  const [hasPromos, setHasPromos] = useState(false);
  const [isSolo, setIsSolo] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [priceRange, setPriceRange] = useState(''); // 'budget' | 'mid' | 'premium' | ''

  // View state
  const [view, setView] = useState('list');
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);

  const isSubscribed =
    subStatus?.is_active === true ||
    user?.subscription_status === 'active' ||
    subStatus?.subscription?.status === 'active';

  // Real-time Queue Counter sync via WebSocket
  useExploreSocket(
    useCallback((data) => {
      if (!data || !data.barbershop_id) return;
      setShops((prevShops) =>
        prevShops.map((shop) =>
          shop.id === data.barbershop_id
            ? {
                ...shop,
                in_queue_count: data.in_queue_count,
                est_wait_minutes: data.est_wait_minutes,
              }
            : shop
        )
      );
    }, [])
  );

  useEffect(() => {
    api.get('/barbers/specialties').then((res) => setSpecialtyOptions(res.data || [])).catch(() => {});
    api.get('/admin/qr').then((res) => setAdminQr(res.data)).catch(() => {});
    api.get('/subscriptions/status').then((res) => {
      setSubStatus(res.data);
      if (res.data?.is_active && user?.subscription_status !== 'active') {
        updateUser({ subscription_status: 'active' });
      }
    }).catch(() => {});

    // Also sync full customer profile to get location & active subscription
    api.get('/customers/me').then((res) => {
      if (res.data) {
        updateUser(res.data);
      }
    }).catch(() => {});
  }, []);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (city) params.city = city;
      if (specialty) params.specialty = specialty;
      if (sortBy) params.sort_by = sortBy;
      if (openNow) params.open_now = 'true';
      if (homeService) params.has_home_service = 'true';
      if (hasPromos) params.has_promos = 'true';
      if (isSolo) params.is_solo = 'true';
      if (minRating) params.min_rating = minRating;
      if (priceRange) params.price_range = priceRange;

      if (user?.latitude && user?.longitude) {
        params.lat = user.latitude;
        params.lng = user.longitude;
      }

      const res = await api.get('/barbershops', { params });
      setShops(res.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [search, city, specialty, sortBy, openNow, homeService, hasPromos, isSolo, minRating, priceRange, user?.latitude, user?.longitude]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchShops();
  };

  const resetFilters = () => {
    setSearch('');
    setCity('');
    setSpecialty('');
    setSortBy('rating');
    setOpenNow(false);
    setHomeService(false);
    setHasPromos(false);
    setIsSolo(false);
    setMinRating('');
    setPriceRange('');
  };

  const hasActiveFilters =
    search ||
    city ||
    specialty ||
    openNow ||
    homeService ||
    hasPromos ||
    isSolo ||
    minRating ||
    priceRange ||
    sortBy !== 'rating';

  const handleMapClick = () => {
    if (!isSubscribed) {
      setShowSubModal(true);
      return;
    }
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
          <p>Discover top-rated barbers, live queue availability, and custom grooming services near you</p>
        </div>

        {/* SEARCH & SMART FILTERS */}
        <div className={styles.searchBox}>
          <form onSubmit={handleSearch}>
            <div className={styles.searchMainRow}>
              <div className={styles.searchInput}>
                <Search size={17} color="#6b7280" />
                <input
                  placeholder="Search barbershops, styles, or keywords..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className={styles.searchInput}>
                <MapPin size={17} color="#6b7280" />
                <input
                  placeholder="City or district..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className={styles.searchInput}>
                <ArrowUpDown size={17} color="#d4af37" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {user?.latitude && <option value="closest">Closest to Me</option>}
                  <option value="rating">Highest Rated</option>
                  <option value="popular">Most Popular</option>
                  <option value="shortest_queue">Shortest Queue</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>

              <button type="submit" className={styles.searchBtn}>
                <Search size={15} /> Find Shops
              </button>
            </div>

            {/* Quick Filter Pills Row */}
            <div className={styles.filterPillsRow}>
              <span className={styles.filterLabel}>Quick Filters:</span>

              <button
                type="button"
                className={`${styles.pill} ${openNow ? styles.active : ''}`}
                onClick={() => setOpenNow(!openNow)}
              >
                <Clock size={13} /> Open Now
              </button>

              <button
                type="button"
                className={`${styles.pill} ${homeService ? styles.active : ''}`}
                onClick={() => setHomeService(!homeService)}
              >
                <Home size={13} /> Home Service
              </button>

              <button
                type="button"
                className={`${styles.pill} ${hasPromos ? styles.active : ''}`}
                onClick={() => setHasPromos(!hasPromos)}
              >
                <Gift size={13} /> Loyalty Promos
              </button>

              <button
                type="button"
                className={`${styles.pill} ${minRating === '4.5' ? styles.active : ''}`}
                onClick={() => setMinRating(minRating === '4.5' ? '' : '4.5')}
              >
                <Star size={13} /> 4.5+ Stars
              </button>

              <button
                type="button"
                className={`${styles.pill} ${isSolo ? styles.active : ''}`}
                onClick={() => setIsSolo(!isSolo)}
              >
                <Scissors size={13} /> Solo Barbers
              </button>

              {/* Price Range Pills */}
              <button
                type="button"
                className={`${styles.pill} ${priceRange === 'budget' ? styles.active : ''}`}
                onClick={() => setPriceRange(priceRange === 'budget' ? '' : 'budget')}
              >
                ₱ Under 200
              </button>

              <button
                type="button"
                className={`${styles.pill} ${priceRange === 'mid' ? styles.active : ''}`}
                onClick={() => setPriceRange(priceRange === 'mid' ? '' : 'mid')}
              >
                ₱200 – ₱500
              </button>

              <button
                type="button"
                className={`${styles.pill} ${priceRange === 'premium' ? styles.active : ''}`}
                onClick={() => setPriceRange(priceRange === 'premium' ? '' : 'premium')}
              >
                ₱500+
              </button>
            </div>
          </form>
        </div>

        {/* RESULTS BAR & VIEW TOGGLE */}
        <div className={styles.controlsBar}>
          <div className={styles.resultsSummary}>
            <span>
              Found <strong>{shops.length}</strong> {shops.length === 1 ? 'barbershop' : 'barbershops'}
            </span>
            {hasActiveFilters && (
              <button type="button" className={styles.resetBtn} onClick={resetFilters}>
                <RotateCcw size={12} /> Reset Filters
              </button>
            )}
          </div>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`}
              onClick={() => setView('list')}
            >
              <List size={15} /> List View
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'map' && isSubscribed ? styles.active : ''}`}
              onClick={handleMapClick}
            >
              {isSubscribed ? <MapIcon size={15} /> : <Lock size={15} />} Map View
              {!isSubscribed && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 10,
                    padding: '1px 5px',
                    background: 'rgba(212,175,55,0.15)',
                    color: '#d4af37',
                    borderRadius: 4,
                  }}
                >
                  Subscribers
                </span>
              )}
            </button>
          </div>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          loading ? (
            <div className={styles.loading}>
              <Scissors size={36} color="#d4af37" />
              <p>Searching barbershops and live queues...</p>
            </div>
          ) : shops.length === 0 ? (
            <div className={styles.empty}>
              <Scissors size={44} color="#374151" />
              <p style={{ fontSize: 16, fontWeight: 600 }}>No barbershops match your current filters</p>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  padding: '8px 18px',
                  background: '#1a2234',
                  border: '1px solid #2d3748',
                  color: '#d4af37',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {shops.map((shop) => {
                const inQueue = shop.in_queue_count || 0;
                const estWait = shop.est_wait_minutes || 0;

                return (
                  <Link key={shop.id} to={`/customer/barbershop/${shop.id}`} className={styles.card}>
                    <div className={styles.cover}>
                      {shop.logo_url || shop.cover_url ? (
                        <img src={shop.cover_url || shop.logo_url} alt={shop.name} />
                      ) : (
                        <Scissors size={40} color="#4b5563" />
                      )}

                      {/* Open / Closed Status Badge */}
                      <span className={`${styles.openBadge} ${shop.is_open_now ? styles.open : styles.closed}`}>
                        {shop.is_open_now ? '● Open' : 'Closed'}
                      </span>

                      {/* Distance Badge if available */}
                      {shop.distance_km !== null && shop.distance_km !== undefined && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0,0,0,0.75)',
                            color: '#f0f0f0',
                            borderRadius: 20,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <MapPin size={10} color="#10b981" /> {shop.distance_km} km
                        </span>
                      )}

                      {/* Live Queue Pill */}
                      <span className={`${styles.queuePill} ${inQueue === 0 ? styles.noWait : styles.waiting}`}>
                        {inQueue === 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={10} /> No Wait
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Users size={10} /> {inQueue} in queue ({estWait}m)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className={styles.info}>
                      <div className={styles.name}>{shop.name}</div>
                      <div className={styles.location}>
                        <MapPin size={13} /> {shop.city || shop.address || 'Location N/A'}
                      </div>

                      <div className={styles.ratingRow}>
                        <div className={styles.rating}>
                          <Star size={13} fill="#f59e0b" color="#f59e0b" />
                          <span>{parseFloat(shop.avg_rating || 0).toFixed(1)}</span>
                          <span className={styles.reviews}>({shop.review_count || 0})</span>
                        </div>

                        {shop.is_solo && <span className="badge badge-gold" style={{ fontSize: 10 }}>Solo Barber</span>}
                      </div>

                      {/* Feature Tags */}
                      <div className={styles.featuresRow}>
                        {shop.has_home_service && (
                          <span className={`${styles.featureTag} ${styles.gold}`}>
                            <Home size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> Home Service
                          </span>
                        )}
                        {shop.has_promos && (
                          <span className={styles.featureTag}>
                            <Gift size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> Loyalty Promos
                          </span>
                        )}
                        {shop.opening_time && (
                          <span className={styles.featureTag}>
                            <Clock size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {shop.opening_time.substring(0, 5)} - {shop.closing_time?.substring(0, 5)}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardFooter}>
                        <div>
                          {shop.min_price ? (
                            <span className={styles.price}>From ₱{parseFloat(shop.min_price).toFixed(0)}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#8b92a9' }}>Pricing in shop</span>
                          )}
                        </div>
                        <span className={styles.viewAction}>
                          View & Book <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* MAP VIEW */}
        {view === 'map' && isSubscribed && (
          <div className={styles.mapContainer}>
            <Map
              markers={shops
                .filter((s) => s.latitude && s.longitude)
                .map((s) => ({
                  id: s.id,
                  name: s.name,
                  address: s.address,
                  city: s.city,
                  latitude: s.latitude,
                  longitude: s.longitude,
                }))}
              height="600px"
              onMarkerClick={(marker) => navigate(`/customer/barbershop/${marker.id}`)}
            />
          </div>
        )}

        {/* Subscription Modal */}
        {showSubModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 16,
            }}
          >
            <div
              style={{
                background: '#0f1827',
                border: '1px solid #1e2a3a',
                borderRadius: 14,
                padding: 28,
                maxWidth: 440,
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapIcon size={22} color="#d4af37" />
                  <h3 style={{ color: '#f0f0f0', margin: 0, fontSize: 18 }}>Unlock Map View</h3>
                </div>
                <button
                  onClick={() => setShowSubModal(false)}
                  style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {subStatus?.subscription?.status === 'pending' ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Clock size={24} color="#f59e0b" />
                  </div>
                  <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 8 }}>Subscription Pending Review</div>
                  <p style={{ color: '#8b92a9', fontSize: 13 }}>
                    Your subscription request has been submitted and is awaiting admin approval. You'll be notified once
                    it's approved.
                  </p>
                  <button
                    onClick={() => setShowSubModal(false)}
                    style={{
                      marginTop: 16,
                      padding: '10px 20px',
                      background: '#1e2a3a',
                      color: '#8b92a9',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ color: '#8b92a9', fontSize: 13, marginBottom: 16 }}>
                    Subscribe to SmartCut to unlock the interactive map and browse barbershops by location. Subscriptions
                    are ₱99/month.
                  </p>

                  {adminQr && (
                    <div
                      style={{
                        background: '#0a1020',
                        borderRadius: 10,
                        padding: 16,
                        marginBottom: 16,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: 4 }}>
                        Pay via {adminQr.type}
                      </div>
                      {adminQr.account_name && (
                        <div style={{ color: '#8b92a9', fontSize: 13, marginBottom: 10 }}>
                          {adminQr.account_name}
                        </div>
                      )}
                      <img
                        src={adminQr.qr_url}
                        alt="Payment QR"
                        style={{
                          maxWidth: 160,
                          width: '100%',
                          margin: '0 auto',
                          display: 'block',
                          borderRadius: 8,
                          border: '1px solid #1e2a3a',
                          background: '#fff',
                          padding: 4,
                        }}
                      />
                      <div style={{ color: '#8b92a9', fontSize: 12, marginTop: 10 }}>
                        Scan and pay, then upload your receipt below
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubRequest}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        background: '#0a1020',
                        border: '1px dashed #1e2a3a',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: proofFile ? '#10b981' : '#8b92a9',
                        fontSize: 13,
                        marginBottom: 12,
                      }}
                    >
                      <Upload size={15} /> {proofFile ? <><Check size={14} color="#10b981" /> {proofFile.name}</> : 'Upload payment receipt'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProofFile(e.target.files[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="submit"
                        disabled={uploading || !proofFile}
                        style={{
                          flex: 1,
                          padding: 12,
                          background: proofFile ? '#d4af37' : '#374151',
                          color: proofFile ? '#0f1422' : '#6b7280',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 700,
                          cursor: proofFile ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {uploading ? 'Submitting...' : 'Submit Request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSubModal(false)}
                        style={{
                          flex: 1,
                          padding: 12,
                          background: '#1e2a3a',
                          color: '#8b92a9',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                  <p style={{ color: '#6b7280', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
                    You can also manage your subscription in Profile → Subscription tab.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
