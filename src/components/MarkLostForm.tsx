import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toPointText } from '../lib/geo';
import type { LatLng } from '../lib/geo';
import {
  DUPLICATE_OPEN_REPORT,
  parseLocalInput,
  toLocalInputValue,
} from '../lib/lostReport';
import { supabase } from '../lib/supabase';
import Button from './Button';
import MapPinPicker from './MapPinPicker';

export type CreatedReport = { id: string; last_seen_at: string };

type MarkLostFormProps = {
  petId: string;
  ownerId: string;
  onCreated: (report: CreatedReport) => void;
  /** Another report was opened for this pet before this one saved. */
  onAlreadyOpen: () => void;
  onCancel: () => void;
};

export default function MarkLostForm({
  petId,
  ownerId,
  onCreated,
  onAlreadyOpen,
  onCancel,
}: MarkLostFormProps) {
  const timeId = useId();
  const [pin, setPin] = useState<LatLng | null>(null);
  const [seenAt, setSeenAt] = useState(() => toLocalInputValue(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pin) {
      setError('Tap the map to mark where your pet was last seen.');
      return;
    }
    const seen = parseLocalInput(seenAt);
    if (!seen) {
      setError('Enter when your pet was last seen.');
      return;
    }
    if (seen.getTime() > Date.now()) {
      setError('The last seen time cannot be in the future.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from('lost_reports')
        .insert({
          pet_id: petId,
          owner_id: ownerId,
          last_seen_location: toPointText(pin),
          last_seen_at: seen.toISOString(),
        })
        .select('id, last_seen_at')
        .single();
      if (insertError?.code === DUPLICATE_OPEN_REPORT) {
        onAlreadyOpen();
        return;
      }
      if (insertError || !data) {
        setError('Could not save the report. Try again.');
        return;
      }
      onCreated(data);
    } catch {
      setError('Could not save the report. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col gap-4"
    >
      <p className="text-sm">Tap the map where your pet was last seen.</p>
      <MapPinPicker value={pin} onChange={setPin} className="h-72 md:h-96" />

      <div className="flex flex-col gap-1">
        <label htmlFor={timeId} className="text-sm font-medium">
          Last seen at
        </label>
        <input
          id={timeId}
          type="datetime-local"
          value={seenAt}
          onChange={(e) => setSeenAt(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Report lost'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
