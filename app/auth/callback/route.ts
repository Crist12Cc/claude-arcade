// ===== app/auth/callback/route.ts — intercambio de code por sesión (SPEC 12) =====
// Recibe la vuelta de la confirmación de correo y de los providers OAuth
// (Supabase entrega un `code` en ambos casos) y lo canjea por una sesión.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect_to') ?? '/';
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
