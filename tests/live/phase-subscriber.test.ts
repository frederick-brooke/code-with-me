import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToPhase, type PhaseSource } from "@/lib/live/phase-subscriber";
import type { SessionPhase } from "@/lib/data/types";

const INTERVAL_MS = 1000;

function sourceThat(reads: Array<() => Promise<SessionPhase | null>>): PhaseSource {
  let calls = 0;
  return {
    readPhase: async () => {
      const next = reads[Math.min(calls, reads.length - 1)];
      calls += 1;
      return next();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("subscribeToPhase", () => {
  it("notifies with the current phase immediately", async () => {
    vi.useFakeTimers();
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      sourceThat([async () => "introduction", async () => "introduction"]),
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual(["introduction"]);
    unsubscribe();
  });

  it("observes a phase change made on the backend on a later poll, without a reload", async () => {
    vi.useFakeTimers();
    let backendPhase: SessionPhase = "introduction";
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      { readPhase: async () => backendPhase },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual(["introduction"]);

    backendPhase = "approach";
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["introduction", "approach"]);
    unsubscribe();
  });

  it("keeps polling across a transient failure, keeping the last-known phase", async () => {
    vi.useFakeTimers();
    let failing = true;
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      {
        readPhase: async () => {
          if (failing) {
            failing = false;
            throw new Error("network blip");
          }
          return "implementation";
        },
      },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual([]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["implementation"]);
    unsubscribe();
  });

  it("stops polling once the Session is gone, keeping the last-known phase", async () => {
    vi.useFakeTimers();
    let sessionExists = true;
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      {
        readPhase: async () => {
          if (!sessionExists) {
            return null;
          }
          return "wrap-up";
        },
      },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual(["wrap-up"]);

    sessionExists = false;
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["wrap-up"]);
    unsubscribe();
  });

  it("does not re-notify when the phase has not changed", async () => {
    vi.useFakeTimers();
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      { readPhase: async () => "clarifying" },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual(["clarifying"]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["clarifying"]);
    unsubscribe();
  });

  it("delivers Debrief once, then stops polling the ended Session", async () => {
    vi.useFakeTimers();
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      { readPhase: async () => "debrief" },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(heard).toEqual(["debrief"]);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["debrief"]);
    unsubscribe();
  });

  it("stops notifying once unsubscribed", async () => {
    vi.useFakeTimers();
    let backendPhase: SessionPhase = "introduction";
    const heard: SessionPhase[] = [];
    const unsubscribe = subscribeToPhase(
      "session-1",
      { readPhase: async () => backendPhase },
      (phase) => heard.push(phase),
      INTERVAL_MS,
    );
    await vi.advanceTimersByTimeAsync(0);

    unsubscribe();
    backendPhase = "debrief";
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(heard).toEqual(["introduction"]);
  });
});