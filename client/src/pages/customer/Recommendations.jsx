import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import L from 'leaflet';
import {
  MapPin, Star, Scissors, Navigation, X,
  Flame, Award, Crown, Zap, TrendingUp, Sparkles, Lock,
  ChevronRight, Users, Clock, CheckCircle,
} from 'lucide-react';
import styles from './Recommendations.module.css';

// ─── Sub-components ──────────────────────────────────────────────────────────

function ShopCard({ shop }) {
  const inQueue = parseInt(shop.in_queue_count, 10) || 0;
  const rating = parseFloat(shop.avg_rating || 0).toFixed(1);
  return (
    <Link to={`/customer/barbershop/${shop.id}`} className={styles.shopCard}>
      <div className={styles.shopCover}>
        {shop.cover_url || shop.logo_url
          ? <img src={shop.cover_url || shop.logo_url} alt={shop.name} />
          : <Scissors size={30} color="#374151" />}

        {shop.distance_km !== null && shop.distance_km !== undefined && (
          <span className={styles.distancePill}>
            <MapPin size={10} /> {shop.distance_km} km
          </span>
        )}

        <span className={`${styles.queuePillCard} ${inQueue === 0 ? styles.noWait : styles.waiting}`}>
          {inQueue === 0
            ? <><CheckCircle size={10} /> No Wait</>
            : <><Users size={10} /> {inQueue} waiting</>}
        </span>
      </div>

      <div className={styles.shopInfo}>
        <div className={styles.shopName}>{shop.name}</div>
        <div className={styles.shopCity}><MapPin size={11} /> {shop.city || shop.address || 'Location N/A'}</div>
        <div className={styles.shopRating}>
          <Star size={12} fill="#f59e0b" color="#f59e0b" />
          <span className={styles.shopRatingNum}>{rating}</span>
          <span className={styles.shopRatingCount}>({shop.review_count || 0} reviews)</span>
        </div>
      </div>
    </Link>
  );
}

function ServiceCard({ service, trending }) {
  return (
    <Link to={`/customer/barbershop/${service.barbershop_id}`} className={styles.serviceCard}>
      <div className={styles.serviceCover} style={{ position: 'relative' }}>
        {service.image_url
          ? <img src={service.image_url} alt={service.name} />
          : <Scissors size={26} color="#374151" />}
        {trending && (
          <span className={styles.trendingBadge}>
            <Flame size={10} /> Trending
          </span>
        )}
      </div>
      <div className={styles.serviceInfo}>
        <div className={styles.serviceName}>{service.name}</div>
        <div className={styles.serviceBarber}>
          by {service.barber_name} · {service.barbershop_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <span className={styles.servicePrice}>
            {'\u20B1'}{parseFloat(service.price || 0).toFixed(0)}
          </span>
          <span className={styles.serviceDur}><Clock size={10} /> {service.duration_minutes}m</span>
        </div>
        {service.distance_km != null && (
          <div style={{ fontSize: 11, color: '#8b92a9', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} /> {service.distance_km} km away
          </div>
        )}
      </div>
    </Link>
  );
}

function BarberCard({ barber }) {
  return (
    <Link to={`/customer/barbershop/${barber.barbershop_id}`} className={styles.barberCard}>
      <div className={styles.barberAvatar}>
        {barber.photo_url
          ? <img src={barber.photo_url} alt={barber.name} />
          : <span>{barber.name.charAt(0)}</span>}
      </div>
      <div className={styles.barberName}>{barber.name}</div>
      <div className={styles.barberShop}>{barber.barbershop_name}</div>
      <div className={styles.barberRating}>
        <Star size={12} fill="#f59e0b" color="#f59e0b" />
        {parseFloat(barber.rating || 0).toFixed(1)}
        <span style={{ color: '#8b92a9', fontWeight: 400 }}>({barber.review_count})</span>
      </div>
      <span
        className={styles.availBadge}
        style={
          barber.is_available
            ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
            : { background: 'rgba(107,114,128,0.15)', color: '#6b7280' }
        }
      >
        {barber.is_available ? <><CheckCircle size={10} /> Available</> : 'Busy'}
      </span>
      {barber.distance_km != null && (
        <div style={{ fontSize: 10, color: '#8b92a9', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
          <MapPin size={9} /> {barber.distance_km} km
        </div>
      )}
    </Link>
  );
}

function FeedSection({ icon, title, subtitle, children, count }) {
  if (!count) return null;
  return (
    <div className={styles.feedSection}>
      <div className={styles.feedHeader}>
        <div>
          <div className={styles.feedTitle}>{icon}{title}</div>
          {subtitle && <div className={styles.feedDesc}>{subtitle}</div>}
        </div>
      </div>
      <div className={styles.scrollLane}>{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerRecommendations() {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletMapRef = useRef(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/recommendations');
      setData(res.data);
    } catch (err) {
      if (err.response?.status !== 403) {
        console.error('Recommendations fetch error:', err);
      }
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecommendations();

    api.get('/subscriptions/status').then((res) => {
      setSubStatus(res.data);
      if (res.data?.is_active && user?.subscription_status !== 'active') {
        updateUser({ subscription_status: 'active' });
      }
    }).catch(() => {});

    api.get('/customers/me').then((res) => {
      if (res.data) updateUser(res.data);
    }).catch(() => {});
  }, [fetchRecommendations]);

  // Initialize Leaflet map for pin-drop picker
  useEffect(() => {
    if (!showMapPicker || !mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView([14.5995, 120.9842], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    leafletMapRef.current = map;

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng]).addTo(map);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMapPicker]);

  const handleGPSLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation is not supported by your browser.');
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          let city = '', address = '';
          try {
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
            ).then((r) => r.json());
            city = geoRes?.address?.city || geoRes?.address?.town || geoRes?.address?.municipality || '';
            address = geoRes?.display_name || '';
          } catch { /* reverse geocode is optional */ }

          await api.patch('/customers/location', {
            latitude: coords.latitude,
            longitude: coords.longitude,
            location_city: city,
            location_address: address,
          });
          toast.success(`Location saved${city ? ` — ${city}` : ''}`, { icon: null });
          fetchRecommendations();
        } catch {
          toast.error('Failed to save location');
        }
        setLocationLoading(false);
      },
      () => {
        toast.error('Location access denied. Please allow it in your browser settings.');
        setLocationLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const handleMapPinSave = async () => {
    if (!markerRef.current) return toast.error('Click on the map to drop a pin first.');
    const { lat, lng } = markerRef.current.getLatLng();
    setLocationLoading(true);
    try {
      let city = '', address = '';
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        ).then((r) => r.json());
        city = geoRes?.address?.city || geoRes?.address?.town || '';
        address = geoRes?.display_name || '';
      } catch { /* optional */ }

      await api.patch('/customers/location', {
        latitude: lat, longitude: lng,
        location_city: city, location_address: address,
      });
      toast.success('Location pinned and saved');
      setShowMapPicker(false);
      fetchRecommendations();
    } catch {
      toast.error('Failed to save location');
    }
    setLocationLoading(false);
  };

  const handleClearLocation = async () => {
    if (!confirm('Remove your saved location?')) return;
    try {
      await api.patch('/customers/location', {
        latitude: null, longitude: null, location_city: null, location_address: null,
      });
      toast.success('Location cleared');
      fetchRecommendations();
    } catch { toast.error('Failed to clear location'); }
  };

  const isSubscriber =
    data?.customer?.is_subscriber === true ||
    user?.subscription_status === 'active' ||
    subStatus?.is_active === true ||
    subStatus?.subscription?.status === 'active';
  const hasLocation = data?.customer?.has_location || (!!user?.latitude && !!user?.longitude);
  const feeds = data?.feeds || {};
  const isPending = subStatus?.subscription?.status === 'pending';

  const allFeedsEmpty =
    !feeds.closest_shops?.length &&
    !feeds.trending_haircuts?.length &&
    !feeds.top_rated_services?.length &&
    !feeds.master_barbers?.length &&
    !feeds.premier_shops?.length &&
    !feeds.open_now?.length &&
    !feeds.no_wait_shops?.length;

  return (
    <Layout>
      <div className={styles.page}>

        {/* ── Page Header ── */}
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>
            <Sparkles size={22} color="#d4af37" />
            For You
          </h1>
          <p className={styles.headerSub}>
            {hasLocation
              ? `Personalized picks for your area${data?.customer?.location_city || user?.location_city ? ` · ${data?.customer?.location_city || user?.location_city}` : ''}`
              : 'Set your location to get distance-ranked shops, trending cuts, and top barbers near you.'}
          </p>
        </div>

        {/* ── Location Banner (subscribers only) ── */}
        {!loading && isSubscriber && (
          <div className={styles.locationBanner}>
            <div className={styles.locationBannerIcon}>
              <MapPin size={22} color="#d4af37" />
            </div>
            <div className={styles.locationBannerText}>
              <div className={styles.locationBannerTitle}>
                {hasLocation
                  ? `Location set${data?.customer?.location_city || user?.location_city ? ` — ${data?.customer?.location_city || user?.location_city}` : ''}`
                  : 'Set your location'}
              </div>
              <div className={styles.locationBannerSub}>
                {hasLocation
                  ? 'Your feeds are ranked by proximity. Tap to update anytime.'
                  : 'Enable location to see distance badges and nearest barbershop feeds.'}
              </div>
            </div>
            <div className={styles.locationBannerActions}>
              <button
                className={`${styles.locBtn} ${styles.locBtnPrimary}`}
                onClick={handleGPSLocation}
                disabled={locationLoading}
              >
                <Navigation size={14} />
                {locationLoading ? 'Locating…' : 'Use GPS'}
              </button>
              <button
                className={`${styles.locBtn} ${styles.locBtnSecondary}`}
                onClick={() => setShowMapPicker(true)}
              >
                <MapPin size={14} /> Pin on Map
              </button>
              {hasLocation && (
                <button className={`${styles.locBtn} ${styles.locBtnDanger}`} onClick={handleClearLocation}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Subscriber Gate ── */}
        {!loading && !isSubscriber && (
          <div className={styles.subsLock}>
            {isPending ? (
              <>
                <Clock size={40} color="#f59e0b" />
                <div style={{ color: '#f0f0f0', fontWeight: 800, fontSize: 20 }}>
                  Subscription Pending Review
                </div>
                <div style={{ color: '#8b92a9', fontSize: 14, maxWidth: 400, lineHeight: 1.6 }}>
                  Your subscription payment receipt has been submitted and is awaiting administrator verification.
                  Once approved, all personalized recommendations will unlock immediately.
                </div>
                <Link
                  to="/customer/profile"
                  style={{
                    padding: '12px 24px', background: '#1e2a3a', color: '#f0f0f0',
                    fontWeight: 700, borderRadius: 10, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4,
                  }}
                >
                  <Clock size={16} /> View Status in Profile
                </Link>
              </>
            ) : (
              <>
                <Lock size={40} color="#d4af37" />
                <div style={{ color: '#f0f0f0', fontWeight: 800, fontSize: 20 }}>
                  Subscriber-Exclusive Feature
                </div>
                <div style={{ color: '#8b92a9', fontSize: 14, maxWidth: 380, lineHeight: 1.6 }}>
                  Upgrade to SmartCut Premium to unlock personalized feeds, GPS distance ranking,
                  trending haircut discovery, and master barber profiles.
                </div>
                <Link
                  to="/customer/profile"
                  style={{
                    padding: '12px 24px', background: '#d4af37', color: '#0f1422',
                    fontWeight: 700, borderRadius: 10, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4,
                  }}
                >
                  <Crown size={16} /> Subscribe Now
                </Link>
              </>
            )}
          </div>
        )}

        {/* ── Skeleton Loaders ── */}
        {loading && (
          [1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 32 }}>
              <div style={{ height: 22, width: 180, background: '#1a2234', borderRadius: 6, marginBottom: 14 }} />
              <div className={styles.skeletonLane}>
                {[1, 2, 3, 4, 5].map((j) => <div key={j} className={styles.skeleton} />)}
              </div>
            </div>
          ))
        )}

        {/* ── Feeds ── */}
        {!loading && isSubscriber && (
          <>
            {/* 1. Closest to You */}
            {hasLocation && !!feeds.closest_shops?.length && (
              <FeedSection
                icon={<MapPin size={18} color="#10b981" />}
                title="Closest to You"
                subtitle="Sorted by distance from your saved location"
                count={feeds.closest_shops.length}
              >
                {feeds.closest_shops.map((s) => <ShopCard key={s.id} shop={s} />)}
              </FeedSection>
            )}

            {/* 2. Open Right Now */}
            {!!feeds.open_now?.length && (
              <FeedSection
                icon={<Zap size={18} color="#10b981" />}
                title="Open Right Now"
                subtitle="Accepting customers at this moment"
                count={feeds.open_now.length}
              >
                {feeds.open_now.map((s) => <ShopCard key={`on-${s.id}`} shop={s} />)}
              </FeedSection>
            )}

            {/* 3. No Wait */}
            {!!feeds.no_wait_shops?.length && (
              <FeedSection
                icon={<TrendingUp size={18} color="#3b82f6" />}
                title="No Queue — Walk Right In"
                subtitle="Open shops with zero waiting customers right now"
                count={feeds.no_wait_shops.length}
              >
                {feeds.no_wait_shops.map((s) => <ShopCard key={`nw-${s.id}`} shop={s} />)}
              </FeedSection>
            )}

            {/* 4. Trending Haircuts */}
            {!!feeds.trending_haircuts?.length && (
              <FeedSection
                icon={<Flame size={18} color="#ef4444" />}
                title="Trending Haircuts"
                subtitle="Most-booked styles in the last 14 days"
                count={feeds.trending_haircuts.length}
              >
                {feeds.trending_haircuts.map((s) => (
                  <ServiceCard key={`tr-${s.id}`} service={s} trending />
                ))}
              </FeedSection>
            )}

            {/* 5. Top-Rated Services */}
            {!!feeds.top_rated_services?.length && (
              <FeedSection
                icon={<Award size={18} color="#d4af37" />}
                title="Highest-Rated Services"
                subtitle="Services with the best customer satisfaction scores"
                count={feeds.top_rated_services.length}
              >
                {feeds.top_rated_services.map((s) => (
                  <ServiceCard key={`ts-${s.id}`} service={s} />
                ))}
              </FeedSection>
            )}

            {/* 6. Master Barbers */}
            {!!feeds.master_barbers?.length && (
              <FeedSection
                icon={<Crown size={18} color="#d4af37" />}
                title="Master Barbers"
                subtitle="Ranked by skill score — rating combined with total cuts"
                count={feeds.master_barbers.length}
              >
                {feeds.master_barbers.map((b) => <BarberCard key={b.id} barber={b} />)}
              </FeedSection>
            )}

            {/* 7. Premier Barbershops */}
            {!!feeds.premier_shops?.length && (
              <FeedSection
                icon={<Star size={18} color="#f59e0b" />}
                title="Premier Barbershops"
                subtitle="Top-rated shops with verified customer reviews"
                count={feeds.premier_shops.length}
              >
                {feeds.premier_shops.map((s) => <ShopCard key={`pr-${s.id}`} shop={s} />)}
              </FeedSection>
            )}

            {/* Empty State */}
            {allFeedsEmpty && (
              <div className={styles.feedEmpty}>
                <Scissors size={36} color="#374151" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 700, color: '#f0f0f0', fontSize: 16, marginBottom: 6 }}>
                  Building your recommendations…
                </div>
                <div>
                  As more barbershops join and more bookings are made, your personalized feeds will appear here.
                </div>
                <Link
                  to="/customer/explore"
                  style={{
                    marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', background: '#d4af37', color: '#0f1422',
                    fontWeight: 700, borderRadius: 8, textDecoration: 'none',
                  }}
                >
                  <Scissors size={14} /> Browse All Barbershops
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── Map Pin Picker Modal ── */}
        {showMapPicker && (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
              zIndex: 2000, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 16,
            }}
            onClick={() => setShowMapPicker(false)}
          >
            <div
              style={{
                background: '#0f1827', borderRadius: 16, border: '1px solid #1e2a3a',
                width: '100%', maxWidth: 620, overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', borderBottom: '1px solid #1e2a3a',
              }}>
                <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={17} color="#d4af37" /> Drop a Pin on Your Location
                </div>
                <button
                  onClick={() => setShowMapPicker(false)}
                  style={{ background: 'none', border: 'none', color: '#8b92a9', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Map */}
              <div ref={mapRef} style={{ height: 380, width: '100%' }} />

              {/* Footer */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <p style={{ color: '#8b92a9', fontSize: 12, margin: 0, flex: 1 }}>
                  Click anywhere on the map to place your pin, then save.
                </p>
                <button
                  onClick={handleMapPinSave}
                  disabled={locationLoading}
                  style={{
                    padding: '10px 20px', background: '#d4af37', color: '#0f1422',
                    border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                    opacity: locationLoading ? 0.7 : 1,
                  }}
                >
                  <MapPin size={14} />
                  {locationLoading ? 'Saving…' : 'Save Location'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
