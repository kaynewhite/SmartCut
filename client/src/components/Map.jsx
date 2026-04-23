import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Siniloan, Laguna, Philippines
export const SINILOAN_CENTER = [14.4119, 121.4524];
export const SINILOAN_BOUNDS = [
  [14.36, 121.40], // Southwest
  [14.46, 121.51]  // Northeast
];

const LocationMarker = ({ position, setPosition, draggable = false }) => {
  useMapEvents({
    click(e) {
      if (setPosition) {
        const lat = e.latlng.lat, lng = e.latlng.lng;
        // clamp to bounds
        if (lat >= SINILOAN_BOUNDS[0][0] && lat <= SINILOAN_BOUNDS[1][0] && lng >= SINILOAN_BOUNDS[0][1] && lng <= SINILOAN_BOUNDS[1][1]) {
          setPosition([lat, lng]);
        }
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
            const newPos = e.target.getLatLng();
            setPosition([newPos.lat, newPos.lng]);
          }
        },
      }}
    >
      <Popup>Your shop location</Popup>
    </Marker>
  );
};

export default function Map({
  center = SINILOAN_CENTER,
  zoom = 14,
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
      map.setMaxBounds(SINILOAN_BOUNDS);
      map.setMinZoom(13);
      map.setMaxZoom(19);
    }
  }, []);

  useEffect(() => {
    if (mapRef.current && markers.length > 0 && !selectedLocation) {
      const map = mapRef.current;
      const valid = markers.filter(m => m.latitude && m.longitude);
      if (valid.length > 0) {
        const markerBounds = L.latLngBounds(valid.map(m => [parseFloat(m.latitude), parseFloat(m.longitude)]));
        map.fitBounds(markerBounds, { padding: [40, 40], maxZoom: 17 });
      }
    }
  }, [markers, selectedLocation]);

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        maxBounds={SINILOAN_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        {/* Satellite imagery (Esri) */}
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        {/* Streets/labels overlay so users can see road & place names */}
        <TileLayer
          attribution=''
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.85}
        />
        <TileLayer
          attribution=''
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.95}
        />

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
