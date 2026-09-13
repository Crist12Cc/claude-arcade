# SPEC 08 — Arkanoid: tercer juego jugable (BLOQUE BUSTER)

**Estado:** Implementado
**Depende de:** SPEC 05, SPEC 06, SPEC 07
**Fecha:** 2026-09-13

**Objetivo:** Adaptar el clon de Arkanoid de `references/started-games/04-arkanoid/` como tercer juego real y jugable de Arcade Vault, integrado en `/jugar/bloque-buster` (id existente "BLOQUE BUSTER", categoría ARCADE) reemplazando su cáscara mock, conectándolo al registro de motores `ENGINES` de `GamePlayer.tsx` ya generalizado en SPEC 07.

## Alcance

**Incluye:**

- Motor del juego portado desde `references/started-games/04-arkanoid/game.js` y `levels.js` a un módulo TypeScript (`lib/games/bloque-buster/engine.ts`), conservando su lógica (paddle controlado por mouse/teclado, pelota con física de rebote AABB, 5 niveles con patrones de bloques distintos y velocidad creciente ×1.10 por nivel, 3 vidas, puntuación 10 pts por bloque), encapsulada por completo en el closure de `createBloqueBusterEngine(canvas, onStateChange)` — sin variables de módulo compartidas entre instancias.
- El motor expone su estado (`score`, `lives`, `level`, `gameOver`) a React vía el mismo contrato (`onStateChange`) usado por ROCAS y CAÍDA, para que el HUD existente de `GamePlayer.tsx` funcione sin cambios de forma.
- **Conexión al registro `ENGINES`** de `GamePlayer.tsx` (ya generalizado desde SPEC 07): se agrega `'bloque-buster': createBloqueBusterEngine` sin tocar ninguna otra parte del componente.
- Render con formas de canvas planas (rectángulos de color y un círculo para la pelota) en vez del spritesheet del original (`assets/spritesheet-breakout.png`), ya que ese asset no se porta — mismo criterio visual "vectorial" ya usado en ROCAS.
- Controles: mover el paddle con el mouse (posición X relativa al canvas, escalada por el `getBoundingClientRect`) y con `←/→` como alternativa de teclado, igual que el original.
- `setPaused(true)` detiene la física/lógica pero sigue dibujando el estado actual (paddle, pelota, bloques) — no lo deja congelado en negro.
- Perder las 3 vidas reporta `gameOver: true`; completar los 5 niveles (`status: 'win'`) también reporta `gameOver: true` para reutilizar el mismo modal genérico de fin de juego sin un tercer estado especial en React.
- El motor no usa el `id`/`title` de "BLOQUE BUSTER" para nada de su lógica interna — la fila existente de `public.games` (id `bloque-buster`, cat `ARCADE`, cover `cover-bricks`) se reutiliza tal cual, sin migración nueva.

**No incluye:**

- Sprites del spritesheet original (`assets/spritesheet-breakout.png`) — se reemplazan por rectángulos/círculo de color plano; no se copian assets de imagen al proyecto.
- Sonido/música (`ball-bounce.mp3`, `break-sound.mp3` del original) — el patrón del skill excluye audio salvo pedido explícito.
- Animación de explosión al romper bloques (frames del spritesheet) — se simplifica a que el bloque desaparece inmediatamente al ser golpeado.
- Overlay de pausa con selector de nivel (botones 1–5 del `index.html` original) — `GamePlayer.tsx` ya tiene su propio overlay genérico de pausa; no se reimplementa el selector de nivel del original.
- Controles táctiles/on-screen para móvil — igual que SPEC 05 y SPEC 07, el juego se muestra pero no es jugable sin mouse o teclado físico en esos viewports.
- Cambiar el `id`, `title`, `short`/`long`, categoría o cover de la entrada `bloque-buster` en `public.games` — se mantiene sin cambios porque ya describe correctamente el juego portado.
- Migrar o adaptar ningún otro juego mock del catálogo (`serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados (no hay test runner configurado en el proyecto).
- Cambios de dificultad, velocidad de la pelota o balance de puntuación distintos a los ya definidos en `game.js`/`levels.js` (`BASE_BALL_VX/VY`, `ballSpeedMultiplier`, 10 pts/bloque).

## Modelo de datos

No se introduce ninguna tabla ni migración nueva — la fila `bloque-buster` ya existía en `public.games` desde SPEC 06 (`id: "bloque-buster"`, `title: "BLOQUE BUSTER"`, `cat: "ARCADE"`, `cover: "cover-bricks"`) y se reutiliza sin modificar.

Interfaz nueva, solo en memoria (no persistida), para el contrato entre el motor y React — mismo shape que `AsteroidsState`/`TetrisState`:

```ts
// lib/games/bloque-buster/engine.ts
export interface BloqueBusterState {
  score: number;
  lives: number; // inicia en 3
  level: number; // nivel 1–5 activo
  gameOver: boolean; // true al perder las 3 vidas o al ganar (completar nivel 5)
}

export interface BloqueBusterEngine {
  start(): void;
  destroy(): void; // cancela el rAF y remueve listeners de teclado/mouse
  setPaused(paused: boolean): void;
  restart(): void; // reinicia el estado interno (nuevo initGame())
}

export function createBloqueBusterEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: BloqueBusterState) => void
): BloqueBusterEngine;
```

Extensión del registro de motores en `components/GamePlayer.tsx` (ya generalizado en SPEC 07, solo se agrega una entrada):

```ts
type Engine = AsteroidsEngine | TetrisEngine | BloqueBusterEngine;

const ENGINES: Record<
  string,
  (canvas: HTMLCanvasElement, onStateChange: (s: EngineState) => void) => Engine
> = {
  rocas: createAsteroidsEngine,
  caida: createTetrisEngine,
  'bloque-buster': createBloqueBusterEngine,
};
```

## Plan de implementación

1. **Portar el motor.** Crear `lib/games/bloque-buster/engine.ts` copiando la lógica de `references/started-games/04-arkanoid/game.js` y `levels.js` (paddle, pelota, colisión AABB con bloques, rebotes en paredes/paddle, 5 niveles con `speed`/`blocks` generados igual que el original, vidas, puntuación), envuelta en `createBloqueBusterEngine(canvas, onStateChange)`. Todo el estado (`paddle`, `ball`, `blocks`, `score`, `lives`, `level`, `status`, `paused`) vive dentro del closure de la factory, no en variables de módulo. Los sprites se reemplazan por `fillRect`/`arc` de color plano. `onStateChange` se invoca al final de cada frame con `{ score, lives, level, gameOver }`. Sistema funcional: el módulo compila y exporta el motor; aún no se usa en ninguna pantalla.
2. **Conectar `bloque-buster` al registro `ENGINES`.** Agregar `'bloque-buster': createBloqueBusterEngine` en `components/GamePlayer.tsx` (el registro ya existe desde SPEC 07, no se modifica su estructura). Sistema funcional: entrar a `/jugar/bloque-buster` muestra el canvas real y jugable (paddle, pelota, bloques) en vez de la arena CSS mock; el HUD muestra puntaje/vidas/nivel reales.
3. **Verificación de controles y ciclo de vida.** Probar mover el paddle con mouse y con `←/→`, romper bloques (puntaje +10, bloque desaparece), rebote en paddle/paredes, perder una vida al caer la pelota (reposiciona sin terminar el juego hasta la 3ª pérdida), pausar/reanudar (el tablero se sigue dibujando en pausa), perder la última vida o completar el nivel 5 abre el modal de fin de juego con el puntaje correcto, "JUGAR DE NUEVO" reinicia el motor, y salir de `/jugar/bloque-buster` (SALIR/Nav/back) detiene el `requestAnimationFrame` y remueve los listeners de teclado y mouse sin dejar residuos. Sistema funcional: ciclo de vida completo sin loops ni listeners huérfanos.
4. **Pulido final.** `npm run build` y `npm run lint` sin errores nuevos; verificar que el canvas 800×600 escala responsivo dentro de `.crt-screen` en un viewport angosto (~400px); confirmar en el navegador con sesión activa que "GUARDAR PUNTUACIÓN" inserta en `scores` con `game_id: "bloque-buster"` y aparece reflejado en `/salon` y `/juego/bloque-buster`; confirmar que ROCAS y CAÍDA siguen funcionando sin regresión.

## Criterios de aceptación

- [x] `npm run build` compila sin errores.
- [x] `npm run lint` pasa sin errores nuevos en los archivos tocados por este spec (persisten errores preexistentes de `no-multiple-empty-lines` en archivos no relacionados).
- [x] `/biblioteca` y `/juego/bloque-buster` siguen mostrando la entrada "BLOQUE BUSTER" con `best`/`plays` reales desde `games_with_stats`, sin cambios de datos.
- [x] `/jugar/bloque-buster` muestra un canvas jugable (paddle, pelota, bloques de colores) en vez de la arena CSS decorativa.
- [x] El HUD de `/jugar/bloque-buster` muestra puntuación, vidas y nivel reales del motor, actualizados en tiempo real.
- [x] El paddle se mueve con el mouse y también con `←/→`.
- [x] Romper un bloque lo elimina, suma 10 puntos, y completar todos los bloques de un nivel avanza al siguiente (o gana el juego en el nivel 5).
- [x] "PAUSA" congela visualmente la física (el tablero se sigue viendo, no queda en negro); "REANUDAR" continúa la partida.
- [x] Perder las 3 vidas (o completar el nivel 5) abre automáticamente el modal "FIN DEL JUEGO" con el puntaje final.
- [x] Con sesión activa, "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` con `game_id: "bloque-buster"`, reflejada en `/salon` y `/juego/bloque-buster`; sin sesión se muestra el mensaje de login en vez del formulario.
- [x] "JUGAR DE NUEVO" reinicia tanto el motor (paddle centrado, nivel 1, puntaje 0, 3 vidas) como el estado del modal.
- [x] Salir de `/jugar/bloque-buster` (SALIR, Nav, back del navegador) detiene el loop del juego y sus listeners de teclado/mouse — no quedan corriendo en segundo plano.
- [x] `/jugar/rocas` y `/jugar/caida` siguen funcionando exactamente igual que antes de agregar esta entrada al registro `ENGINES` — sin regresión.
- [x] El canvas se ve completo y sin desbordar el layout en un viewport angosto (~400px).

## Decisiones tomadas y descartadas

- **Reutilizar la entrada existente `bloque-buster`** en vez de crear un nuevo `id`/fila en `public.games`, porque ya existía temáticamente como el placeholder de Arkanoid (título "BLOQUE BUSTER", categoría ARCADE, cover `cover-bricks` ya diseñado con la estética de bloques) desde SPEC 06 — evita una migración innecesaria y mantiene los enlaces existentes desde `/juego/bloque-buster` y `/salon`.
- **Render con rectángulos/círculo de color plano en vez del spritesheet original**: portar `assets/spritesheet-breakout.png` y su loader agregaría un asset binario y un paso de carga asíncrona (`loadSpritesheet`) que no aporta al contrato del motor; se prioriza consistencia con el estilo vectorial ya usado en ROCAS sobre replicar el arte pixel-art exacto del original.
- **`gameOver: true` tanto al perder como al ganar (completar los 5 niveles)**: el contrato `EngineState` compartido por `ENGINES` solo tiene un booleano de fin de juego; en vez de agregar un campo `won`/un tercer estado a la UI genérica, se reutiliza el mismo modal de "FIN DEL JUEGO" para ambos desenlaces, igual criterio que Tetris con `lives` fijo en SPEC 07 (adaptar el motor al contrato genérico, no al revés).
- **Sin animación de explosión ni sonido**: igual que SPEC 07, se excluye todo lo que no sea física/puntuación/HUD — el bloque desaparece de inmediato al ser golpeado en vez de reproducir los 4 frames de explosión del original.
- **Sin overlay de selector de nivel en pausa**: el original permite saltar a cualquier nivel desde la pausa; `GamePlayer.tsx` ya tiene su propio overlay de pausa genérico y no expone ese control — se descarta sin reemplazo, consistente con no rediseñar el HUD/overlay compartido por un solo juego.
- **Canvas de tamaño fijo 800×600 escalado por CSS**: mismo patrón que ROCAS y CAÍDA, en vez de recalcular resolución según viewport.

## Riesgos identificados

- Igual que en SPEC 05/07: el motor original de Arkanoid usa variables de módulo (`paddle`, `ball`, `blocks`, `score`, etc.). Al envolverlo en `createBloqueBusterEngine`, debe verificarse que cada instancia tenga su propio estado encapsulado en el closure — si el usuario navega a `/jugar/bloque-buster`, sale y vuelve a entrar, dos instancias no deben compartir estado.
- El listener de `mousemove` se agrega sobre el propio `<canvas>` (no `window`, a diferencia de los listeners de teclado); si `destroy()` no lo remueve correctamente al desmontar, quedaría un listener huérfano atado al nodo DOM del canvas.
- `requestAnimationFrame` no detenido correctamente al desmontar dejaría el loop de Arkanoid corriendo en segundo plano, igual que el riesgo ya identificado para ROCAS y CAÍDA.
- Agregar una entrada más a `ENGINES` en `GamePlayer.tsx` toca el único componente compartido por todos los juegos; mitigado verificando explícitamente que ROCAS y CAÍDA siguen funcionando igual después del cambio (criterio de aceptación dedicado).
