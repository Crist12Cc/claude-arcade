# SPEC 04 — Cimientos de Supabase y autenticación real

**Estado:** Approved
**Depende de:** SPEC 01, SPEC 03
**Fecha:** 2026-09-13

**Objetivo:** Integrar Supabase en la aplicación (clientes browser/server, middleware de sesión y tabla `profiles`) y reemplazar el login simulado de `localStorage` por autenticación real con correo y contraseña.

## Alcance

**Incluye:**

- Dependencias nuevas: `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- Variables de entorno:
  - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (no versionado).
  - Archivo `.env.example` versionado con ambas claves vacías, a modo de documentación.
- Clientes de Supabase:
  - `lib/supabase/client.ts` — `createBrowserClient` de `@supabase/ssr`, para componentes cliente.
  - `lib/supabase/server.ts` — `createServerClient` con el store de cookies de Next 16, para Server Components y Route Handlers.
  - `middleware.ts` en la raíz — refresca la cookie de sesión en cada request y reescribe las cookies en la respuesta. **Sin proteger ninguna ruta**: todas siguen siendo públicas.
- Esquema en Supabase (proyecto `cqffttdymdnhfmsrhuup`), aplicado con `apply_migration` del MCP:
  - Tabla `public.profiles` (ver Modelo de datos).
  - Trigger `on_auth_user_created` sobre `auth.users` que inserta la fila de `profiles` tomando el `username` de `raw_user_meta_data`.
  - RLS habilitado en `profiles` con políticas: `select` público, `update` solo del propio dueño (`auth.uid() = id`). El `insert` lo hace el trigger con `security definer`.
- Reescritura de `lib/useSession.ts` **conservando su API pública** (`{ user, signIn, signOut }` y el tipo `StoredUser { name: string }`), ahora respaldada por Supabase:
  - Lee la sesión inicial con `getUser()` y se suscribe a `onAuthStateChange`.
  - `user` se deriva del `username` del perfil (fallback: `user_metadata.username`, luego la parte del correo antes de `@`), en mayúsculas y recortado a 10 caracteres, igual que hoy.
  - `signOut()` llama a `supabase.auth.signOut()`.
  - `signIn` deja de ser el atajo local: el login pasa a hacerse en `app/login/page.tsx` contra Supabase (ver abajo).
  - Se elimina por completo el uso de `localStorage` y del evento `av-user-change`.
- Actualización de `app/login/page.tsx`:
  - Pestaña **INICIAR SESIÓN** → `supabase.auth.signInWithPassword({ email, password })`. El campo de correo pasa a mostrarse también en esta pestaña (hoy solo aparece en "CREAR CUENTA").
  - Pestaña **CREAR CUENTA** → `supabase.auth.signUp({ email, password, options: { data: { username } } })`.
  - Estados del formulario: `idle`, `sending` (botón deshabilitado con texto de espera) y `error`.
  - Mensajes de error **inline en español** dentro de la tarjeta, traducidos de los errores de Supabase (credenciales inválidas, correo ya registrado, contraseña demasiado corta, correo inválido) con un fallback genérico; mismo patrón de UX que el formulario de contacto del SPEC 03.
  - "JUGAR COMO INVITADO" se mantiene: **no** crea ningún usuario en Supabase; simplemente navega a `/` sin sesión (el estado invitado ya equivale hoy a `user === null`).
  - Los botones ◆ GOOGLE y ▣ GITHUB quedan visibles pero `disabled`, con `title="Próximamente"`.
  - Tras un inicio de sesión o registro exitoso: `router.push("/")` + `router.refresh()`.
- Estilos: agregar a `app/globals.css` la clase del mensaje de error del login, reutilizando la paleta del estado de error introducido en el SPEC 03.

**No incluye:**

- **Puntuaciones persistentes.** El Salón de la Fama (`app/salon/page.tsx`) y `GamePlayer.tsx` siguen usando `seededScores` y datos mock de `lib/data.ts`. La tabla `scores` y el guardado de partidas son un spec futuro.
- **Catálogo de juegos en base de datos.** `GAMES` sigue viviendo en `lib/data.ts`.
- **OAuth (Google, GitHub).** Solo se deshabilitan los botones; no se configura ningún proveedor.
- **Magic link / OTP** y **login anónimo** (`signInAnonymously`).
- **Confirmación de correo.** Se asume "Confirm email" **desactivado** en el dashboard de Supabase, de modo que `signUp` devuelve sesión inmediata. No se crea ninguna ruta `/auth/confirm` ni `/auth/callback`.
- **Recuperación de contraseña**, cambio de correo y edición del perfil desde la UI.
- **Rutas protegidas.** El middleware solo refresca la sesión; nada redirige por falta de sesión, y `/login` sigue accesible aunque ya haya sesión activa.
- **Supabase CLI, stack local ni carpeta `supabase/migrations/`.** El esquema se aplica directamente al proyecto remoto vía MCP.
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

Una tabla nueva en Supabase:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);
```

Y el tipo del cliente, que **no cambia** respecto al actual (`lib/useSession.ts`):

```ts
export interface StoredUser {
  name: string; // username en mayúsculas, máx. 10 caracteres
}
```

Se conserva el mismo tipo a propósito para que `Nav.tsx`, `salon/page.tsx` y `GamePlayer.tsx` no requieran cambios.

## Plan de implementación

1. **Dependencias y variables de entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (obtenidos con `get_project_url` y `get_publishable_keys` del MCP) y `.env.example` versionado con las mismas claves vacías. Sistema funcional: build sigue pasando, sin efecto visible.
2. **Esquema en Supabase.** Aplicar con `apply_migration` la creación de `public.profiles`, el trigger `on_auth_user_created` (`security definer`) y las políticas RLS. Verificar con `list_tables` y `get_advisors`. Sistema funcional: la app sigue igual; la base ya está lista.
3. **Clientes de Supabase.** Antes de escribir código, leer la guía correspondiente en `node_modules/next/dist/docs/` sobre middleware y acceso a cookies en Next 16 (la API puede diferir de la documentación pública de Supabase). Crear `lib/supabase/client.ts`, `lib/supabase/server.ts` y `middleware.ts` con su `config.matcher` excluyendo estáticos. Sistema funcional: la app compila y navega igual que antes; el middleware refresca sesiones aunque todavía no exista ninguna.
4. **Reescribir `lib/useSession.ts`.** Misma firma exportada, ahora sobre `onAuthStateChange` + consulta a `profiles` para el `username`, con los fallbacks descritos y limpieza de la suscripción al desmontar. Sistema funcional: `Nav`, `Salón` y `GamePlayer` compilan sin cambios y muestran "sin sesión" (estado invitado) porque aún no hay forma de iniciar sesión.
5. **Estilo del error de login.** Agregar a `app/globals.css` la clase del mensaje de error dentro de `.auth-card`. Sistema funcional: build pasa, sin efecto visible aún.
6. **Login real.** Reescribir `app/login/page.tsx` con los dos flujos (`signInWithPassword` / `signUp` con `username` en `options.data`), el campo de correo visible en ambas pestañas, los estados `idle`/`sending`/`error`, los mensajes traducidos, el invitado sin sesión y los botones OAuth deshabilitados. Sistema funcional: se puede crear una cuenta, cerrar sesión y volver a entrar; el Nav muestra el nombre real del jugador.
7. **Pulido final.** Verificar que `npm run build` y `npm run lint` pasan, que `get_advisors` no reporta problemas de seguridad nuevos, y probar manualmente el ciclo completo: registro → nombre en el Nav → cierre de sesión → inicio de sesión → error con credenciales inválidas.

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] Existe la tabla `public.profiles` con RLS habilitado y las políticas de `select` público y `update` del propio dueño.
- [ ] Crear una cuenta desde `/login` inserta automáticamente una fila en `profiles` con el `username` escrito en el formulario.
- [ ] Tras registrarse, la app navega a `/` y el Nav muestra el nombre del jugador en mayúsculas (máx. 10 caracteres).
- [ ] Cerrar sesión desde el Nav elimina la sesión y el Nav vuelve al estado sin usuario.
- [ ] Iniciar sesión con las credenciales creadas restaura la sesión y el nombre en el Nav.
- [ ] Iniciar sesión con credenciales inválidas muestra un mensaje de error **en español** dentro de la tarjeta, sin navegar, y conservando lo escrito.
- [ ] Mientras se envía el formulario, el botón queda deshabilitado y no se puede enviar dos veces.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin crear usuario en Supabase y sin sesión activa.
- [ ] Los botones GOOGLE y GITHUB están visibles y deshabilitados.
- [ ] Recargar la página con sesión activa mantiene al usuario autenticado (el middleware refresca la cookie).
- [ ] `lib/useSession.ts` no contiene ninguna referencia a `localStorage`, y `Nav.tsx`, `salon/page.tsx` y `GamePlayer.tsx` funcionan sin haber sido modificados.
- [ ] Ninguna clave de Supabase aparece hardcodeada en archivos versionados; `.env.local` está ignorado por git y `.env.example` no contiene valores reales.

## Decisiones tomadas y descartadas

- **Alcance limitado a cimientos + Auth**, dejando puntuaciones y catálogo en base de datos para specs posteriores: "implementar Supabase" tocaba cuatro dominios a la vez y un solo spec habría obligado a improvisar el modelo de `scores`.
- **Tabla `profiles` con trigger** en vez de guardar el nombre solo en `user_metadata`: `profiles` es consultable y joinable, lo que la vuelve la base natural para el leaderboard real del spec siguiente.
- **Reescribir `useSession` conservando su API** en vez de crear un `useAuth` nuevo: evita tocar `Nav.tsx`, `salon/page.tsx` y `GamePlayer.tsx`, y reduce la superficie de cambio de este spec a login + infraestructura.
- **Modo invitado como ausencia de sesión**, no como `signInAnonymously`: hoy `user === null` ya significa invitado, no requiere habilitar nada en el dashboard y no ensucia `auth.users` con cuentas fantasma. El costo (un invitado no puede persistir puntajes) se decidirá en el spec de scores.
- **Sin rutas protegidas**: proteger `/jugar/*` o `/salon` contradiría el modo invitado que se decidió mantener. El middleware solo refresca la sesión.
- **Confirmación de correo desactivada**: da acceso inmediato tras el registro y evita crear rutas de callback; es aceptable para un MVP sin usuarios reales y se puede activar en un spec futuro.
- **Errores traducidos al español inline** en vez de mostrar `error.message` crudo: toda la UI del proyecto está en español y el SPEC 03 ya estableció ese patrón de error visible en formularios.
- **Migraciones vía MCP contra el proyecto remoto** en vez del Supabase CLI: el proyecto no tiene stack local ni Docker configurado, y añadirlos sería un cambio de infraestructura ajeno a este spec.
- **Botones OAuth deshabilitados, no eliminados**: conserva el diseño de la tarjeta de login sin prometer una funcionalidad que no existe.

## Riesgos identificados

- `@supabase/ssr` documenta su integración contra versiones anteriores de Next.js; en Next 16.3.4 la API de `cookies()` y del middleware puede diferir. Mitigación: leer la guía en `node_modules/next/dist/docs/` **antes** de escribir el paso 3, y no copiar el snippet de la documentación pública de Supabase sin adaptarlo.
- Un trigger sobre `auth.users` mal escrito puede hacer fallar todo registro con un error opaco ("Database error saving new user"). Mitigación: probar el registro inmediatamente tras el paso 2 y revisar `query_logs` si falla.
- Si "Confirm email" está activado en el dashboard, `signUp` no devolverá sesión y el usuario quedará en un limbo silencioso sin la ruta de callback que este spec no incluye. Debe verificarse que la opción esté desactivada antes de dar por buenos los criterios de aceptación.
- El Salón de la Fama seguirá mostrando puntuaciones mock junto al nombre real del usuario autenticado, lo que puede parecer un bug. Es esperado hasta el spec de puntuaciones persistentes.
