# SPEC 12 — Autenticación endurecida: rutas protegidas, confirmación de correo y OAuth

**Estado:** Implementado
**Depende de:** SPEC 04
**Fecha:** 2026-09-15

**Objetivo:** Cerrar tres huecos que SPEC 04 dejó explícitamente fuera de alcance — proteger `/salon` con sesión obligatoria, activar la confirmación de correo tras el registro, y habilitar los botones OAuth de Google y GitHub — todo a través de una ruta compartida `/auth/callback`.

## Alcance

**Incluye:**

- **Ruta protegida `/salon`.** Si no hay sesión activa, redirige a `/login?redirect=/salon`. `/jugar/[id]` y todo lo demás sigue público; el modo invitado no cambia.
- **Redirect post-login configurable.** `app/login/page.tsx` lee `?redirect=` de la URL; tras `signInWithPassword` exitoso (o vuelta de OAuth) navega ahí en vez de siempre a `/`. Sin el parámetro, se mantiene el comportamiento actual (`/`).
- **Confirmación de correo activada.** Se activa "Confirm email" en el dashboard de Supabase. `signUp` deja de devolver sesión inmediata.
  - Tras un `signUp` exitoso, la tarjeta de `/login` cambia a un estado `awaiting-confirmation` con el mensaje "Revisa tu correo para confirmar tu cuenta" (sin redirigir a `/`, sin navegar).
  - Se crea `app/auth/callback/route.ts` (Route Handler) que recibe `code`, llama a `supabase.auth.exchangeCodeForSession(code)` y redirige a `/` (o a `redirect_to` si viene en la URL de confirmación).
- **OAuth Google y GitHub.** Ambos providers se configuran en el dashboard de Supabase (client ID/secret provistos por el usuario fuera de esta sesión de código). Los botones ◆ GOOGLE y ▣ GITHUB en `/login` dejan de estar `disabled` y llaman a `supabase.auth.signInWithOAuth({ provider: 'google' | 'github', options: { redirectTo: <origin>/auth/callback } })`. El mismo `app/auth/callback/route.ts` de confirmación de correo maneja la vuelta del provider.
- Traducción de nuevos estados de error/carga en español, siguiendo el patrón ya usado en `translateAuthError`.

**Fuera de alcance:**

- Recuperación de contraseña ("olvidé mi contraseña").
- Edición de perfil, cambio de correo o de contraseña desde la UI.
- Proteger `/jugar/[id]` o eliminar el modo invitado — se mantiene tal cual.
- Registrar las OAuth Apps en Google Cloud Console / GitHub Developer Settings — es una tarea manual del usuario en las consolas externas; este spec solo consume las credenciales ya cargadas en el dashboard de Supabase.
- Manejo de vinculación de identidades (un mismo email con password + OAuth simultáneos).
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

No se introducen nuevas tablas. No hay cambios en `public.profiles` ni en `StoredUser`.

El trigger `on_auth_user_created` (SPEC 04) ya inserta `profiles` desde `raw_user_meta_data.username`; para un registro por OAuth (que no pasa por el formulario y no trae `username`), el trigger debe seguir funcionando con un fallback. Se ajusta así:

```sql
-- Ajuste al trigger existente: username fallback a la parte del email antes de @
-- cuando raw_user_meta_data no trae 'username' (caso OAuth).
coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
```

## Plan de implementación

1. **Activar "Confirm email" y configurar Google/GitHub en el dashboard de Supabase.** Requiere que el usuario provea client ID/secret de cada provider (obtenidos fuera de esta sesión). Verificación: `list_extensions`/dashboard muestra ambos providers habilitados y "Confirm email" activo. Sistema funcional: sin cambios de código aún, pero `signUp` ya no da sesión inmediata (afecta el flujo hasta el paso 3).

2. **Ajustar el trigger `on_auth_user_created`** con `apply_migration` para el fallback de `username` en registros OAuth. Verificar con `get_advisors` que no rompe RLS. Sistema funcional: build y app sin cambios visibles.

3. **Crear `app/auth/callback/route.ts`.** Antes de escribir código, leer la guía de Route Handlers en `node_modules/next/dist/docs/` para Next 16.3.4 (la firma puede diferir de ejemplos públicos de Supabase). Recibe `code` y opcionalmente `redirect_to`, llama a `exchangeCodeForSession`, y redirige. Sistema funcional: la ruta existe y compila; nada la invoca todavía.

4. **Estado `awaiting-confirmation` en `app/login/page.tsx`.** Tras un `signUp` exitoso sin sesión (detectable porque `data.session` es `null`), mostrar el mensaje de "revisa tu correo" en vez de navegar. Verificación: crear una cuenta nueva muestra el mensaje y no redirige.

5. **Habilitar botones OAuth.** Quitar `disabled`/`title="Próximamente"` de GOOGLE y GITHUB, cablear `signInWithOAuth` con `redirectTo` apuntando a `/auth/callback`. Verificación manual: click en cada botón redirige al provider y, tras autorizar, vuelve autenticado a `/`.

6. **Redirect post-login con `?redirect=`.** Leer el query param con `useSearchParams`, usarlo en el `router.push` final de `signInWithPassword` y como `redirectTo` de OAuth cuando esté presente. Verificación: entrar a `/salon` sin sesión, loguearse, termina en `/salon`.

7. **Proteger `/salon`.** En `app/salon/page.tsx` (o su Server Component contenedor), leer la sesión con el cliente de servidor (`lib/supabase/server.ts`) y redirigir con `redirect('/login?redirect=/salon')` si no hay usuario. Verificación: `/salon` sin sesión redirige; con sesión, se ve igual que antes.

8. **Verificación final.** `npm run build` y `npm run lint` sin errores. `get_advisors` sin problemas nuevos. Probar manualmente: registro → mensaje de confirmación → clic en el link del correo → sesión activa en `/`; login con Google; login con GitHub; entrar a `/salon` sin sesión → redirige a login → tras loguear vuelve a `/salon`; invitado sigue jugando en `/jugar/[id]` sin cuenta.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] "Confirm email" está activo en el dashboard de Supabase.
- [ ] Registrarse desde `/login` ya no navega a `/`: muestra el mensaje "revisa tu correo" en la misma tarjeta.
- [ ] Confirmar el correo (clic en el link recibido) redirige a `/` con sesión activa.
- [ ] Los botones ◆ GOOGLE y ▣ GITHUB están habilitados y cada uno completa un login real contra su provider.
- [ ] Un registro por OAuth crea la fila en `profiles` con `username` derivado del email cuando el provider no entrega uno.
- [ ] Entrar a `/salon` sin sesión redirige a `/login?redirect=/salon`.
- [ ] Iniciar sesión (password u OAuth) desde ese redirect vuelve a `/salon` en vez de `/`.
- [ ] Iniciar sesión sin el parámetro `redirect` sigue navegando a `/` como hoy.
- [ ] `/jugar/[id]` sigue accesible en modo invitado, sin exigir sesión.
- [ ] `get_advisors` no reporta problemas de seguridad nuevos tras el ajuste del trigger.

## Decisiones tomadas y descartadas

- **Solo `/salon` se protege, no `/jugar/[id]`**: proteger jugar habría implicado eliminar el modo invitado, que el usuario decidió conservar intacto para este spec.
- **Una sola ruta `/auth/callback` para confirmación de correo y OAuth**, no dos separadas: ambos flujos terminan igual (Supabase entrega un `code` que se intercambia por sesión), duplicar la ruta sería redundante.
- **Mensaje de confirmación inline en la misma tarjeta**, no una ruta `/verificar-correo` dedicada: mantiene el patrón de estados (`idle`/`sending`/`error`) ya usado en SPEC 04 sin crear una página nueva de un solo mensaje.
- **Redirect post-login vía query param `?redirect=`**, no un store global de "próxima ruta": es el patrón estándar de Next para este caso y no requiere estado adicional.
- **Configuración de providers OAuth queda fuera del código**: registrar las apps en Google Cloud Console y GitHub requiere secretos que el usuario debe generar y cargar él mismo en el dashboard de Supabase; el spec solo asume que ya están cargados al llegar al paso 5.
- **No se protege `/jugar/[id]` ni se toca el modo invitado**: decisión explícita del usuario en la fase de clarificación, para no romper la UX actual de "jugar sin cuenta".

## Riesgos identificados

- Activar "Confirm email" sin haber probado antes puede dejar cuentas de prueba ya creadas en un estado "no confirmado" que no pueden iniciar sesión. Mitigación: verificar el flujo completo con una cuenta nueva antes de dar por buenos los criterios.
- Si las credenciales OAuth (client ID/secret) no están cargadas correctamente en Supabase, `signInWithOAuth` fallará con un error genérico del provider, no de la app. Mitigación: confirmar en el dashboard que ambos providers muestran estado "Enabled" antes del paso 5.
- El Route Handler `app/auth/callback/route.ts` en Next 16.3.4 puede tener una firma distinta a los ejemplos públicos de `@supabase/ssr` (mismo riesgo que SPEC 04 con el middleware/`proxy.ts`). Mitigación: leer la documentación local antes de escribir el paso 3.
- Un usuario que ya tiene cuenta por password y luego usa "Continuar con Google" con el mismo email puede terminar con dos identidades separadas si Supabase no las vincula automáticamente. Mitigación: fuera de alcance de este spec, pero debe probarse manualmente y documentarse como conocido si ocurre.
