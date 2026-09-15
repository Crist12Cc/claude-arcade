import { redirect } from 'next/navigation';
import SalonClient from '@/components/SalonClient';
import { createClient } from '@/lib/supabase/server';
export default async function HallOfFamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/salon');
  const { data } = await supabase
    .from('games')
    .select('id, title')
    .order('title', { ascending: true });
  return <SalonClient games={data ?? []} />;
}
