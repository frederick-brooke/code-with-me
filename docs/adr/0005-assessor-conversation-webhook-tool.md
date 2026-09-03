# ADR-0005: The Assessor conversation is a managed voice agent over a webhook tool

The Candidate talks to the Assessor through an ElevenLabs managed agent: STT, the agent's LLM reasoning, turn-taking, and TTS all run inside that managed pipeline, so the app holds no voice state and never touches raw audio. The agent is pointed at a Problem by static context injected as dynamic variables (Problem statement, the Candidate-visible sample tests, starter template, Session id); its live view of the Candidate's Working Code and Run results comes from backend webhook tools — `get_session_state` reads the same `SessionEngine.query` surface the UI uses, and `set_phase` writes phase changes back to the engine as the source of truth. Because every value the agent sees is selected in the backend, the agent can never observe hidden-test inputs or expected outputs no matter how it is prompted. The tool endpoints fail closed: a request needs the configured `ASSESSOR_TOOL_SECRET` header, and the signed-URL endpoint that starts a conversation requires a signed-in Candidate who owns that Session, so one candidate cannot open another's interview.

- Static context (dynamic variables): `buildAssessorContext` in `lib/assessor/context.ts`. It carries the problem statement, the Candidate-visible sample tests, the starter template, and the Session id.
- Live-state tool: `getSessionStateForTool` in `lib/assessor/session-state.ts`, exposed at `GET /api/assessor/session-state/[sessionId]`. It returns the Working Code snapshot, the visible Run counts, the run count, and how recently the last Run and the last Candidate activity happened.
- Phase tool: `set_phase`, exposed at `POST /api/assessor/phase/[sessionId]`, advancing the Session through the five-phase arc with the engine as the single source of truth.
- Conversation start (signed URL): `GET /api/assessor/conversation`, which returns a short-lived WebSocket URL plus the dynamic variables.
- No hidden test crosses any boundary: the tool responses and the static context are both built from fields that exclude `hiddenTests` — the sample tests are Candidate-visible, so they are safe for the Assessor to see, but hidden inputs/expected outputs never leave the backend.

## Configuring the managed agent

The agent is configured in the ElevenLabs dashboard for the tenant agent id in `ELEVENLABS_AGENT_ID`:

- **Dynamic variables** (referenced in the system prompt as `{{...}}`): `session_id`, `problem_statement`, `sample_tests`, `starter_template`. The app supplies these at conversation start, so no prompt edits are needed when a new Problem is added.
- **Webhook tool** `get_session_state`:
  - Method `GET`, URL `https://<APP_URL>/api/assessor/session-state/{session_id}` where `{session_id}` is bound to the `session_id` dynamic variable.
  - A static header `x-assessor-tool-secret` set to the same value as `ASSESSOR_TOOL_SECRET`.
- **Webhook tool** `set_phase`:
  - Method `POST`, URL `https://<APP_URL>/api/assessor/phase/{session_id}`, body `{ "phase": "approach" }` naming one of the five arc phases or `debrief`.
  - The same static `x-assessor-tool-secret` header.
- **Webhook tool** `end_session`:
  - Method `POST`, URL `https://<APP_URL>/api/assessor/end/{session_id}`.
  - Records the end and lands the Session in the terminal Debrief phase (ADR-0006's closing cue).
  - The same static `x-assessor-tool-secret` header.

The tool definitions live in `lib/assessor/tools.ts` (`ASSESSOR_TOOLS`) so `assessor:configure`, the system prompt test, and this record share one source of truth.