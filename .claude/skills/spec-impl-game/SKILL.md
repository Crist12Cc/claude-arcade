---
name: spec-impl-game
description: Implementa una spec aprobada de un juego siguiendo el mismo flujo que /spec-impl (validar estado Aprobado, crear rama, implementar paso a paso con pausas), y al terminar dispara secuencialmente los agentes skin-designer y luego mobile-porter sobre el juego recién implementado.
argument-hint: <NN-spec-name>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementador de specs de juegos + skins + mobile

## Contexto de sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles en esta carpeta:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

---

## Instrucciones

Este comando sigue **exactamente el mismo lineamiento que `/spec-impl`** para las Fases 1 a 4 (implementación de la spec). Al terminar la implementación añade una **Fase 5**: encadenar los agentes `skin-designer` y `mobile-porter`, uno después del otro, nunca en paralelo.

Sigue las cinco fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.**

---

### Fase 1 — Identificar la spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los archivos disponibles en `specs/` (ya los tienes arriba).
- Pide al usuario que especifique el nombre exacto de la spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en `specs/`. El usuario puede haber escrito el nombre completo (`07-frogger`), solo el número (`07`) o solo el slug (`frogger`). Intenta encontrar el archivo correcto en cualquiera de esos casos.
- Si no encuentras el archivo, muestra las specs disponibles y pide al usuario que corrija el nombre.
- Si lo encuentras, continúa a la Fase 2.

---

### Fase 2 — Validar el estado de la spec

Lee el archivo de la spec encontrada:
!`cat specs/$ARGUMENTS.md 2>/dev/null || echo "FILE_NOT_FOUND"`

Busca en el contenido la línea que indica el estado de la spec. La etiqueta típica es `**Estado:**` (español) o `**Status:**` (inglés), pero puede usar cualquier idioma. Identifícala por posición (línea de estado cerca del encabezado) y por la máquina de estados circundante, no por la etiqueta exacta.

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"** — sin importar el idioma usado.

Trata como estado **Aprobado** (y continúa): `Aprobado`, `Approved`, `Aprovado`, `Approuvé`, `Genehmigt`, `Approvato`, o cualquier palabra equivalente en otro idioma.

Cualquier otro valor (`Draft`/`Borrador`, `En revisión`/`In review`, `Implementado`/`Implemented`, `Obsoleto`/`Obsolete`, o cualquier valor no reconocido) significa **detenerse** y mostrar el mensaje de error estándar:

```
❌ No puedo implementar esta spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado significa "Aprobado" (p. ej. `Aprobado`, `Approved`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si la spec ya está lista para implementarse, ábrela y cambia el estado
     a "Aprobado" (o el término equivalente que use tu equipo) manualmente.
     Ese cambio lo hace la persona, no el agente.
  2. Si la spec aún necesita trabajo, usa /spec [nombre] para retomarla.
```

No ofrezcas alternativas, no sugieras "puedo empezar igual si quieres". El bloqueo es intencional.

---

### Fase 3 — Crear la rama git y cambiar a ella

Una vez confirmado que el estado significa `Aprobado`:

1. Deriva el nombre de la rama a partir del nombre completo del archivo de la spec, sin extensión. Formato: `spec-NN-slug`. Ejemplos:

   - `07-frogger.md` → rama `spec-07-frogger`
   - `10-mobile-controls.md` → rama `spec-10-mobile-controls`

2. Verifica si la rama ya existe:

   - Si **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: informa al usuario que la rama ya existía (puede significar que se retoma trabajo previo).
   - En ambos casos: cambia a la rama con `git checkout spec-NN-slug` y confirma que el cambio fue exitoso antes de continuar.

3. Confirma visualmente al usuario que la rama fue creada y que estás en ella:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)
   Estado: Aprobado   (← repite el valor real encontrado en la spec)
   ```

4. **No empieces a implementar todavía.** Primero muestra el resumen de la spec al usuario para que lo tenga fresco. Extrae y muestra:
   - El **objetivo** (la línea después de `**Objetivo:**` / `**Objective:**` / equivalente).
   - El **alcance** (la sección `## Alcance` / `## Scope` / equivalente).
   - El **plan de implementación** (la sección con los pasos numerados — `## Plan de implementación` / `## Implementation plan` / equivalente).
   - Los **criterios de aceptación** (el checklist — `## Criterios de aceptación` / `## Acceptance criteria` / equivalente).

Empareja los encabezados de sección por significado, no por redacción exacta — la spec puede estar escrita en cualquier idioma.

---

### Fase 4 — Implementar paso a paso

Después de mostrar el resumen de la spec, dile al usuario:

```
Voy a implementar la spec siguiendo exactamente el plan de implementación.
Pausaré después de cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "adelante", "dale", o equivalente). No empieces sin ella.

Una vez confirmado, sigue estas reglas durante toda la implementación:

**Regla por encima de todas:** implementa lo que dice la spec. Si algo en la spec te parece subóptimo, menciónalo como observación pero implementa lo acordado. Los cambios a la spec van en la spec, no en el código por sorpresa.

**Ritmo de trabajo:**

- Implementa un paso del plan.
- Muestra un resumen de qué archivos tocaste y qué hiciste.
- Di: `Paso N completado. ¿Podrías revisar el diff y avisarme si continúo con el Paso N+1?`
- Espera confirmación antes de continuar.

**Si durante la implementación encuentras una ambigüedad** que la spec no resuelve:

- Detente.
- Describe la ambigüedad exactamente.
- Presenta dos o tres opciones concretas.
- Espera la decisión del usuario.
- No improvises.

**Si el usuario pide algo fuera del alcance de la spec:**

- Recuérdale que está fuera del alcance de esta spec.
- Sugiere anotarlo para la siguiente spec.
- No lo implementes en esta rama.

**Al terminar el último paso:**

```
✅ Todos los pasos del plan están implementados.

Siguiente paso: verificar los criterios de aceptación de la spec uno por uno.
Si todos pasan, actualiza el estado de la spec a "Implementado" (o el equivalente
en el idioma de tu repo) y haz el commit final antes de fusionar esta rama.
```

Verifica los criterios de aceptación, actualiza el estado de la spec en el archivo a `Implementado` y confirma con el usuario antes de pasar a la Fase 5.

---

### Fase 5 — Skins y soporte mobile (secuencial, no en paralelo)

Esta fase es exclusiva de `/spec-impl-game` (no existe en `/spec-impl`). Determina el `id`/nombre del juego recién implementado a partir de la spec (título, slug, o el campo que identifique el juego en el catálogo).

**Orden obligatorio — un agente a la vez:**

1. Anuncia: `Implementación completa. Ahora aplico los skins visuales con el agente skin-designer.`
2. Invoca el agente `skin-designer` (Agent tool, `subagent_type: skin-designer`) pasándole el nombre/id del juego recién implementado.
3. **Espera a que `skin-designer` termine por completo** (su notificación de finalización) antes de continuar. No lances `mobile-porter` en el mismo mensaje ni en paralelo.
4. Una vez que `skin-designer` haya terminado, anuncia: `Skins aplicados. Ahora agrego soporte táctil mobile con el agente mobile-porter.`
5. Invoca el agente `mobile-porter` (Agent tool, `subagent_type: mobile-porter`) pasándole el mismo nombre/id del juego.
6. Espera su finalización.
7. Reporta al usuario un resumen final de las tres fases: implementación (spec), skins (skin-designer), mobile (mobile-porter).

**Regla estricta:** nunca envíes las invocaciones de `skin-designer` y `mobile-porter` en un solo mensaje con dos tool calls — deben ser secuenciales, cada una esperando la finalización de la anterior.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 07-frogger

  Fase 1  →  Encuentra specs/07-frogger.md
  Fase 2  →  Lee el estado → "Aprobado" → ✅ continúa
  Fase 3  →  git checkout -b spec-07-frogger → git checkout spec-07-frogger
             Muestra objetivo, alcance, plan y criterios
  Fase 4  →  Implementa paso a paso con pausas
             Marca la spec como "Implementado"
  Fase 5  →  Lanza skin-designer para "frogger" → espera que termine
             Luego lanza mobile-porter para "frogger" → espera que termine
             Resume las 3 fases al usuario

/spec-impl-game 02-powerups  (estado: Draft)

  Fase 1  →  Encuentra specs/02-powerups.md
  Fase 2  →  Lee el estado → "Draft" → ❌ se detiene
             Muestra el mensaje de error estándar
             No crea rama, no toca código, no lanza agentes
```
