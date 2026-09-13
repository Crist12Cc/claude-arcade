# SPEC 09 — Snake: cuarto juego jugable (SERPENTINA)

**Estado:** Implementado
**Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
**Fecha:** 2026-09-13

**Objetivo:** Crear desde cero (no hay carpeta en `references/started-games/` para este juego) un motor de Snake clásico como cuarto juego real y jugable de Arcade Vault, usando como referencia visual únicamente el spritesheet de frutas de `references/snake-assets/` (`fruits.png` + `sprites.js`), integrado en `/jugar/serpentina` (id existente "SERPENTINA", categoría ARCADE, cover `cover-snake`) reemplazando su cáscara mock, conectándolo al registro de motores `ENGINES` de `GamePlayer.tsx` ya generalizado en SPEC 07/08.

## Alcance

**Incluye:**

- Motor de Snake escrito desde cero en `lib/games/serpentina/engine.ts` (contrato ya usado por ROCAS/CAÍDA/BLOQUE BUSTER): grilla de 40×30 celdas de 20px sobre canvas 800×600, movimiento por pasos de tiempo fijo (`stepTime`) en vez de por frame, cola de dirección de hasta 2 movimientos para no perder inputs entre pasos, bloqueo de giro en reversa (no permite ir directamente en la dirección opuesta a la actual), encapsulado por completo en el closure de `createSerpentinaEngine(canvas, onStateChange)` — sin variables de módulo compartidas entre instancias.
- Comida representada con los sprites reales de fruta (`apple`, `orange`, `cherry`, `grape`, `strawberry`, `watermelon`, `kiwi`, `lemon`, `pepper`, `peach`) recortados del spritesheet de `references/snake-assets/fruits.png`, copiado tal cual a `public/games/serpentina/fruits.png` y cargado por el motor vía `new Image()`; fruta aleatoria en cada spawn, con _fallback_ a un círculo magenta plano si la imagen aún no cargó.
- Serpiente dibujada como segmentos de rectángulos neón verdes con `shadowBlur` (cabeza más brillante que el cuerpo), sin sprite propio — mismo criterio "vectorial" que ROCAS.
- Progresión de dificultad: cada 5 frutas comidas sube de nivel y reduce `stepTime` (de `BASE_STEP` 0.16s hasta un piso `MIN_STEP` 0.07s), acelerando la velocidad de la serpiente; puntuación +10×nivel por fruta.
- Controles: `↑ ↓ ← →`, con `preventDefault` para evitar scroll de la página.
- `setPaused(true)` detiene el avance de la serpiente pero sigue dibujando el tablero actual (grilla, comida, serpiente, HUD) — no lo deja congelado en negro.
- Fin de juego por colisión contra los bordes de la grilla o contra el propio cuerpo (`status: 'gameover'`); no hay wrap-around como en ROCAS.
- **Conexión al registro `ENGINES`** de `GamePlayer.tsx` (ya generalizado desde SPEC 07): se agrega `serpentina: createSerpentinaEngine` sin tocar ninguna otra parte del componente.
- El motor expone su estado (`score`, `lives`, `level`, `gameOver`) al mismo contrato `onStateChange` usado por los demás juegos; como Snake clásico no tiene noción de "vidas" (muere de una vez), se reporta `lives: 1` mientras juega y `lives: 0` al perder, igual criterio que Tetris con un valor fijo/derivado en SPEC 07.
- La fila existente de `public.games` (id `serpentina`, cat `ARCADE`, cover `cover-snake`, título/short/long ya definidos desde el catálogo mock) se reutiliza tal cual, sin cambios de contenido — solo se confirmó su existencia (ya estaba sembrada desde SPEC 06) vía `insert ... on conflict do nothing`.

**No incluye:**

- Sonido/música — igual que el resto de juegos portados, se excluye salvo pedido explícito.
- Wrap-around en los bordes (aparecer del lado opuesto) — se descarta a favor del comportamiento clásico "Nokia Snake" (morir contra la pared).
- Obstáculos, power-ups, múltiples frutas simultáneas o modos de juego alternativos — solo la mecánica clásica de una fruta a la vez.
- Controles táctiles/on-screen para móvil — igual que SPEC 05/07/08, el juego se muestra pero no es jugable sin teclado físico en esos viewports.
- Cambiar el `id`, `title`, `short`/`long`, categoría o cover de la entrada `serpentina` en `public.games` — se mantiene sin cambios porque ya describe correctamente el juego portado.
- Migrar o adaptar ningún otro juego mock del catálogo (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Tests automatizados (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introduce ninguna tabla nueva — la fila `serpentina` ya existía en `public.games` desde SPEC 06 (`id: "serpentina"`, `title: "SERPENTINA"`, `cat: "ARCADE"`, `cover: "cover-snake"`) y se confirmó/reafirmó con una migración idempotente (`on conflict (id) do nothing`), sin modificar sus valores.

Interfaz nueva, solo en memoria (no persistida), para el contrato entre el motor y React — mismo shape que `AsteroidsState`/`TetrisState`/`BloqueBusterState`:

```ts
// lib/games/serpentina/engine.ts
export interface SerpentinaState {
  score: number;
  lives: number; // 1 mientras juega, 0 al perder (Snake no tiene vidas múltiples)
  level: number; // sube cada 5 frutas comidas, acelera el paso de movimiento
  gameOver: boolean; // true al chocar contra un borde o contra el propio cuerpo
}

export interface SerpentinaEngine {
  start(): void;
  destroy(): void; // cancela el rAF y remueve el listener de teclado
  setPaused(paused: boolean): void;
  restart(): void; // reinicia el estado interno (nuevo initGame())
}

export function createSerpentinaEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: SerpentinaState) => void
): SerpentinaEngine;
```

Extensión del registro de motores en `components/GamePlayer.tsx` (ya generalizado en SPEC 07/08, solo se agrega una entrada):

```ts
type Engine =
  AsteroidsEngine | TetrisEngine | BloqueBusterEngine | SerpentinaEngine;

const ENGINES: Record<
  string,
  (canvas: HTMLCanvasElement, onStateChange: (s: EngineState) => void) => Engine
> = {
  rocas: createAsteroidsEngine,
  caida: createTetrisEngine,
  'bloque-buster': createBloqueBusterEngine,
  serpentina: createSerpentinaEngine,
};
```

## Plan de implementación

1. **Analizar las referencias disponibles.** A diferencia de SPEC 05/07/08, no existe `references/started-games/*-snake/` con `game.js`/`CLAUDE.md` propios: la única referencia es `references/snake-assets/` (`fruits.png` + `sprites.js` con el mapa de coordenadas de recorte de cada fruta en la hoja de sprites). Se decide diseñar el motor desde cero siguiendo el mismo contrato de los demás juegos, usando el spritesheet solo para el dibujo de la comida.
2. **Copiar el asset de fruta.** `references/snake-assets/fruits.png` se copia a `public/games/serpentina/fruits.png` para que el `<canvas>` pueda cargarlo por URL en tiempo de ejecución (los assets bajo `references/` no son servidos por Next.js). Se reutilizan las coordenadas de `sprites.js` para un subconjunto de 10 frutas dentro de `SPRITE_ATLAS` en el propio `engine.ts` (no se importa `sprites.js` tal cual, para mantener el motor autocontenido en TypeScript sin depender de un script que asigna a `window`).
3. **Escribir el motor.** Crear `lib/games/serpentina/engine.ts` con grilla, cola de dirección, avance por paso de tiempo, colisión de bordes/cuerpo, spawn de fruta en celda libre aleatoria, progresión de nivel/velocidad, y dibujo (grilla tenue, fruta con sprite, serpiente con rectángulos neón, HUD, overlay de "GAME OVER"). Todo el estado (`snake`, `dir`, `dirQueue`, `food`, `score`, `level`, `stepTime`, `status`, `paused`) vive dentro del closure de la factory, no en variables de módulo. `onStateChange` se invoca al final de cada frame con `{ score, lives, level, gameOver }`. Sistema funcional: el módulo compila y exporta el motor; aún no se usa en ninguna pantalla.
4. **Conectar `serpentina` al registro `ENGINES`.** Agregar `serpentina: createSerpentinaEngine` en `components/GamePlayer.tsx` (el registro ya existe desde SPEC 07/08, no se modifica su estructura). Sistema funcional: entrar a `/jugar/serpentina` muestra el canvas real y jugable (serpiente, fruta, grilla) en vez de la arena CSS mock; el HUD muestra puntaje/nivel reales.
5. **Confirmar la fila en `public.games`.** Ejecutar un `insert ... on conflict (id) do nothing` para la fila `serpentina` (ya sembrada desde SPEC 06) y verificar con una consulta a `games_with_stats` que sigue apareciendo con `best`/`plays` reales.
6. **Verificación de punta a punta en navegador.** `npm run build` y `npm run lint` sin errores nuevos (se confirma que los 45 errores de `no-multiple-empty-lines` preexisten igual en `main` antes del cambio, vía `git stash`). En Chrome: el canvas se renderiza con serpiente y fruta visibles, `↑/↓/←/→` giran la serpiente correctamente, "PAUSA"/"REANUDAR" congela y reanuda el tablero visualmente, "FIN" abre el modal "FIN DEL JUEGO" con el puntaje correcto y el botón "GUARDAR PUNTUACIÓN" (sesión activa), y la fila `serpentina` responde `200` en `/jugar/serpentina`.

## Criterios de aceptación

- [x] `npm run build` compila sin errores.
- [x] `npm run lint` pasa sin errores nuevos en los archivos tocados por este spec (persisten los mismos 45 errores preexistentes de `no-multiple-empty-lines` en archivos no relacionados, confirmado comparando contra `main` sin el cambio).
- [x] `/biblioteca` y `/juego/serpentina` siguen mostrando la entrada "SERPENTINA" con `best`/`plays` reales desde `games_with_stats`, sin cambios de datos (`best: 0, plays: 0` antes de la primera partida guardada).
- [x] `/jugar/serpentina` muestra un canvas jugable (grilla, serpiente, fruta con sprite real) en vez de la arena CSS decorativa.
- [x] El HUD de `/jugar/serpentina` muestra puntuación y nivel reales del motor, actualizados en tiempo real.
- [x] La serpiente gira con `↑ ↓ ← →` y no puede invertir dirección directamente sobre sí misma.
- [x] Comer una fruta hace crecer la serpiente, suma puntos, y cada 5 frutas sube de nivel y acelera el juego.
- [x] "PAUSA" congela visualmente el tablero (se sigue viendo, no queda en negro); "REANUDAR" continúa la partida.
- [x] Chocar contra un borde o contra el propio cuerpo abre automáticamente el modal "FIN DEL JUEGO" con el puntaje final.
- [x] Con sesión activa, "GUARDAR PUNTUACIÓN" inserta una fila real en `scores` con `game_id: "serpentina"`; sin sesión se muestra el mensaje de login en vez del formulario.
- [x] "JUGAR DE NUEVO" reinicia tanto el motor (serpiente centrada, nivel 1, puntaje 0) como el estado del modal.
- [x] Salir de `/jugar/serpentina` (SALIR, Nav, back del navegador) detiene el loop del juego y su listener de teclado — no queda corriendo en segundo plano.
- [x] `/jugar/rocas`, `/jugar/caida` y `/jugar/bloque-buster` siguen funcionando exactamente igual que antes de agregar esta entrada al registro `ENGINES` — sin regresión.
- [x] El canvas se ve completo y sin desbordar el layout en un viewport angosto (~400px).

## Decisiones tomadas y descartadas

- **Diseñar el motor desde cero en vez de portar un `game.js` existente**, porque `references/snake-assets/` solo trae un spritesheet de frutas y su mapa de coordenadas (`sprites.js`), no una implementación de juego — a diferencia de ROCAS/CAÍDA/BLOQUE BUSTER, que sí partían de un `game.js` en `references/started-games/`.
- **Copiar `fruits.png` a `public/games/serpentina/`** en vez de referenciarlo desde `references/snake-assets/`: Next.js solo sirve estáticos desde `public/`, y `references/` es contenido de trabajo/documentación, no un asset servible en producción.
- **Reimplementar el atlas de coordenadas dentro de `engine.ts`** en vez de importar `sprites.js` tal cual: el original asigna a `window.SPRITE_ATLAS` (patrón de script global de un juego standalone), lo cual no encaja con un módulo TypeScript autocontenido; se portó un subconjunto de 10 frutas como constante tipada dentro del motor.
- **Snake clásico sin wrap-around** (muere contra el borde) en vez del comportamiento toroidal de ROCAS: es la mecánica estándar de Snake y evita ambigüedad al decidir cuándo termina el juego.
- **`lives: 1`/`lives: 0` en vez de un campo separado para "sin vidas múltiples"**: mismo criterio que Tetris (SPEC 07) y Arkanoid (SPEC 08) de adaptar el motor al contrato genérico `EngineState` compartido por `GamePlayer.tsx`, sin agregar un tercer estado a la UI.
- **Progresión de velocidad por umbral de frutas comidas (cada 5) en vez de por tiempo transcurrido**: refleja mejor la sensación clásica de "cada bocado te acerca al siguiente nivel" y es consistente con que el nivel también determina el puntaje por fruta (10×nivel).
- **Sin sonido, power-ups, obstáculos ni wrap-around**: igual criterio de alcance mínimo que SPEC 07/08 — solo grilla, fruta, crecimiento, colisión y HUD.

## Riesgos identificados

- Igual que en SPEC 05/07/08: si el motor no encapsula todo su estado (`snake`, `food`, `score`, etc.) dentro del closure de `createSerpentinaEngine`, dos instancias montadas en momentos distintos (usuario navega, sale, vuelve a entrar a `/jugar/serpentina`) podrían compartir estado — mitigado por diseño desde el inicio (todo el estado vive en variables locales de la factory, no de módulo).
- El listener de teclado se agrega en `window` (como en los demás motores) y debe removerse explícitamente en `destroy()`; si no se remueve, quedaría escuchando `keydown` en segundo plano incluso fuera de `/jugar/serpentina`.
- Cargar `fruits.png` de forma asíncrona (`new Image()`) introduce una ventana breve donde el sprite aún no está listo antes del primer `draw()`; mitigado con el _fallback_ a un círculo de color plano mientras `fruitImg.complete` sea `false`.
- `requestAnimationFrame` no detenido correctamente al desmontar dejaría el loop de Snake corriendo en segundo plano, igual riesgo ya identificado para los demás juegos portados.
- Agregar una entrada más a `ENGINES` en `GamePlayer.tsx` toca el único componente compartido por todos los juegos; mitigado verificando explícitamente que ROCAS, CAÍDA y BLOQUE BUSTER siguen funcionando igual después del cambio (criterio de aceptación dedicado).
