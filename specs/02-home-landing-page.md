# SPEC 02 — Home Landing Page

**Estado:** Aprobado
**Depende de:** SPEC 01
**Fecha:** 2026-09-06

**Objetivo:** Migrar la landing page de marketing de `references/home/home.jsx` a `/`, moviendo la Biblioteca actual a `/biblioteca` y actualizando el Nav para reflejar la nueva estructura de rutas.

## Alcance

**Incluye:**

- Nueva pantalla **Home** (`/`) migrada de `references/home/home.jsx`, con:
  - Hero con eyebrow parpadeante, título en 3 líneas, subtítulo, CTAs ("Explorar juegos" → `/biblioteca`, "Crear cuenta" → `/login`) y silhouettes SVG decorativos animados (`FloatingSilhouettes`).
  - Sección "¿Por qué Arcade Vault?" con 4 tarjetas de feature (iconos pixel SVG inline vía `FeatureIcon`).
  - Sección "Juegos disponibles ahora": rail de `MiniCard` con los primeros 6 juegos de `GAMES` (de `lib/data.ts`), cada una navega a `/juego/[id]`; botón "Ver todos los juegos" → `/biblioteca`.
  - Sección de stats (3 bloques numéricos decorativos).
  - Sección "Actividad en vivo": ticker de últimas puntuaciones y top 5 jugadores, con botón "Ver salón" → `/salon`.
  - Sección de pricing (plan único gratuito) + FAQ.
  - CTA final ("Insertar moneda" → `/biblioteca`).
  - Animación de entrada por scroll (`useReveal`, basada en `IntersectionObserver`) sobre las secciones con clase `.reveal`.
- Mover la pantalla Biblioteca existente de `app/page.tsx` a `app/biblioteca/page.tsx` (mismo contenido y comportamiento del SPEC 01, sin cambios funcionales).
- Actualizar `components/Nav.tsx`:
  - Agregar link "Inicio" que apunta a `/` y se resalta solo en esa ruta exacta.
  - El link "Biblioteca" ahora apunta a `/biblioteca` y se resalta en `/biblioteca`, `/juego/*` y `/jugar/*` (igual lógica que antes, ruta distinta).
  - Sin cambios en el resto del Nav (créditos, botón de sesión, panel móvil).
- Estilos: portar a `app/globals.css` las clases usadas por `home.jsx` presentes en `references/home/styles.css` (`.home-*`, `.mini-*`, `.feature-*`, `.stat-*`, `.activity-*`, `.ticker`, `.tick-row`, `.top-*`, `.pricing-*`, `.price-card`, `.faq-*`, `.final-*`, `.silo*`, `.reveal`/`.in`, etc.).

**No incluye:**

- Link o página "Acerca de": el nav de referencia lo incluye pero no hay diseño ni contenido de referencia para esa ruta; se omite por completo (no se agrega el link).
- Cualquier dato real detrás de las secciones de stats y "Actividad en vivo": los valores se portan hardcodeados tal como están en `home.jsx` (arrays estáticos dentro del componente), sin derivarlos de `seededScores` ni de ninguna fuente dinámica.
- Cambios a las pantallas de Detalle, Reproductor, Login o Salón (SPEC 01), salvo los que dependan indirectamente de que `GAMES` siga viviendo en `lib/data.ts`.
- Redirects o compatibilidad hacia atrás para quien tuviera enlazada la ruta anterior de Biblioteca en `/` (no se agrega un `redirect()` desde `/`; `/` pasa a ser contenido nuevo).
- Tests automatizados (no hay test runner configurado).

## Modelo de datos

No se introduce ningún tipo o estructura de datos nueva. La Home reutiliza `Game` y `GAMES` ya definidos en `lib/data.ts` (SPEC 01) solo para el rail de `MiniCard` (`GAMES.slice(0, 6)`). Los arrays de "Actividad en vivo" y "Top jugadores" son literales locales al componente (mismos valores que `home.jsx`), sin tipo exportado ni persistencia.

## Plan de implementación

1. **Mover la Biblioteca a `/biblioteca`.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero de biblioteca, buscador, chips, grid), sin modificar su lógica. Sistema funcional: `/biblioteca` sigue mostrando y filtrando el catálogo exactamente igual que antes.
2. **Estilos de Home.** Portar a `app/globals.css` las clases de `references/home/styles.css` que usa `home.jsx` (listadas en Alcance). Sistema funcional: build sigue pasando, sin efecto visible aún porque `/` no ha cambiado.
3. **Componente Home.** Crear `components/Home.tsx` (client component) migrando `home.jsx`: `useReveal`, `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` y el JSX de las secciones, reemplazando `navigate({name:...})` del template por `next/link` (`<Link href="/biblioteca">`, `<Link href="/login">`, `<Link href="/salon">`, `<Link href="/juego/[id]">`) y usando `GAMES` importado de `lib/data.ts` en vez de la variable global del template.
4. **Reemplazar `app/page.tsx`.** Sustituir el contenido actual (ya movido en el paso 1) para que `app/page.tsx` renderice `<Home />`. Sistema funcional: `/` muestra la landing completa con todas sus secciones y animaciones de reveal al hacer scroll.
5. **Actualizar Nav.** En `components/Nav.tsx`: agregar el link "Inicio" (`/`, activo solo en `pathname === "/"`), cambiar el `href` de "Biblioteca" a `/biblioteca` (conservando la lógica `isActive` para `/biblioteca`, `/juego/*`, `/jugar/*`), replicar el cambio en el panel móvil. Sistema funcional: la navegación completa del sitio queda enlazada — Inicio, Biblioteca, Salón de la Fama, Login — sin rutas rotas.
6. **Pulido final.** Revisar responsive de las nuevas secciones (breakpoints ya definidos en el CSS portado) y que `npm run build` y `npm run lint` pasen sin errores.

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] La ruta `/` muestra la landing (hero, features, rail de juegos, stats, actividad en vivo, pricing/FAQ, CTA final) en vez de la Biblioteca.
- [ ] La ruta `/biblioteca` muestra el catálogo de juegos (hero, buscador, chips, grid) con el mismo comportamiento de filtrado que tenía antes en `/`.
- [ ] En la Home, el botón "Explorar juegos" y "Ver todos los juegos" navegan a `/biblioteca`; "Crear cuenta" y "Empezar gratis" navegan a `/login`; "Ver salón" navega a `/salon`; cada `MiniCard` navega a `/juego/[id]` con el id correcto.
- [ ] Las secciones con clase `.reveal` aparecen animadas al hacer scroll hasta ellas (igual que en el template).
- [ ] El Nav muestra los links "Inicio" y "Biblioteca" apuntando a `/` y `/biblioteca` respectivamente; "Inicio" se resalta solo en `/`, y "Biblioteca" se resalta en `/biblioteca`, `/juego/[id]` y `/jugar/[id]`.
- [ ] No existe ningún link "Acerca de" en el Nav.
- [ ] El panel móvil del Nav refleja los mismos links y estados activos que la barra superior.

## Decisiones tomadas y descartadas

- **`/` pasa a ser la landing y la Biblioteca se mueve a `/biblioteca`**, en vez de combinar ambos contenidos en una sola ruta, porque así lo definen los links separados "Inicio"/"Biblioteca" de `nav.jsx` y evita una página `/` sobrecargada.
- **Sin link "Acerca de"** en el Nav: no hay diseño de referencia para esa pantalla y no se quiere improvisar contenido; se puede agregar en un spec futuro si se define su contenido.
- **Sin redirect desde rutas antiguas**: como el proyecto no tiene usuarios reales ni tráfico externo (MVP visual, SPEC 01), no se justifica mantener compatibilidad con la ruta anterior de Biblioteca en `/`.
- **Datos de "Actividad en vivo" y stats hardcodeados**, igual que el template, en vez de derivarlos de `seededScores`, porque son puramente decorativos y no se pidió que reflejen datos "reales" del sitio.
- **Reutilizar `GAMES` de `lib/data.ts`** para el rail de juegos de la Home (en vez de duplicar una lista), para que la Home y la Biblioteca muestren siempre el mismo catálogo.

## Riesgos identificados

- Mover `/` a un componente nuevo mientras `/biblioteca` sigue existiendo puede generar confusión temporal en enlaces internos (`Link href="/"`) si alguno quedó apuntando a la Biblioteca por error; se debe revisar cada `Link` tras el paso 5.
- Los efectos de scroll-reveal e IntersectionObserver, si no se limpian correctamente al desmontar, pueden acumular observers en navegación cliente-a-cliente entre `/` y otras rutas; replicar el `return () => io.disconnect()` del template mitiga esto.
