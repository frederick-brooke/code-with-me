import { describe, expect, it } from "vitest";
import { InMemoryDataStore } from "@/lib/data/store";
import type {
  Message,
  PerformanceSummary,
  Problem,
  Run,
  Session,
} from "@/lib/data/types";

function makeProblem(overrides?: Partial<Problem>): Problem {
  return {
    id: "two-sum",
    title: "Two Sum",
    statement: "Return the indices of the two numbers that add up to target.",
    difficulty: "easy",
    starterTemplate: "def two_sum(nums, target):\n    pass\n",
    sampleTests: [{ input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]" }],
    hiddenTests: [{ input: "[3, 3], 6", expectedOutput: "[0, 1]" }],
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

describe("InMemoryDataStore", () => {
  describe("candidate", () => {
    it("creates a candidate and reads it back by id", async () => {
      const store = new InMemoryDataStore();
      const created = await store.createCandidate("candidate@example.com");

      expect(created.id).toBeTruthy();
      expect((await store.findCandidateById(created.id))?.email).toBe("candidate@example.com");
    });

    it("creates a candidate and reads it back by email", async () => {
      const store = new InMemoryDataStore();
      const created = await store.createCandidate("candidate@example.com");

      expect((await store.findCandidateByEmail("candidate@example.com"))?.id).toBe(created.id);
    });

    it("returns null when no candidate matches", async () => {
      const store = new InMemoryDataStore();
      expect(await store.findCandidateById("nobody")).toBeNull();
      expect(await store.findCandidateByEmail("nobody@example.com")).toBeNull();
    });
  });

  describe("problem", () => {
    it("creates a problem and reads it back by id", async () => {
      const store = new InMemoryDataStore();
      const problem = makeProblem();
      await store.createProblem(problem);
      expect(await store.findProblemById(problem.id)).toBe(problem);
    });

    it("lists seeded problems", async () => {
      const store = new InMemoryDataStore();
      await store.createProblem(makeProblem({ id: "a" }));
      await store.createProblem(makeProblem({ id: "b" }));
      expect((await store.listProblems()).map((p) => p.id)).toEqual(["a", "b"]);
    });
  });

  describe("session", () => {
    it("creates a session and reads it back with its candidate and problem relationships", async () => {
      const store = new InMemoryDataStore();
      const session = makeSession();
      await store.createSession(session);

      const found = await store.findSessionById(session.id);
      expect(found?.candidateId).toBe("candidate-1");
      expect(found?.problemId).toBe("two-sum");
      expect(found?.phase).toBe("introduction");
    });

    it("lists a candidate's sessions without leaking another's", async () => {
      const store = new InMemoryDataStore();
      await store.createSession(makeSession({ id: "session-1", candidateId: "candidate-1" }));
      await store.createSession(makeSession({ id: "session-2", candidateId: "candidate-1" }));
      await store.createSession(makeSession({ id: "session-3", candidateId: "candidate-2" }));

      expect((await store.listSessionsByCandidate("candidate-1")).map((s) => s.id)).toEqual([
        "session-1",
        "session-2",
      ]);
    });

    it("returns null for an unknown session", async () => {
      const store = new InMemoryDataStore();
      expect(await store.findSessionById("nope")).toBeNull();
    });
  });

  describe("run", () => {
    it("records a run and lists it under its session", async () => {
      const store = new InMemoryDataStore();
      const run = makeRun();
      await store.createRun(run);
      expect(await store.listRunsBySession("session-1")).toHaveLength(1);
      expect((await store.listRunsBySession("session-1"))[0]).toBe(run);
    });

    it("keeps the run code and pass/fail count", async () => {
      const store = new InMemoryDataStore();
      await store.createRun(makeRun({ code: "print(1)", passedCount: 2, failedCount: 1 }));
      const run = (await store.listRunsBySession("session-1"))[0];
      expect(run?.code).toBe("print(1)");
      expect(run?.passedCount).toBe(2);
      expect(run?.failedCount).toBe(1);
    });

    it("orders runs by createdAt, the oldest first, regardless of insert order", async () => {
      const store = new InMemoryDataStore();
      await store.createRun(makeRun({ id: "run-2", createdAt: new Date("2026-01-01T00:02:00Z") }));
      await store.createRun(makeRun({ id: "run-1", createdAt: new Date("2026-01-01T00:01:00Z") }));
      await store.createRun(makeRun({ id: "run-3", createdAt: new Date("2026-01-01T00:03:00Z") }));
      expect((await store.listRunsBySession("session-1")).map((r) => r.id)).toEqual([
        "run-1",
        "run-2",
        "run-3",
      ]);
    });

    it("does not leak runs between sessions", async () => {
      const store = new InMemoryDataStore();
      await store.createRun(makeRun({ id: "run-1", sessionId: "session-1" }));
      await store.createRun(makeRun({ id: "run-2", sessionId: "session-2" }));
      expect((await store.listRunsBySession("session-1")).map((r) => r.id)).toEqual(["run-1"]);
    });
  });

  describe("message", () => {
    it("records a transcript line with speaker and lists it under its session", async () => {
      const store = new InMemoryDataStore();
      await store.createMessage(makeMessage());
      const found = (await store.listMessagesBySession("session-1"))[0];
      expect(found?.speaker).toBe("assessor");
      expect(found?.text).toBe("Let's begin.");
    });

    it("orders messages chronologically by createdAt, regardless of insert order", async () => {
      const store = new InMemoryDataStore();
      await store.createMessage(
        makeMessage({ id: "message-2", speaker: "candidate", createdAt: new Date("2026-01-01T00:02:00Z") }),
      );
      await store.createMessage(
        makeMessage({ id: "message-1", createdAt: new Date("2026-01-01T00:01:00Z") }),
      );
      expect((await store.listMessagesBySession("session-1")).map((m) => m.id)).toEqual([
        "message-1",
        "message-2",
      ]);
    });

    it("does not leak messages between sessions", async () => {
      const store = new InMemoryDataStore();
      await store.createMessage(makeMessage({ id: "message-1", sessionId: "session-1" }));
      await store.createMessage(makeMessage({ id: "message-2", sessionId: "session-2" }));
      expect((await store.listMessagesBySession("session-1")).map((m) => m.id)).toEqual(["message-1"]);
    });
  });

  describe("performance summary", () => {
    it("stores a summary and reads it back for its session", async () => {
      const store = new InMemoryDataStore();
      await store.createPerformanceSummary(makeSummary());
      expect((await store.findPerformanceSummaryBySession("session-1"))?.content).toBe(
        "What went well: …",
      );
    });

    it("returns null when a session has no summary", async () => {
      const store = new InMemoryDataStore();
      expect(await store.findPerformanceSummaryBySession("session-1")).toBeNull();
    });
  });
});