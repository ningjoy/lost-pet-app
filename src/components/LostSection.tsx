import { useEffect, useState } from 'react';
import { formatSeenAt } from '../lib/lostReport';
import { supabase } from '../lib/supabase';
import Button from './Button';
import MarkLostForm from './MarkLostForm';
import type { CreatedReport } from './MarkLostForm';
import Spinner from './Spinner';

type LostSectionProps = {
  petId: string;
  ownerId: string;
};

type LoadState = 'loading' | 'error' | 'ready';

/**
 * The lost-pet part of a pet page: shows the open report, or lets the owner
 * start one. Fetches its own data, so any pet page can drop it in.
 */
export default function LostSection({ petId, ownerId }: LostSectionProps) {
  const [load, setLoad] = useState<LoadState>('loading');
  const [userId, setUserId] = useState('');
  const [report, setReport] = useState<CreatedReport | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const { data, error } = await supabase
          .from('lost_reports')
          .select('id, last_seen_at')
          .eq('pet_id', petId)
          .eq('status', 'open')
          .maybeSingle();
        if (!active) return;
        if (error) {
          setLoad('error');
          return;
        }
        setUserId(session?.user.id ?? '');
        setReport(data);
        setLoad('ready');
      } catch {
        if (active) setLoad('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [petId, reloads]);

  if (load === 'loading') return <Spinner />;
  if (load === 'error') {
    return <p role="alert">Could not load this pet&apos;s lost status.</p>;
  }

  if (report) {
    return (
      <p role="status" className="text-sm">
        <span className="rounded bg-red-700 px-2 py-1 font-semibold text-white">
          Lost
        </span>{' '}
        Last seen {formatSeenAt(report.last_seen_at)}
      </p>
    );
  }

  if (userId !== ownerId) return null;

  if (!formOpen) {
    return <Button onClick={() => setFormOpen(true)}>Mark lost</Button>;
  }

  return (
    <MarkLostForm
      petId={petId}
      ownerId={ownerId}
      onCreated={(created) => {
        setReport(created);
        setFormOpen(false);
      }}
      onAlreadyOpen={() => {
        setFormOpen(false);
        setReloads((n) => n + 1);
      }}
      onCancel={() => setFormOpen(false)}
    />
  );
}
