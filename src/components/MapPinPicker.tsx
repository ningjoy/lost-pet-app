import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLng } from '../lib/geo';

// Urbana, IL
const DEFAULT_CENTER: LatLng = { lat: 40.1164, lng: -88.2434 };
const DEFAULT_ZOOM = 14;

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="h-5 w-5 rounded-full border-2 border-white bg-black shadow-md"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type MapPinPickerProps = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  /** Extra map layers, such as a radius circle. */
  children?: ReactNode;
  className?: string;
};

function ClickToPlace({ onPlace }: { onPlace: (point: LatLng) => void }) {
  useMapEvents({
    click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function KeepPinInView({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value && !map.getBounds().contains([value.lat, value.lng])) {
      map.setView([value.lat, value.lng]);
    }
  }, [map, value]);
  return null;
}

/**
 * The parent owns the pin. With no value on mount, the pin starts at the
 * user's current location, so mount this only after any saved pin has loaded.
 */
export default function MapPinPicker({
  value,
  onChange,
  children,
  className = 'h-72',
}: MapPinPickerProps) {
  const userPlaced = useRef(false);

  const place = (point: LatLng) => {
    userPlaced.current = true;
    onChange(point);
  };

  const startAtCurrentLocation = useEffectEvent((point: LatLng) => {
    if (!userPlaced.current && !value) onChange(point);
  });

  useEffect(() => {
    if (value || !navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (active) {
          startAtCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      },
      () => {},
      { timeout: 10000 },
    );
    return () => {
      active = false;
    };
    // Ask once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const center = value ?? DEFAULT_CENTER;

  return (
    <div className={`isolate overflow-hidden rounded ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={DEFAULT_ZOOM}
        doubleClickZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onPlace={place} />
        <KeepPinInView value={value} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                place({ lat, lng });
              },
            }}
          />
        )}
        {children}
      </MapContainer>
    </div>
  );
}
