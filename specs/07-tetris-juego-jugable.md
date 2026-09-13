# SPEC 07 — Tetris: segundo juego jugable (CAÍDA)

**Estado:** Implementado
**Depende de:** SPEC 05, SPEC 06
**Fecha:** 2026-09-13

**Objetivo:** Adaptar el clon de Tetris de `references/started-games/03-tetris/` como segundo juego real y jugable de Arcade Vault, integrado en `/jugar/caida` (id existente "CAÍDA", categoría PUZZLE) reemplazando su cáscara mock, y generalizar `GamePlayer.tsx` de un chequeo hardcodeado a un registro de motores para que agregar el siguiente juego no requiera tocar ese archivo dos veces.

## Alcance

**Incluye:**

- Motor del juego portado desde `references/started-games/03-tetris/game.js` a un módulo TypeScript (`lib/games/tetris/engine.ts`), conservando su lógica (tablero 10×20, 8 piezas incluida la "N"/tuerca, rotación con wall kicks, soft/hard drop, pieza fantasma, limpieza de líneas, puntuación y niveles por velocidad), encapsulada por completo en el closure de `createTetrisEngine(canvas, onStateChange)` — sin variables de módulo compartidas entre instancias.
- El motor expone su estado (`score`, `lives: 1` fijo — Tetris no tiene vidas —, `level`, `gameOver`) a React vía el mismo contrato (`onStateChange`) usado por el motor de ROCAS, para que el HUD existente de `GamePlayer.tsx` funcione sin cambios de forma.
- **Refactor de `GamePlayer.tsx`**: se reemplaza el chequeo hardcodeado `isAsteroids = game.id === 'rocas'` por un registro `ENGINES: Record<string, EngineFactory>` (`{ rocas: createAsteroidsEngine, caida: createTetrisEngine }`) y `const engineFactory = ENGINES[game.id]`. El resto del flujo (canvas 800×600, `useEffect` de montaje/destrucción, HUD, pausa, modal de fin de juego, guardado en Supabase) es genérico y no distingue entre juegos con motor real.
- Controles de teclado propios de Tetris (`←/→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop) con `preventDefault()` en los códigos capturados, activos solo mientras `/jugar/caida` está montado.
- `setPaused(true)` detiene la caída/lógica pero sigue dibujando el tablero (no lo deja congelado en negro).
- Game over quieto: cuando una pieza nueva colisiona al aparecer, el motor reporta `gameOver: true` (sin `alert`/overlay propio del original, delegado al modal genérico de React) y detiene su propio loop.
- El motor no usa el `id`/`title` de "CAÍDA" para nada de su lógica interna — la fila existente de `public.games` (id `caida`, cat `PUZZLE`, cover `cover-tetro`) se reutiliza tal cual, sin migración nueva.

**No incluye:**

- Controles táctiles/on-screen para móvil — igual que SPEC 05, el juego se muestra pero no es jugable sin teclado físico en esos viewports.
- Vista previa de la siguiente pieza (`next-canvas` del original) — el HUD de `GamePlayer.tsx` no tiene un slot para ese segundo canvas; se deja fuera para no rediseñar el HUD genérico solo por este juego.
- Selector de tema claro/oscuro del `index.html` original (`theme-toggle`/`localStorage['tetris-theme']`) — Arcade Vault ya tiene su propio tema global; el motor ignora ese comportamiento del original.
- Cambiar el `id`, `title`, `short`/`long`, categoría o cover de la entrada `caida` en `public.games` — se mantiene sin cambios porque ya describe correctamente el juego portado.
- Migrar o adaptar ningún otro juego mock del catálogo (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Sonido/música (el original no lo tiene).
- Tests automatizados (no hay test runner configurado en el proyecto).
- Cambios de dificultad, velocidad de caída o balance de puntuación distintos a los ya definidos en `game.js` (`LINE_SCORES`, `dropInterval`).

## Modelo de datos

No se introduce ninguna tabla ni migración nueva — la fila `caida` ya existía en `public.games` desde SPEC 06 (`id: "caida"`, `title: "CAÍDA"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`) y se reutiliza sin modificar.

Interfaz nueva, solo en memoria (no persistida), para el contrato entre el motor y React — mismo shape que `AsteroidsState`/`AsteroidsEngine` de SPEC 05:

```ts
// lib/games/tetris/engine.ts
export interface TetrisState {
  score: number;
  lives: number; // siempre 1 — Tetris no tiene vidas
  level: number; // nivel de velocidad (sube cada 10 líneas)
  gameOver: boolean;
}

export interface TetrisEngine {
  start(): void;
  destroy(): void; // cancela el rAF y remueve el listener de teclado
  setPaused(paused: boolean): void;
  restart(): void; // reinicia el estado interno (nuevo initGame())
}

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: TetrisState) => void
): TetrisEngine;
```

Refactor del registro de motores en `components/GamePlayer.tsx` (reemplaza el chequeo `isAsteroids`):

```ts
type EngineState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};
type Engine = AsteroidsEngine | TetrisEngine;

const ENGINES: Record<
  string,
  (canvas: HTMLCanvasElement, onStateChange: (s: EngineState) => void) => Engine
> = {
  rocas: createAsteroidsEngine,
  caida: createTetrisEngine,
};
```

## Plan de implementación

1. **Portar el motor.** Crear `lib/games/tetris/engine.ts` copiando la lógica de `references/started-games/03-tetris/game.js` (tablero, piezas, colisión, rotación con wall kicks, línea/puntuación, ghost piece), envuelta en `createTetrisEngine(canvas, onStateChange)`. Todo el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`) vive dentro del closure de la factory, no en variables de módulo. `onStateChange` se invoca al final de cada frame con `{ score, lives: 1, level, gameOver }`. Sistema funcional: el módulo compila y exporta el motor; aún no se usa en ninguna pantalla.
2. **Refactorizar `GamePlayer.tsx` a un registro de motores.** Reemplazar `isAsteroids`/`createAsteroidsEngine` hardcodeado por `ENGINES` + `engineFactory = ENGINES[game.id]`; todo lo que antes chequeaba `asteroids` (render de canvas vs. arena mock, montaje/destrucción del motor, pausa, nivel calculado) pasa a chequear `hasEngine = !!engineFactory`. Sistema funcional: `/jugar/rocas` sigue funcionando exactamente igual que en SPEC 05 (verificado por regresión), sin cambio de comportamiento.
3. **Conectar `caida` al registro.** Agregar `caida: createTetrisEngine` a `ENGINES`. Sistema funcional: entrar a `/jugar/caida` muestra el tablero real y jugable con teclado en vez de la arena CSS mock; el HUD muestra puntaje/nivel reales (vidas fijas en 1, sin corazones vacíos raros).
4. **Verificación de controles y ciclo de vida.** Probar mover/rotar/soft-drop/hard-drop, pausar/reanudar (el tablero se sigue dibujando en pausa), perder (pieza nueva colisiona) abre el modal de fin de juego con el puntaje correcto, "JUGAR DE NUEVO" reinicia el motor, y salir de `/jugar/caida` (SALIR/Nav/back) detiene el `requestAnimationFrame` y remueve el listener de teclado sin dejar residuos. Sistema funcional: ciclo de vida completo sin loops ni listeners huérfanos.
5. **Pulido final.** `npm run build` y `npm run lint` sin errores nuevos; verificar que el canvas 800×600 escala responsivo dentro de `.crt-screen` en un viewport angosto (~400px); confirmar en el navegador con sesión activa que "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: "caida"` y aparece reflejado en `/salon` y `/juego/caida`.

## Criterios de aceptación

- [x] `npm run build` compila sin errores.
- [x] `npm run lint` pasa sin errores nuevos (solo persisten errores preexistentes de `no-multiple-empty-lines` en archivos no tocados por este spec).
- [x] `/biblioteca` y `/juego/caida` siguen mostrando la entrada "CAÍDA" con `best`/`plays` reales desde `games_with_stats`, sin cambios de datos.
- [x] `/jugar/caida` muestra un canvas jugable (tablero 10×20, piezas cayendo, controlable con teclado) en vez de la arena CSS decorativa.
- [x] El HUD de `/jugar/caida` muestra puntuación y nivel reales del motor, actualizados en tiempo real; "vidas" se muestra fijo (1 corazón) sin romper el layout del HUD genérico.
- [x] Rotar, mover, soft drop y hard drop funcionan con los mismos controles que el original (`←/→`, `↑`/`X`, `↓`, `Espacio`).
- [x] Completar una línea la elimina, suma puntaje según `LINE_SCORES × nivel`, y el nivel sube cada 10 líneas acelerando la caída.
- [x] "PAUSA" congela visualmente la caída de la pieza (el tablero se sigue viendo, no queda en negro); "REANUDAR" continúa la partida.
- [x] Una pieza nueva que colisiona al aparecer abre automáticamente el modal "FIN DEL JUEGO" con el puntaje final.
- [x] Con sesión activa, "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` con `game_id: "caida"`, reflejada en `/salon` y `/juego/caida`; sin sesión se muestra el mensaje de login en vez del formulario.
- [x] "JUGAR DE NUEVO" reinicia tanto el motor (tablero vacío, puntaje 0, nivel 1) como el estado del modal.
- [x] Salir de `/jugar/caida` (SALIR, Nav, back del navegador) detiene el loop del juego y su listener de teclado — no quedan corriendo en segundo plano.
- [x] `/jugar/rocas` y las demás rutas `/jugar/[id]` (juegos mock) siguen funcionando exactamente igual que antes del refactor de `ENGINES` — sin regresión.
- [x] El canvas se ve completo y sin desbordar el layout en un viewport angosto (~400px).

## Decisiones tomadas y descartadas

- **Reutilizar la entrada existente `caida`** en vez de crear un nuevo `id`/fila en `public.games`, porque ya existía temáticamente como el placeholder de Tetris (título "CAÍDA", categoría PUZZLE, cover `cover-tetro` ya diseñado con la estética de piezas) desde SPEC 06 — evita una migración innecesaria y mantiene los enlaces existentes desde `/juego/caida` y `/salon`.
- **Refactorizar `isAsteroids` a un registro `ENGINES`** en el mismo spec que agrega el segundo juego real, en vez de posponerlo: con solo un juego real (`rocas`) el chequeo hardcodeado era aceptable, pero agregar un segundo `if`/chequeo manual habría sido la señal exacta de que el patrón necesitaba generalizarse — corresponde hacerlo ahora, no como deuda técnica para un tercer juego.
- **`lives` fijo en `1`** en vez de omitir el campo o rediseñar el HUD genérico: el contrato `EngineState` es compartido entre motores por diseño (para que `ENGINES` tenga un tipo de retorno uniforme); Tetris no tiene noción de vidas, así que se reporta un valor constante en vez de bifurcar el HUD por tipo de juego.
- **Sin vista previa de la siguiente pieza ("next canvas")**: agregarla requeriría un segundo `<canvas>` y una zona dedicada en el HUD de `GamePlayer.tsx`, que hoy es genérico para todos los juegos — un rediseño de ese alcance no fue pedido y se deja fuera explícitamente.
- **Canvas de tamaño fijo (300×600 lógico, escalado a la convención de 800×600 del contenedor)**: se mantiene el mismo patrón de "tamaño fijo escalado por CSS" de SPEC 05 en vez de recalcular resolución según viewport, por consistencia entre motores y para no introducir un cambio de mayor alcance no pedido.
- **Sin selector de tema propio del original**: el juego portado hereda el tema visual global de Arcade Vault; el `theme-toggle`/`localStorage['tetris-theme']` del `index.html` original no tiene lugar dentro de `GamePlayer.tsx` y se descarta sin reemplazo.

## Riesgos identificados

- Igual que en SPEC 05: el motor original de Tetris usa variables de módulo (`board`, `current`, `next`, etc.). Al envolverlo en `createTetrisEngine`, debe verificarse que cada instancia tenga su propio estado encapsulado en el closure — si el usuario navega a `/jugar/caida`, sale y vuelve a entrar, dos instancias no deben compartir estado.
- El refactor de `isAsteroids` a `ENGINES` toca el único componente compartido por todos los juegos (`GamePlayer.tsx`); un error ahí podría romper silenciosamente `/jugar/rocas` además de introducir Tetris — mitigado verificando explícitamente que ROCAS sigue funcionando igual después del refactor (criterio de aceptación dedicado).
- El listener de teclado captura `Espacio` con `preventDefault()` para el hard drop; si `destroy()` no lo remueve correctamente, el scroll de la página podría quedar bloqueado al presionar espacio fuera de `/jugar/caida`.
- `requestAnimationFrame` no detenido correctamente al desmontar dejaría el loop de Tetris corriendo en segundo plano, igual que el riesgo ya identificado para ROCAS en SPEC 05.
