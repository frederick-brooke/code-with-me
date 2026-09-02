# PRD: Code with Me

## Overview

Code with Me is a Next.js (App Router) + TypeScript web application that prepares candidates for technical coding interviews. It simulates a live coding interview with an **AI voice assessor**: the candidate solves a leetcode-style problem in an in-browser Python editor while an AI voice agent introduces the problem, answers questions, and guides them — without ever giving the solution away. After the session, the candidate receives a written performance summary, and their sessions are persisted so they can track progress.

## Goals

- Let candidates practice a technical interview end-to-end in one app: read a problem, code in Python, run tests, talk to a voice assessor, and get feedback.
- Provide honest, useful coaching: the assessor hints and guides but never reveals a full solution.
- Persist progress so a candidate can come back, see past sessions, and track what went well and what didn't.

## Non-Goals (MVP)

- No human assessor; no admin UI for authoring problems.
- No real-time (duplex) voice pipeline — the managed agent handles turn-taking.
- No on-screen timed interview clock.
- No recorded audio storage in our database.
- No password login / SSO — passwordless email OTP only.

## Users

**Candidate** — the only human user. Identified by a lightweight email account so session records follow them across devices.

## Core Concepts (see CONTEXT.md for canonical terms)

- **Candidate** — the human preparing for interviews.
- **Assessor** — the AI voice agent that runs the interview. Managed turn-based voice pipeline (ElevenLabs): STT, agent reasoning, turn-taking, interruption handling, and TTS all run in that managed pipeline; the app supplies context and receives events.
- **Session** — one complete mock-interview run for a single Problem. Four phases: Introduction, Solve, Wrap-up, Debrief. The candidate can end from any phase (skips straight to Debrief). The candidate initiates the move from Solve to Wrap-up. No time limit; the assessor suggests realistic pacing.
- **Conversation** — the live turn-taking voice exchange between Candidate and Assessor, hosted by the managed agent. One live Conversation stays open for the whole Session (MVP).
- **Problem** — a leetcode-style question: statement, 1–3 sample tests (candidate-visible), a set of hidden tests (shown only as a pass/fail count), difficulty, optional starter template.
- **Run** — an explicit event where the candidate submits code to the compiler (in-browser, Pyodide). The assessor reacts only to explicit events (Run, a question, a hint request, session end) — never to keystrokes. Every Run executes against the hidden tests.
- **Hidden test** — a test only shown as a pass/fail count; never shown to candidate or assessor directly.
- **Session Record** — the persisted record per Session: problem, final code snapshot, run history, transcript, and Performance Summary.
- **Performance Summary** — end-of-session written artifact (not spoken) covering what went well, even-better-if, problems, and a technical review.

## Requirements

### 1. Account & entry

- Candidate signs in via a passwordless email magic-link / OTP. No password store, no SSO.
- Home page lists available Problems (title, difficulty, filterable) and the candidate's past Sessions after the first exists.
- Launching a Problem starts a Session.

### 2. Editor & compiler

- In-browser Python editor with syntax highlighting (CodeMirror 6), starter template pre-loaded.
- "Run" compiles candidate code with Pyodide and executes against the hidden suite. Sample tests are for candidate exploration only.
- Run outcome shown to Candidate as a visible pass/fail count (e.g. 4/10). The Assessor sees the same counts — nothing more.

### 3. The Assessor conversation

- Live voice Session via the ElevenLabs managed agent (eleven-agents). Candidate speaks naturally; the managed pipeline hands turn-taking, interruptions, and barge-in.
- The agent receives static context (Problem statement, starter template) injected as dynamic variables; volatile state (current code, latest Run counts) is fetched live through our **tools** so it never reasons on stale code.
- The agent is told the candidate's current code, visible pass/fail counts, and the conversational memory. It never sees hidden-test inputs/expected outputs.
- Candidate can end the Session at any point (straight to Debrief).

### 4. Hint policy (see ADR-0001)

- Hard rule: the Assessor never reveals a full solution while a Session is live, in any wording. Hints describe approach and structure only, never a concrete implementation.
- **Structural guard**: asks that smell like "give me the answer" are routed to our backend tool, which returns hint-tiered guidance. The agent's system prompt is a fallback layer, not the primary guarantee. Prompt text alone is not trusted to hold the line.
- Tightening the rule is a backend deploy, not a platform reconfiguration.

### 5. Performance Summary

- At Session end (Debrief), a dedicated call to the same LLM used in the agent, fed the whole Session Record: Problem chosen, final code snapshot, every Run's code + pass/fail, the transcript.
- Output is a written cover of: what went well, even-better-if, problems, technical review of the solution.
- Persisted with the Session Record; never spoken aloud.

### 6. Persistence (data model)

- **candidate** — email identity + auth.
- **problem** — statement, difficulty, starter template, sample tests, hidden tests (inputs + expected).
- **session** — candidate_id, problem_id, phase, started_at, ended_at.
- **run** — session_id, code snapshot, timestamp, pass/fail count. Every Run is stored in-browser, essentially free — this trajectory is what makes the summary non-generic.
- **message** — transcript line (speaker, text, timestamp).
- **summary** — output of the end-of-session call.
- Raw audio is the platform's business (retained/configured in ElevenLabs); our store keeps transcript + results only.

## Non-Functional

- TypeScript strict; Next.js App Router; Tailwind v4; ESLint 9 flat config; path alias `@/*`.
- Code runs in-browser (Pyodide) — no server-side sandbox for the MVP. Self-hosted (Docker) judge is the upgrade path.

## ADRs

- **ADR-0001** — Structural guard for the hint policy instead of prompt-only. See `docs/adr/0001-structural-guard-for-hint-policy.md`.

## Open Questions (future)

- Move the voice agent to offline/snapshot resume instead of keeping one Conversation open?
- Admin authoring UI for Problems.
- A real interviewer timer.
- Performance summary spoken aloud (post-MVP).