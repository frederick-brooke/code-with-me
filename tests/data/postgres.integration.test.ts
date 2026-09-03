import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/db/prisma";
import { PostgresDataStore, seedPostgresProblems } from "@/lib/data/postgres";
import { seedProblems } from "@/lib/data/seeds/problems";
import { SessionEngine } from "@/lib/engine/session-engine";
import type {
  Message,
  PerformanceSummary,
  Problem,
  Run,
  Session,
} from "@/lib/data/types";

const DATABASE_URL = process.env.DATABASE_URL;

function makeProblem(overrides?: Partial<Problem>): Problem {
  return {
    id: "two-sum",
    title: "Two Sum",
    statement: "Return the indices of the two numbers that add up to target.",
    difficulty: "easy",
    starterTemplate: "def two_sum(nums, target):\n    pass\n",
    sampleTests: [{ input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" }],
    hiddenTests: [{ input: "[3, 3], 6", expectedOutput: "[0, 1]" }],
    hintTiers: ["Think about approach.", "Think about structure.", "Think about the technique."],
    ...overrides,
  };
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-1",
    candidateId: "candidate-1",
    problemId: "two-sum",
    phase: "introduction",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    endedAt: null,
    workingCode: null,
    lastActivityAt: null,
    hintsGiven: 0,
    ...overrides,
  };
}

function makeRun(overrides?: Partial<Run>): Run {
  return {
    id: "run-1",
    sessionId: "session-1",
    code: "def two_sum(nums, target):\n    pass\n",
    passedCount: 0,
    failedCount: 2,
    createdAt: new Date("2026-01-01T00:01:00Z"),
    ...overrides,
  };
}

function makeMessage(overrides?: Partial<Message>): Message {
  return {
    id: "message-1",
    sessionId: "session-1",
    speaker: "assessor",
    text: "Let's begin.",
    createdAt: new Date("2026-01-01T00:02:00Z"),
    ...overrides,
  };
}

function makeSummary(overrides?: Partial<PerformanceSummary>): PerformanceSummary {
  return {
    id: "summary-1",
    sessionId: "session-1",
    content: "What went well: …",
    createdAt: new Date("2026-01-01T00:03:00Z"),
    ...overrides,
  };
}

describe.skipIf(!DATABASE_URL)("PostgresDataStore (integration)", () => {
  const store = new PostgresDataStore();

  beforeAll(async () => {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: DATABASE_URL ?? "" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.performanceSummary.deleteMany();
    await prisma.message.deleteMany();
    await prisma.run.deleteMany();
    await prisma.session.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.pendingCode.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.problem.deleteMany();
  });

  it("creates a candidate and reads it back by id and email", async () => {
    const created = await store.createCandidate("candidate@example.com");
    expect(created.id).toBeTruthy();
    expect((await store.findCandidateById(created.id))?.email).toBe("candidate@example.com");
    expect((await store.findCandidateByEmail("candidate@example.com"))?.id).toBe(created.id);
    expect(await store.findCandidateById("nobody")).toBeNull();
  });

  it("associates a session with its candidate and problem", async () => {
    const created = await store.createCandidate("candidate@example.com");
    const problem = makeProblem();
    await store.createProblem(problem);
    await store.createSession(makeSession({ candidateId: created.id, problemId: problem.id }));

    const found = await store.findSessionById("session-1");
    expect(found?.candidateId).toBe(created.id);
    expect(found?.problemId).toBe(problem.id);
    expect(found?.phase).toBe("introduction");
  });

  it("lists only the candidate's own sessions", async () => {
    const a = await store.createCandidate("a@example.com");
    const b = await store.createCandidate("b@example.com");
    await store.createProblem(makeProblem());
    await store.createSession(makeSession({ id: "s1", candidateId: a.id }));
    await store.createSession(makeSession({ id: "s2", candidateId: a.id }));
    await store.createSession(makeSession({ id: "s3", candidateId: b.id }));

    expect((await store.listSessionsByCandidate(a.id)).map((s) => s.id)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("keeps the seed Problems present and idempotent after setup", async () => {
    await seedPostgresProblems();
    await seedPostgresProblems();

    const stored = await store.listProblems();
    expect(stored).toHaveLength(seedProblems.length);

    const twoSum = await store.findProblemById("two-sum");
    expect(twoSum?.title).toBe("Two Sum");
    expect(twoSum?.sampleTests).toEqual([
      { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" },
      { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]" },
    ]);
    expect(twoSum?.hiddenTests).toHaveLength(4);
  });

  it("round-trips a seeded problem's optional starter template and tests", async () => {
    const problem = makeProblem({ id: "custom", starterTemplate: undefined });
    await store.createProblem(problem);
    const found = await store.findProblemById("custom");
    expect(found?.starterTemplate).toBeUndefined();
    expect(found?.sampleTests).toEqual(problem.sampleTests);
  });

  it("returns Runs in chronological order regardless of insert order", async () => {
    await store.createCandidate("candidate@example.com");
    await store.createProblem(makeProblem());
    await store.createSession(makeSession());
    await store.createRun(makeRun({ id: "run-2", createdAt: new Date("2026-01-01T00:02:00Z") }));
    await store.createRun(makeRun({ id: "run-3", createdAt: new Date("2026-01-01T00:03:00Z") }));
    await store.createRun(makeRun({ id: "run-1", createdAt: new Date("2026-01-01T00:01:00Z") }));

    expect((await store.listRunsBySession("session-1")).map((r) => r.id)).toEqual([
      "run-1",
      "run-2",
      "run-3",
    ]);
  });

  it("returns transcript lines in chronological order and leaks nothing", async () => {
    await store.createCandidate("candidate@example.com");
    await store.createProblem(makeProblem());
    await store.createSession(makeSession());
    await store.createMessage(
      makeMessage({
        id: "message-2",
        speaker: "candidate",
        text: "Hello!",
        createdAt: new Date("2026-01-01T00:02:00Z"),
      }),
    );
    await store.createMessage(
      makeMessage({ id: "message-1", createdAt: new Date("2026-01-01T00:01:00Z") }),
    );
    await store.createMessage(
      makeMessage({ id: "leak", sessionId: "session-2", createdAt: new Date("2026-01-01T00:03:00Z") }),
    );

    expect((await store.listMessagesBySession("session-1")).map((m) => m.id)).toEqual([
      "message-1",
      "message-2",
    ]);
    expect((await store.listMessagesBySession("session-1"))[1]?.speaker).toBe("candidate");
  });

  it("stores a Performance Summary unique per Session", async () => {
    await store.createCandidate("candidate@example.com");
    await store.createProblem(makeProblem());
    await store.createSession(makeSession());
    await store.createPerformanceSummary(makeSummary());
    expect((await store.findPerformanceSummaryBySession("session-1"))?.content).toBe(
      "What went well: …",
    );
    await expect(store.createPerformanceSummary(makeSummary({ id: "summary-2" }))).rejects.toThrow();
  });

  it("drives a full SessionEngine lifecycle against Postgres", async () => {
    await seedPostgresProblems();
    const candidate = await store.createCandidate("candidate@example.com");
    const engine = new SessionEngine(new PostgresDataStore());

    const started = await engine.start("session-1", candidate.id, "two-sum");
    expect(started.phase).toBe("introduction");

    await engine.recordRun("session-1", { code: "print(1)", passedCount: 1, failedCount: 0 });
    await engine.recordMessage("session-1", { speaker: "candidate", text: "Done." });
    const advanced = await engine.advance("session-1");
    expect(advanced.phase).toBe("clarifying");
    const ended = await engine.end("session-1");
    expect(ended.phase).toBe("debrief");
    expect(ended.endedAt).toBeInstanceOf(Date);

    const query = await engine.query("session-1");
    expect(query.currentCode).toBe("print(1)");
    expect(query.passedCount).toBe(1);
    expect(query.failedCount).toBe(0);
    expect(query.transcript).toEqual([{ speaker: "candidate", text: "Done." }]);
  });
});