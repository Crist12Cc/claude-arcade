import BibliotecaClient from '@/components/BibliotecaClient';
import { createClient } from '@/lib/supabase/server';
import type { Game } from '@/lib/data';
export default async function Biblioteca() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('games_with_stats')
    .select('*')
    .order('title', { ascending: true });
  const games = (data ?? []) as Game[];
  return <BibliotecaClient games={games} />;
}
