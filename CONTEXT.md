# Code with Me

A mock live-coding interview app where a candidate prepares for a technical coding interview with an AI voice assessor.

## Language

**Candidate**:
The human using the app to prepare. The only human user; there is no human assessor for the MVP. Identified by a lightweight email account so Session Records follow them across devices.
_Avoid_: User, Interviewee, guest

**Assessor**:
The AI voice agent that runs the interview: introduces the Problem, answers questions, guides the Candidate without giving the answer away. Implemented as a managed turn-based voice caller (ElevenLabs Voice Agent) — STT, the agent reasoning, turn detection, interruption handling, and TTS all run inside that managed pipeline; the app supplies context and receives events.
_Avoid_: Interviewer, coach

**Session**:
One complete mock-interview run for a single Problem. Driven by the Assessor through four phases — Introduction, Solve, Wrap-up, Debrief — with the Candidate able to end from anywhere. The Candidate initiates the move from Solve to Wrap-up. Keeps one live Conversation open for its whole lifetime.
_Avoid_: Interview, attempt, run

**Conversation**:
The live turn-taking voice exchange between Candidate and Assessor, hosted by the managed agent pipeline. Distinct from Session: a Conversation is the ephemeral live voice link that could later be torn down and resumed; the Session is the durable run.
_Avoid_: Call, voice link, live feed

**Tool call**:
A backend endpoint the managed Assessor can invoke mid-turn for fresh, volatile state — the Candidate's current code, their Run results — rather than relying on injected-at-start context. The app's server responds with data, plus the hint policy for guarded Candidate requests.
_Avoid_: Plug-in, skill, function call (in docs)

**Phases**:
The four scripted stages of a Session. **Introduction**: the Assessor welcomes the Candidate and pitches the Problem. **Solve**: the Candidate reads, codes, Runs, and asks questions. **Wrap-up**: the Candidate signals done and the Assessor asks 1–2 closing questions. **Debrief**: the Session ends and the Performance Summary is produced. An early exit from any phase skips straight to Debrief.

**Hidden test**:
A test in the Problem's suite that is only shown to the Candidate as a pass/fail count. Every Run executes against the hidden suite. The Assessor sees only the same pass/fail counts the Candidate sees, never the raw failures.
_Avoid_: secret test, private test

**Problem**:
A leetcode-style coding question the Candidate selects to practice. Defined as a statement, 1–3 sample tests (Candidate-visible), a set of hidden tests (only shown to the Candidate as a pass/fail count), a difficulty, and an optional starter template. Stored in the database, seeded at setup.
_Avoid_: Challenge, exercise

**Hint**:
Assessor guidance that describes approach and structure only, never a concrete implementation. A hard rule, enforced by a **structural guard** (see ADR-0001): candidate requests that smell like "give me the answer" are routed to our backend tool, which returns hint-tiered guidance without revealing a solution. The agent's own system prompt is a fallback layer, never the primary guarantee.
_Avoid_: Clue, spoiler

**Run**:
An explicit event where the Candidate submits their code to the compiler. The Assessor reacts only to explicit events (Run, a question, a Hint request, Session end) — never to keystrokes. There is no Session time limit; the Assessor suggests realistic pacing instead.
_Avoid_: Submit, execute

**Session Record**:
The one persisted record per Session: the Problem chosen, final code snapshot, test-case results, the Q&A transcript, and the Performance Summary.
_Avoid_: Attempt history, result

**Performance Summary**:
Post-interview written artifact (never spoken aloud) for the Candidate covering what went well, even-better-if, problems, and a technical review of the solution. Computed end-of-session as a dedicated call to the same LLM that played the Assessor, fed the whole Session Record.
_Avoid_: Report, debrief, feedback