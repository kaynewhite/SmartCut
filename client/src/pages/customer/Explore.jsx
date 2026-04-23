import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Layout from '../../components/Layout';
import Map from '../../components/Map';
import { Search, Star, MapPin, Scissors, List, MapIcon } from 'lucide-react';
import styles from './Explore.module.css';

export default function CustomerExplore() {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [view, setView] = useState('list');
  const [specialtyOptions, setSpecialtyOptions] = useState([]);

  useEffect(() => {
    api.get('/barbers/specialties').then(res => setSpecialtyOptions(res.data || [])).catch(() => {});
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
              <select value={specialty} onChange={e => setSpecialty(e.target.value)} style={{background:'transparent',border:'none',color:'inherit',outline:'none',width:'100%'}}>
                <option value="">All Specialties</option>
                {specialtyOptions.map(s => <option key={s} value={s} style={{background:'#1a2234'}}>{s}</option>)}
              </select>
            </div>
            <div className={styles.searchInput}>
              <span style={{fontSize:12,color:'#6b7280'}}>₱ Max</span>
              <input type="number" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
            <button type="submit" className={styles.searchBtn}>Search</button>
          </div>
        </form>

        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`} onClick={() => setView('list')}>
            <List size={16} /> List
          </button>
          <button className={`${styles.viewBtn} ${view === 'map' ? styles.active : ''}`} onClick={() => setView('map')}>
            <MapIcon size={16} /> Map
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}><Scissors size={32} color="#374151" /><p>Finding barbershops...</p></div>
        ) : shops.length === 0 ? (
          <div className={styles.empty}><Scissors size={40} color="#374151" /><p>No barbershops found. Try adjusting your search.</p></div>
        ) : view === 'map' ? (
          <div className={styles.mapContainer}>
            <Map
              markers={shops.filter(shop => shop.latitude && shop.longitude).map(shop => ({
                id: shop.id,
                name: shop.name,
                address: shop.address,
                city: shop.city,
                latitude: shop.latitude,
                longitude: shop.longitude
              }))}
              height="600px"
              onMarkerClick={(marker) => navigate(`/customer/barbershop/${marker.id}`)}
            />
          </div>
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
                  {shop.description && <div className={styles.desc}>{shop.description.substring(0,60)}...</div>}
                  {shop.min_price && (
                    <div className={styles.price}>From ₱{parseFloat(shop.min_price).toFixed(0)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
