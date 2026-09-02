import { randomUUID } from "node:crypto";
import type { DataStore, Problem, Session, SessionPhase } from "@/lib/data/types";

export const PHASE_ORDER: SessionPhase[] = ["introduction", "solve", "wrap-up", "debrief"];

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
  transcript: Array<{ speaker: "candidate" | "assessor"; text: string }>;
}

export interface SavedSessionView {
  session: Session;
  problemTitle: string;
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
    return this.requireActiveSession(sessionId);
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
    return this.requireActiveSession(sessionId);
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
    const currentCode = lastRun?.code ?? problem?.starterTemplate ?? "";
    const passedCount = lastRun?.passedCount ?? 0;
    const failedCount = lastRun?.failedCount ?? 0;

    return {
      session,
      currentCode,
      passedCount,
      failedCount,
      transcript: messages.map((m) => ({ speaker: m.speaker, text: m.text })),
    };
  }

  /**
   * Read projection for the UI: the Candidate's saved Sessions, newest
   * first, joined with the chosen Problem's title.
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

  private async moveTo(sessionId: string, phase: SessionPhase): Promise<Session> {
    const session = await this.requireActiveSession(sessionId);
    const endedAt = session.endedAt ?? (phase === "debrief" ? new Date() : null);
    return this.store.updateSession({ ...session, phase, endedAt });
  }

  private async requireActiveSession(sessionId: string): Promise<Session> {
    const session = await this.store.findSessionById(sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return session;
  }
}