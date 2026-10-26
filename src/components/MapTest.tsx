import 'leaflet/dist/leaflet.css';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom pulsing dot icon for current location using Tailwind classes / inline styles
const currentLocationIcon = L.divIcon({
  className: 'custom-location-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute w-6 h-6 bg-blue-500 opacity-30 rounded-full animate-ping"></div>
      <div class="w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Helper component to recenter the map when user location updates
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapTest() {
  // Default fallback: Urbana, IL center
  const [position, setPosition] = useState<[number, number]>([40.1164, -88.2434]);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setHasLocation(true);
      },
      (err) => {
        console.warn(`Geolocation error (${err.code}): ${err.message}`);
        setLocationError('Could not get your precise location. Showing default area.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  return (
    <div className="flex flex-col h-screen w-full p-4 bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">Leaflet Mobile & Desktop Test</h1>
        <p className="text-sm text-gray-600">
          {hasLocation ? 'Showing your current location.' : (locationError || 'Fetching location...')}
        </p>
      </div>

      {/* Map Container - h-96 or flex-grow so it renders properly on mobile screens */}
      <div className="relative flex-grow w-full h-[500px] rounded-xl overflow-hidden shadow-lg border border-gray-200">
        <MapContainer
          center={position}
          zoom={15}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={currentLocationIcon}>
            <Popup>
              <div className="text-xs font-medium">
                You are here 📍
                <br />
                Lat: {position[0].toFixed(4)}, Lng: {position[1].toFixed(4)}
              </div>
            </Popup>
          </Marker>
          <RecenterMap center={position} />
        </MapContainer>
      </div>
    </div>
  );
}