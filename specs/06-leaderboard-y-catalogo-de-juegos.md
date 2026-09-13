# SPEC 06 — Leaderboard real y catálogo de juegos en Supabase

**Estado:** Implementado
**Depende de:** SPEC 01, SPEC 04, SPEC 05
**Fecha:** 2026-09-13

**Objetivo:** Mover el catálogo de juegos (`GAMES`) y las puntuaciones (`av_scores` en `localStorage` + `seededScores` mock) a tablas reales de Supabase, de modo que `/salon`, `/biblioteca`, `/juego/[id]` y el modal "FIN DEL JUEGO" muestren y guarden datos reales para cualquier juego.

## Alcance

**Incluye:**

- Tabla `public.games` en Supabase con el contenido hoy hardcodeado en `lib/data.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`), sembrada por migración con los 8 juegos actuales.
- Tabla `public.scores` en Supabase: cada fila es una partida guardada, vinculada a `games.id` y a `profiles.id` (el jugador dueño del puntaje). Aplica a **todos** los juegos del catálogo, incluidos los que hoy son cáscaras mock (siguen generando un puntaje simulado con el timer falso, pero ese puntaje ahora se guarda en Supabase en vez de `localStorage`).
- Una vista `public.games_with_stats` (o consulta equivalente) que calcula `best` (`MAX(score)`) y `plays` (`COUNT(*)`) por juego a partir de `scores`, en tiempo real. Un juego sin partidas guardadas muestra `best: 0` y `plays: 0`.
- RLS:
  - `games`: `select` público. Sin políticas de `insert`/`update`/`delete` desde la app (el contenido se administra manualmente vía SQL/MCP si hace falta; no hay UI de administración en este spec).
  - `scores`: `select` público (necesario para que el leaderboard sea visible sin sesión). `insert` solo permitido cuando `auth.uid() = user_id` (solo un usuario autenticado puede guardar su propio puntaje). Sin `update`/`delete` (un puntaje guardado es inmutable).
- `lib/useSession.ts` expone también `id` (el `auth.uid()`) en `StoredUser`, necesario para escribir `scores.user_id` al guardar.
- `app/biblioteca/page.tsx` y `app/juego/[id]/page.tsx` leen el catálogo desde `games_with_stats` en vez del array `GAMES`.
- `app/salon/page.tsx` lee, para el juego seleccionado en las pestañas, el top real de `scores` (con `join` a `profiles` para el nombre) ordenado por puntaje descendente, y — si hay sesión — el mejor puntaje propio del usuario en ese juego (consulta separada filtrada por `user_id`), reemplazando `seededScores` por completo. Un juego sin partidas guardadas muestra la tabla vacía con un mensaje ("AÚN NO HAY PUNTUACIONES REGISTRADAS").
- `components/GamePlayer.tsx`:
  - El modal "FIN DEL JUEGO" ya no acepta un nombre de iniciales editable: el nombre mostrado es siempre el del perfil autenticado (`user.name`).
  - Si hay sesión, "GUARDAR PUNTUACIÓN" inserta una fila en `scores` (`game_id`, `user_id: user.id`, `score`) usando el cliente de Supabase del navegador; tras guardar exitosamente se muestra el mismo aviso "▸ PUNTUACIÓN GUARDADA_".
  - Si **no** hay sesión (invitado), en vez del formulario de guardado se muestra un mensaje ("INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN") con un enlace a `/login`; el puntaje final se sigue mostrando en el modal, pero no hay forma de persistirlo.
  - Se elimina por completo `saveScore()` y el uso de `localStorage`/`av_scores`.
- `lib/data.ts` pierde `GAMES`, `seededScores` y `PLAYERS` (ya no se usan); conserva los tipos (`Game`, `GameCategory`, `ScoreRow` si aún aplica) y `CATS` (los chips de categoría siguen siendo una lista estática, no dependen de la base de datos).

**No incluye:**

- Cualquier UI de administración para crear/editar/borrar juegos — el contenido de `games` se siembra una sola vez por migración.
- Editar o borrar puntuaciones ya guardadas (ni desde la app ni desde una UI de moderación).
- Migrar los puntajes ya guardados en `localStorage` (`av_scores`) de sesiones anteriores del navegador hacia Supabase — quedan descartados; solo cuentan las partidas guardadas después de este spec.
- Cambiar la lógica de generación del puntaje simulado de los juegos mock (`bloque-buster`, `caida`, etc.) — siguen usando el mismo timer falso de `GamePlayer.tsx`; solo cambia dónde se persiste el resultado final.
- Paginación del leaderboard (se mantiene el mismo límite de 12/10 filas que ya usaba `seededScores`).
- Guardar puntuaciones para invitados de ninguna forma (ni anónima, ni con nombre libre) — coherente con la decisión de SPEC 04 de no crear usuarios fantasma.
- Realtime/suscripciones en vivo al leaderboard (los datos se leen al cargar la página, no se actualizan solos si otro jugador guarda un puntaje mientras la página está abierta).
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create view public.games_with_stats as
select
  g.*,
  coalesce(max(s.score), 0) as best,
  count(s.id) as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;
```

RLS:

```sql
alter table public.games enable row level security;
create policy "games_select_public" on public.games for select using (true);

alter table public.scores enable row level security;
create policy "scores_select_public" on public.scores for select using (true);
create policy "scores_insert_own" on public.scores for insert with check (auth.uid() = user_id);
```

Tipo actualizado en el cliente (`lib/useSession.ts`):

```ts
export interface StoredUser {
  id: string; // auth.uid(), nuevo
  name: string;
}
```

`lib/data.ts` conserva (sin `GAMES`/`seededScores`/`PLAYERS`):

```ts
export type GameCategory = 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS';
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: 'cyan' | 'magenta' | 'green' | 'yellow';
  best: number;
  plays: number; // antes string ("15.6K"); ahora un conteo real
}
export const CATS = ['TODOS', 'ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS'] as const;
```

## Plan de implementación

1. **Esquema en Supabase.** Aplicar con `apply_migration`: creación de `games`, `scores`, la vista `games_with_stats` y las políticas RLS descritas. Sembrar `games` con los 8 registros actuales de `lib/data.ts` (sin `best`/`plays`, que ahora se calculan). Verificar con `list_tables` y `get_advisors`. Sistema funcional: la app sigue igual; la base ya está lista.
2. **Actualizar `lib/useSession.ts`.** Agregar `id: authUser.id` a `StoredUser` en ambos puntos donde se construye (`fallbackName`/resolución de perfil). Sistema funcional: build pasa, `Nav`/`GamePlayer` compilan sin cambios de comportamiento visible.
3. **Actualizar `lib/data.ts`.** Quitar `GAMES`, `seededScores`, `PLAYERS`; ajustar `Game.plays` a `number`. Sistema funcional: el build falla temporalmente en los consumidores de `GAMES` — se corrige en los pasos siguientes (o se hace en el mismo commit que el paso 4/5 para no dejar el build roto).
4. **Catálogo real en `/biblioteca` y `/juego/[id]`.** `app/biblioteca/page.tsx` pasa a Server Component (o hace fetch en un `useEffect` si se mantiene como cliente por el filtro interactivo) que consulta `games_with_stats` vía `lib/supabase/server.ts`/`client.ts`; `app/juego/[id]/page.tsx` consulta el juego por `id` en `games_with_stats` y, para el leaderboard lateral, el top 10 de `scores` con `join` a `profiles.username`, reemplazando `seededScores`. `GameCard.tsx` no cambia de firma (`game.best`/`game.plays` siguen existiendo, ahora reales). Sistema funcional: `/biblioteca` y `/juego/[id]` muestran datos reales desde Supabase; `best`/`plays` en 0 para juegos sin partidas guardadas.
5. **`app/jugar/[id]/page.tsx`.** Consulta el juego por `id` en `games` (o `games_with_stats`) en vez de `GAMES.find`; `notFound()` si no existe. Sistema funcional: `/jugar/[id]` sigue funcionando igual, ahora con el juego real de la base de datos.
6. **Guardado real en `GamePlayer.tsx`.** Quitar `saveScore()`/`localStorage`; al confirmar "GUARDAR PUNTUACIÓN" con sesión activa, insertar `{ game_id: game.id, user_id: user.id, score }` con el cliente de Supabase del navegador. Quitar el input de iniciales editable (el nombre mostrado es siempre `user.name`). Cuando no hay sesión, reemplazar el formulario por el mensaje + enlace a `/login`. Sistema funcional: terminar una partida con sesión activa guarda un registro real en `scores`; sin sesión, se ve el mensaje de login en vez del formulario.
7. **`/salon` real.** `app/salon/page.tsx` consulta la lista de juegos (para las pestañas) y, por cada pestaña seleccionada, el top real de `scores` + `profiles.username` para ese `game_id`, más (si hay sesión) el mejor puntaje propio en ese juego. Reemplaza `seededScores`/`PLAYERS`/`seedFromId` por completo. Un juego sin partidas guardadas muestra la tabla vacía con el mensaje correspondiente. Sistema funcional: `/salon` muestra el leaderboard real por juego, incluida la fila "TU MEJOR MARCA" cuando aplica.
8. **Pulido final.** `npm run build` y `npm run lint` sin errores; `get_advisors` sin problemas nuevos; probar manualmente de punta a punta: jugar ROCAS (o un juego mock) con sesión activa → guardar puntaje → verlo reflejado en `/salon` y en `/juego/[id]` → cerrar sesión → jugar de nuevo → ver el mensaje de login en el modal en vez del formulario de guardado.

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] Existen las tablas `public.games` y `public.scores` y la vista `public.games_with_stats`, con RLS habilitado según lo descrito.
- [ ] `/biblioteca` muestra los 8 juegos leídos desde Supabase, con `best`/`plays` calculados desde `scores` (no valores hardcodeados).
- [ ] `/juego/[id]` muestra el detalle del juego y su leaderboard real (top de `scores` con nombre de jugador), sin usar `seededScores`.
- [ ] `/jugar/[id]` sigue funcionando para cualquier `id` válido, ahora resuelto contra la tabla `games`.
- [ ] Con sesión activa, terminar una partida y pulsar "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` con el `user_id` del usuario autenticado, y el modal muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] Sin sesión activa (invitado), el modal de fin de juego muestra un mensaje invitando a iniciar sesión en vez del formulario de guardado, y no se inserta ninguna fila en `scores`.
- [ ] `/salon` muestra, para el juego seleccionado en las pestañas, el top real desde `scores` (no `seededScores`); un juego sin partidas guardadas muestra el mensaje de tabla vacía.
- [ ] Con sesión activa, `/salon` muestra la fila "TU MEJOR MARCA EN {JUEGO}" con el mejor puntaje real del usuario en ese juego, si existe alguno.
- [ ] Ningún archivo de la app importa `GAMES`, `seededScores` o `PLAYERS` desde `lib/data.ts` (fueron eliminados).
- [ ] `localStorage` ya no se usa en `GamePlayer.tsx` para guardar puntuaciones.
- [ ] Un usuario no puede insertar una fila en `scores` con un `user_id` distinto al suyo (verificado por la política RLS `scores_insert_own`).

## Decisiones tomadas y descartadas

- **Un solo spec para catálogo + scores**, en vez de dos specs separados, porque ambos requieren la misma migración a Supabase y se implementan en la misma sesión de trabajo (decisión explícita del usuario, aceptando el mayor alcance).
- **Todos los juegos guardan puntajes reales**, incluidos los mock, en vez de limitar el guardado real a ROCAS: mantiene un solo flujo de guardado en `GamePlayer.tsx` y evita una bifurcación de comportamiento entre juegos reales y cáscaras mock.
- **Se elimina `seededScores` sin fallback**, en vez de mantenerlo como relleno visual: con todos los juegos guardando puntajes reales, mezclar datos ficticios con reales habría sido confuso para el usuario y contradice el objetivo de "leaderboard real".
- **Guardar puntaje requiere sesión**, sin modo invitado con nombre libre: coherente con la decisión de SPEC 04 de no crear usuarios fantasma (`signInAnonymously` descartado ahí); el modal ahora depende de `user.id`, que no existe sin sesión.
- **`scores.user_id` con FK a `profiles`** en vez de un campo de texto libre para el nombre: permite hacer `join` con `profiles.username` para mostrar el nombre actualizado del jugador (si cambiara en el futuro) y hace cumplible la política RLS `auth.uid() = user_id`.
- **`best`/`plays` calculados con una vista (`games_with_stats`)** en vez de columnas desnormalizadas en `games` actualizadas por trigger: evita mantener sincronizados dos lugares con el mismo dato; el costo de recalcular en cada lectura es aceptable para el volumen de datos de este proyecto.
- **`games` de solo lectura pública, sin UI de administración**: el catálogo no cambia con frecuencia y agregar CRUD de juegos es un problema de alcance distinto (probablemente un panel de administrador) no pedido en esta conversación.
- **Sin migración de los puntajes ya guardados en `localStorage`**: no hay forma de asociar esas partidas anónimas a un `user_id` real (la clave `av_scores` nunca guardó identidad de Supabase), así que migrarlas requeriría inventar una atribución falsa.
- **`Game.plays` pasa de `string` (`"15.6K"`) a `number`**: el valor ahora es un conteo real y pequeño (no un contador inflado de marketing), así que un número simple es más honesto y más fácil de calcular con `COUNT(*)`.

## Riesgos identificados

- Si la política `scores_insert_own` queda mal escrita (por ejemplo, sin `with check`), un usuario autenticado podría insertar puntajes a nombre de otro `user_id`, falseando el leaderboard. Debe verificarse explícitamente con un intento de insert cruzado antes de dar por buenos los criterios de aceptación.
- La vista `games_with_stats` recalcula `MAX`/`COUNT` en cada lectura; si el volumen de `scores` creciera mucho, esto podría volverse lento. Aceptable para el alcance actual del proyecto (sin usuarios reales aún).
- Al quitar el input de iniciales editable del modal, cualquier código o estilo que dependiera de `nameOverride` en `GamePlayer.tsx` debe revisarse para no dejar estado muerto.
- `app/biblioteca/page.tsx` y `app/salon/page.tsx` son hoy Client Components con filtrado/tabs interactivos; convertir su fuente de datos a una consulta asíncrona a Supabase requiere decidir entre Server Component + subcomponente cliente para la interactividad, o `useEffect` + estado de carga en el propio Client Component. Cualquiera de las dos es válida; debe evitarse dejar un parpadeo de contenido vacío sin ningún estado de carga.
