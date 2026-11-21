import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import SafetyScreen from '../components/SafetyScreen';
import SightingForm from '../components/SightingForm';
import Spinner from '../components/Spinner';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

type ReportData = {
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

  useEffect(() => {
    let stale = false;
    supabase
      .from('lost_reports')
      .select('status, last_seen_at, pets(name, photo_paths)')
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
          setStep('view');
        }}
        onCancel={() => setStep('view')}
      />
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
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
