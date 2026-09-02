# ADR-0005: The Assessor conversation is a managed voice agent over a webhook tool

The Candidate talks to the Assessor through an ElevenLabs managed agent: STT, the agent's LLM reasoning, turn-taking, and TTS all run inside that managed pipeline, so the app holds no voice state and never touches raw audio. The agent is pointed at a Problem by static context injected as dynamic variables (Problem statement, starter template, Session id); its live view of the Candidate's code and Run results comes from one backend webhook tool — `get_session_state` — which reads the same `SessionEngine.query` surface the UI uses. Because the tool is the only live window, and it selects just `currentCode`, `passedCount`, and `failedCount`, the agent can never observe hidden-test inputs or expected outputs no matter how the agent is prompted. The tool endpoint fails closed: a request needs the configured `ASSESSOR_TOOL_SECRET` header, and the signed-URL endpoint that starts a conversation requires a signed-in Candidate who owns that Session, so one candidate cannot open another's interview.

- Static context (dynamic variables): `buildAssessorContext` in `lib/assessor/context.ts`.
- Live-state tool: `getSessionStateForTool` in `lib/assessor/session-state.ts`, exposed at `GET /api/assessor/session-state/[sessionId]`.
- Conversation start (signed URL): `GET /api/assessor/conversation`, which returns a short-lived WebSocket URL plus the dynamic variables.
- No hidden tests cross any boundary: the tool response and the static context are both built from fields that exclude `sampleTests` and `hiddenTests`.

## Configuring the managed agent

The agent is configured in the ElevenLabs dashboard for the tenant agent id in `ELEVENLABS_AGENT_ID`:

- **Dynamic variables** (referenced in the system prompt as `{{...}}`): `session_id`, `problem_statement`, `starter_template`. The app supplies these at conversation start, so no prompt edits are needed when a new Problem is added.
- **Webhook tool** `get_session_state`:
  - Method `GET`, URL `https://<APP_URL>/api/assessor/session-state/{session_id}` where `{session_id}` is bound to the `session_id` dynamic variable.
  - A static header `x-assessor-tool-secret` set to the same value as `ASSESSOR_TOOL_SECRET`.