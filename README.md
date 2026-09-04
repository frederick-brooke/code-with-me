# Code with Me

**Code with Me** is a mock live-coding interview app. A **Candidate** prepares for a real technical coding interview by talking through a **Problem** out loud with an AI voice **Assessor** — an ElevenLabs managed voice agent that interviews, guides, and challenges them without ever handing over the solution. The candidate writes Python in an in-browser CodeMirror editor, runs it against a hidden test suite, and receives a written **Performance Summary** when the interview ends. Every **Session** is saved, so progress follows the candidate across devices.

## Description

Practising for a technical interview is hard to do alone: you need a problem, a live interviewer, and honest, non-spoiling guidance — none of which a plain editor or a chatbot provides. Code with Me simulates the whole interview in one place:

- **Passwordless sign-in** — just an email address; a one-time code is delivered as a magic link.
- **A live voice Assessor** that leads the interview through a five-phase arc — Introduction, Clarifying, Approach, Implementation, Wrap-up — and ends in Debrief.
- **A real code editor** (CodeMirror + Pyodide) where the Candidate writes and **Runs** Python against a hidden test suite, seeing only pass/fail counts.
- **A structural guard** (ADR-0001) that routes "give me the answer" requests to a hint-tier backend instead of trusting the agent's prompt — the solution is never leaked.
- **A written Performance Summary** after each interview, generated from the whole Session Record: what went well, even-better-if, problems, and a technical review.
- **Durable Session Records** — the problem, every Run's code and counts, the transcript, and the summary — persisted in Postgres so the candidate can revisit their history.

The app is built around a single, UI-free domain module, the **`SessionEngine`** (ADR-0004): the UI, the Assessor's webhook tools, and the summary generator are all clients of one seam that owns Session state and lifecycle.

## Tech Stack

- **Next.js 16.3.4** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** for styling
- **ElevenLabs** managed voice agent as the Assessor, wired over webhook tools
- **Prisma 7** + **Postgres** (via `@prisma/adapter-pg`) as the durable data layer
- **Pyodide** for in-browser Python execution
- **CodeMirror** for the code editor
- **Resend** for transactional email (magic links)
- **Vitest** for tests

## Architecture

The system is organised around async seams and a UI-free engine:

```
┌─────────────┐   ┌────────────────────────────────────────────────┐
│   Browser   │   │                  Next.js app                   │
│  Candidate  │──▶│  pages (App Router) → Server Actions / API     │
└─────────────┘   │                     │                          │
                  └─────────────────────┼──────────────────────────┘
                                        │
                  ┌─────────────────────▼──────────────────────────┐
                  │              SessionEngine (UI-free)           │
                  │        owns Session state and lifecycle        │
                  └─────────────────────┬──────────────────────────┘
                                        │
                  ┌─────────────────────▼──────────────────────────┐
                  │         DataStore / AuthStore (seams)          │
                  │   in-memory  │  Postgres (Prisma) impls        │
                  └────────────────────────────────────────────────┘
                                        ▲
                  ┌─────────────────────┴──────────────────────────┐
                  │  ElevenLabs Assessor (webhook tools)           │
                  │  get_session_state · set_phase · hint guard    │
                  └────────────────────────────────────────────────┘
```

- **`SessionEngine`** (`lib/engine/session-engine.ts`) — the single seam owning a Session's lifecycle: start, record Runs, save Working Code snapshots, record messages and hints, advance phases, end, and query projections. It is deliberately UI-free and LLM-free so it tests headlessly.
- **Seams** — `AuthStore` (`lib/auth/`) and `DataStore` (`lib/data/`) are async interfaces with in-memory and Postgres implementations. With `DATABASE_URL` set, the app uses the Postgres stores; otherwise dev/test use in-memory stores.
- **Assessor** — the voice agent is a managed ElevenLabs agent. Static context is injected as dynamic variables; volatile state (current code, Run counts, activity) is fetched live through backend webhook tools the agent calls, so it never reasons on stale code (ADR-0005, ADR-0006).
- **Hint policy** — enforced structurally (ADR-0001): suspicious "give me the answer" requests are routed to a backend guard that returns hint-tiered guidance without a solution.

Architecture decisions are recorded in `docs/adr/`:

| ADR | Decision |
| --- | --- |
| [ADR-0001](docs/adr/0001-structural-guard-for-hint-policy.md) | Structural guard tool instead of the agent's prompt for hint policy |
| [ADR-0002](docs/adr/0002-async-persistence-seams.md) | Persistence seams are asynchronous |
| [ADR-0003](docs/adr/0003-prisma-postgres-durable-data-layer.md) | Prisma 7 + Postgres as the durable data layer |
| [ADR-0004](docs/adr/0004-sessionengine-lifecycle-seam.md) | `SessionEngine` is the single Session lifecycle seam |
| [ADR-0005](docs/adr/0005-assessor-conversation-webhook-tool.md) | The Assessor conversation is a managed voice agent over a webhook tool |
| [ADR-0006](docs/adr/0006-live-assessor-arc.md) | The Assessor leads a live, five-phase interview arc over Working Code snapshots |
| [ADR-0007](docs/adr/0007-performance-summary-generation.md) | The Performance Summary is a failure-soft, idempotent LLM call outside the managed agent |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Without any configuration, the app runs fully against in-memory stores and shows login codes on screen instead of emailing them — a good default for local development.

## Configuration

Copy `.env.example` to `.env` and fill in what you need. All variables are optional for local development:

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Base URL used to build magic links in login emails (defaults to `http://localhost:3000`). |
| `DATABASE_URL` | Managed Postgres connection string. When set, the app uses the Postgres stores and seeds the problem set idempotently; when unset, the in-memory stores run. Production fails fast without it. |
| `EMAIL_API_KEY` / `EMAIL_FROM` | Resend transactional email. When unset, login codes are shown on screen instead of emailed. |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` | The managed Assessor voice agent. When unset, the interview page shows the Assessor panel as not-configured. |
| `ASSESSOR_TOOL_SECRET` / `ASSESSOR_TOOL_BASE_URL` | The webhook-tool shared secret and its public base URL; see `npm run assessor:configure` below. |
| `SUMMARY_LLM_BASE_URL` / `SUMMARY_LLM_API_KEY` / `SUMMARY_LLM_MODEL` | The dedicated Performance Summary LLM call (ADR-0007) — an OpenAI-compatible `chat/completions` endpoint. Point it at the same provider/model as the ElevenLabs agent so the summary comes from "the same LLM". When the API key is unset, ending a Session still works but no summary is generated. |

### Database

Run the migrations against a configured `DATABASE_URL` with:

```bash
npm run db:migrate
```

### Assessor webhook tools

The ElevenLabs agent needs two webhook tools — `get_session_state` and `set_phase` — plus the repo-versioned system prompt. Configure them once with:

```bash
npm run assessor:configure
```

This creates/updates and attaches the tools, applies the system prompt (`scripts/assessor-system-prompt.md`), and sets patient turn settings plus a raised max conversation duration (the 600s default would kill the arc mid-Implementation). It is idempotent.

> **Caveat:** the webhook tool's URL must be reachable from ElevenLabs' servers — never `localhost`. Before running `assessor:configure` for real testing, set `ASSESSOR_TOOL_BASE_URL` to a public HTTPS URL (deployed app or a tunnel like `ngrok http 3000`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run build` | `prisma generate && next build` (prebuild hook) |
| `npm run start` | `next start`; the `prestart` hook auto-runs `assessor:configure` first (skipped when the ElevenLabs env keys are unset) |
| `npm run lint` | ESLint (flat config) |
| `npm run test` | Vitest |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate deploy` (apply migrations on a deploy) |
| `npm run assessor:configure` | Creates/updates the `get_session_state` and `set_phase` webhook tools on the ElevenLabs agent, attaches them, and applies the repo-versioned system prompt plus patient turn settings and a raised max conversation duration |
| `npm run doctor` | `react-doctor` — checks for React anti-patterns (also runs on CI via `.github/workflows/react-doctor.yml`) |

## Project Structure

```
app/                 # App Router pages, components, server actions, API routes
  api/assessor/      #   Webhook-tool endpoints: session-state, phase, hint, end, conversation
  interview/[sessionId]/  #   Live interview: Assessor conversation + solve surface
  session/[sessionId]/    #   Session history / Performance Summary view
lib/
  auth/              # AuthStore seam: passwordless one-time-code + auth session
  data/              # DataStore seam: in-memory + Postgres impls, problem seeds
  db/                # Prisma 7 client wired with @prisma/adapter-pg
  engine/            # SessionEngine (the single lifecycle seam)
  assessor/          # ElevenLabs context, tools, hint guard, session state
  run/               # Pyodide in-browser execution + output parsing
  summary/           # Performance Summary generator (LLM call, prompt, debrief)
  mail/              # Email seam: Resend impl
prisma/              # Prisma schema + migrations
generated/prisma/    # Generated Prisma client (committed)
scripts/             # assessor:configure, migrate-on-vercel, system prompt
docs/                # Spec (spec-mvp.md), ADRs, agent docs, diagrams
tests/               # Vitest suite
```

## Domain Vocabulary

Read `CONTEXT.md` before naming anything — it defines the project's canonical terms: **Candidate**, **One-time code**, **Assessor**, **Session**, **Conversation**, **Tool call**, **Phases**, **Hidden test**, **Problem**, **Hint**, **Run**, **Working Code**, **Session Record**, and **Performance Summary**, each with words to avoid.

## Deploy on Vercel

1. Create a free project at [Neon](https://neon.tech) (or Supabase) and copy the **pooled** connection string (a `-pooler` host makes many cold-started serverless functions share a small connection pool).
2. Import this repository into Vercel.
3. Add the env vars from the Configuration section as **Production** env vars in the Vercel project settings. At minimum set `DATABASE_URL` to the pooled URL (with `sslmode=require`) and `APP_URL` to your deployed origin. Set the rest — `EMAIL_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ASSESSOR_TOOL_SECRET`, `ASSESSOR_TOOL_BASE_URL` — if you want those features.
4. Deploy. The build's prebuild step runs `prisma migrate deploy` under the hood (`scripts/migrate-on-vercel.mts`), which applies any pending migrations; with no `DATABASE_URL` it no-ops so preview/env-less builds still succeed against the in-memory stores.

Production fails fast when `DATABASE_URL` is missing — the Postgres stores are required there.
