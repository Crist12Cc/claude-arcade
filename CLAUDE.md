# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform to play games online and compete for the highest score (see README.md, in Spanish).

Next.js 16.3.4 app (App Router, React 19.2.8, TypeScript, Tailwind CSS v4) backed by Supabase (auth + database). The MVP visual shell, real auth, and a growing catalog of playable games with a real leaderboard are implemented — see `specs/` for the full history and current status of each feature.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`)

There is no test runner configured yet.

## Architecture notes

- **Next.js version is 16.3.4 — not the Next.js in your training data.** Breaking changes exist across APIs, conventions, and file structure. Before writing any code, read the relevant guide under `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) and heed deprecation notices. See `AGENTS.md` for details.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.js` — v4 uses CSS-based config in `app/globals.css`).
- Fonts are loaded via `next/font/google` (Geist, Geist Mono) and exposed as CSS variables on the `<html>` element.

### Routes (`app/`)

- `/` — Home landing page (hero, features).
- `/biblioteca` — game catalog (`BibliotecaClient.tsx`), reads from Supabase.
- `/juego/[id]` — game detail page.
- `/jugar/[id]` — game player (`GamePlayer.tsx`), mounts the engine for the given game `id` and saves scores on game over.
- `/salon` — leaderboard / Salón de la Fama (`SalonClient.tsx`).
- `/login` — real auth (sign in / sign up / guest) against Supabase.
- `/about` — about page with a contact form (`app/api/contact`, sent via Resend).

### Supabase integration

- `lib/supabase/client.ts` / `lib/supabase/server.ts` — browser/server Supabase clients (`@supabase/ssr`).
- `middleware.ts` — refreshes the session cookie on every request; no routes are protected.
- `lib/useSession.ts` — session hook (`{ user, signIn, signOut }`), backed by Supabase auth + `profiles`.
- Tables: `public.profiles` (auto-created via trigger on `auth.users`), `public.games` (catalog, replaces the old hardcoded `lib/data.ts` list), `public.scores` (one row per finished game, tied to `games` + `profiles`), and the `public.games_with_stats` view (computes `best`/`plays` per game from `scores`).
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`).

### Games (`lib/games/<id>/engine.ts`)

Each playable game is a self-contained engine following a fixed contract (`start`, `destroy`, `setPaused`, `restart`, `onStateChange` callback with `{score, lives, level, gameOver}`), registered in `components/GamePlayer.tsx`. Currently ported: `asteroids` (ROCAS), `tetris`, `bloque-buster` (Arkanoid), `serpentina` (Snake). Adding a new game does **not** require touching the catalog/leaderboard/player pages — they're generic and read everything from Supabase by `id`. Use the `new-game` skill (`.claude/skills/new-game/SKILL.md`) to port a new game following this pattern.

See `references/impl-games.md` for the full catalog table (id, title, category, short description, color) of all games currently seeded in `public.games`, including mock shells without a real engine yet.

## Spec-driven development

This project follows spec-driven design using `/spec` and `/spec-impl` conventions from https://github.com/Klerith/fernando-skills. Install the associated skills with:

```bash
npx skills@latest add Klerith/fernando-skills
```

Specs live in `specs/` (`01`–`09` so far, each marked "Implementado" once done); read the relevant spec before touching a feature it covers.

## Project skills

- `new-game` (`.claude/skills/new-game/SKILL.md`) — repeatable pattern for porting a new game into the catalog: engine in `lib/games/<id>/engine.ts`, registration in `GamePlayer.tsx`, seed row in Supabase `games`, cover CSS class `cover-<id>`. Reference sources for not-yet-ported games live under `references/started-games/`.
- `game-jam` (`.claude/skills/game-jam/SKILL.md`) — genera 3 propuestas de juego distintas y en paralelo a partir de un tema libre, cada una con spec completa, guardadas en carpetas versionadas bajo `specs/game-jam/`. El usuario elige una al final.
- `spec-impl-game` (`.claude/skills/spec-impl-game/SKILL.md`) — igual que `/spec-impl` (valida estado Aprobado, crea rama `spec-NN-slug`, implementa paso a paso con pausas), y al terminar dispara secuencialmente (nunca en paralelo) los agentes `skin-designer` y luego `mobile-porter` sobre el juego recién implementado.
- `worktree` — spins up an isolated git worktree under `.trees/<name>` to run a requirement without touching the main checkout.

## Project subagents

Ver `.claude/agents/<nombre>.md` de cada uno para el detalle completo (tools, prompt, comportamiento).

- `game-curator` — decide qué juego portar a continuación (solo lectura, mantiene memoria en `references/game-suggestions-todo.md`).
- `game-planner` — propone el próximo juego a implementar y mantiene un to-do persistente en `references/game-suggestions-todo.md`.
- `game-jam` — dado un tema, diseña un juego nuevo y genera specs en `specs/game-jam/`.
- `game-jam-designer` — redacta una propuesta de juego individual; usado en paralelo por la skill `game-jam`.
- `skin-designer` — aplica los 3 skins canónicos (classic, retro, neon) a un juego indicado.
- `skin-reviewer` — audita de solo lectura si un juego implementa los 3 skins.
- `mobile-porter` — aplica soporte táctil mobile a un juego indicado.
- `mobile-reviewer` — audita de solo lectura si un juego funciona bien en web y mobile.
