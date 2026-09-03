import { describe, expect, it } from "vitest";
import { SessionEngine, PHASE_ORDER } from "@/lib/engine/session-engine";
import { makeSeededStore } from "@/tests/helpers/seeded-store";
import type { DataStore } from "@/lib/data/types";

function makeStore(): DataStore {
  return makeSeededStore();
}

async function startSession(
  store: DataStore,
  problemId = "two-sum",
  sessionId = "session-1",
  candidateId = "candidate-1",
) {
  const engine = new SessionEngine(store);
  return engine.start(sessionId, candidateId, problemId);
}

describe("SessionEngine", () => {
  it("starts a Session on a seeded Problem in the Introduction phase", async () => {
    const store = makeStore();
    const session = await startSession(store);

    expect(session.id).toBe("session-1");
    expect(session.candidateId).toBe("candidate-1");
    expect(session.problemId).toBe("two-sum");
    expect(session.phase).toBe("introduction");
    expect(session.endedAt).toBeNull();
    expect(session.startedAt).toBeInstanceOf(Date);
  });

  it("persists the started Session through the store", async () => {
    const store = makeStore();
    const session = await startSession(store);

    const found = await store.findSessionById(session.id);
    expect(found).toEqual(session);
  });

  it("rejects starting on an unknown Problem", async () => {
    const engine = new SessionEngine(makeStore());

    await expect(engine.start("nope", "candidate-1", "not-a-problem")).rejects.toThrow(
      /Unknown problem: not-a-problem/,
    );
  });

  it("records every Run with its code snapshot and pass/fail counts", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    await engine.recordRun("session-1", { code: "x = 1", passedCount: 1, failedCount: 1 });
    await engine.recordRun("session-1", { code: "x = 2", passedCount: 2, failedCount: 0 });

    const runs = await store.listRunsBySession("session-1");
    expect(runs).toHaveLength(2);
    expect(runs[1].code).toBe("x = 2");
    expect(runs[1].passedCount).toBe(2);
    expect(runs[1].failedCount).toBe(0);
  });

  it("records every transcript message", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    await engine.recordMessage("session-1", { speaker: "assessor", text: "Let's begin." });
    await engine.recordMessage("session-1", { speaker: "candidate", text: "Hello?" });

    const messages = await store.listMessagesBySession("session-1");
    expect(messages).toHaveLength(2);
    expect(messages[0].speaker).toBe("assessor");
    expect(messages[0].text).toBe("Let's begin.");
    expect(messages[1].speaker).toBe("candidate");
  });

  it("advances through the agreed phase order and no further", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    const order = ["clarifying", "approach", "implementation", "wrap-up", "debrief"];
    let session: Awaited<ReturnType<typeof engine.advance>> | null = null;
    for (const phase of order) {
      session = await engine.advance("session-1");
      expect(session.phase).toBe(phase);
      const persisted = await store.findSessionById("session-1");
      expect(persisted?.phase).toBe(phase);
    }

    session = await engine.advance("session-1");
    expect(session.phase).toBe("debrief");
    session = await engine.advance("session-1");
    expect(session.phase).toBe("debrief");
  });

  it("moves a Session through the whole five-phase arc with setPhase and records the end on Debrief", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    for (const phase of ["clarifying", "approach", "implementation", "wrap-up"] as const) {
      const session = await engine.setPhase("session-1", phase);
      expect(session.phase).toBe(phase);
      expect(session.endedAt).toBeNull();
    }

    const ended = await engine.setPhase("session-1", "debrief");
    expect(ended.phase).toBe("debrief");
    expect(ended.endedAt).toBeInstanceOf(Date);

    const persisted = await store.findSessionById("session-1");
    expect(persisted?.phase).toBe("debrief");
    expect(persisted?.endedAt).not.toBeNull();
  });

  it("is a no-op when setPhase names the current phase", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.setPhase("session-1", "approach");

    const same = await engine.setPhase("session-1", "approach");
    expect(same.phase).toBe("approach");
    expect(same.endedAt).toBeNull();
    expect(await store.findSessionById("session-1")).toEqual(same);
  });

  it("rejects an unknown phase without changing the current phase", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.setPhase("session-1", "approach");

    await expect(engine.setPhase("session-1", "solving")).rejects.toThrow(
      /Unknown phase: solving; valid phases: introduction, clarifying, approach, implementation, wrap-up, debrief/,
    );

    const session = await store.findSessionById("session-1");
    expect(session?.phase).toBe("approach");
  });

  it("rejects a backward setPhase move, leaving the Session unchanged", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.setPhase("session-1", "implementation");

    await expect(engine.setPhase("session-1", "approach")).rejects.toThrow(
      /Cannot move Session backward from implementation to approach/,
    );

    const session = await store.findSessionById("session-1");
    expect(session?.phase).toBe("implementation");
    expect(session?.endedAt).toBeNull();
  });

  it("never moves an ended Session back out of Debrief through setPhase", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    const ended = await engine.end("session-1");
    expect(ended.phase).toBe("debrief");
    expect(ended.endedAt).toBeInstanceOf(Date);

    await expect(engine.setPhase("session-1", "approach")).rejects.toThrow(
      /Cannot move Session backward from debrief to approach/,
    );

    const persisted = await store.findSessionById("session-1");
    expect(persisted?.phase).toBe("debrief");
    expect(persisted?.endedAt).not.toBeNull();
  });

  it("lands in Debrief when ending from a mid-Session phase, recording the end time", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.advance("session-1");
    await engine.advance("session-1");

    const ended = await engine.end("session-1");
    expect(ended.phase).toBe("debrief");
    expect(ended.endedAt).toBeInstanceOf(Date);

    const persisted = await store.findSessionById("session-1");
    expect(persisted?.phase).toBe("debrief");
    expect(persisted?.endedAt).not.toBeNull();
  });

  it("ends into Debrief from a freshly started (Introduction) Session", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    const ended = await engine.end("session-1");
    expect(ended.phase).toBe("debrief");
    expect(ended.endedAt).toBeInstanceOf(Date);
  });

  it("orders the phases exactly once from Introduction to Debrief", () => {
    expect(PHASE_ORDER).toEqual([
      "introduction",
      "clarifying",
      "approach",
      "implementation",
      "wrap-up",
      "debrief",
    ]);
  });

  it("returns the seeded starter template as current code before any Run", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    const query = await engine.query("session-1");
    expect(query.currentCode).toBe("def two_sum(nums, target):\n    pass\n");
    expect(query.passedCount).toBe(0);
    expect(query.failedCount).toBe(0);
  });

  it("returns the latest Run's code and counts as the query surface", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);

    await engine.recordRun("session-1", { code: "old", passedCount: 1, failedCount: 2 });
    await engine.recordRun("session-1", { code: "current", passedCount: 3, failedCount: 0 });

    const query = await engine.query("session-1");
    expect(query.currentCode).toBe("current");
    expect(query.passedCount).toBe(3);
    expect(query.failedCount).toBe(0);
  });

  it("exposes the transcript in the query surface", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.recordMessage("session-1", { speaker: "assessor", text: "Let's begin." });

    const query = await engine.query("session-1");
    expect(query.transcript).toEqual([{ speaker: "assessor", text: "Let's begin." }]);
  });

  it("keeps Runs and messages leak-proof between sessions", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await startSession(store);
    await engine.start("session-2", "candidate-1", "valid-parentheses");

    await engine.recordRun("session-1", { code: "a", passedCount: 1, failedCount: 0 });
    await engine.recordMessage("session-2", { speaker: "assessor", text: "Different." });

    expect(await store.listRunsBySession("session-2")).toHaveLength(0);
    expect(await store.listMessagesBySession("session-1")).toHaveLength(0);
  });

  it("throws on an unknown Session", async () => {
    const engine = new SessionEngine(makeStore());

    await expect(engine.advance("missing")).rejects.toThrow(/Unknown session: missing/);
    await expect(engine.end("missing")).rejects.toThrow(/Unknown session: missing/);
    await expect(engine.setPhase("missing", "approach")).rejects.toThrow(/Unknown session: missing/);
    await expect(
      engine.recordRun("missing", { code: "a", passedCount: 0, failedCount: 0 }),
    ).rejects.toThrow(/Unknown session: missing/);
    await expect(
      engine.recordMessage("missing", { speaker: "assessor", text: "a" }),
    ).rejects.toThrow(/Unknown session: missing/);
    await expect(engine.query("missing")).rejects.toThrow(/Unknown session: missing/);
  });

  it("lists a Candidate's saved Sessions newest first, joined with Problem titles", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    const storeEngine = new SessionEngine(store);
    await storeEngine.start("session-1", "candidate-1", "two-sum");
    await new Promise((resolve) => setTimeout(resolve, 2));
    await storeEngine.start("session-2", "candidate-1", "valid-parentheses");
    await storeEngine.start("session-3", "candidate-2", "two-sum");

    const saved = await engine.listSessionsForCandidate("candidate-1");
    expect(saved.map((s) => s.session.id)).toEqual(["session-2", "session-1"]);
    expect(saved.map((s) => s.problemTitle)).toEqual(["Valid Parentheses", "Two Sum"]);

    const other = await engine.listSessionsForCandidate("candidate-2");
    expect(other.map((s) => s.session.id)).toEqual(["session-3"]);
    expect(await engine.listSessionsForCandidate("nobody")).toEqual([]);
  });

  it("returns a Session with its Problem, or null when the Session is unknown", async () => {
    const store = makeStore();
    const engine = new SessionEngine(store);
    await engine.start("session-1", "candidate-1", "two-sum");

    const view = await engine.getSession("session-1");
    expect(view?.session.problemId).toBe("two-sum");
    expect(view?.problem?.title).toBe("Two Sum");
    expect(await engine.getSession("missing")).toBeNull();
  });
});