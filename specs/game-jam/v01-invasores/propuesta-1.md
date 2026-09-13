# SPEC PROPUESTA — Cañón Automático

**Estado:** Propuesta
**Tema de la jam:** invasores
**Ángulo de diseño:** Mecánica simple de un solo botón/control, ritmo rápido tipo arcade clásico.
**Fecha:** 2026-09-13

**Objetivo:** Un shooter de invasores reducido a un único control: la nave se mueve sola de un lado a otro de la pantalla en rebote constante, y el jugador solo decide **cuándo disparar** (una tecla/clic/tap). El disparo sale desde la posición actual de la nave en el instante exacto en que se presiona el botón, así que todo el juego es una cuestión de timing puro contra un enjambre que desciende sin pausa. Encaja en el catálogo como una alternativa de ritmo altísimo y curva de aprendizaje de cero segundos frente a ROCAS (shooter con movimiento libre en 2 ejes) e INVASORES (el mock existente, aún sin motor), ofreciendo la experiencia clásica "un botón, reflejos puros" que no tiene ningún juego portado hoy.

## Alcance

**Incluye:**

- Motor nuevo en `lib/games/canon-auto/engine.ts` (id de catálogo a definir como `canon-auto`, distinto de `invasores` para no chocar con la entrada mock existente ni proponer un reemplazo de su contenido).
- Nave fija en el eje vertical (parte inferior del canvas), moviéndose automáticamente en el eje horizontal a velocidad constante y rebotando contra los bordes del canvas — el jugador nunca controla el movimiento lateral.
- **Un solo input:** una tecla (`Espacio` o `↑`) más clic/tap en el propio canvas, ambos mapeados a la misma acción "disparar". Cada pulsación crea un proyectil vertical desde la posición X actual de la nave en ese instante; hay un cooldown corto entre disparos (p. ej. 150ms) para evitar spam de tiro automático que trivialice el timing.
- Enjambre de invasores dispuesto en filas (igual estética que un Space Invaders clásico: sprites/rectángulos alienígenas en grilla), pero **sin movimiento lateral en bloque**: cada invasor desciende en línea recta vertical a velocidad fija desde su fila, y el spawn de nuevas filas es continuo desde arriba (oleada infinita, no niveles discretos por limpiar la pantalla).
- Ritmo creciente por tiempo transcurrido: la velocidad de descenso de los invasores y la frecuencia de spawn aumentan gradualmente cada X segundos de partida (no por "subir de nivel" tras completar una oleada, sino como una rampa continua tipo "endless runner"), reforzando la sensación arcade de partida corta e intensa.
- Puntuación: +10 puntos por invasor destruido, sin multiplicadores de combo ni bonificaciones por reflejos — el único factor de score es cuántos invasores acumulas antes de fallar, coherente con la simplicidad de un solo botón.
- Condición de derrota: un invasor llega a la línea de la nave (parte inferior del canvas) sin haber sido destruido — game over inmediato, sin vidas extra ni escudos.
- `setPaused(true)` congela el descenso y el disparo, pero sigue dibujando el último frame (nave, invasores, HUD) — mismo criterio que los motores existentes.
- Entrada nueva en `public.games` (ver Modelo de datos) para no reutilizar ni modificar la fila `invasores` ya sembrada.

**No incluye:**

- Movimiento lateral del jugador — es intencional, es el corazón del ángulo "un solo botón"; no se agrega una segunda tecla de movimiento aunque sería trivial.
- Combos, multiplicadores de racha, dificultad por niveles discretos o power-ups — eso corresponde a los otros dos ángulos de la jam (combo/reflejos y giro inesperado), no a esta propuesta.
- Vidas múltiples o escudos defensivos — un solo impacto termina la partida, para mantener la tensión de ritmo rápido.
- Sonido/música.
- Controles táctiles avanzados más allá de "tap para disparar" (no hay gestos, swipes, ni joystick virtual).
- Tocar la fila `invasores` existente en `public.games` — se crea una fila nueva e independiente.

## Modelo de datos

Nueva fila propuesta para `public.games` (no se modifica el esquema, solo se agrega un registro):

| Campo              | Valor                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `id`               | `canon-auto`                                                                                           |
| `title`            | `CAÑÓN AUTOMÁTICO`                                                                                     |
| `category` (`cat`) | `SHOOTER`                                                                                              |
| `short`            | `Un botón, un disparo. Detén el enjambre antes de que te alcance.`                                     |
| `cover`            | `cover-canon-auto`                                                                                     |
| `color`            | `red` (para diferenciarlo visualmente de `rocas`, que ya usa `yellow`, e `invasores`, que usa `green`) |

Interfaz de estado del motor (mismo contrato `EngineState` que el resto del catálogo):

```ts
// lib/games/canon-auto/engine.ts
export interface CanonAutoState {
  score: number;
  lives: number; // 1 mientras juega, 0 al perder (un solo impacto termina la partida)
  level: number; // se reporta como "oleada" derivada del tiempo transcurrido, solo informativo en el HUD
  gameOver: boolean;
}

export interface CanonAutoEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
}

export function createCanonAutoEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: CanonAutoState) => void
): CanonAutoEngine;
```

## Plan de implementación

1. **Definir la mecánica de nave automática y disparo por timing.** Prototipar dentro del closure de `createCanonAutoEngine` el movimiento de rebote horizontal de la nave (velocidad constante, sin input) y el listener único de disparo (`keydown` de `Espacio`/`↑` + `click`/`touchstart` sobre el canvas), con cooldown entre disparos. Sistema funcional: en un canvas de prueba se ve la nave rebotando sola y cada pulsación dispara un proyectil vertical desde su posición actual.
2. **Implementar el enjambre de invasores en oleada continua.** Spawn periódico de filas de invasores desde arriba del canvas, cada uno cayendo en línea recta a velocidad fija; detección de colisión proyectil-invasor (destruye ambos, suma puntaje) y colisión invasor-línea inferior (dispara game over). Sistema funcional: se puede jugar una partida completa de principio a fin en un entorno aislado (fuera de `/jugar`), con score y derrota funcionando.
3. **Agregar la rampa de dificultad por tiempo.** Incrementar gradualmente la velocidad de caída y la frecuencia de spawn cada N segundos de partida transcurridos, y derivar un valor de "oleada"/`level` informativo para el HUD a partir de ese contador de tiempo. Sistema funcional: la partida se siente progresivamente más intensa sin necesidad de "limpiar la pantalla" para avanzar.
4. **Dibujo y HUD.** Nave y proyectiles vectoriales (rectángulos/triángulos neón con `shadowBlur`, mismo criterio estético que ROCAS/SERPENTINA), invasores como sprites simples o formas geométricas alienígenas repetidas, HUD con score y oleada actual, overlay de "GAME OVER". Sistema funcional: el juego es visualmente coherente con el resto del catálogo (estética neón sobre fondo oscuro).
5. **Conectar al registro `ENGINES` de `GamePlayer.tsx`** agregando `'canon-auto': createCanonAutoEngine`, y sembrar la fila nueva en `public.games` (`insert ... on conflict (id) do nothing`). Sistema funcional: `/jugar/canon-auto` es jugable de punta a punta, incluyendo guardado de puntuación en `scores` con sesión activa.
6. **Verificación de punta a punta.** `npm run build`/`npm run lint` sin errores nuevos; confirmar en navegador que pausa/reanudar, reinicio, y fin de juego con guardado de score funcionan, y que ningún otro juego portado (`rocas`, `caida`, `bloque-buster`, `serpentina`) sufre regresión por el cambio en `GamePlayer.tsx`.

## Criterios de aceptación

- [ ] La nave se mueve automáticamente en rebote horizontal sin ningún input del jugador para el movimiento.
- [ ] Una sola tecla (`Espacio`/`↑`) y un tap/clic en el canvas producen la misma acción de disparo, con cooldown perceptible entre disparos consecutivos.
- [ ] Los invasores caen en oleada continua (sin necesidad de "limpiar la pantalla" para que aparezcan más) y aumentan de velocidad/frecuencia con el tiempo transcurrido.
- [ ] Destruir un invasor suma 10 puntos, sin combos ni multiplicadores.
- [ ] Un invasor que llega a la línea inferior sin ser destruido termina la partida inmediatamente.
- [ ] `setPaused(true)` congela el juego visualmente sin dejarlo en negro; reanudar continúa desde el mismo estado.
- [ ] El HUD muestra score y oleada actuales en tiempo real.
- [ ] Con sesión activa, terminar la partida permite guardar el puntaje en `scores` con `game_id: "canon-auto"`.
- [ ] `/biblioteca` muestra la nueva entrada `CAÑÓN AUTOMÁTICO` sin afectar la fila `invasores` existente.
- [ ] Ningún otro juego portado sufre regresión tras agregar la entrada al registro `ENGINES`.

## Decisiones tomadas y descartadas

- **Crear un `id` nuevo (`canon-auto`) en vez de portar el motor sobre la fila `invasores` existente:** la fila `invasores` en el catálogo mock ya tiene su propia descripción ("Defiende el planeta de filas alienígenas") que sugiere un shooter de movimiento libre clásico; forzar la mecánica de un solo botón sobre esa entrada cambiaría su identidad sin autorización, y esta propuesta es una alternativa, no un reemplazo.
- **Nave con movimiento automático en vez de dejar que el jugador la mueva con una segunda tecla:** es la decisión central del ángulo asignado — reducir el control a una sola acción (disparar) es lo que distingue esta propuesta de un shooter convencional y de las otras dos propuestas de la jam.
- **Oleada continua por tiempo en vez de niveles discretos que se completan al limpiar la pantalla:** un sistema de "nivel completado" introduce pausas de ritmo (esperar a que caiga el último invasor) que contradicen el objetivo de ritmo ininterrumpido; la rampa de dificultad por tiempo transcurrido mantiene la tensión constante.
- **Un solo impacto para game over, sin vidas extra:** refuerza que cada disparo/timing importa, coherente con un juego de reflejos puros de sesión corta (30 segundos a 2 minutos por partida), en vez de partidas largas con margen de error.
- **Sin combos ni multiplicadores de puntaje:** esa mecánica corresponde explícitamente al ángulo de diseño de "combos/reflejos con dificultad creciente por niveles" asignado a otra propuesta paralela; esta se mantiene deliberadamente minimalista en su sistema de score (10 puntos fijos por invasor) para no solaparse.

## Riesgos identificados

- El cooldown de disparo debe calibrarse con cuidado: demasiado corto convierte el "timing" en spam sin skill; demasiado largo frustra al jugador cuando varios invasores caen alineados. Requiere playtesting antes de fijar el valor final (150ms es un punto de partida, no un valor cerrado).
- La velocidad de rebote de la nave debe ser predecible (no aleatoria) para que el jugador pueda anticipar su posición al momento de decidir disparar; si se introduce cualquier variación de velocidad no comunicada en el HUD, el juego se sentiría injusto.
- Igual que en los motores existentes, todo el estado (posición de nave, proyectiles, invasores, contador de tiempo/oleada) debe vivir dentro del closure de `createCanonAutoEngine`, no en variables de módulo, para evitar fugas de estado entre partidas.
- Agregar una fila nueva a `public.games` y una entrada nueva a `ENGINES` en `GamePlayer.tsx` toca la única superficie compartida por todo el catálogo; mitigado verificando explícitamente que los juegos ya portados no sufren regresión.
