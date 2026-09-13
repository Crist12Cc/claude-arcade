// ===== lib/supabase/server.ts — cliente de Supabase para Server Components y Route Handlers (SPEC 04) =====
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export async function createClient() {
  // En Next 16 `cookies()` es asíncrona.
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: el refresco de sesión ya lo
            // hace `proxy.ts`, así que se puede ignorar sin riesgo.
          }
        },
      },
    },
  );
}
