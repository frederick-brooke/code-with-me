# Structural guard for hints — system view

How the current Assessor tool system works, with the `get_hint` guard (Ticket 8, ADR-0001) in place.

## Sequence diagram

```mermaid
sequenceDiagram
    autonumber
    actor C as Candidate (voice)
    participant EL as ElevenLabs managed agent
    participant B as App backend (Next.js)
    participant E as SessionEngine
    participant S as DataStore (PG / memory)

    Note over C,EL: Live voice turn (STT + LLM + TTS all inside EL)

    C->>EL: "what's the max, can you just show me?"
    EL->>B: GET /api/assessor/session-state/{id}  [x-assessor-tool-secret]
    B->>E: engine.query(sessionId)
    E->>S: findSession + runs + messages
    S-->>E: data (working code, counts, phase)
    E-->>B: AssessorSessionState
    B-->>EL: JSON (no hidden tests ever)

    alt Candidate smells like "give me the answer"
        EL->>B: POST /api/assessor/hint/{id}  {question}
        Note over B: get_hint guard (ADR-0001)
        B->>E: engine.recordHint(sessionId)  [+hintsGiven]
        E->>S: persist hintsGiven
        E-->>B: tier = min(hintsGiven, authoredTiers)
        B->>B: serve pre-authored hint tier (no LLM in the loop)
        B-->>EL: { hintsGiven, tier, guidance }
        EL-->>C: reads tiered hint back as guidance
    else normal question / advance
        EL->>B: POST /api/assessor/phase/{id} {phase}
        B->>E: engine.setPhase(...)
        EL->>B: POST /api/assessor/end/{id}
        B->>E: engine.end(...) → debrief
    end

    Note over B,S: Static problem context injected once at conversation start:<br/>problem_statement, sample_tests, starter_template, session_id.<br/>Hidden-test inputs/expected outputs never cross ANY boundary.
```

## Component flow

```mermaid
flowchart TD
    subgraph EL["ElevenLabs managed agent (Assessor)"]
        A["LLM reasoning + turn-taking"]
        T1["webhook tool: get_hint (POST)"]
        T2["webhook tool: get_session_state (GET)"]
        T3["webhook tool: set_phase (POST)"]
        T4["webhook tool: end_session (POST)"]
    end

    subgraph API["App backend /api/assessor/*  (fail-closed on secret)"]
        R1["/hint/[id]  ← guard"]
        R2["/session-state/[id]"]
        R3["/phase/[id]"]
        R4["/end/[id]"]
    end

    E["SessionEngine<br/>(single source of truth)"]
    S["DataStore<br/>PG / in-memory"]
    H["Hint guard<br/>tier escalation + pre-authored guidance"]

    T1 <--> R1
    T2 <--> R2
    T3 <--> R3
    T4 <--> R4
    R1 -->|recordHint| E
    E --> S
    R1 --> H
    H -->|problem.hintTiers| T
    T["seeded Problem hint tiers<br/>(authored, approach/structure only)"]

    R2 --> E
    R3 --> E
    R4 --> E
```

## Key points

- **One seam**: every tool route is a thin adapter over `SessionEngine`, which owns all Session state including the new `hintsGiven` counter.
- **Guard is the only sanctioned answer path**: the agent routes "give me the answer" style asks into `get_hint`; the backend serves the Problem's pre-authored hint tier, escalating on a durable counter, and never sees hidden tests. The system prompt is backup, not the guarantee.
- **No LLM in the loop**: hint guidance is authored with each seeded Problem and served verbatim — the strongest structural guarantee, with nothing to jailbreak.
- **Fail-closed**: every tool call needs `x-assessor-tool-secret`; a Problem with no authored tiers still gets fixed, generic approach guidance rather than an unguarded answer.

To view: render the Mermaid blocks on GitHub, [mermaid.live](https://mermaid.live), or the *Markdown Preview Mermaid Support* VS Code extension.