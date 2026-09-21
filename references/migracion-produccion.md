# Migración Dev → Producción (Supabase)

Runbook para llevar el esquema y los datos de catálogo de la instancia de **desarrollo** de Supabase a la nueva instancia de **producción**, sin darle a Claude acceso a producción en ningún momento. Todos los pasos de esta guía los ejecuta el usuario, desde su propia máquina/dashboard.

## 0. Qué se migra y qué no

| Dato                                                                                                      | ¿Migrar a prod? | Motivo                                                            |
| --------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| Esquema (`profiles`, `games`, `scores`, vista `games_with_stats`, funciones, triggers, policies, índices) | Sí              | Es la estructura de la app                                        |
| Filas de `games` (8 juegos del catálogo)                                                                  | Sí              | Es contenido de producto, no dato de prueba                       |
| Filas de `profiles` (2 filas)                                                                             | No              | Cuentas de prueba creadas en dev por el trigger `handle_new_user` |
| Filas de `scores` (7 filas)                                                                               | No              | Partidas de prueba jugadas en dev                                 |

Las migraciones en `supabase/migrations/` ya reflejan esto: el DDL y el seed de `games` están incluidos; no hay ninguna migración que inserte filas en `profiles` o `scores`.

## 1. Aplicar el esquema con la CLI de Supabase (recomendado)

```bash
# 1. Instalar la CLI si no la tienes
npm install -g supabase

# 2. Login (abre el navegador)
supabase login

# 3. Vincular el repo al proyecto de PRODUCCIÓN (usar el project ref de prod, NO el de dev)
supabase link --project-ref <PROD_PROJECT_REF>

# 4. Aplicar todas las migraciones de supabase/migrations/ a producción
supabase db push
```

`supabase db push` aplica las 8 migraciones en `supabase/migrations/` en orden, contra el proyecto vinculado. Verifica en la confirmación interactiva que el proyecto listado sea el de **producción** antes de aceptar.

## 2. Alternativa manual (SQL Editor del dashboard)

Si prefieres no usar la CLI, copia y pega el contenido de cada archivo en `supabase/migrations/` (en orden por nombre de archivo, que ya está ordenado cronológicamente) en el **SQL Editor** del dashboard de producción, y ejecútalos uno por uno:

1. `20260913153426_create_profiles_table.sql`
2. `20260913153501_revoke_execute_handle_new_user.sql`
3. `20260913174325_create_games_scores_and_stats.sql`
4. `20260913174339_games_with_stats_security_invoker.sql`
5. `20260913192334_scores_performance_fixes.sql`
6. `20260913210534_seed_serpentina_game.sql`
7. `20260915165020_revoke_execute_rls_auto_enable.sql`
8. `20260915165051_revoke_execute_rls_auto_enable_public.sql`

## 3. Configuración manual (no vive en SQL)

Revisar y replicar a mano en el dashboard de producción, comparando contra el de dev:

- **Auth → Providers**: qué proveedores están habilitados (email, OAuth de specs 12/13, etc.) y sus credenciales de OAuth propias para prod (client id/secret distintos a los de dev).
- **Auth → URL Configuration**: `Site URL` y `Additional Redirect URLs` deben apuntar al dominio real de producción, no a `localhost` ni al dominio de preview de dev.
- **Auth → Email Templates**: si se personalizaron en dev, copiarlos a mano.
- **Auth → Confirmación de email / OTP**: replicar la configuración endurecida de la spec 13.
- **Storage**: no se detectaron buckets en dev; confirmar en el dashboard de prod que no haga falta crear ninguno.
- **Extensiones**: dev tiene instaladas `pgcrypto` y `uuid-ossp` (usadas por `gen_random_uuid()` en `scores`). Los proyectos nuevos de Supabase suelen traerlas por defecto — confirmar en **Database → Extensions** de prod antes de aplicar las migraciones, ya que `create table public.scores (... default gen_random_uuid() ...)` fallará si `pgcrypto` no está habilitada.

## 4. Variables de entorno para el deploy de producción

Actualizar en el entorno de producción de la app (Vercel u otro), **tomando los valores desde el dashboard de prod**, nunca reutilizando los de dev:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
RESEND_API_KEY=
```

(`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en **Project Settings → API** del proyecto de prod. `RESEND_API_KEY` puede ser el mismo si el dominio verificado en Resend es el mismo, o uno nuevo si se usa un dominio distinto para prod.)

## 5. Verificación post-migración

- `supabase db diff` contra prod (con la CLI vinculada) debería devolver "no schema changes" si todo se aplicó bien.
- Confirmar en el dashboard de prod que `public.games` tiene 8 filas y `public.profiles`/`public.scores` están vacías.
- Correr los advisors de seguridad y performance sobre el proyecto de prod (`Database → Advisors` en el dashboard, o pedirle a Claude que lo haga en una sesión futura si en algún momento se le da acceso de solo lectura a prod vía MCP).
- Probar el flujo completo en prod: signup → aparece fila en `profiles` (por el trigger) → jugar un juego → se guarda una fila en `scores` → aparece en `/salon`.
