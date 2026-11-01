import L from 'leaflet';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { Circle, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { milesToMeters, parsePoint, toPointText } from '../lib/geo';
import type { LatLng } from '../lib/geo';
import { supabase } from '../lib/supabase';
import Button from './Button';
import MapPinPicker from './MapPinPicker';
import Spinner from './Spinner';

const MIN_MILES = 0.5;
const MAX_MILES = 5;
const DEFAULT_MILES = 1;

/** The database allows any radius from 0.5 to 5, the slider only halves. */
function snapMiles(value: number): number {
  const snapped = Math.round(value * 2) / 2;
  return Math.min(MAX_MILES, Math.max(MIN_MILES, snapped));
}

type LoadState = 'loading' | 'signed-out' | 'load-error' | 'ready';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function FitCircle({
  center,
  miles,
}: {
  center: LatLng | null;
  miles: number;
}) {
  const map = useMap();
  const fit = useEffectEvent(() => {
    if (!center) return;
    const size = milesToMeters(miles) * 2;
    map.fitBounds(L.latLng(center.lat, center.lng).toBounds(size), {
      animate: false,
    });
  });
  const hasCenter = center !== null;
  useEffect(() => {
    if (hasCenter) fit();
  }, [hasCenter, miles]);
  return null;
}

export default function HomeLocationForm() {
  const sliderId = useId();
  const [load, setLoad] = useState<LoadState>('loading');
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [miles, setMiles] = useState(DEFAULT_MILES);
  const [save, setSave] = useState<SaveState>('idle');
  const edits = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active) return;
        if (!session) {
          setLoad('signed-out');
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('home_location, alert_radius_miles')
          .eq('id', session.user.id)
          .single();
        if (!active) return;
        if (error) {
          setLoad('load-error');
          return;
        }
        setUserId(session.user.id);
        setPin(parsePoint(data.home_location));
        setMiles(snapMiles(Number(data.alert_radius_miles)));
        setLoad('ready');
      } catch {
        if (active) setLoad('load-error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const edit = () => {
    edits.current += 1;
    setSave('idle');
  };

  const changePin = (point: LatLng) => {
    setPin(point);
    edit();
  };

  const changeMiles = (value: number) => {
    setMiles(value);
    edit();
  };

  const saveHome = async () => {
    if (!pin) return;
    setSave('saving');
    const editsAtStart = edits.current;
    let saved = false;
    try {
      // An update that matches no row returns no error, so ask for the row back.
      const { data, error } = await supabase
        .from('profiles')
        .update({
          home_location: toPointText(pin),
          alert_radius_miles: miles,
        })
        .eq('id', userId)
        .select('id');
      saved = !error && data.length > 0;
    } catch {
      // A thrown request is a failed save.
    }
    // The user edited mid-save, so this result no longer applies.
    if (edits.current === editsAtStart) setSave(saved ? 'saved' : 'error');
  };

  if (load === 'loading') return <Spinner />;
  if (load === 'signed-out') {
    return (
      <Link to="/sign-in" className="text-sm font-semibold underline">
        Sign in
      </Link>
    );
  }
  if (load === 'load-error') {
    return <p role="alert">Could not load your home location.</p>;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-base font-semibold">Home location</h2>
      <MapPinPicker value={pin} onChange={changePin} className="h-72 md:h-96">
        {pin && (
          <Circle
            center={[pin.lat, pin.lng]}
            radius={milesToMeters(miles)}
            pathOptions={{ color: '#000', weight: 2 }}
          />
        )}
        <FitCircle center={pin} miles={miles} />
      </MapPinPicker>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={sliderId}
          className="flex justify-between text-sm font-medium"
        >
          <span>Alert radius</span>
          <span>{miles} mi</span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={MIN_MILES}
          max={MAX_MILES}
          step={0.5}
          value={miles}
          onChange={(e) => changeMiles(Number(e.target.value))}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={saveHome} disabled={!pin || save === 'saving'}>
          Save
        </Button>
        {save === 'saved' && <span className="text-sm">Saved</span>}
        {save === 'error' && (
          <span role="alert" className="text-sm text-red-700">
            Could not save
          </span>
        )}
      </div>
    </section>
  );
}
