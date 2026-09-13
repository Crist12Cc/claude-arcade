# SPEC 05 — Asteroids: primer juego jugable (ROCAS)

**Estado:** Implementado
**Depende de:** SPEC 01
**Fecha:** 2026-09-13

**Objetivo:** Adaptar el clon de Asteroids de `references/started-games/02-asteroids/` como el primer juego real y jugable de Arcade Vault, integrado en `/jugar/rocas` reemplazando la cáscara mock de la entrada "ROCAS" del catálogo.

## Alcance

**Incluye:**

- Motor del juego portado desde `references/started-games/02-asteroids/game.js` a un módulo TypeScript (`lib/games/asteroids/engine.ts`), conservando su lógica (nave, asteroides con split, balas, partículas de explosión, power-up de disparo triple, wrap toroidal, colisiones) tal como está en el original.
- El motor se monta sobre un `<canvas>` de 800×600 dentro de la arena de `GamePlayer.tsx`, reemplazando el `div.game-arena` decorativo (CSS) que existe hoy solo para la entrada `rocas`. Otras entradas del catálogo (`bloque-buster`, `caida`, etc.) siguen mostrando la arena CSS mock sin cambios.
- El motor expone su estado (`score`, `lives`, `level`, `gameOver`) a React vía un callback en cada frame, para que el HUD existente (jugador/puntuación/vidas/nivel) de `GamePlayer.tsx` refleje los valores reales del juego en vez del timer mock.
- El botón "PAUSA" del HUD detiene realmente el loop del motor (dejan de actualizarse nave/asteroides/balas); "REANUDAR" lo reactiva.
- Cuando el motor entra en su estado interno de game over (vidas a 0), notifica a React para abrir el mismo modal de "FIN DEL JUEGO" ya existente (input de iniciales + "GUARDAR PUNTUACIÓN"), con el puntaje final real. El botón manual "FIN" del HUD sigue funcionando igual que hoy (corta la partida en curso y abre el modal con el puntaje actual).
- "JUGAR DE NUEVO" en el modal reinicia el motor (nuevo `initGame()` interno) además de resetear el estado de React del modal.
- Guardado de puntuación al confirmar en el modal: se mantiene el flujo actual sin cambios (`localStorage` bajo `av_scores`, con `{ game: "rocas", score, name, at }`).
- Captura de teclado (`ArrowLeft/Right/Up`, `Space`) con `preventDefault()` para evitar scroll de la página, activa solo mientras `/jugar/rocas` está montado (listeners se agregan en el mount del componente y se remueven al desmontar o navegar fuera).
- El `requestAnimationFrame` del motor se detiene por completo al desmontar el componente (salir con "SALIR", navegar con el Nav, cerrar pestaña), sin dejar loops corriendo en segundo plano.
- Actualización de la entrada `rocas` en `lib/data.ts` si el título/descripción actual ya no aplican (ver Modelo de datos) — se mantiene el mismo `id` para no romper enlaces existentes desde `/juego/[id]` y `/salon`.
- El canvas escala de forma responsiva (mantiene proporción 4:3, `max-width: 100%`) dentro de `.crt-screen` para no romper el layout en viewports angostos, aunque el juego solo sea jugable con teclado físico.

**No incluye:**

- Controles táctiles/on-screen para móvil. En viewports sin teclado físico el juego se muestra pero no es jugable; no se agrega ningún aviso adicional más allá de lo que ya haría un jugador sin teclado.
- Persistencia de puntuaciones en Supabase/backend. Se mantiene `localStorage` (`av_scores`), igual que el resto de juegos mock — es un spec futuro no incluido aquí.
- Adaptar ningún otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel` siguen siendo cáscaras mock).
- Cambios al Salón de la Fama (`/salon`): sigue mostrando `seededScores` mock para `rocas`, sin mezclarse con las puntuaciones reales guardadas en `av_scores`.
- Sonido/música (el original no lo tiene).
- Tests automatizados (no hay test runner configurado en el proyecto).
- Cambios de dificultad, niveles adicionales o balance distintos a los ya definidos en `game.js`.

## Modelo de datos

No se introduce ninguna estructura de datos nueva. Cambios sobre estructuras existentes:

```ts
// lib/data.ts — entrada existente, mismo id, texto ajustado a la realidad del juego portado
{
  id: "rocas",
  title: "ROCAS",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge el power-up de disparo triple cuando aparezca.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

Estructura ya existente en `localStorage` (`av_scores`), sin cambios — se sigue escribiendo con `game: "rocas"`:

```ts
type StoredScoreEntry = {
  game: string;
  score: number;
  name: string;
  at: number;
};
```

Interfaz nueva, solo en memoria (no persistida), para el contrato entre el motor y React:

```ts
// lib/games/asteroids/engine.ts
export interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

export interface AsteroidsEngine {
  start(): void;
  destroy(): void; // detiene el rAF y remueve listeners de teclado
  setPaused(paused: boolean): void;
  restart(): void; // reinicia el estado interno del juego (nuevo initGame())
}

export function createAsteroidsEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: AsteroidsState) => void
): AsteroidsEngine;
```

## Plan de implementación

1. **Portar el motor.** Crear `lib/games/asteroids/engine.ts` copiando la lógica de `references/started-games/02-asteroids/game.js` (clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, constantes, `update`/`draw`), envuelta en `createAsteroidsEngine(canvas, onStateChange)` que retorna `{ start, destroy, setPaused, restart }`. El canvas y el contexto 2D se toman del parámetro en vez de `document.getElementById`. `onStateChange` se invoca al final de cada `update(dt)` con `{ score, lives, level, gameOver: state === 'gameover' }`. El loop deja de correr si `paused` es `true` (se guarda pero no se dibuja congelado — se sigue llamando `draw()` para que el canvas no quede en negro). Sistema funcional: el módulo compila y exporta el motor; aún no se usa en ninguna pantalla.
2. **Actualizar `lib/data.ts`.** Ajustar `short`/`long` de la entrada `rocas` para reflejar el power-up de disparo triple (ver Modelo de datos). Sistema funcional: build pasa, sin efecto visible en el canvas todavía.
3. **Integrar el motor en `GamePlayer.tsx`.** Cuando `game.id === "rocas"`, renderizar un `<canvas>` de 800×600 dentro de `.crt-screen` en vez del `div.game-arena` mock, montar el motor en un `useEffect` (`createAsteroidsEngine` + `start()`), reflejar `score`/`lives`/`level` reales en el HUD vía el callback, y llamar `engine.destroy()` en el cleanup del efecto. Para el resto de `game.id`, `GamePlayer.tsx` sigue exactamente igual que hoy (arena CSS + timer mock). Sistema funcional: entrar a `/jugar/rocas` muestra el juego real y jugable con teclado; el HUD muestra el puntaje/vidas/nivel reales; las demás rutas `/jugar/[id]` no cambian.
4. **Pausa real.** Conectar el botón "PAUSA"/"REANUDAR" existente a `engine.setPaused(paused)`. Sistema funcional: pausar congela nave/asteroides/balas en pantalla; reanudar continúa desde donde quedó.
5. **Game over y modal.** Cuando `onStateChange` reporta `gameOver: true` (y aún no se había mostrado el modal para esa partida), disparar el mismo flujo que hoy dispara el botón "FIN" (abrir el modal con el puntaje final). El botón manual "FIN" sigue funcionando igual para `rocas` (corta la partida ya en curso). "JUGAR DE NUEVO" llama `engine.restart()` además del reset de estado de React existente. Sistema funcional: perder las 3 vidas dentro del juego abre el modal automáticamente con el puntaje correcto; reiniciar vuelve a jugar desde cero.
6. **Limpieza de listeners y ciclo de vida.** Verificar que `engine.destroy()` remueve los listeners de teclado y cancela el `requestAnimationFrame` pendiente; probar navegar a `/jugar/rocas`, jugar, y salir por "SALIR"/Nav/back del navegador sin que el juego siga corriendo en consola (verificar con el loop detenido, sin errores). Sistema funcional: no quedan listeners ni loops huérfanos tras salir de la pantalla.
7. **Pulido final.** Verificar el canvas responsivo (no rompe layout en viewport angosto, aunque no sea jugable sin teclado), `npm run build` y `npm run lint` sin errores, y una partida completa de punta a punta (jugar → power-up de disparo triple → subir de nivel → perder → guardar puntuación → ver reflejado en `/salon` no aplica, solo en `av_scores`).

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] Entrar a `/jugar/rocas` muestra un canvas jugable (nave controlable con flechas, disparo con espacio) en vez de la arena CSS decorativa.
- [ ] El HUD de `/jugar/rocas` muestra puntuación, vidas y nivel reales del motor, actualizados en tiempo real (no el timer mock).
- [ ] Destruir asteroides suma puntos según su tamaño (20/50/100, igual que el original) y los grandes se dividen en medianos y luego en pequeños.
- [ ] Recoger el power-up de disparo triple hace que la nave dispare tres balas en abanico durante su duración.
- [ ] Perder una vida reaparece la nave con invencibilidad temporal (parpadeo); perder las 3 vidas abre automáticamente el modal "FIN DEL JUEGO" con el puntaje final.
- [ ] El botón "FIN" del HUD también abre el modal con el puntaje actual sin esperar a perder todas las vidas.
- [ ] "PAUSA" congela visualmente el juego (nave, asteroides y balas dejan de moverse); "REANUDAR" continúa la partida.
- [ ] Guardar la puntuación desde el modal persiste una entrada en `localStorage` bajo `av_scores` con `game: "rocas"`, igual que los demás juegos.
- [ ] "JUGAR DE NUEVO" reinicia tanto el estado del modal como el juego (nave al centro, puntaje en 0, 3 vidas, nivel 1, asteroides regenerados).
- [ ] Salir de `/jugar/rocas` (botón "SALIR", navegación del Nav, o back del navegador) detiene el loop del juego y sus listeners de teclado — no quedan corriendo en segundo plano.
- [ ] Las demás rutas `/jugar/[id]` (juegos que no son `rocas`) siguen mostrando la arena CSS mock sin cambios de comportamiento.
- [ ] El canvas se ve completo y sin desbordar el layout en un viewport angosto (~400px), aunque el juego no sea jugable sin teclado en ese caso.

## Decisiones tomadas y descartadas

- **Reemplazar la entrada `rocas`** en vez de crear una nueva, porque ya existe temáticamente como "asteroides" en el catálogo y el detalle/salón ya apuntan a ese `id` — evita enlaces rotos o duplicar el juego en el catálogo.
- **Reusar el HUD y el modal genéricos de `GamePlayer.tsx`** en vez de una pantalla standalone, para mantener consistencia visual con el resto de juegos (aunque sean mock) y no duplicar el flujo de guardado de puntuación ya construido en SPEC 01.
- **El motor expone estado vía callback por frame** en vez de que React haga polling con un intervalo, porque ya existe un loop de `requestAnimationFrame` corriendo — reportar el estado al final de cada `update(dt)` es más simple y evita un segundo timer.
- **Incluir el power-up de disparo triple** aunque no esté en el README del juego original, porque ya está implementado en `game.js` y no cuesta trabajo adicional dejarlo fuera.
- **Sin controles táctiles**, porque el juego depende de rotación continua + propulsión + disparo, un esquema que no se puede resolver bien con un layout de botones improvisado sin diseño dedicado — se deja explícitamente fuera de alcance para no inventar una UX de controles táctiles sin que el usuario la haya pedido.
- **Sin puntuaciones reales en el Salón de la Fama**, manteniendo `seededScores` mock ahí — mezclar mock con datos reales de `av_scores` es un problema de diseño de datos que corresponde a un spec futuro de puntuaciones persistentes (ya anticipado como fuera de alcance en SPEC 04).
- **Canvas de tamaño fijo (800×600) escalado por CSS** en vez de recalcular la resolución interna del canvas según el viewport, porque el motor original asume esas dimensiones para el wrap toroidal y el spawn de asteroides; reescribirlo a resolución variable es un cambio de mayor alcance no pedido.

## Riesgos identificados

- El motor original usa variables de módulo (`ship`, `bullets`, `score`, etc.) en vez de un estado encapsulado en una clase/closure. Al envolverlo en `createAsteroidsEngine`, hay que asegurarse de que cada instancia tenga su propio estado — si el usuario navega a `/jugar/rocas`, sale y vuelve a entrar, dos instancias del motor no deben compartir variables globales del módulo (riesgo de "fuga" de estado entre partidas si no se encapsula bien).
- Los listeners de teclado del original son globales (`window.addEventListener`). Si no se remueven correctamente en `engine.destroy()`, pulsar flechas/espacio en otras pantallas del sitio después de salir de `/jugar/rocas` podría tener efectos residuales (aunque no muevan ninguna nave, sí bloquean el scroll vía `preventDefault`).
- `requestAnimationFrame` no detenido correctamente al desmontar dejaría el loop corriendo indefinidamente en segundo plano, consumiendo CPU incluso fuera de la pantalla del juego.
