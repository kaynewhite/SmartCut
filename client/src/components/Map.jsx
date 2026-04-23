import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const SINILOAN_CENTER = [14.413480043065805, 121.44852231660464];
export const DEFAULT_ZOOM = 17;

const RecenterOnChange = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.setView(center, zoom || map.getZoom(), { animate: true });
    setTimeout(() => map.invalidateSize(), 100);
  }, [center?.[0], center?.[1]]);
  return null;
};

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

export default function Map({
  center = SINILOAN_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  onLocationSelect,
  selectedLocation,
  height = '400px',
  interactive = true,
  onMarkerClick
}) {
  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <InvalidateOnMount />
        <RecenterOnChange center={center} zoom={zoom} />

        {markers.filter(m => m.latitude && m.longitude).map((marker, index) => (
          <Marker
            key={marker.id || index}
            position={[parseFloat(marker.latitude), parseFloat(marker.longitude)]}
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
