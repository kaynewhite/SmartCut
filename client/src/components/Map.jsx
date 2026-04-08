import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Siniloan, Laguna coordinates
const SINILOAN_CENTER = [14.42, 121.45];
const SINILOAN_BOUNDS = [
  [14.35, 121.35], // Southwest
  [14.50, 121.55]  // Northeast
];

const LocationMarker = ({ position, setPosition, draggable = false }) => {
  const map = useMapEvents({
    click(e) {
      if (setPosition) {
        setPosition([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return position === null ? null : (
    <Marker
      position={position}
      draggable={draggable}
      eventHandlers={{
        dragend: (e) => {
          if (setPosition) {
            const marker = e.target;
            const newPos = marker.getLatLng();
            setPosition([newPos.lat, newPos.lng]);
          }
        },
      }}
    >
      <Popup>You are here</Popup>
    </Marker>
  );
};

export default function Map({ 
  center = SINILOAN_CENTER, 
  zoom = 13, 
  markers = [], 
  onLocationSelect, 
  selectedLocation, 
  height = '400px',
  interactive = true,
  onMarkerClick
}) {
  const mapRef = useRef();

  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      // Restrict map to Siniloan bounds
      map.setMaxBounds(SINILOAN_BOUNDS);
      map.setMinZoom(11);
      map.setMaxZoom(18);
    }
  }, []);

  // If there are markers and no specific center, fit bounds to markers
  useEffect(() => {
    if (mapRef.current && markers.length > 0 && !selectedLocation) {
      const map = mapRef.current;
      const markerBounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]));
      map.fitBounds(markerBounds, { padding: [20, 20] });
    }
  }, [markers, selectedLocation]);

  return (
    <div style={{ height, width: '100%' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {markers.map((marker, index) => (
          <Marker 
            key={index} 
            position={[marker.latitude, marker.longitude]}
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
          <LocationMarker 
            position={selectedLocation} 
            setPosition={onLocationSelect}
            draggable={true}
          />
        )}
      </MapContainer>
    </div>
  );
}