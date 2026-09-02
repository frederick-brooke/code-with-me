# code-with-me

Next.js 16.3.4 mock live-coding interview app: passwordless Candidate sign-in, a UI-free `SessionEngine` owning the Session lifecycle, and Postgres via Prisma 7 as the durable data layer. See `docs/adr/` for the architecture decisions; read `CONTEXT.md` for the domain vocabulary before naming anything.

## Commands

| `npm run dev`      | Dev server on `localhost:3000` |
| `npm run build`    | `prisma generate && next build` (prebuild hook) |
| `npm run lint`     | ESLint (flat config)           |
| `npm run start`    | `next start`                   |
| `npm run test`     | Vitest                         |
| `npm run db:generate` | `prisma generate`          |
| `npm run db:migrate`  | `prisma migrate deploy` (apply migrations on a deploy) |
| `npm run assessor:configure` | Creates/updates the `get_session_state` webhook tool on the ElevenLabs agent and attaches it (idempotent; uses env keys, URL from `ASSESSOR_TOOL_BASE_URL` or `APP_URL`) |

> Caveat: the webhook tool's URL must be reachable from ElevenLabs' servers — never `localhost`. Before running `assessor:configure` for real testing, set `ASSESSOR_TOOL_BASE_URL` to a public HTTPS URL (deployed app or a tunnel like `ngrok http 3000`).

## Conventions

- **App Router** (App Router, not Pages Router) — routes in `app/`
- **ESLint 9 flat config** — `eslint.config.mjs`
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme` directive (not v3's `@tailwind`)
- **Path alias** `@/*` maps to project root
- **TypeScript strict mode** on, `noEmit: true`, `moduleResolution: bundler`
- **Prisma 7** pinned to 7.10.0 (not the npm `latest` 8-rc); config in `prisma7.config.ts`, client generated into `generated/prisma` (committed), schema + migrations in `prisma/`
- **Postgres via a driver adapter**: `@prisma/adapter-pg` wired in `lib/db/prisma.ts`; with `DATABASE_URL` set the app uses the Postgres stores, otherwise production fails fast and dev/test use in-memory stores
- **Seams**: `AuthStore` (`lib/auth/`) and `DataStore` (`lib/data/`) are async interfaces with in-memory and Postgres implementations; `SessionEngine` (`lib/engine/`) owns the session lifecycle over the data seam
- No custom `next.config.ts` — default empty config
- No CI, no Docker config — env vars via `.env` / `.env.example` (dotenv-loaded by `prisma7.config.ts`); DATABASE_URL drives the store selection
- `next-env.d.ts`, `.next/types/`, and `generated/prisma/` are auto-generated — do not edit (the generated Prisma client is committed)

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
