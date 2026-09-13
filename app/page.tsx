import Home from '@/components/Home';
import { createClient } from '@/lib/supabase/server';
import type { Game } from '@/lib/data';
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('games_with_stats')
    .select('*')
    .order('title', { ascending: true })
    .limit(6);
  return <Home games={(data ?? []) as Game[]} />;
}
