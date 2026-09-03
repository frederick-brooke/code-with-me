# ADR-0001: Structural guard tool instead of the managed agent's prompt for hint policy

The Candidate's trust is the product: a mock interview that leaks the solution in front of a candidate is worthless. We chose to implement the hint policy as a **structural guard** — candidate questions that smell like "give me the answer" are routed to our own backend tool, which replies with hint-tiered guidance — rather than relying on the managed ElevenLabs agent's system prompt (or any externally-hosted LLM prompt) to hold the line on its own. A prompt-only policy is as strong as the prompt; prompt text can be rewritten by model updates, prompt-injection, or agent drift, and the cost of a single leak is a broken session. The guard is a narrow, additive piece: agent, policy, and hint-tiering all live server-side, so tightening the rule is a backend deploy, not a platform reconfiguration.

## Mechanism

The guard is the `get_hint` webhook tool, served from `POST /api/assessor/hint/{sessionId}` and built on `getHintForTool` in `lib/assessor/hint-guard.ts`:

- **Guidance is pre-authored, not generated.** Each seeded Problem carries `hintTiers` — three strings written by us describing approach, structure, then technique, in that order. The guard serves them verbatim. No LLM is in the loop at all, so there is no prompt to jailbreak and no generation path that could emit a working solution.
- **Escalation is a durable counter.** Each tool call bumps `session.hintsGiven` (a `SessionEngine.recordHint` command), and the tier served is `min(hintsGiven, authoredTiers)` — the first hint is the most abstract, later hints get more concrete, and past the last authored tier the guard holds the line, returning the most concrete tier unchanged.
- **The response is candidate-safe by construction.** It carries only `sessionId`, the hint count, the tier, and the authored guidance — never hidden-test inputs, expected outputs, or any problem internals beyond the guidance. A Problem with no authored tiers falls back to a fixed, generic approach prompt.
- **The agent's prompt is a routing reminder, not the guarantee.** The prompt tells the assistant to send answer-solicitations through `get_hint` and to read the guidance back in its own words; even if it ignores or forgets that, the only sanctioned path to guidance is the backend tool.

Tightening the policy means editing the authored tiers in `lib/data/seeds/problems.ts` (and the store's seed data) — a backend deploy, not a platform reconfiguration.