# Spec: Mock live-coding interview with an AI voice assessor (MVP)

## Problem Statement

Preparing for a technical coding interview is hard to rehearse alone. A candidate cannot practice the parts that actually decide a real interview — talking through an unfamiliar problem out loud, getting gently guided rather than told the answer, and performing under the pressure of an assessor who can judge the code as it evolves. Existing resources split the experience: an editor with no interviewer, or a chatbot with no code.

The candidate needs one place that simulates the whole interview — a problem to solve, a code editor to solve it in, a voice assessor who interviews and guides honestly without ever handing over the solution, and a written review afterwards — with every session saved so progress accumulates.

## Solution

A Next.js + TypeScript web app. A **Candidate** signs in by email (passwordless), picks a **Problem** from a home page, and a **Session** starts: the **Assessor** (an ElevenLabs managed voice agent) introduces the problem by voice, the candidate solves it in an in-browser Python editor (CodeMirror + Pyodide), and **Runs** the code. The Assessor receives the candidate's current code and visible pass/fail counts through our backend tools and answers questions honestly, never revealing a full solution (a structural guard, ADR-0001). On ending, a **Performance Summary** is written to screen and the whole **Session Record** is persisted.

## User Stories

1. As a Candidate, I want to sign in with just my email, so that I can start practising with minimal setup and without creating a password.
2. As a Candidate, I want to come back on another device and still see my sessions, so that my progress follows me as long as I sign in with the same email.
3. As a Candidate, I want to see a list of Problems on the home page with their difficulty, so that I can pick one that matches my level.
4. As a Candidate, I want to filter Problems by difficulty, so that I can target easy or hard practice.
5. As a Candidate, I want to see my past Sessions on the home page, so that I can revisit what I worked on.
6. As a Candidate, I want to start a Session on a chosen Problem, so that I can begin an interview for that specific question.
7. As a Candidate, I want the editor pre-filled with the Problem's starter template, so that I can start writing my solution without boilerplate.
8. As a Candidate, I want a Python code editor with syntax highlighting, so that I can read and write my code comfortably.
9. As a Candidate, I want the Assessor to introduce themselves and the Problem by voice, so that I experience the opening of a real interview.
10. As a Candidate, I want to run my code with one action and see a pass/fail count against the hidden test suite, so that I know whether my solution works without seeing the test internals.
11. As a Candidate, I want to run my code as many times as I like, so that I can iterate on my solution freely.
12. As a Candidate, I want to ask the Assessor questions by voice, so that I can think through the problem out loud like in a real interview.
13. As a Candidate, I want the Assessor to know my current code and latest run result, so that my questions are answered in the context of what I've actually written.
14. As a Candidate, I want to ask for a hint without being told the answer, so that I stay challenged and can make progress on my own.
15. As a Candidate, I want the Assessor to never give me the full solution no matter how I ask, so that I can trust the practice to be honest.
16. As a Candidate, I want to end the Session when I'm done or stuck, so that I control the interview duration.
17. As a Candidate, I want a written Performance Summary at the end covering what went well, even-better-if, problems, and a technical review, so that I know what to improve.
18. As a Candidate, I want my Run history preserved, so that my feedback reflects how I got to the solution rather than just the final code.
19. As a Candidate, I want to see my saved Session Records and their summaries, so that I can track my progress over time.
20. As a Developer, I want one module — a Session engine — to own the Session's state and lifecycle, so that the UI, the voice agent's tools, and the summary generator all speak to a single seam.
21. As a Developer, I want the hint policy to be enforced structurally, not just by prompt, so that a model behaving badly can never leak a solution in front of a Candidate.

## Implementation Decisions

**Session engine (the single seam).** The core of the system is a UI-agnostic domain module, the **`SessionEngine`**, that owns one Session's lifecycle and state. Its command surface: start a Session for a Problem, run the Candidate's current code, advance phase, and end the Session. Its query surface exposes the volatile state the Assessor's tools need — the Candidate's current code and the visible pass/fail counts of recent Runs — plus read projections for the UI (current phase, transcript, saved Sessions). The UI, the voice tool endpoints, and the summary generator are all clients of this one seam. No other module owns Session state.

**Phases.** The Assessor leads the Session through five live phases — Introduction, Clarifying, Approach, Implementation, Wrap-up — ending in Debrief (ADR-0006). Failing Runs keep the Session in Implementation; a passing Run is the natural cue for the Assessor to close. The Assessor advances phases through a backend `set_phase` tool; the Candidate may end from any phase, which jumps straight to Debrief.

**Problems.** Persisted in a `problems` table, seeded at setup from a hard-coded seed set. Each Problem: statement, difficulty, optional starter template, 1–3 sample tests (Candidate-visible), and a set of hidden tests (inputs + expected outputs; only a pass/fail count is ever exposed).

**In-browser execution.** Code executes client-side using Pyodide. On a Run, the Candidate's code is run against the hidden suite; the Candidate sees only a pass/fail count. The Assessor sees exactly the same count — never the hidden expectations.

**The Assessor conversation.** The voice agent is an ElevenLabs managed agent; STT, LLM reasoning, turn-taking, interruption handling, and TTS all run inside the managed pipeline. One live Conversation is held open for the whole Session (no tear-down/resume in the MVP). Static context (Problem statement, Candidate-visible sample tests, starter template) is injected as dynamic variables; volatile state (current code, Working Code snapshot, Run results, activity) is fetched live through backend **tools** the agent calls — `get_session_state` to read, `set_phase` to advance the arc — so the agent never reasons on stale code.

**Structural guard for hints (ADR-0001).** The hint policy is enforced structurally: Candidate requests that smell like "give me the answer" are routed to a backend guard tool that returns hint-tiered guidance without revealing a solution. The agent's system prompt is a fallback layer, not the primary guarantee. Tightening the rule is a backend deploy, not a platform reconfiguration.

**Performance Summary.** At Session end, a dedicated call to the same LLM used in the Assessor, fed the whole Session Record: the Problem, the final code snapshot, every Run's code + pass/fail, and the transcript. Output is a written artifact (never spoken aloud) covering what went well, even-better-if, problems, and a technical review; it is persisted with the Session Record.

**Persistence.** Entities, with the obvious foreign keys and timestamps:

- `candidate` — email identity + auth (passwordless magic-link / OTP; no password store, no SSO)
- `problem` — statement, difficulty, starter template, sample tests, hidden tests
- `session` — candidate, problem, phase, started_at, ended_at, working_code (autosaved snapshot), last_activity_at
- `run` — session, code snapshot, pass/fail count, timestamp. **Every** Run is stored, not just the last — the trajectory is what makes the summary non-generic.
- `message` — transcript line (speaker, text, timestamp)
- `summary` — the generated Performance Summary for a Session

Raw audio is the platform's business (retained/configurable in ElevenLabs); our store keeps the transcript and results only.

**Auth.** Passwordless email magic-link / OTP only, as scoped.

## Testing Decisions

A good test asserts observable behaviour at the seam — start a Session and see its phase, run code and see the recorded Run and returned count, end a Session and see the summary generated — never internal implementation details of the engine.

The `SessionEngine` is the seam to test: state transitions through the phases, Run recording, and the query surface (current code, counts, transcript additions, saved Session Records). The voice/tool endpoints are thin adapters over this seam and are tested against it.

No test framework or prior test exists in the repo yet (fresh scaffold, `npm test` does nothing). The implementer will establish the framework (Vitest is the natural fit for a TS/Next stack) — the engine is deliberately UI-free so it can be tested without a browser.

## Out of Scope

- Human assessor; admin or authoring UI for Problems (Problems are seeded from data only)
- Real-time duplex voice — the managed agent handles turn-taking
- On-screen interview timer / countdown
- Recording or storing raw audio
- Storing password login / SSO / social auth
- Multi-Contexing; the repo remains single-context
- Supporting languages other than Python
- Self-hosted (Docker) code sandbox — Pyodide is the MVP; a self-hosted judge is the recorded upgrade path

## Further Notes

- The single-seam decision (a UI-free Session engine) is what lets the voice platform's tools and the summary pipeline share one source of truth, and what makes the feature testable headlessly.
- Respect ADR-0001 (structural guard) — it is the reason the hint policy lives in a backend tool rather than only in the agent prompt.
- Keep terms to the glossary in `CONTEXT.md` (Candidate, Assessor, Session, Problem, Run, Hidden test, Session Record, Performance Summary, Hint).