# SPEC PROPUESTA — Cadena de Impacto (COMBO INVASOR)

**Estado:** Propuesta
**Tema de la jam:** invasores
**Ángulo de diseño:** Mecánica de puntuación por combos/reflejos, con dificultad creciente por niveles.
**Fecha:** 2026-09-13

**Objetivo:** Crear un shooter de invasores donde el puntaje no depende de "cuántos disparas" sino de "qué tan preciso y rítmico es tu disparo": cada impacto sin fallar extiende una cadena de combo que multiplica el puntaje, mientras oleadas cada vez más rápidas y erráticas de aliens ponen a prueba los reflejos del jugador. Encaja en el catálogo porque introduce, sin clonar `invasores` (SHOOTER, ya implementado en el catálogo como cáscara mock con la interpretación clásica de filas descendientes), un sistema de scoring de combo/reflejos que ningún otro juego portado hasta ahora (ROCAS, CAÍDA, BLOQUE BUSTER, SERPENTINA) utiliza, diferenciándose también de una propuesta paralela de un solo botón/ritmo clásico y de otra con un giro conceptual inesperado sobre el tema.

## Alcance

**Incluye:**

- Nave del jugador en la parte inferior del canvas (800×600), movimiento horizontal con `←`/`→` (o `A`/`D`), disparo con `Espacio` o clic; sin límite de munición.
- Oleadas de aliens que aparecen desde arriba en patrones variables (línea recta, zigzag, diagonal) y descienden hacia el jugador; cada oleada tiene una "ventana de reflejo": los aliens parpadean brevemente (flash blanco) justo antes de quedar en rango de disparo óptimo, indicando el momento ideal para dispararles.
- **Sistema de combo:** cada impacto consecutivo sin fallar un disparo (o sin dejar que un alien cruce la línea inferior) incrementa un contador de combo (`comboCount`) y un multiplicador de puntos (`x1`, `x2`, `x3`... hasta un tope `MAX_MULTIPLIER`); disparar y fallar (no impactar nada) o dejar pasar un alien reinicia el combo a `x1`. El puntaje base por alien es fijo (`BASE_POINTS`), pero el puntaje otorgado es `BASE_POINTS * multiplicador`.
- **Bono de reflejo:** si el impacto ocurre dentro de la ventana de flash (alien "marcado"), se otorga un bono extra de puntos y el combo sube el doble de rápido (para incentivar disparar en el momento justo, no solo disparar rápido sin puntería).
- Barra de combo en el HUD que se vacía visualmente con el tiempo si el jugador no dispara (ventana de gracia corta), forzando ritmo constante en vez de ráfagas esporádicas.
- Progresión de dificultad por niveles: cada nivel aumenta la velocidad de descenso de los aliens, la frecuencia de spawn, y reduce la duración de la ventana de flash de reflejo; el nivel sube automáticamente tras derrotar un número fijo de oleadas.
- Vidas: el jugador pierde una vida si un alien llega a la línea inferior o colisiona con la nave; 3 vidas iniciales, fin de juego (`gameOver: true`) al llegar a 0.
- HUD con puntaje, combo actual (`xN`), nivel y vidas, siguiendo el mismo contrato `onStateChange({score, lives, level, gameOver})` de los motores existentes.
- Motor autocontenido en `lib/games/<id>/engine.ts` (id propuesto: `cadena-impacto` o similar, a decidir en fase de implementación) siguiendo el mismo contrato (`start`, `destroy`, `setPaused`, `restart`) que ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA.

**No incluye:**

- Clon del `invasores` mock existente en el catálogo (no reutiliza su id ni su descripción; si en implementación se decide usar ese id, se reemplazaría su cáscara mock, pero el diseño de esta propuesta es un juego nuevo, no una copia 1:1 de "filas alienígenas defendiendo el planeta" sin la capa de combo/reflejos).
- Power-ups, armas alternativas, jefes finales o modos cooperativos — se prioriza la mecánica de scoring por combo sobre variedad de contenido.
- Sonido/música.
- Controles táctiles/on-screen para móvil.
- Guardado de "mejor combo" como estadística separada del score — el combo es solo un multiplicador interno, no se persiste como columna nueva en Supabase.

## Modelo de datos

Fila propuesta para `public.games` (o reutilización/reemplazo de la fila mock `invasores` existente, a decidir en implementación):

| Campo             | Valor propuesto                                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `cadena-impacto`                                                                                                                                                                                                                               |
| `title`           | CADENA DE IMPACTO                                                                                                                                                                                                                              |
| `cat` (categoría) | SHOOTER                                                                                                                                                                                                                                        |
| `short`           | Encadena impactos perfectos antes de que el combo se apague.                                                                                                                                                                                   |
| `long`            | Dispara en el momento justo para mantener viva tu cadena de combo: cada impacto certero multiplica tu puntaje, pero un solo fallo o un alien que se te escapa lo reinicia todo. La velocidad y densidad de las oleadas aumenta con cada nivel. |
| `cover`           | `cover-cadena-impacto` (clase CSS nueva a crear en `globals.css`, siguiendo el patrón `cover-<id>` de los demás juegos)                                                                                                                        |
| `color`           | orange (no usado aún por ningún otro juego del catálogo listado en `references/impl-games.md`)                                                                                                                                                 |

No se requiere ningún cambio de esquema: la tabla `public.games` ya tiene las columnas necesarias (`id`, `title`, `cat`, `short`, `long`, `cover`, `color`), y `public.scores`/`games_with_stats` funcionan igual para cualquier `game_id` nuevo sin cambios.

## Plan de implementación

1. **Diseñar el motor y las estructuras de estado.** Definir en `lib/games/cadena-impacto/engine.ts` el estado interno del closure: posición de la nave, lista de aliens activos (posición, patrón, si están "marcados" para bono de reflejo y por cuánto tiempo), proyectiles del jugador, `comboCount`, `multiplier`, `score`, `lives`, `level`, y temporizador de gracia del combo. Sistema funcional: el módulo compila y exporta `createCadenaImpactoEngine`, aún no conectado a ninguna pantalla.
2. **Implementar spawn y movimiento de oleadas.** Generar patrones de aparición (línea, zigzag, diagonal) parametrizados por nivel (velocidad, frecuencia), con colisión contra los bordes del canvas y detección de cuándo un alien cruza la línea inferior (pierde vida y rompe combo). Sistema funcional: al llamar `start()`, se ven aliens descendiendo y moviéndose en canvas, sin lógica de disparo/combo todavía.
3. **Implementar disparo, colisión e impacto.** Agregar disparo del jugador (`Espacio`/clic), proyectiles ascendentes, detección de colisión proyectil-alien, y destrucción del alien impactado con suma de puntos base. Sistema funcional: el jugador puede moverse y disparar, destruyendo aliens y sumando puntaje simple, sin combo aún.
4. **Implementar el sistema de combo y ventana de reflejo.** Agregar el flash de "marcado" en cada alien con un temporizador corto, el bono de puntos/combo acelerado si el impacto ocurre dentro de esa ventana, el incremento normal de combo en impactos fuera de la ventana, y el reinicio del combo a `x1` en disparo fallido o alien que cruza la línea. Agregar la barra de combo visual en el HUD con su vaciado por inactividad. Sistema funcional: el juego refleja visualmente el multiplicador de combo (`xN`) y el puntaje sube de forma no lineal según la precisión y ritmo del jugador.
5. **Implementar progresión de dificultad por niveles.** Subir de nivel tras un número fijo de oleadas derrotadas, incrementando velocidad de descenso, frecuencia de spawn, y reduciendo la duración de la ventana de flash; reportar `level` en `onStateChange`. Sistema funcional: jugar varios minutos muestra una progresión perceptible de dificultad, con el HUD reflejando el nivel actual.
6. **Conectar al registro `ENGINES` y sembrar la fila en `public.games`.** Registrar `cadena-impacto: createCadenaImpactoEngine` en `components/GamePlayer.tsx`, crear la clase CSS `cover-cadena-impacto`, e insertar (o reemplazar, según decisión final) la fila correspondiente en `public.games` vía migración idempotente. Sistema funcional: `/jugar/cadena-impacto` muestra el juego completo y jugable, aparece en `/biblioteca` con `best`/`plays` reales desde `games_with_stats`, y guarda puntuaciones reales en `scores` con sesión activa.

## Criterios de aceptación

- [ ] El motor sigue el contrato estándar (`start`, `destroy`, `setPaused`, `restart`, `onStateChange`) usado por los demás juegos portados.
- [ ] Un disparo que impacta un alien fuera de la ventana de flash incrementa el combo en 1 y aplica el multiplicador correspondiente al puntaje otorgado.
- [ ] Un disparo que impacta un alien dentro de la ventana de flash otorga un bono de puntos adicional y avanza el combo más rápido que un impacto normal.
- [ ] Un disparo que no impacta nada, o un alien que cruza la línea inferior, reinicia el combo a `x1` inmediatamente.
- [ ] El HUD muestra el multiplicador de combo actual (`xN`) de forma visible y actualizada en tiempo real, además de puntaje, nivel y vidas.
- [ ] La velocidad de descenso, frecuencia de spawn y duración de la ventana de flash cambian de forma medible entre nivel 1 y nivel 3+.
- [ ] Perder las 3 vidas dispara `gameOver: true` y detiene la lógica de juego (aunque siga dibujando el estado final, como en los motores existentes).
- [ ] `setPaused(true)` congela el avance del juego sin dejar el canvas en negro.
- [ ] La fila correspondiente en `public.games` aparece en `/biblioteca` y guarda scores reales en `scores` vía el flujo estándar de `GamePlayer.tsx`.

## Decisiones tomadas y descartadas

- **Combo basado en precisión/ritmo (no en velocidad de disparo pura):** se descartó premiar solo "disparar rápido" porque eso favorecería spam de disparos sin habilidad real; en su lugar el bono de reflejo exige sincronización con la ventana de flash, y cualquier fallo rompe la cadena, generando tensión constante.
- **No reutilizar el id `invasores` existente sin cambios de contenido:** se prefiere un id/título nuevo (`cadena-impacto`) para no pisar la entrada mock ya catalogada como "Defiende el planeta de filas alienígenas" en `references/impl-games.md`, dejando la decisión de fusionar o reemplazar esa entrada para la fase de implementación real (fuera del alcance de esta propuesta).
- **Descartar power-ups y jefes finales:** para mantener el foco exclusivo en la mecánica de scoring de combo/reflejos que es el ángulo asignado, evitando diluir la propuesta con contenido que no aporta a esa mecánica central.
- **Barra de combo con vaciado por inactividad en vez de combo persistente indefinidamente:** fuerza al jugador a mantener un ritmo de disparo constante, reforzando el ángulo de "reflejos" sobre simplemente "no fallar nunca".

## Riesgos identificados

- Balancear la duración de la ventana de flash y la velocidad de vaciado de la barra de combo requiere iteración; si son muy exigentes el juego se siente injusto, si son muy laxas el combo pierde su propósito de tensión.
- El sistema de combo introduce más estado por frame (temporizadores por alien, multiplicador, barra de gracia) que los motores más simples ya portados (ROCAS, SERPENTINA); riesgo de un bug de estado compartido entre instancias si no se encapsula todo estrictamente dentro del closure de la factory, igual riesgo ya mitigado en specs anteriores.
- Progresión de dificultad mal calibrada podría hacer que niveles altos sean injugables por la reducción agresiva de la ventana de flash combinada con mayor velocidad de aliens; se recomienda definir topes (`MIN_FLASH_WINDOW`, `MAX_SPAWN_RATE`) desde el diseño inicial del motor.
- Elegir un `color` de catálogo (`orange`) no usado aún requiere confirmar en implementación que el sistema de estilos (`globals.css`) ya soporta esa variante de color de cover, o crearla si no existe.
