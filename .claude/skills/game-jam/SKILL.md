---
name: game-jam
description: Genera 3 propuestas de juego distintas y en paralelo a partir de un tema libre (ej. "juego sobre café"), cada una con spec completa, guardadas en carpetas versionadas bajo specs/game-jam/. El usuario elige una al final. Usar cuando el usuario pida ideas/propuestas de juego a partir de un tema, o invoque /game-jam.
---

# Game Jam — propuestas de juego en paralelo

Dado un tema (argumento del comando), orquesta 3 subagentes `game-jam-designer` en paralelo para producir 3 propuestas de juego distintas y completas, y deja que el usuario elija una.

## Pasos

1. **Determinar versión y slug.** Lista las subcarpetas de `specs/game-jam/` (patrón `vNN-<slug>`). Toma el número más alto existente y usa `NN+1` (dos dígitos, con cero a la izquierda), o `v01` si no hay ninguna. Genera un slug kebab-case a partir del tema (minúsculas, sin tildes, espacios → guiones). La carpeta de trabajo es `specs/game-jam/vNN-<slug>/`.

2. **Lanzar 3 agentes `game-jam-designer` en paralelo**, en un solo mensaje con 3 llamadas Agent (no secuenciales). Dale a cada uno:
   - El mismo tema, tal cual lo dio el usuario.
   - Un ángulo de diseño distinto, para forzar diversidad entre las 3 propuestas. Usa por defecto estos tres ángulos (ajústalos si el tema sugiere algo más natural, pero mantenlos claramente diferenciados entre sí):
     1. Mecánica simple de un solo botón/control, ritmo rápido tipo arcade clásico.
     2. Mecánica de puntuación por combos/reflejos, con dificultad creciente por niveles.
     3. Un giro inesperado o poco obvio sobre el tema (no la interpretación literal más directa).
   - La ruta de salida exacta: `specs/game-jam/vNN-<slug>/propuesta-1.md`, `propuesta-2.md`, `propuesta-3.md` respectivamente.
   - Instrucción explícita de que su propuesta debe ser claramente distinta a lo que cabría esperar de los otros dos ángulos.

3. **Recoger los 3 resúmenes** (bloque `TÍTULO/MECÁNICA/POR QUÉ ENCAJA/ARCHIVO` que devuelve cada agente).

4. **Presentar la elección al usuario** con `AskUserQuestion`: una pregunta única, 3 opciones (una por propuesta), usando el título como `label` y "mecánica — por qué encaja" como `description`.

5. **Registrar la elección.** Escribe `specs/game-jam/vNN-<slug>/seleccion.md` con:
   - Qué propuesta fue elegida (título + ruta del archivo).
   - Fecha de la elección.
   - Una nota de siguiente paso: para llevar la propuesta elegida al catálogo real, el siguiente paso natural es crear el spec numerado definitivo en `specs/` (siguiente número tras el último existente) a partir de esa propuesta, y luego usar la skill `new-game` para portarlo.
   - No borres ni modifiques las otras dos propuestas — quedan como registro de la jam.

6. Responde al usuario con un resumen breve: carpeta creada, cuál se eligió, y el siguiente paso sugerido (spec numerado + `new-game`).
