# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform to play games online and compete for the highest score (see README.md, in Spanish).

This is a freshly scaffolded Next.js 16.3.4 app (App Router, React 19.2.8, TypeScript, Tailwind CSS v4). No custom app logic exists yet beyond the default `create-next-app` output (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`).

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

## Spec-driven development

This project follows spec-driven design using `/spec` and `/spec-impl` conventions from https://github.com/Klerith/fernando-skills. Install the associated skills with:

```bash
npx skills@latest add Klerith/fernando-skills
```
