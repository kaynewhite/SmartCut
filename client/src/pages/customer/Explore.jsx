import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import toast from 'react-hot-toast';
import { ArrowRight, Crosshair, Home, Lock, MapIcon, MapPin, Search, Scissors, Star, List, X, Upload } from 'lucide-react';
import { SERVICE_CATEGORIES } from '../../constants/serviceCategories';
import styles from './Explore.module.css';

const LOCATION_STORAGE_KEY = 'smartcut_customer_location';

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRadians = value => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function CustomerExplore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [homeServiceOnly, setHomeServiceOnly] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [view, setView] = useState('list');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [adminQr, setAdminQr] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const isSubscribed = subStatus !== null ? subStatus.is_active === true : user?.subscription_status === 'active';

  useEffect(() => {
    try {
      const savedLocation = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY));
      if (Array.isArray(savedLocation) && savedLocation.length === 2 && savedLocation.every(Number.isFinite)) {
        setUserLocation(savedLocation);
        return;
      }
    } catch {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = [coords.latitude, coords.longitude];
        setUserLocation(location);
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  const setCustomerLocation = coordinates => {
    setUserLocation(coordinates);
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coordinates));
    setShowLocationPicker(false);
    toast.success('Your location has been set');
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location services are not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCustomerLocation([coords.latitude, coords.longitude]),
      error => toast.error(error.code === error.PERMISSION_DENIED
        ? 'Location access was denied. You can set your location on the map instead.'
        : 'Could not determine your location. Try placing a pin on the map.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const recommendedShops = useMemo(() => [...shops].map(shop => {
    const latitude = Number(shop.latitude);
    const longitude = Number(shop.longitude);
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) &&
      (latitude !== 0 || longitude !== 0);
    return {
      ...shop,
      distanceKm: userLocation && hasCoordinates
        ? getDistanceKm(userLocation[0], userLocation[1], latitude, longitude)
        : Number.POSITIVE_INFINITY
    };
  }).sort((a, b) => {
    if (sort === 'price_low' || sort === 'price_high') {
      const priceA = a.min_price === null || a.min_price === undefined ? Number.NaN : Number(a.min_price);
      const priceB = b.min_price === null || b.min_price === undefined ? Number.NaN : Number(b.min_price);
      const validA = Number.isFinite(priceA);
      const validB = Number.isFinite(priceB);
      if (validA !== validB) return validA ? -1 : 1;
      if (validA && priceA !== priceB) return sort === 'price_low' ? priceA - priceB : priceB - priceA;
    }
    const hasDistanceA = Number.isFinite(a.distanceKm);
    const hasDistanceB = Number.isFinite(b.distanceKm);
    if (hasDistanceA && hasDistanceB && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (hasDistanceA !== hasDistanceB) return hasDistanceA ? -1 : 1;
    const ratingDiff = Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
    return ratingDiff || Number(b.review_count || 0) - Number(a.review_count || 0);
  }), [shops, userLocation, sort]);

  const fetchShops = async (event, filters = {
    search, city, specialty, category, minPrice, maxPrice, minRating, availableOnly, homeServiceOnly, sort
  }) => {
    event?.preventDefault();
    setLoading(true);
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.city.trim()) params.city = filters.city.trim();
      if (filters.specialty) params.specialty = filters.specialty;
      if (filters.category) params.category = filters.category;
      if (filters.minPrice) params.min_price = filters.minPrice;
      if (filters.maxPrice) params.max_price = filters.maxPrice;
      if (filters.minRating) params.min_rating = filters.minRating;
      if (filters.availableOnly) params.available = 'true';
      if (filters.homeServiceOnly) params.home_service = 'true';
      if (filters.sort && filters.sort !== 'recommended') params.sort = filters.sort;
      const response = await api.get('/barbershops', { params });
      setShops(response.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load barbershops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
    api.get('/barbers/specialties').then(response => setSpecialtyOptions(response.data || [])).catch(() => {});
    api.get('/admin/qr').then(response => setAdminQr(response.data)).catch(() => {});
    api.get('/subscriptions/status').then(response => setSubStatus(response.data)).catch(() => {});
  }, []);

  const clearFilters = () => {
    setSearch('');
    setCity('');
    setSpecialty('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setAvailableOnly(false);
    setHomeServiceOnly(false);
    setSort('recommended');
    fetchShops(undefined, {
      search: '', city: '', specialty: '', category: '', minPrice: '', maxPrice: '',
      minRating: '', availableOnly: false, homeServiceOnly: false, sort: 'recommended'
    });
  };

  const activeFilterCount = [
    search.trim(), city.trim(), specialty, category, minPrice, maxPrice, minRating,
    availableOnly, homeServiceOnly, sort !== 'recommended'
  ].filter(Boolean).length;

  const handleSubRequest = async event => {
    event.preventDefault();
    if (!proofFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      await api.post('/subscriptions/request', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const response = await api.get('/subscriptions/status');
      setSubStatus(response.data);
      setProofFile(null);
      setShowSubModal(false);
      toast.success('Subscription request submitted! Admin will review within 24 hours.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.eyebrow}><Scissors size={14} /> YOUR NEXT GREAT CUT STARTS HERE</div>
          <h1>For You</h1>
          <p>Discover barbershops picked for your location, style, and budget.</p>
        </div>

        <form className={styles.searchBox} onSubmit={fetchShops}>
          <div className={styles.searchHeading}>
            <div>
              <h2>Find your barbershop</h2>
              <p>Choose your location, then narrow shops by services, price, and availability.</p>
            </div>
            <div className={styles.locationActions}>
              <button type="button" className={styles.locationButton} onClick={useDeviceLocation}>
                <Crosshair size={15} /> Use my location
              </button>
              <button type="button" className={styles.locationButton} onClick={() => setShowLocationPicker(open => !open)}>
                <MapPin size={15} /> {showLocationPicker ? 'Close map' : userLocation ? 'Change location' : 'Set location'}
              </button>
            </div>
          </div>
          {userLocation && (
            <div className={styles.locationStatus}>
              <MapPin size={13} /> Recommendations are sorted by distance from your chosen location.
              <button type="button" onClick={() => { localStorage.removeItem(LOCATION_STORAGE_KEY); setUserLocation(null); }}>Clear location</button>
            </div>
          )}
          {showLocationPicker && (
            <div className={styles.locationPicker}>
              <div className={styles.locationPickerHeading}>
                <strong>Choose your location</strong>
                <span>Click the map to place your pin.</span>
              </div>
              <Map
                center={userLocation}
                selectedLocation={userLocation}
                onLocationSelect={setCustomerLocation}
                height="280px"
              />
            </div>
          )}
          <div className={styles.searchRow}>
            <label className={styles.searchInput}>
              <Search size={16} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Shop or service name" />
            </label>
            <label className={styles.searchInput}>
              <MapPin size={16} />
              <input value={city} onChange={event => setCity(event.target.value)} placeholder="City or area" />
            </label>
            <label className={styles.searchInput}>
              <Scissors size={16} />
              <select value={specialty} onChange={event => setSpecialty(event.target.value)}>
                <option value="">All specialties</option>
                {specialtyOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className={styles.searchInput}>
              <span aria-hidden="true">₱</span>
              <input aria-label="Minimum price" type="number" min="0" step="1" value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="Min price" />
            </label>
            <label className={styles.searchInput}>
              <span aria-hidden="true">₱</span>
              <input aria-label="Maximum price" type="number" min="0" step="1" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Max price" />
            </label>
            <label className={styles.searchInput}>
              <Star size={16} />
              <select aria-label="Minimum rating" value={minRating} onChange={event => setMinRating(event.target.value)}>
                <option value="">Any rating</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </label>
            <label className={styles.searchInput}>
              <span>Sort</span>
              <select aria-label="Sort shops" value={sort} onChange={event => setSort(event.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="price_low">Price: low to high</option>
                <option value="price_high">Price: high to low</option>
              </select>
            </label>
            <div className={styles.searchActions}>
              {activeFilterCount > 0 && <button className={styles.clearBtn} type="button" onClick={clearFilters}>Clear</button>}
              <button className={styles.searchBtn} type="submit" disabled={loading}><Search size={16} /> {loading ? 'Searching' : 'Apply filters'}</button>
            </div>
          </div>
          <div className={styles.filterDivider} />
          <div className={styles.categoryGroup}>
            <span className={styles.categoryLabel}>Service</span>
            <div className={styles.categoryChips}>
              <button type="button" className={`${styles.categoryChip} ${!category ? styles.selectedChip : ''}`} onClick={() => setCategory('')}>All</button>
              {SERVICE_CATEGORIES.map(option => (
                <button
                  type="button"
                  key={option.value}
                  className={`${styles.categoryChip} ${category === option.value ? styles.selectedChip : ''}`}
                  onClick={() => setCategory(current => current === option.value ? '' : option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.extraFilters}>
            <label className={styles.checkFilter}>
              <input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />
              <span>Has an available barber</span>
            </label>
            <label className={styles.checkFilter}>
              <input type="checkbox" checked={homeServiceOnly} onChange={event => setHomeServiceOnly(event.target.checked)} />
              <Home size={15} />
              <span>Offers home service</span>
            </label>
          </div>
        </form>

        <div className={styles.resultsBar}>
          <div>
            <h2>Barbershops near you</h2>
            <p>{loading ? 'Finding your options…' : `${recommendedShops.length} ${recommendedShops.length === 1 ? 'shop' : 'shops'}${activeFilterCount ? ` · ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'} applied` : ' to explore'}`}</p>
          </div>
          <div className={styles.viewToggle} aria-label="Barbershop view">
            <button type="button" className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`} onClick={() => setView('list')}>
              <List size={16} /> List
            </button>
            <button type="button" className={`${styles.viewBtn} ${view === 'map' && isSubscribed ? styles.active : ''}`} onClick={() => {
              if (isSubscribed) setView('map');
              else setShowSubModal(true);
            }}>
              {isSubscribed ? <MapIcon size={16} /> : <Lock size={16} />} Map
              {!isSubscribed && <span className={styles.subscriberTag}>Pro</span>}
            </button>
          </div>
        </div>

        {view === 'list' && (loading ? (
          <div className={styles.empty}><span className={styles.emptyIcon}><Scissors size={22} /></span><strong>Finding your next barbershop</strong><p>Searching shops that match your filters.</p></div>
        ) : recommendedShops.length === 0 ? (
          <div className={styles.empty}><span className={styles.emptyIcon}><Scissors size={22} /></span><strong>No barbershops found</strong><p>Try broadening your search or clearing one of your filters.</p></div>
        ) : (
          <div className={styles.grid}>
            {recommendedShops.map(shop => (
              <Link key={shop.id} to={`/customer/barbershop/${shop.id}`} className={styles.card}>
                <div className={styles.cover}>
                  {shop.logo_url ? <img src={shop.logo_url} alt={shop.name} /> : <Scissors size={36} />}
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{shop.name}</div>
                  <div className={styles.location}><MapPin size={12} /> {shop.city || shop.address || 'Location N/A'}</div>
                  <div className={styles.rating}>
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span>{Number(shop.avg_rating || 0).toFixed(1)}</span>
                    <span className={styles.reviews}>({shop.review_count || 0} reviews)</span>
                  </div>
                  {Number.isFinite(shop.distanceKm) && <div className={styles.distance}><MapPin size={12} /> {shop.distanceKm < 1 ? `${shop.distanceKm.toFixed(2)} km away` : `${shop.distanceKm.toFixed(1)} km away`}</div>}
                  {shop.description && <div className={styles.desc}>{shop.description.substring(0, 76)}{shop.description.length > 76 ? '…' : ''}</div>}
                  <div className={styles.cardFooter}>
                    {shop.min_price && <div className={styles.price}>From ₱{Number(shop.min_price).toFixed(0)}</div>}
                    <span className={styles.cardLink}>View shop <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}

        {view === 'map' && isSubscribed && (
          <div className={styles.mapContainer}>
            <Map
              markers={recommendedShops.filter(shop => shop.latitude && shop.longitude)}
              height="600px"
              onMarkerClick={marker => navigate(`/customer/barbershop/${marker.id}`)}
            />
          </div>
        )}
      </div>

      {showSubModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2><MapIcon size={21} /> Unlock Map View</h2>
              <button type="button" onClick={() => setShowSubModal(false)} aria-label="Close"><X size={18} /></button>
            </div>
            {subStatus?.subscription?.status === 'pending' ? (
              <div className={styles.pending}>
                <strong>Subscription Pending Review</strong>
                <p>Your subscription request is awaiting admin approval.</p>
              </div>
            ) : (
              <>
                <p className={styles.modalCopy}>Subscribe to unlock the interactive map. Subscriptions are ₱99/month.</p>
                {adminQr && (
                  <div className={styles.qrBox}>
                    <strong>Pay via {adminQr.type}</strong>
                    {adminQr.account_name && <div>{adminQr.account_name}</div>}
                    <img src={adminQr.qr_url} alt="Payment QR" />
                    <div>Scan and pay, then upload your receipt below.</div>
                  </div>
                )}
                <form onSubmit={handleSubRequest}>
                  <label className={styles.upload}>
                    <Upload size={16} /> {proofFile ? proofFile.name : 'Upload payment receipt'}
                    <input type="file" accept="image/*" onChange={event => setProofFile(event.target.files?.[0] || null)} />
                  </label>
                  <div className={styles.modalActions}>
                    <button type="submit" disabled={uploading || !proofFile}>{uploading ? 'Submitting...' : 'Submit Request'}</button>
                    <button type="button" onClick={() => setShowSubModal(false)}>Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
