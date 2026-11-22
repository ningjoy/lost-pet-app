import { z } from 'zod';
import type { LatLng } from './geo';
import { toPointText } from './geo';
import { supabase } from './supabase';

export const SIGHTING_NOTE_MAX = 500;
// Must match the pet-photos bucket in supabase/migrations/20261106211526_photo_bucket.sql.
export const SIGHTING_PHOTO_MAX_BYTES = 5242880;
export const SIGHTING_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const PHOTO_BUCKET = 'pet-photos';

const EXTENSIONS: Record<(typeof SIGHTING_PHOTO_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const sightingSchema = z.object({
  pin: z.object({ lat: z.number(), lng: z.number() }),
  seenAt: z.date().refine((d) => d.getTime() <= Date.now(), {
    message: 'Time seen cannot be in the future',
  }),
  note: z
    .string()
    .trim()
    .max(SIGHTING_NOTE_MAX)
    .transform((s) => (s === '' ? null : s)),
  photo: z
    .instanceof(File)
    .refine(
      (f) => (SIGHTING_PHOTO_TYPES as readonly string[]).includes(f.type),
      { message: 'Photo must be a JPEG, PNG or WebP image' },
    )
    .refine((f) => f.size <= SIGHTING_PHOTO_MAX_BYTES, {
      message: 'Photo must be 5 MB or smaller',
    })
    .optional(),
});

export type SightingInput = z.input<typeof sightingSchema>;
export type SightingValues = z.output<typeof sightingSchema>;

export async function submitSighting({
  reportId,
  userId,
  pin,
  seenAt,
  note,
  photo,
}: {
  reportId: string;
  userId: string;
  pin: LatLng;
  seenAt: Date;
  note: string | null;
  photo?: File;
}): Promise<void> {
  let photoPath: string | null = null;
  if (photo) {
    const ext = EXTENSIONS[photo.type as keyof typeof EXTENSIONS] ?? 'jpg';
    photoPath = `${userId}/sightings/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photo);
    if (error) throw error;
  }

  const { error } = await supabase.from('sightings').insert({
    report_id: reportId,
    reporter_id: userId,
    location: toPointText(pin),
    seen_at: seenAt.toISOString(),
    photo_path: photoPath,
    note,
  });
  if (error) {
    // Best effort: do not leave an orphan photo behind.
    if (photoPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    }
    throw error;
  }
}
