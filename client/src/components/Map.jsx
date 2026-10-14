import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const SINILOAN_CENTER = [14.4232089, 121.4452652];
export const DEFAULT_ZOOM = 17;

const InvalidateOnMount = () => {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return null;
};

const ClickToSet = ({ setPosition }) => {
  useMapEvents({
    click(e) {
      if (setPosition) setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const SyncMapView = ({ points, selectedLocation, zoom }) => {
  const map = useMap();
  const pointsKey = points.map(point => point.join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [24, 24], maxZoom: zoom });
    } else if (points.length === 1) {
      map.setView(points[0], zoom);
    } else if (selectedLocation) {
      map.setView(selectedLocation, zoom);
    }
  }, [map, pointsKey, selectedLocation?.[0], selectedLocation?.[1], zoom]);
  return null;
};

export default function Map({
  zoom = DEFAULT_ZOOM,
  markers = [],
  onLocationSelect,
  selectedLocation,
  height = '400px',
  interactive = true,
  onMarkerClick
}) {
  const validMarkers = markers.map(marker => ({
    marker,
    point: [Number(marker.latitude), Number(marker.longitude)]
  })).filter(({ point }) => point.every(Number.isFinite) &&
    (point[0] !== 0 || point[1] !== 0));
  const points = validMarkers.map(({ point }) => point);
  const initialCenter = selectedLocation || points[0] || SINILOAN_CENTER;

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={19}
        />

        <InvalidateOnMount />
        <SyncMapView points={points} selectedLocation={selectedLocation} zoom={zoom} />

        {validMarkers.map(({ marker, point }, index) => (
          <Marker
            key={marker.id || index}
            position={point}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(marker)
            }}
          >
            <Popup>
              <div>
                <strong>{marker.name}</strong>
                {marker.address && <div>{marker.address}</div>}
                {marker.city && <div>{marker.city}</div>}
              </div>
            </Popup>
          </Marker>
        ))}

        {onLocationSelect && (
          <>
            <ClickToSet setPosition={onLocationSelect} />
            {selectedLocation && (
              <Marker position={selectedLocation}>
                <Popup>Selected location</Popup>
              </Marker>
            )}
          </>
        )}
      </MapContainer>
    </div>
  );
}
