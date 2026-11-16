import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LostSection from '../components/LostSection';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import { supabase } from '../lib/supabase';

type PetRow = { id: string; name: string; species: string; owner_id: string };
type LoadState = 'loading' | 'error' | 'missing' | 'ready';

export default function Pet() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<LoadState>('loading');
  const [pet, setPet] = useState<PetRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('pets')
          .select('id, name, species, owner_id')
          .eq('id', id)
          .maybeSingle();
        if (!active) return;
        if (error) {
          setLoad('error');
          return;
        }
        setPet(data);
        setLoad(data ? 'ready' : 'missing');
      } catch {
        if (active) setLoad('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (load === 'loading') return <Spinner />;
  if (load === 'error') return <p role="alert">Could not load this pet.</p>;
  if (!pet) return <p>Pet not found.</p>;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={pet.name} backTo="/my-pets" />
      <p className="text-sm">{pet.species}</p>
      <LostSection petId={pet.id} ownerId={pet.owner_id} />
    </div>
  );
}
