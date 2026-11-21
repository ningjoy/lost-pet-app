import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import type { ReactNode } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LatLng } from '../lib/geo';
import type { Sighting } from '../lib/sighting';
import { supabase } from '../lib/supabase';

const lastSeenIcon = L.divIcon({
  className: '',
  html: '<div data-marker="last-seen" class="h-5 w-5 rounded-full border-2 border-white bg-red-600 shadow-md"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const sightingIcons = {
  confirmed: L.divIcon({
    className: '',
    html: '<div data-marker="confirmed" class="h-5 w-5 rounded-full border-2 border-white bg-black shadow-md"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  }),
  unconfirmed: L.divIcon({
    className: '',
    html: '<div data-marker="unconfirmed" class="h-5 w-5 rounded-full border-2 border-black bg-white shadow-md"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  }),
};

const STATUS_LABELS = { confirmed: 'Confirmed', unconfirmed: 'Unconfirmed' };

type ReportMapProps = {
  lastSeen: LatLng;
  sightings: Sighting[];
  isOwner: boolean;
  /** Owner-only slot inside each sighting popup. */
  renderActions?: (sighting: Sighting) => ReactNode;
};

export default function ReportMap({
  lastSeen,
  sightings,
  isOwner,
  renderActions,
}: ReportMapProps) {
  return (
    <div className="isolate h-72 overflow-hidden rounded md:h-96">
      <MapContainer
        center={[lastSeen.lat, lastSeen.lng]}
        zoom={14}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lastSeen.lat, lastSeen.lng]} icon={lastSeenIcon}>
          <Popup>Last seen</Popup>
        </Marker>
        <MarkerClusterGroup chunkedLoading>
          {sightings.map((s) => (
            <Marker
              key={s.id}
              position={[s.point.lat, s.point.lng]}
              icon={sightingIcons[s.status]}
            >
              <Popup>
                <SightingPopup sighting={s} />
                {isOwner && renderActions?.(s)}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

function SightingPopup({ sighting }: { sighting: Sighting }) {
  const photoUrl = sighting.photoPath
    ? supabase.storage.from('pet-photos').getPublicUrl(sighting.photoPath).data
        .publicUrl
    : null;
  return (
    <div className="flex max-w-48 flex-col gap-1">
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Sighting"
          loading="lazy"
          className="w-full rounded"
        />
      )}
      <p className="font-semibold">{STATUS_LABELS[sighting.status]}</p>
      <p>{new Date(sighting.seenAt).toLocaleString()}</p>
      {sighting.note && <p className="break-words">{sighting.note}</p>}
    </div>
  );
}
