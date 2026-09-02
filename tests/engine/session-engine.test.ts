import { describe, expect, it } from "vitest";
import { InMemoryDataStore } from "@/lib/data/store";
import { seedProblems } from "@/lib/data/seeds/problems";
import { SessionEngine, PHASE_ORDER } from "@/lib/engine/session-engine";
import type { DataStore } from "@/lib/data/types";

function makeStore(): DataStore {
  const store = new InMemoryDataStore();
  for (const problem of seedProblems) {
    store.createProblem(problem);
  }
  return store;
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

    let session = await engine.advance("session-1");
    expect(session.phase).toBe("solve");
    session = (await store.findSessionById("session-1")) as NonNullable<Awaited<typeof session>>;
    expect(session.phase).toBe("solve");

    session = await engine.advance("session-1");
    expect(session.phase).toBe("wrap-up");
    session = await engine.advance("session-1");
    expect(session.phase).toBe("debrief");
    session = await engine.advance("session-1");
    expect(session.phase).toBe("debrief");
    session = await engine.advance("session-1");
    expect(session.phase).toBe("debrief");
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
    expect(PHASE_ORDER).toEqual(["introduction", "solve", "wrap-up", "debrief"]);
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
    await expect(
      engine.recordRun("missing", { code: "a", passedCount: 0, failedCount: 0 }),
    ).rejects.toThrow(/Unknown session: missing/);
    await expect(
      engine.recordMessage("missing", { speaker: "assessor", text: "a" }),
    ).rejects.toThrow(/Unknown session: missing/);
    await expect(engine.query("missing")).rejects.toThrow(/Unknown session: missing/);
  });
});