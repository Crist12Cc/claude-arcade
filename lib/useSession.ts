'use client';
// ===== lib/useSession.ts — sesión respaldada por Supabase Auth (SPEC 04) =====
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
export interface StoredUser {
  id: string; // auth.uid()
  name: string;
}
/** Normaliza un nombre al formato arcade: mayúsculas, máx. 10 caracteres. */
function toArcadeName(raw: string): string {
  return raw.toUpperCase().slice(0, 10);
}
/** Nombre de respaldo cuando aún no se pudo leer el perfil. */
function fallbackName(authUser: User): string {
  const meta =
    typeof authUser.user_metadata?.username === 'string'
      ? authUser.user_metadata.username
      : '';
  const fromEmail = (authUser.email ?? '').split('@')[0];
  return toArcadeName(meta.trim() || fromEmail || 'PLAYER1');
}
export function useSession() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    let active = true;
    const resolve = async (authUser: User | null) => {
      if (!authUser) {
        if (active) setUser(null);
        return;
      }
      // Nombre provisional inmediato; luego se refina con el perfil.
      if (active) setUser({ id: authUser.id, name: fallbackName(authUser) });
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', authUser.id)
        .maybeSingle();
      if (!active) return;
      if (data?.username)
        setUser({ id: authUser.id, name: toArcadeName(data.username) });
    };
    supabase.auth.getUser().then(({ data }) => resolve(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);
  /** Modo invitado: no hay cuenta en Supabase, solo ausencia de sesión. */
  const signIn = useCallback((u: StoredUser | null) => {
    setUser(u);
  }, []);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);
  return { user, signIn, signOut };
}
