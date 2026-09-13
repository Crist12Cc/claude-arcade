// ===== proxy.ts — refresco de la sesión de Supabase en cada request (SPEC 04) =====
// En Next 16 el convenio `middleware.ts` está deprecado y se renombró a `proxy.ts`.
// No protege ninguna ruta: solo mantiene viva la cookie de sesión.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  // Refresca el token expirado y reescribe las cookies en la respuesta.
  await supabase.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes optimizadas, el favicon y archivos de imagen.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
