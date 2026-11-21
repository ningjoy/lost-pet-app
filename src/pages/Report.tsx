import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import ReportMap from '../components/ReportMap';
import SafetyScreen from '../components/SafetyScreen';
import SightingForm from '../components/SightingForm';
import Spinner from '../components/Spinner';
import { useAuth } from '../lib/auth-context';
import { parsePoint } from '../lib/geo';
import { fetchSightings } from '../lib/sighting';
import type { Sighting } from '../lib/sighting';
import { supabase } from '../lib/supabase';

type ReportData = {
  owner_id: string;
  last_seen_location: unknown;
  status: string;
  last_seen_at: string;
  pets: { name: string; photo_paths: string[] } | null;
};
type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'missing' }
  | { kind: 'ready'; report: ReportData };
type Step = 'view' | 'safety' | 'form';

let channelCount = 0;

export default function Report() {
  const { id } = useParams();
  // key resets the safety step when the route moves to another report.
  return <ReportView key={id} id={id} />;
}

function ReportView({ id }: { id: string | undefined }) {
  const userId = useAuth().session?.user.id;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<Step>('view');
  const [sent, setSent] = useState(false);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [sightingsError, setSightingsError] = useState(false);
  const [sightingsTick, setSightingsTick] = useState(0);
  const refetchSightings = () => setSightingsTick((n) => n + 1);

  useEffect(() => {
    if (!id) return;
    let stale = false;
    fetchSightings(id)
      .then((rows) => {
        if (stale) return;
        setSightings(rows);
        setSightingsError(false);
      })
      .catch(() => {
        if (!stale) setSightingsError(true);
      });
    return () => {
      stale = true;
    };
  }, [id, sightingsTick]);

  useEffect(() => {
    if (!id) return;
    // A unique name per subscription: channel() reuses a same-named channel
    // that removeChannel has not finished closing, and that one stays silent.
    const subscribe = () =>
      supabase
        .channel(`sightings:${id}:${++channelCount}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sightings',
            filter: `report_id=eq.${id}`,
          },
          () => setSightingsTick((n) => n + 1),
        )
        // Refetch once live, to catch sightings posted before the socket joined.
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setSightingsTick((n) => n + 1);
        });
    let channel = subscribe();
    // iPhone pauses home screen apps, so the socket may be dead on return.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.removeChannel(channel);
      channel = subscribe();
      setSightingsTick((n) => n + 1);
      setAttempt((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    let stale = false;
    supabase
      .from('lost_reports')
      .select(
        'status, owner_id, last_seen_at, last_seen_location, pets(name, photo_paths)',
      )
      .eq('id', id ?? '')
      .maybeSingle()
      .then(({ data, error }) => {
        if (stale) return;
        if (error) setLoad({ kind: 'error' });
        else if (!data) setLoad({ kind: 'missing' });
        else setLoad({ kind: 'ready', report: data as unknown as ReportData });
      });
    return () => {
      stale = true;
    };
  }, [id, attempt]);

  function retry() {
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  if (load.kind === 'loading') return <Spinner />;
  if (load.kind === 'missing') {
    return <p role="alert">Report not found</p>;
  }
  if (load.kind === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-red-600">
          Could not load report
        </p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }

  const { report } = load;
  const photoPath = report.pets?.photo_paths[0];
  const photoUrl = photoPath
    ? supabase.storage.from('pet-photos').getPublicUrl(photoPath).data.publicUrl
    : null;

  if (step === 'safety') {
    return <SafetyScreen onAcknowledge={() => setStep('form')} />;
  }
  if (step === 'form' && userId && id) {
    return (
      <SightingForm
        reportId={id}
        userId={userId}
        onDone={() => {
          setSent(true);
          refetchSightings();
          setStep('view');
        }}
        onCancel={() => setStep('view')}
      />
    );
  }

  const lastSeen = parsePoint(report.last_seen_location);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={report.pets?.name ?? 'Report'} backTo="/" />
      {photoUrl && (
        <img
          src={photoUrl}
          alt={report.pets?.name ?? ''}
          className="aspect-square w-full rounded object-cover"
        />
      )}
      <dl className="text-sm">
        <dt className="font-semibold">Last seen</dt>
        <dd>{new Date(report.last_seen_at).toLocaleString()}</dd>
        <dt className="mt-2 font-semibold">Status</dt>
        <dd className="capitalize">{report.status}</dd>
      </dl>
      {lastSeen && (
        <ReportMap
          lastSeen={lastSeen}
          sightings={sightings}
          isOwner={userId === report.owner_id}
        />
      )}
      {sightingsError && (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-red-600">
            Could not load sightings
          </p>
          <Button onClick={refetchSightings}>Retry</Button>
        </div>
      )}
      {sent && <p role="status">Sighting sent</p>}
      {report.status === 'open' && userId && (
        <Button
          onClick={() => {
            setSent(false);
            setStep('safety');
          }}
        >
          I saw this pet
        </Button>
      )}
    </div>
  );
}
