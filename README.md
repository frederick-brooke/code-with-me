This is a Next.js mock live-coding interview app: passwordless Candidate sign-in, a UI-free `SessionEngine` owning the Session lifecycle, and a durable data layer over a managed PostgreSQL database via Prisma. When `DATABASE_URL` is unset, local development and the test suite use in-memory stores.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

Copy `.env.example` to `.env` and fill in what you need. All variables are optional for local development:

- `DATABASE_URL` — managed Postgres connection string. When set, the app uses the Postgres stores and seeds the problem set idempotently; when unset, the in-memory stores run.
- `APP_URL` — base URL used to build magic links in login emails.
- `EMAIL_API_KEY` / `EMAIL_FROM` — Resend transactional email. When unset, login codes are shown on screen instead of emailed.
- `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` — the managed Assessor voice agent. When unset, the interview page shows the Assessor panel as not-configured.
- `ASSESSOR_TOOL_SECRET` / `ASSESSOR_TOOL_BASE_URL` — the webhook-tool shared secret and its public base URL; see `npm run assessor:configure`.
- `SUMMARY_LLM_BASE_URL` / `SUMMARY_LLM_API_KEY` / `SUMMARY_LLM_MODEL` — the dedicated Performance Summary LLM call (ADR-0007). An OpenAI-compatible `chat/completions` endpoint; point it at the same provider/model as the ElevenLabs agent so the summary comes from "the same LLM". When the API key is unset, ending a Session still works but no summary is generated.

Run the database migrations against a configured `DATABASE_URL` with:

```bash
npm run db:migrate
```

## Deploy on Vercel

1. Create a free project at [Neon](https://neon.tech) (or Supabase) and copy the **pooled** connection string (a `-pooler` host makes many cold-started serverless functions share a small connection pool).
2. Import this repository into Vercel.
3. Add the env vars from the Configuration section as **Production** env vars in the Vercel project settings. At minimum set `DATABASE_URL` to the pooled URL (with `sslmode=require`) and `APP_URL` to your deployed origin. Set the rest — `EMAIL_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ASSESSOR_TOOL_SECRET`, `ASSESSOR_TOOL_BASE_URL` — if you want those features.
4. Deploy. The build's prebuild step runs `prisma migrate deploy` under the hood (`scripts/migrate-on-vercel.mts`), which applies any pending migrations; with no `DATABASE_URL` it no-ops so preview/env-less builds still succeed against the in-memory stores.

Production fails fast when `DATABASE_URL` is missing — the Postgres stores are required there.
