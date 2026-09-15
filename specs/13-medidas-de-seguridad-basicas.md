# SPEC 13 — Medidas de seguridad básicas

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 12
> **Fecha:** 2026-09-15
> **Objetivo:** Cerrar el checklist básico de seguridad de `references/security-check.md` — RLS en `games` y `scores`, headers de seguridad en Next.js, y los tres warnings pendientes en el panel de Supabase (SECURITY DEFINER, leaked password protection, política de contraseñas/rate limit).

## Alcance

**Incluye:**

- **RLS en `public.games`.** Habilitar Row Level Security con una policy de `SELECT` pública (`USING (true)`), sin `INSERT`/`UPDATE`/`DELETE` desde el cliente (el catálogo se administra fuera de la app). Verificación: `/biblioteca` sigue listando todos los juegos sin sesión activa.
- **RLS en `public.scores`.** Habilitar RLS con:
  - `SELECT` público (`USING (true)`) — el leaderboard en `/salon` y `games_with_stats` deben seguir leyendo sin sesión.
  - `INSERT` solo para usuarios autenticados y únicamente sobre su propia fila: `WITH CHECK (auth.uid() = user_id)`.
  - Sin `UPDATE` ni `DELETE` desde el cliente (los puntajes no se editan ni se borran desde la UI).
- **Headers de seguridad en `next.config.ts`.** Agregar `headers()` con los tres headers del checklist aplicados a todas las rutas (`source: '/(.*)'`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Warning SECURITY DEFINER (`rls_auto_enable`).** Investigar el propósito de `public.rls_auto_enable()` (función auto-generada por Supabase al habilitar RLS desde el dashboard/advisor). Revocar `EXECUTE` de los roles `anon` y `authenticated` sobre esa función, dado que no debe ser invocable públicamente vía `/rest/v1/rpc/rls_auto_enable`.
- **Leaked password protection.** Activar el toggle "Leaked password protection" en el dashboard de Supabase Auth (verificación contra HaveIBeenPwned).
- **Política de contraseñas y rate limit de signup.** En el dashboard de Supabase Auth: fijar el mínimo de longitud de contraseña en 8 caracteres, y configurar un límite de signups por IP para mitigar registros automatizados (usar el valor por defecto que ofrezca el dashboard salvo que el usuario indique otro durante la implementación).
- Correr `get_advisors` al final para confirmar que los tres warnings del checklist (`auth_leaked_password_protection`, y los dos de `SECURITY DEFINER` sobre `rls_auto_enable`) ya no aparecen, y que no se introdujeron warnings nuevos.

**Fuera de alcance:**

- Content-Security-Policy (CSP) y `Strict-Transport-Security`/`Permissions-Policy` — el usuario decidió limitarse a los 3 headers listados en el checklist; una CSP completa requiere su propio spec por el riesgo de romper scripts/estilos inline existentes.
- Cualquier otro warning del panel de Supabase que no esté explícitamente listado en `references/security-check.md` (el checklist solo trae esos tres; si aparecen más al correr `get_advisors`, se documentan pero no se resuelven aquí).
- Cambios al modelo de auth (SPEC 12 ya cubrió confirmación de correo y OAuth) — este spec solo ajusta configuración de contraseñas/rate limit sobre esa base, no el flujo.
- Policies de RLS sobre `public.profiles` — no está en el checklist ni se menciona en el alcance original.
- Tests automatizados (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introducen nuevas tablas ni columnas. Se agregan políticas de RLS sobre tablas existentes (`games`, `scores`) y se ajustan permisos (`REVOKE EXECUTE`) sobre la función existente `public.rls_auto_enable()`. No hay cambios en `StoredUser` ni en ningún tipo TypeScript.

## Plan de implementación

1. **Inspeccionar el estado actual de RLS** en `games` y `scores` con `list_tables`/`execute_sql` para confirmar que RLS está deshabilitado hoy y no hay policies previas que se pisen. Sistema funcional: sin cambios aún.
2. **Habilitar RLS y crear las policies en `public.games`** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy `SELECT` pública) vía `apply_migration`. Verificación: `select * from games` sigue funcionando desde el cliente anónimo (`/biblioteca` carga igual que antes).
3. **Habilitar RLS y crear las policies en `public.scores`** (`SELECT` público, `INSERT` con `WITH CHECK (auth.uid() = user_id)`) vía `apply_migration`. Verificación: `/salon` sigue mostrando el leaderboard sin sesión; terminar una partida logueado guarda el score (`saveScore` en `components/GamePlayer.tsx`); intentar un `insert` manual con `user_id` distinto al de la sesión falla.
4. **Agregar `headers()` a `next.config.ts`** con los tres headers del checklist. Verificación: `npm run build` sin errores, y en dev, `curl -I http://localhost:3000` (o el Network tab) muestra los tres headers en la respuesta de `/`.
5. **Revocar `EXECUTE` en `rls_auto_enable()`** para los roles `anon` y `authenticated` vía `apply_migration` (`REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`). Verificación: `get_advisors` deja de reportar `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` para esa función.
6. **Activar "Leaked password protection"** en el dashboard de Supabase Auth (Authentication → Policies/Settings). Verificación: `get_advisors` deja de reportar `auth_leaked_password_protection`.
7. **Configurar longitud mínima de contraseña (8) y rate limit de signup por IP** en el dashboard de Supabase Auth. Verificación manual: un intento de registro con contraseña de 7 caracteres es rechazado con el mensaje de error correspondiente en `/login` (usando el `translateAuthError` existente de SPEC 04/12).
8. **Verificación final.** `npm run build` y `npm run lint` sin errores. `get_advisors` sin ninguno de los tres warnings del checklist. Prueba manual completa: `/biblioteca` y `/salon` sin sesión siguen mostrando datos; registro/login/guardado de score con sesión sigue funcionando; headers presentes en la respuesta HTTP.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] RLS está habilitado en `public.games` y `public.scores` (visible en `list_tables` o en el dashboard).
- [ ] `/biblioteca` sigue mostrando el catálogo completo sin sesión activa.
- [ ] `/salon` sigue mostrando el leaderboard completo sin sesión activa.
- [ ] Un usuario autenticado puede guardar su score al terminar una partida (`saveScore` sigue funcionando).
- [ ] Un intento de `insert` en `scores` con `user_id` distinto al del usuario autenticado es rechazado por RLS.
- [ ] La respuesta HTTP de cualquier ruta incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `EXECUTE` sobre `public.rls_auto_enable()` está revocado para `anon` y `authenticated`.
- [ ] "Leaked password protection" está activo en el dashboard de Supabase Auth.
- [ ] La longitud mínima de contraseña está fijada en 8 caracteres (un registro con contraseña más corta es rechazado).
- [ ] Hay un límite de signups por IP configurado en el dashboard de Supabase Auth.
- [ ] `get_advisors` no reporta ninguno de los tres warnings listados en `references/security-check.md` tras la implementación.

## Decisiones tomadas y descartadas

- **Sí: RLS con lectura pública / escritura autenticada en `games` y `scores`** — mantiene el comportamiento actual del catálogo y del leaderboard (visibles sin sesión) mientras cierra la escritura no autorizada, que es el hueco real que señala el checklist.
- **No: policies de `UPDATE`/`DELETE` en `scores`** — la UI actual (`GamePlayer.tsx`) solo hace `insert`; agregar esas policies sería especular sobre una funcionalidad que no existe.
- **Sí: solo los 3 headers del checklist**, sin CSP ni `Strict-Transport-Security`/`Permissions-Policy` — decisión explícita del usuario en la fase de clarificación; una CSP mal configurada puede romper la app y merece su propio spec con pruebas dedicadas.
- **Sí: revocar `EXECUTE` en `rls_auto_enable()` en vez de eliminar la función** — es una función auto-generada por el propio Supabase Advisor; revocar el acceso público resuelve el warning sin tocar herramientas internas de la plataforma.
- **No: policies sobre `public.profiles`** — no está en el checklist original ni se mencionó como problema; se deja fuera para no expandir el alcance.
- **Sí: depende de SPEC 12** — la configuración de password/rate limit se hace sobre la base de auth ya endurecida (confirmación de correo, OAuth) que dejó SPEC 12.

## Riesgos identificados

- Habilitar RLS sin las policies correctas puede dejar `games` o `scores` completamente inaccesibles (RLS habilitado sin ninguna policy bloquea todo). Mitigación: crear las policies de `SELECT` en el mismo paso/migración que habilita RLS, nunca en pasos separados.
- Si la policy de `INSERT` en `scores` queda mal escrita (por ejemplo comparando contra un campo inexistente), el guardado de puntajes se rompe silenciosamente para todos los usuarios. Mitigación: probar manualmente el guardado de score después del paso 3, antes de continuar.
- Revocar `EXECUTE` sobre `rls_auto_enable()` podría romper un flujo interno del dashboard de Supabase si esa función se sigue invocando desde ahí. Mitigación: confirmar con `get_advisors` que el warning desaparece sin que aparezcan errores nuevos, y revisar el dashboard de Supabase tras el cambio.
- Activar un mínimo de contraseña más estricto no afecta cuentas ya creadas con contraseñas más cortas, solo a registros nuevos — no hay migración de contraseñas existentes posible ni necesaria.
