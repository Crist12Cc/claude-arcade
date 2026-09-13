# SPEC PROPUESTA — Infiltrador (INFILTRADOR)

**Estado:** Propuesta
**Tema de la jam:** invasores
**Ángulo de diseño:** Un giro inesperado o poco obvio sobre el tema "invasores" (no la interpretación literal más directa, como el clon directo de Space Invaders).
**Fecha:** 2026-09-13

**Objetivo:** Invertir el punto de vista clásico de "invasores": en vez de defender la Tierra disparando a una flota alienígena, el jugador controla al invasor — un explorador alienígena diminuto infiltrado en una ciudad humana — y debe moverse sigilosamente por una cuadrícula esquivando conos de visión de guardias/cámaras para plantar "balizas de invasión" en puntos objetivo antes de que se agote el tiempo, sin ser detectado. Encaja en el catálogo arcade porque mantiene una sesión corta, tensa y de reflejos (leer patrones de patrulla, planear rutas, arriesgarse en ventanas cortas de seguridad) pero cambia por completo el verbo principal: de "disparar" a "esconderse y planear", diferenciándose claramente de un shooter de reflejos o de un juego de un solo botón.

## Alcance

**Incluye:**

- Motor nuevo en `lib/games/infiltrador/engine.ts`, mismo contrato que los juegos ya portados (`start`, `destroy`, `setPaused`, `restart`, `onStateChange` con `{score, lives, level, gameOver}`), canvas de 800×600 sobre una cuadrícula fija (por ejemplo 40×30 celdas de 20px, mismo criterio de grilla que SERPENTINA).
- Un mapa por nivel con 3–5 "guardias" que patrullan rutas fijas o pendulares (izquierda-derecha / arriba-abajo) a velocidad constante, cada uno proyectando un cono/rectángulo de visión en la dirección de movimiento; el cono se dibuja semitransparente para que el jugador anticipe la zona peligrosa.
- 3–4 "balizas objetivo" (puntos fijos marcados en el mapa) que el jugador debe alcanzar y mantener presionado `E`/`Espacio` durante ~1 segundo (una barra de progreso breve) para "plantarlas"; plantar todas las balizas del nivel completa el nivel y suma puntos base + bonus por tiempo restante.
- Controles de movimiento por celda con `↑ ↓ ← →` (un paso por pulsación o repetición controlada, no movimiento continuo tipo shooter), para reforzar el ritmo de planeación en vez de reflejos puros.
- Detección: si el jugador está dentro de un cono de visión de un guardia durante más de una fracción de segundo (~0.3s de gracia para permitir cruces rápidos), se considera "detectado": pierde una vida, es teletransportado al punto de entrada del nivel, y los guardias reinician sus rutas; con 0 vidas, `gameOver: true`.
- Vidas iniciales: 3. Cada nivel superado sube el nivel (`level++`), agrega un guardia adicional o acorta el tiempo límite, aumentando la dificultad de planeación sin depender de velocidad de reflejos.
- Temporizador visible por nivel (ej. 45s); si se agota sin plantar todas las balizas, se pierde una vida igual que ser detectado y el nivel se reinicia.
- Cálculo de score: +50 por baliza plantada, +bonus proporcional al tiempo restante al completar el nivel, sin puntos por "matar" a nadie (no hay combate ni disparo en todo el juego).
- `setPaused(true)` congela guardias, temporizador y barra de progreso de plantado, pero sigue dibujando el último frame (mismo criterio que los demás motores).
- Reutilización de la fila existente `invasores` en `public.games` (ya sembrada, categoría SHOOTER) — se documenta como decisión abierta que el equipo de curaduría deberá resolver si esta propuesta reemplaza esa entrada o crea una nueva (ver sección de datos).

**No incluye:**

- Cualquier forma de disparo, proyectil o combate directo — es la pieza central que distingue esta propuesta de una interpretación literal de "invasores".
- IA de guardias reactiva/persecutoria (no persiguen al jugador tras detectarlo más allá del reinicio); solo patrullas de ruta fija predecible, para mantener el foco en planeación y timing, no en huida.
- Sonido/música, controles táctiles, múltiples pantallas de menú o editor de niveles — alcance mínimo jugable, igual criterio que SPEC 05/07/08/09.
- Generación procedural de mapas — los niveles son un conjunto pequeño de layouts fijos definidos en el propio motor (array de niveles), sin editor ni aleatoriedad estructural (los guardias sí patrullan con timing determinista dentro de cada layout).
- Historias, diálogos o narrativa adicional más allá del concepto "explorador alienígena plantando balizas".

## Modelo de datos

Esta propuesta puede resolverse de dos maneras respecto a `public.games` (decisión a tomar por curaduría, no en esta spec):

**Opción A (recomendada):** nueva fila con un `id` distinto de `invasores` para no chocar con la entrada ya existente (que describe un shooter clásico de filas alienígenas):

| Campo      | Valor propuesto                                          |
| ---------- | -------------------------------------------------------- |
| `id`       | `infiltrador`                                            |
| `title`    | `INFILTRADOR`                                            |
| `category` | `ARCADE` (o `SIGILO` si se decide abrir categoría nueva) |
| `short`    | `Cuélate sin ser visto y planta tus balizas.`            |
| `color`    | `magenta`                                                |

**Opción B:** si la curaduría decide que esta propuesta reemplaza el mock actual de `invasores`, se actualizaría `title`/`short`/`cover` de esa fila existente en vez de crear una nueva — pero esto cambia la promesa ya comunicada en el catálogo ("Defiende el planeta de filas alienígenas") por una completamente distinta, así que se deja como decisión explícita fuera de esta spec.

No se requiere ningún cambio de esquema: la tabla `public.games` ya tiene todas las columnas necesarias.

Interfaz en memoria (no persistida) para el contrato motor↔React:

```ts
// lib/games/infiltrador/engine.ts
export interface InfiltradorState {
  score: number;
  lives: number; // 3 iniciales, baja al ser detectado o agotar el tiempo del nivel
  level: number; // sube al completar todas las balizas de un layout
  gameOver: boolean; // true al llegar a 0 vidas
}

export interface InfiltradorEngine {
  start(): void;
  destroy(): void;
  setPaused(paused: boolean): void;
  restart(): void;
}

export function createInfiltradorEngine(
  canvas: HTMLCanvasElement,
  onStateChange: (state: InfiltradorState) => void
): InfiltradorEngine;
```

## Plan de implementación

1. **Definir el formato de nivel.** Diseñar una estructura de datos simple por nivel: posición inicial del jugador, lista de guardias (ruta de patrulla como array de puntos + velocidad), lista de balizas objetivo (posición fija), tiempo límite. Empezar con 3 layouts fijos codificados como constantes dentro del motor. Sistema funcional: los datos de nivel existen y son válidos en TypeScript, sin dibujarse aún.
2. **Escribir el bucle de simulación.** Crear `lib/games/infiltrador/engine.ts` con el ciclo de movimiento del jugador por celda, movimiento pendular de guardias sobre su ruta, cálculo del cono de visión de cada guardia (rectángulo/triángulo proyectado desde su posición en la dirección de movimiento), y detección de solapamiento jugador/cono con la gracia de ~0.3s. Sistema funcional: el módulo compila, la lógica de patrulla y detección es verificable con pruebas manuales en consola (sin canvas todavía).
3. **Dibujar el mapa y el HUD.** Renderizar grilla, guardias (sprite simple o rectángulo con dirección indicada), conos de visión semitransparentes, balizas (parpadeo suave para destacarlas), jugador (marcador distintivo), barra de progreso de plantado sobre la baliza activa, temporizador y HUD de vidas/score/nivel. Sistema funcional: `/jugar/infiltrador` (o el id definitivo) muestra un tablero completo, navegable con el teclado, aunque aún sin condición de derrota conectada al modal.
4. **Conectar detección, temporizador y progresión de nivel.** Implementar pérdida de vida por detección o por tiempo agotado, teletransporte al punto de entrada, avance de nivel al completar todas las balizas, y `gameOver` a las 3 vidas perdidas. Sistema funcional: el juego es jugable de principio a fin — se puede perder, ganar niveles, y llegar a un game over real.
5. **Registrar el motor y sembrar/ajustar el catálogo.** Agregar la entrada correspondiente a `ENGINES` en `GamePlayer.tsx` y resolver la decisión de datos (Opción A o B de la sección anterior) con el equipo de curaduría antes de sembrar/actualizar la fila en `public.games`. Sistema funcional: el juego aparece jugable en `/biblioteca` → `/juego/<id>` → `/jugar/<id>` con guardado de score real en `scores`.

## Criterios de aceptación

- [ ] El jugador se mueve por celdas con `↑ ↓ ← →` sin poder atravesar límites del mapa.
- [ ] Cada guardia patrulla una ruta fija y predecible, con su cono de visión dibujado y visualmente distinguible del resto del mapa.
- [ ] Entrar al cono de visión más de ~0.3s cuenta como detección: resta una vida, reinicia la posición del jugador y las rutas de guardias.
- [ ] Mantener presionada la tecla de acción sobre una baliza objetivo durante ~1s la planta (con barra de progreso visible) y suma puntos.
- [ ] Completar todas las balizas de un nivel antes de que se agote el temporizador avanza al siguiente nivel y agrega dificultad (guardia extra o menos tiempo).
- [ ] Agotar el temporizador sin completar el nivel resta una vida y reinicia el intento del mismo nivel.
- [ ] Llegar a 0 vidas dispara `gameOver: true` y el modal estándar de fin de juego con el puntaje final.
- [ ] `setPaused(true)` congela guardias, temporizador y barra de plantado sin dejar el canvas en negro.
- [ ] El juego no incluye ningún mecanismo de disparo o combate en ningún momento de la partida.

## Decisiones tomadas y descartadas

- **Invertir el rol jugador↔invasor** (el jugador ES el invasor, no quien lo combate): es el corazón del ángulo asignado ("giro inesperado sobre el tema") y evita solaparse con un shooter de reflejos o un juego de un solo botón.
- **Movimiento por celda en vez de movimiento continuo:** refuerza el ritmo de planeación pausada (leer patrullas, esperar la ventana correcta) en vez de reflejos de esquive en tiempo real, diferenciándose de las otras dos propuestas de la jam centradas en velocidad/combos.
- **Guardias con rutas fijas predecibles en vez de IA de persecución:** mantiene el alcance simple (sin pathfinding) y refuerza que el desafío es de observación y timing, no de huida reactiva.
- **Sin disparo ni combate de ningún tipo:** decisión deliberada para que la propuesta no termine convergiendo en un tetris de disparos; el "invasor" gana por sigilo, no por fuerza.
- **Dejar como decisión abierta si reemplaza o coexiste con la fila `invasores` existente:** el mock actual promete explícitamente un shooter clásico ("Defiende el planeta de filas alienígenas"); cambiar su promesa sin decisión de curaduría se considera fuera del alcance de esta spec.

## Riesgos identificados

- Si el cono de visión se calcula mal (por ejemplo, sin considerar la dirección actual del guardia), el jugador podría percibir detecciones como injustas; mitigar dibujando el cono siempre visible y con ángulo/alcance consistentes con la dirección de movimiento.
- Un temporizador demasiado ajustado en niveles con múltiples balizas podría frustrar más que desafiar; deberá calibrarse en playtesting antes de considerarse aceptable.
- Movimiento por celda (en vez de continuo) puede sentirse "lento" si el paso de repetición de tecla no está bien ajustado; se deberá afinar el intervalo de repetición para que se sienta responsivo sin volverse un movimiento continuo de facto.
- Reutilizar el `id` `invasores` sin coordinar con curaduría rompería la promesa de descripción ya mostrada en el catálogo; se deja explícitamente como decisión pendiente para evitar ese riesgo.
- Como con todos los motores basados en `requestAnimationFrame` y listeners de teclado en `window`, si `destroy()` no limpia correctamente el loop y el listener, el juego seguiría corriendo en segundo plano tras salir de la pantalla.
