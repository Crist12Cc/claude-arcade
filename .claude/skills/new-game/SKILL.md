---
name: new-game
description: Crea un nuevo juego jugable con leaderboard integrado en Arcade Vault — porta el motor a lib/games/<id>/engine.ts, lo conecta a GamePlayer.tsx, siembra la fila en Supabase (games) y agrega el CSS de portada. Usar cuando el usuario pida "crear un juego", "agregar un juego al catálogo", "portar tetris/arkanoid", o similar.
---

# Crear un juego jugable con leaderboard

Este skill empaqueta el patrón ya usado para integrar ROCAS (asteroids) — ver `specs/05-asteroids-juego-jugable.md` y `specs/06-leaderboard-y-catalogo-de-juegos.md` — para que agregar el siguiente juego real al catálogo sea repetible.

Idea clave: el catálogo (`/biblioteca`), el detalle (`/juego/[id]`), el salón (`/salon`) y `/jugar/[id]` ya son **genéricos** — leen todo desde Supabase (`games`/`games_with_stats`/`scores`) por `id`. Agregar un juego NO requiere tocar esas páginas. Solo se necesita:

1. Un motor del juego (`lib/games/<id>/engine.ts`).
2. Una entrada en el registro de motores de `components/GamePlayer.tsx`.
3. Una fila nueva en `public.games`.
4. Un estilo de portada `cover-<id>`.

## Paso 0 — Confirmar el origen del juego

Preguntar (o inferir del pedido del usuario) si el juego:

- **Viene de `references/started-games/`**: hoy hay `02-asteroids` (ya portado como ROCAS, úsalo solo de referencia del patrón), `03-tetris`, `04-arkanoid`. Cada carpeta trae `game.js` (o varios archivos JS), `CLAUDE.md` (describe su arquitectura interna) y `README.md`. Leer ambos antes de portar.
- **Es un juego nuevo sin fuente existente**: diseñar el motor desde cero siguiendo el mismo contrato (paso 1).

## Paso 1 — Portar/crear el motor: `lib/games/<id>/engine.ts`

Contrato fijo (igual al de `lib/games/asteroids/engine.ts`, que ya cumple con SPEC 05):

```ts
export interface GameEngineState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

export interface GameEngine {
  start(): void;
  destroy(): void; // cancela el rAF y remueve listeners de teclado
  setPaused(paused: boolean): void;
  restart(): void; // reinicia el estado interno (nuevo initGame())
}

export function create<Nombre>Engine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: GameEngineState) => void
): GameEngine;
```

Reglas al portar (tomadas de SPEC 05 y de los riesgos ya identificados ahí):

- **Encapsular todo el estado en el closure de la factory function** — nunca en variables de módulo. Si el motor original (`game.js` en `references/started-games/`) usa variables globales del módulo, hay que envolverlas dentro de `create<Nombre>Engine` para que dos instancias montadas en momentos distintos (usuario navega, sale, vuelve a entrar) no compartan estado.
- Listeners de teclado van en `window.addEventListener('keydown'/'keyup', ...)` dentro de la factory, y se remueven explícitamente en `destroy()`. Verificar que no queden residuales (bloqueo de scroll vía `preventDefault`) después de salir de la pantalla.
- El loop usa `requestAnimationFrame`, con `dt` capado (~0.05s) para evitar saltos grandes tras un tab en background. `destroy()` debe cancelar el rAF pendiente (`cancelAnimationFrame`).
- `onStateChange(state)` se llama al final de cada `update(dt)` con al menos `{score, lives, level, gameOver}`. Si el juego no tiene noción de "vidas" o "nivel" (p. ej. un puzzle como Tetris), usar un valor sensato (`lives: 1`, `level` = nivel de dificultad/velocidad actual) — el HUD de `GamePlayer.tsx` espera esas 4 claves.
- `setPaused(true)` detiene las actualizaciones de lógica pero debe seguir invocando `draw()` (no dejar el canvas en negro/congelado a medias).
- Canvas de tamaño fijo (el original ya suele asumir una resolución, p. ej. 800×600), escalado por CSS (`max-width: 100%`, `aspect-ratio`) — no recalcular la resolución interna según el viewport; eso es un cambio de mayor alcance no cubierto por este patrón.
- No agregar sonido/música salvo que el usuario lo pida explícitamente (el patrón original tampoco lo tiene).

## Paso 2 — Conectar el motor en `components/GamePlayer.tsx`

`GamePlayer.tsx` hoy distingue el único juego real (`rocas`) con un chequeo hardcodeado (`isAsteroids = game.id === 'rocas'`). Al agregar el segundo juego real, **refactorizar ese chequeo a un registro**:

```ts
const ENGINES: Record<
  string,
  (
    canvas: HTMLCanvasElement,
    onStateChange: (s: GameEngineState) => void
  ) => GameEngine
> = {
  rocas: createAsteroidsEngine,
  '<id>': create < Nombre > Engine,
};
```

Y sustituir el branch `isAsteroids` por `const engineFactory = ENGINES[game.id]` (`undefined` → sigue el camino mock existente sin cambios). El resto del flujo ya construido no cambia:

- Canvas 800×600 montado en `.crt-screen` cuando hay `engineFactory`.
- `useEffect` que llama `engineFactory(canvas, onStateChange)` + `.start()`, con cleanup `.destroy()`.
- HUD (`score`/`lives`/`level`) alimentado por el callback del motor.
- Botón "PAUSA"/"REANUDAR" llama `engine.setPaused(...)`.
- Modal "FIN DEL JUEGO" se abre cuando `onStateChange` reporta `gameOver: true` (guardar con una ref para no disparar dos veces) o cuando el usuario pulsa "FIN" manualmente.
- "JUGAR DE NUEVO" llama `engine.restart()`.
- Guardado de puntaje: ya es genérico — inserta en Supabase `scores` (`game_id: game.id, user_id: user.id, score`) solo si hay sesión; sin sesión muestra el mensaje de login. No tocar esta parte.

Para juegos mock (sin motor real, cáscara con timer falso) no se necesita ningún cambio — siguen el camino existente sin `engineFactory`.

## Paso 3 — Sembrar la fila en `public.games`

Usar `mcp__supabase__apply_migration` para insertar una fila (no se necesita tocar `games_with_stats`, `scores`, ni RLS — ya cubren cualquier `id` nuevo automáticamente):

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values ('<id>', '<TÍTULO>', '<resumen corto>', '<descripción larga>', '<ARCADE|PUZZLE|SHOOTER|VERSUS>', 'cover-<id>', '<cyan|magenta|green|yellow>');
```

Confirmar con `mcp__supabase__list_tables` / una consulta a `games_with_stats` que la fila aparece con `best: 0, plays: 0` antes de la primera partida guardada.

## Paso 4 — Estilo de portada `cover-<id>`

Agregar una clase CSS `cover-<id>` (mismo patrón que `cover-rocas`) en el stylesheet donde vivan las demás — usada por `GameCard` y el detalle de `/juego/[id]` vía `game.cover`. Buscar `cover-rocas` en el CSS para copiar el patrón (gradiente/color de fondo por categoría).

## Paso 5 — Verificación de punta a punta

Calcado de los criterios de aceptación de SPEC 05/06:

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/biblioteca` muestra el juego nuevo con `best`/`plays` en 0 antes de jugar.
- [ ] `/jugar/<id>` muestra el canvas jugable (no la arena CSS mock).
- [ ] HUD (puntaje/vidas/nivel) refleja el estado real del motor en tiempo real.
- [ ] "PAUSA"/"REANUDAR" congela y reanuda visualmente el juego.
- [ ] Perder (o terminar) abre el modal "FIN DEL JUEGO" con el puntaje correcto.
- [ ] Con sesión activa, "GUARDAR PUNTUACIÓN" inserta en `scores` y el puntaje aparece en `/salon` y `/juego/<id>`.
- [ ] Sin sesión, se muestra el mensaje de login en vez del formulario de guardado (no se inserta nada).
- [ ] "JUGAR DE NUEVO" reinicia motor y modal correctamente.
- [ ] Salir de `/jugar/<id>` (SALIR, Nav, back del navegador) detiene el rAF y remueve los listeners — sin loops ni listeners huérfanos.
- [ ] El canvas se ve completo sin desbordar en un viewport angosto (~400px).
- [ ] Los demás juegos (mock y `rocas`) siguen funcionando sin cambios de comportamiento.
