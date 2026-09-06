# SPEC 01 — MVP Visual Arcade Vault

**Estado:** Approved
**Depende de:** Ninguno
**Fecha:** 2026-09-06

**Objetivo:** Implementar la capa visual completa de Arcade Vault (Biblioteca, Detalle de juego, Autenticación, Reproductor y Salón de la Fama) migrando el template de `references/templates/` a Next.js 16 App Router con TypeScript, sin implementar ningún juego real.

## Alcance

**Incluye:**

- Migración del layout base: fondo con grid en perspectiva, scanlines, ruido y fuentes pixel/mono, portado desde `references/templates/styles.css` a `app/globals.css` (junto a las directivas de Tailwind v4 ya presentes).
- Componente `Nav` (barra superior + panel móvil con hamburguesa), con:
  - Logo/marca, enlaces a Biblioteca y Salón de la Fama.
  - Contador "CRÉDITOS · 03" fijo y decorativo (sin lógica).
  - Botón de sesión: "Iniciar Sesión" si no hay usuario, o `{nombre} ▾` (cierra sesión al hacer click) si lo hay.
- Pantalla **Biblioteca** (`/`): hero con título animado, buscador por nombre, chips de categoría (`TODOS`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`), grid de tarjetas de juego con tilt al mouse, estado vacío cuando no hay resultados.
- Pantalla **Detalle de juego** (`/juego/[id]`): portada, tags, descripción larga, estadísticas (partidas, mejor global, dificultad fija), botones "Jugar ahora" / "Volver al Vault", tabla de mejores puntuaciones (mock).
- Pantalla **Reproductor** (`/jugar/[id]`): HUD (jugador, puntuación, vidas, nivel), simulación visual tipo CRT con "arena" animada en CSS puro (nave, enemigos, grid), botones Pausa/Fin/Salir, modal de fin de juego con input de iniciales y botón "Guardar puntuación", que persiste en `localStorage`. El puntaje sube solo mediante un timer (igual que el template) — es una cáscara visual, no un juego jugable.
- Pantalla **Autenticación** (`/login`): tabs "Iniciar sesión" / "Crear cuenta", formulario (usuario, email si es registro, contraseña) que no valida contra nada real y siempre autentica al enviar, botón "Jugar como invitado" (entra con `user = null`), botones decorativos de Google/GitHub (sin acción).
- Pantalla **Salón de la Fama** (`/salon`): tabs por juego, podio (2do/1ro/3er lugar), tabla completa de puntuaciones (mock determinístico via `seededScores`), fila destacada "tu mejor marca" cuando hay usuario logueado.
- Datos mock portados a TypeScript (`lib/data.ts`): `GAMES`, `CATS`, `PLAYERS`, función `seededScores(seed, count)`.
- Persistencia en `localStorage` del navegador:
  - `av_user`: usuario de sesión (`{ name: string } | null`).
  - `av_scores`: array de puntuaciones guardadas desde el reproductor.
- Navegación real de Next.js App Router (enlaces con `next/link` y `useRouter`/`usePathname` donde aplique), reemplazando el hash-router del template.

**No incluye:**

- Ningún juego jugable real (Bloque Buster, Caída, Serpentina, etc. son solo entradas de catálogo con portadas CSS).
- Backend, base de datos, API routes o autenticación real (OAuth, validación de contraseña, etc.).
- Persistencia de puntuaciones en servidor o sincronización entre dispositivos.
- Tests automatizados (no hay test runner configurado en el proyecto).
- Internacionalización (todo el contenido queda en español, igual que el template).
- Accesibilidad avanzada más allá de lo ya presente en el template (roles/tabIndex existentes se conservan).

## Modelo de datos

Todo vive en `lib/data.ts`, portado 1:1 desde `references/templates/data.jsx`:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS: cover-bricks, cover-tetro, etc.
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: string[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estructuras de `localStorage` (sin versionado — MVP visual, se puede invalidar limpiando la clave si el formato cambia):

```ts
// clave "av_user"
type StoredUser = { name: string } | null;

// clave "av_scores"
type StoredScoreEntry = {
  game: string;
  score: number;
  name: string;
  at: number;
};
```

## Plan de implementación

1. **Tema base y datos.** Portar `styles.css` → `app/globals.css` (variables, animaciones, clases `.pixel`, `.neon-*`, `.btn`, `.card`, `.cover-*`, `.crt`, etc.) manteniendo las directivas Tailwind v4 existentes. Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores`. El sistema sigue funcional (build pasa, home por defecto de Next se ve con el nuevo fondo/tema aplicado).
2. **Layout y Nav.** Actualizar `app/layout.tsx` para incluir los divs de fondo (`av-bg`, `av-noise`) y montar `components/Nav.tsx` (usa `usePathname` para resaltar el link activo; maneja el panel móvil con estado local; lee/escribe `av_user` de `localStorage` vía un hook simple, ej. `useSession()`). El nav se ve y navega entre `/` y `/salon` (aunque `/salon` aún no exista, el link puede apuntar ahí).
3. **Biblioteca (`/`).** Reemplazar `app/page.tsx` con la pantalla de biblioteca: hero, buscador, chips y grid de `GameCard` (componente cliente con el efecto tilt). Cada tarjeta enlaza a `/juego/[id]`. Sistema funcional: se puede filtrar y buscar juegos desde la home.
4. **Detalle (`/juego/[id]`).** Crear `app/juego/[id]/page.tsx` con la info del juego, stats y tabla de mejores puntuaciones vía `seededScores`. Botón "Jugar ahora" enlaza a `/jugar/[id]`. Manejar `id` inexistente con `notFound()`. Sistema funcional: desde la biblioteca se navega al detalle y de vuelta.
5. **Autenticación (`/login`).** Crear `app/login/page.tsx` con el formulario de tabs, tal como el template. Al enviar (o al elegir "invitado"), guarda el usuario en `localStorage` (`av_user`) mediante el mismo hook de sesión y redirige a `/`. El botón de sesión en el Nav refleja el cambio. Sistema funcional: login/logout funcionan end to end con persistencia.
6. **Reproductor (`/jugar/[id]`).** Crear `app/jugar/[id]/page.tsx` (client component) con el HUD, la arena CRT animada, pausa/fin, y el modal de fin de juego que guarda la puntuación en `localStorage` (`av_scores`) usando el nombre del usuario logueado o "INVITADO". Sistema funcional: se puede "jugar", pausar, terminar y guardar una puntuación.
7. **Salón de la Fama (`/salon`).** Crear `app/salon/page.tsx` con tabs por juego, podio y tabla, usando `seededScores` y mostrando la fila "tu mejor marca" solo si hay usuario logueado (usar un valor mock estable en vez del bug del template que referenciaba `youScore` sin definir). Sistema funcional: todas las pantallas están enlazadas entre sí y navegables de punta a punta.
8. **Pulido final.** Revisar responsive (breakpoints ya definidos en el CSS portado), estados vacíos, y que `npm run build` y `npm run lint` pasen sin errores.

## Criterios de aceptación

- [ ] `npm run build` compila sin errores.
- [ ] `npm run lint` pasa sin errores.
- [ ] La ruta `/` muestra el hero, buscador, chips de categoría y el grid de las 8 juegos mock; buscar por nombre y cambiar de categoría filtra el grid en el cliente.
- [ ] Click en una tarjeta o su botón "JUGAR" navega a `/juego/[id]` con el detalle correcto del juego.
- [ ] `/juego/[id]` muestra estadísticas, tags y una tabla de 10 puntuaciones mock; el botón "Jugar ahora" navega a `/jugar/[id]`; un `id` inexistente muestra 404.
- [ ] `/jugar/[id]` incrementa el puntaje automáticamente, permite pausar/reanudar, y al presionar "FIN" muestra el modal con input de iniciales; guardar la puntuación la persiste en `localStorage` bajo `av_scores` y muestra el mensaje de confirmación.
- [ ] `/login` permite iniciar sesión con cualquier usuario/contraseña, crear cuenta, o entrar como invitado; el usuario autenticado se persiste en `localStorage` bajo `av_user` y se refleja en el Nav.
- [ ] Cerrar sesión desde el Nav borra `av_user` y el botón vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra tabs por los 8 juegos, un podio de 3 lugares y una tabla de 12 filas; si hay usuario logueado, aparece la fila "tu mejor marca".
- [ ] El Nav resalta el link activo según la ruta actual y el panel móvil se abre/cierra correctamente en viewport angosto.
- [ ] El fondo (grid en perspectiva, scanlines, ruido), las fuentes pixel/mono y los efectos neón/CRT se ven igual que en `references/templates/Arcade Vault.html`, sin usar imágenes externas (todo CSS puro).

## Decisiones tomadas y descartadas

- **App Router con rutas reales** en vez de replicar el hash-router del template, porque es la convención nativa de Next.js 16 y evita un patrón atípico dentro de App Router.
- **Datos mock hardcodeados en TypeScript** en vez de exponerlos vía API routes, porque este spec es solo la capa visual y no amerita simular una capa de red inexistente.
- **Persistencia en `localStorage`** (sesión y puntuaciones) igual que el template, sin backend, porque el MVP es únicamente visual y no se pidió autenticación real.
- **Rutas en español** (`/`, `/juego/[id]`, `/jugar/[id]`, `/login`, `/salon`) para mantener consistencia con la UI y el README, en vez de nombres en inglés.
- **`styles.css` portado casi tal cual** a `app/globals.css` en vez de reescribirlo como utilidades Tailwind v4, para preservar fielmente el look retro-neón del template sin reinvertir tiempo en una traducción de sistema de diseño.
- **Portadas de juego (`cover-*`) como CSS puro**, sin assets de imagen, tal como están definidas en el template.
- **Reproductor con simulación mock** (puntaje que sube solo vía timer) en vez de una pantalla estática, porque es la cáscara visual que el template define y no constituye un juego real jugable.
- **Sin versionado de esquema en `localStorage`**: al ser un MVP visual sin usuarios reales, un cambio de formato futuro simplemente invalida los datos existentes; no se implementa migración.
- **Botones sociales (Google/GitHub) decorativos**, sin integración OAuth, igual que el template.
- **Contador de créditos fijo ("03")** sin lógica, tal como en el template — es puramente decorativo.

## Riesgos identificados

- El template tiene un bug conocido en `salon.jsx` (referencia a una variable `youScore` no definida). Se corrige en la implementación usando un valor mock estable derivado de la semilla, en vez de portar el bug.
- Los efectos visuales pesados (grid animado, ruido SVG inline, blur) pueden afectar el rendimiento en dispositivos de gama baja; no se optimizan en este MVP más allá de lo que ya trae el template.
