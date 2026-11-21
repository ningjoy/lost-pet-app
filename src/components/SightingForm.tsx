import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LatLng } from '../lib/geo';
import {
  SIGHTING_NOTE_MAX,
  SIGHTING_PHOTO_TYPES,
  sightingSchema,
  submitSighting,
} from '../lib/sighting';
import Button from './Button';
import MapPinPicker from './MapPinPicker';
import TextInput from './TextInput';

type SightingFormProps = {
  reportId: string;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
};

type Field = 'pin' | 'seenAt' | 'photo' | 'note';
type Errors = Partial<Record<Field, string>>;

/** The value format datetime-local expects: local time, to the minute. */
function toLocalInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-red-700">
      {message}
    </p>
  ) : null;
}

export default function SightingForm({
  reportId,
  userId,
  onDone,
  onCancel,
}: SightingFormProps) {
  const [now] = useState(() => toLocalInput(new Date()));
  const [pin, setPin] = useState<LatLng | null>(null);
  const [seenAt, setSeenAt] = useState(now);
  const [photo, setPhoto] = useState<File | undefined>();
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const seenDate = new Date(seenAt);
    const result = sightingSchema.safeParse({
      pin,
      seenAt: seenDate,
      note,
      photo,
    });
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as Field;
        if (next[field]) continue;
        next[field] =
          field === 'pin'
            ? 'Tap the map to place the pin'
            : Number.isNaN(seenDate.getTime()) && field === 'seenAt'
              ? 'Enter a valid time'
              : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFailed(false);
    setSaving(true);
    try {
      await submitSighting({
        reportId,
        userId,
        pin: result.data.pin,
        seenAt: result.data.seenAt,
        note: result.data.note,
        photo: result.data.photo,
      });
      onDone();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <MapPinPicker value={pin} onChange={setPin} className="h-72 md:h-96" />
        <FieldError message={errors.pin} />
      </div>

      <div className="flex flex-col gap-1">
        <TextInput
          label="Time seen"
          type="datetime-local"
          value={seenAt}
          max={now}
          onChange={(e) => setSeenAt(e.target.value)}
        />
        <FieldError message={errors.seenAt} />
      </div>

      <div className="flex flex-col gap-1">
        <TextInput
          label="Photo (optional)"
          type="file"
          accept={SIGHTING_PHOTO_TYPES.join(',')}
          onChange={(e) => setPhoto(e.target.files?.[0])}
        />
        <FieldError message={errors.photo} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sighting-note" className="text-sm font-medium">
          Note (optional)
        </label>
        <textarea
          id="sighting-note"
          rows={3}
          maxLength={SIGHTING_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <FieldError message={errors.note} />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send Sighting'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {failed && (
          <span role="alert" className="text-sm text-red-700">
            Could not save. Try again.
          </span>
        )}
      </div>
    </form>
  );
}
