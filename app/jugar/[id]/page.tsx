import { notFound } from 'next/navigation';
import GamePlayer from '@/components/GamePlayer';
import { createClient } from '@/lib/supabase/server';
import type { Game } from '@/lib/data';
export default async function GamePlayerPage(props: PageProps<'/jugar/[id]'>) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('games_with_stats')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const game = data as Game | null;
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
