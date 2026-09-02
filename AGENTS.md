# code-with-me

Fresh Next.js 16.3.4 scaffold — only starter template code, no custom work yet.

## Commands

| `npm run dev`      | Dev server on `localhost:3000` |
| `npm run build`    | `prisma generate && next build` (prebuild hook) |
| `npm run lint`     | ESLint (flat config)           |
| `npm run start`    | `next start`                   |
| `npm run test`     | Vitest                         |
| `npm run db:generate` | `prisma generate`          |
| `npm run db:migrate`  | `prisma migrate deploy` (apply migrations on a deploy) |

## Conventions

- **App Router** (App Router, not Pages Router) — routes in `app/`
- **ESLint 9 flat config** — `eslint.config.mjs`
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme` directive (not v3's `@tailwind`)
- **Path alias** `@/*` maps to project root
- **TypeScript strict mode** on, `noEmit: true`, `moduleResolution: bundler`
- No custom `next.config.ts` — default empty config
- No CI, no env files, no Docker config
- `next-env.d.ts` and `.next/types/` are auto-generated — do not edit

## Next.js version caveat

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues and specs for this repo live as GitHub Issues, tracked via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage runs on the five canonical roles, each label string equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root plus decision records under `docs/adr/`. See `docs/agents/domain.md`.
