import { randomUUID } from "node:crypto";
import { PHASE_ORDER } from "@/lib/data/phases";
import type {
  DataStore,
  Problem,
  PerformanceSummary,
  Session,
  SessionPhase,
  SessionRecord,
} from "@/lib/data/types";

export { PHASE_ORDER } from "@/lib/data/phases";
export type { SessionRecord } from "@/lib/data/types";

export interface SessionRunInput {
  code: string;
  passedCount: number;
  failedCount: number;
}

export interface SessionMessageInput {
  speaker: "candidate" | "assessor";
  text: string;
}

export interface SessionQuery {
  session: Session;
  currentCode: string;
  passedCount: number;
  failedCount: number;
  runCount: number;
  lastRunAt: Date | null;
  lastActivityAt: Date | null;
  transcript: Array<{ speaker: "candidate" | "assessor"; text: string }>;
}

export interface SavedSessionView {
  session: Session;
  problemTitle: string;
  summary: PerformanceSummary | null;
}

export type SessionEngineFailure =
  | "unknown-session"
  | "unknown-phase"
  | "invalid-transition";

export class SessionEngineError extends Error {
  constructor(
    readonly code: SessionEngineFailure,
    message: string,
  ) {
    super(message);
    this.name = "SessionEngineError";
  }
}

export class SessionEngine {
  constructor(private readonly store: DataStore) {}

  /** Starts a Session on the given seeded Problem, in the Introduction phase. */
  async start(sessionId: string, candidateId: string, problemId: string): Promise<Session> {
    const problem = await this.store.findProblemById(problemId);
    if (!problem) {
      throw new Error(`Unknown problem: ${problemId}`);
    }

    const session: Session = {
      id: sessionId,
      candidateId,
      problemId,
      phase: "introduction",
      startedAt: new Date(),
      endedAt: null,
      workingCode: null,
      lastActivityAt: null,
      hintsGiven: 0,
    };
    return this.store.createSession(session);
  }

  /** Records a Run (code snapshot + pass/fail counts) against a Session. */
  async recordRun(sessionId: string, run: SessionRunInput): Promise<Session> {
    await this.requireActiveSession(sessionId);
    await this.store.createRun({
      id: randomUUID(),
      sessionId,
      code: run.code,
      passedCount: run.passedCount,
      failedCount: run.failedCount,
      createdAt: new Date(),
    });
    return this.touchActivity(sessionId);
  }

  /** Appends a transcript line to a Session. */
  async recordMessage(sessionId: string, message: SessionMessageInput): Promise<Session> {
    await this.requireActiveSession(sessionId);
    await this.store.createMessage({
      id: randomUUID(),
      sessionId,
      speaker: message.speaker,
      text: message.text,
      createdAt: new Date(),
    });
    if (message.speaker === "candidate") {
      return this.touchActivity(sessionId);
    }
    return this.requireActiveSession(sessionId);
  }

  /**
   * Saves the Candidate's Working Code as a debounced snapshot so the Assessor
   * can read where they actually are without reacting to every keystroke. The
   * snapshot is durable on the Session (survives reload) and distinct from a
   * Run's immutable snapshot; it also marks the Session as having activity.
   */
  async saveWorkingCode(sessionId: string, code: string): Promise<Session> {
    await this.requireActiveSession(sessionId);
    return this.updateActiveSession(sessionId, { workingCode: code });
  }

  /**
   * Records a hint request so the structural guard (ADR-0001) can escalate the
   * Candidate across hint tiers. A hint counts as Candidate activity.
   */
  async recordHint(sessionId: string): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    return this.updateActiveSession(sessionId, { hintsGiven: session.hintsGiven + 1 });
  }

  /**
   * Advances the Session to the next phase. Ending from any phase lands in
   * Debrief; moving into Debrief also records the end time.
   */
  async advance(sessionId: string): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    const index = PHASE_ORDER.indexOf(session.phase);
    const next = PHASE_ORDER[Math.min(index + 1, PHASE_ORDER.length - 1)];
    return this.moveTo(sessionId, next);
  }

  /**
   * The Assessor's phase-advance tool: sets the Session to a named phase
   * through the arc (e.g. "approach" once the Candidate has talked through
   * their approach). The engine stays the single source of truth for phase
   * state: motion is forward-only (an unknown or backward label is rejected
   * without touching the current phase, so the tool response can guide the
   * Assessor to recover), and moving into Debrief records the end time.
   */
  async setPhase(sessionId: string, target: string): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    const phase = PHASE_ORDER.find((known) => known === target);
    if (!phase) {
      throw new SessionEngineError(
        "unknown-phase",
        `Unknown phase: ${target}; valid phases: ${PHASE_ORDER.join(", ")}`,
      );
    }
    const currentIndex = PHASE_ORDER.indexOf(session.phase);
    const targetIndex = PHASE_ORDER.indexOf(phase);
    if (targetIndex < currentIndex) {
      throw new SessionEngineError(
        "invalid-transition",
        `Cannot move Session backward from ${session.phase} to ${phase}`,
      );
    }
    if (phase === session.phase) {
      return session;
    }
    return this.moveTo(sessionId, phase);
  }

  /** Ends the Session from any phase, writing the end timestamp and landing in Debrief. */
  async end(sessionId: string): Promise<Session> {
    return this.moveTo(sessionId, "debrief");
  }

  /** The query surface: current code and the visible pass/fail counts. */
  async query(sessionId: string): Promise<SessionQuery> {
    const session = await this.requireActiveSession(sessionId);
    const problem = await this.store.findProblemById(session.problemId);
    const runs = await this.store.listRunsBySession(sessionId);
    const messages = await this.store.listMessagesBySession(sessionId);

    const lastRun = runs.at(-1);
    const currentCode = session.workingCode ?? lastRun?.code ?? problem?.starterTemplate ?? "";
    const passedCount = lastRun?.passedCount ?? 0;
    const failedCount = lastRun?.failedCount ?? 0;

    return {
      session,
      currentCode,
      passedCount,
      failedCount,
      runCount: runs.length,
      lastRunAt: lastRun?.createdAt ?? null,
      lastActivityAt: session.lastActivityAt,
      transcript: messages.map((m) => ({ speaker: m.speaker, text: m.text })),
    };
  }

  /**
   * Read projection for the UI: the Candidate's saved Sessions, newest
   * first, joined with the chosen Problem's title and any Performance Summary.
   */
  async listSessionsForCandidate(candidateId: string): Promise<SavedSessionView[]> {
    const sessions = await this.store.listSessionsByCandidate(candidateId);
    const newestFirst = [...sessions].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
    );
    return Promise.all(
      newestFirst.map(async (session) => ({
        session,
        problemTitle:
          (await this.store.findProblemById(session.problemId))?.title ?? session.problemId,
        summary: await this.store.findPerformanceSummaryBySession(session.id),
      })),
    );
  }

  /** Read projection for the UI: a Session with its Problem, or null when unknown. */
  async getSession(
    sessionId: string,
  ): Promise<{ session: Session; problem: Problem | null } | null> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) {
      return null;
    }
    return { session, problem: await this.store.findProblemById(session.problemId) };
  }

  /**
   * The full Session Record projection: the Problem, every Run, the transcript,
   * and the Candidate's final/Working Code. This is what the Performance Summary
   * generator and the Session history page are fed (spec's Session Record). The
   * Problem projection has its hidden tests stripped, so no consumer of the
   * record can observe hidden-test inputs or expected outputs (ADR-0001/0005).
   */
  async getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) {
      return null;
    }
    const problem = await this.store.findProblemById(session.problemId);
    const runs = await this.store.listRunsBySession(sessionId);
    const messages = await this.store.listMessagesBySession(sessionId);
    const lastRun = runs.at(-1);
    const currentCode = session.workingCode ?? lastRun?.code ?? problem?.starterTemplate ?? "";
    return {
      session,
      problem: problem ? { ...problem, hiddenTests: [] } : null,
      runs,
      messages,
      currentCode,
    };
  }

  private async moveTo(sessionId: string, phase: SessionPhase): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    const endedAt = session.endedAt ?? (phase === "debrief" ? new Date() : null);
    return this.store.updateSession({ ...session, phase, endedAt });
  }

  private async touchActivity(sessionId: string): Promise<Session> {
    return this.updateActiveSession(sessionId, {});
  }

  /** Candidate activity only: Working Code saves, Runs, Candidate turns, and Hint requests. */
  private async updateActiveSession(
    sessionId: string,
    patch: { workingCode?: string; hintsGiven?: number },
  ): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    return this.store.updateSession({
      ...session,
      workingCode: patch.workingCode ?? session.workingCode,
      hintsGiven: patch.hintsGiven ?? session.hintsGiven,
      lastActivityAt: new Date(),
    });
  }

  private async requireActiveSession(sessionId: string): Promise<Session> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) {
      throw new SessionEngineError("unknown-session", `Unknown session: ${sessionId}`);
    }
    return session;
  }
}