import { randomUUID } from "node:crypto";
import type {
  Candidate,
  DataStore,
  Message,
  PerformanceSummary,
  Problem,
  Run,
  Session,
} from "@/lib/data/types";

export class InMemoryDataStore implements DataStore {
  private candidates = new Map<string, Candidate>();
  private problems = new Map<string, Problem>();
  private sessions = new Map<string, Session>();
  private runs = new Map<string, Run>();
  private messages = new Map<string, Message>();
  private summaries = new Map<string, PerformanceSummary>();

  createCandidate(email: string): Candidate {
    const candidate: Candidate = {
      id: randomUUID(),
      email,
      createdAt: new Date(),
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  findCandidateById(id: string): Candidate | null {
    return this.candidates.get(id) ?? null;
  }

  findCandidateByEmail(email: string): Candidate | null {
    for (const candidate of this.candidates.values()) {
      if (candidate.email === email) {
        return candidate;
      }
    }
    return null;
  }

  createProblem(problem: Problem): Problem {
    this.problems.set(problem.id, problem);
    return problem;
  }

  findProblemById(id: string): Problem | null {
    return this.problems.get(id) ?? null;
  }

  listProblems(): Problem[] {
    return [...this.problems.values()];
  }

  createSession(session: Session): Session {
    this.sessions.set(session.id, session);
    return session;
  }

  findSessionById(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  listSessionsByCandidate(candidateId: string): Session[] {
    return [...this.sessions.values()].filter(
      (session) => session.candidateId === candidateId,
    );
  }

  createRun(run: Run): Run {
    this.runs.set(run.id, run);
    return run;
  }

  listRunsBySession(sessionId: string): Run[] {
    return [...this.runs.values()]
      .filter((run) => run.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  createMessage(message: Message): Message {
    this.messages.set(message.id, message);
    return message;
  }

  listMessagesBySession(sessionId: string): Message[] {
    return [...this.messages.values()]
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  createPerformanceSummary(summary: PerformanceSummary): PerformanceSummary {
    this.summaries.set(summary.id, summary);
    return summary;
  }

  findPerformanceSummaryBySession(sessionId: string): PerformanceSummary | null {
    for (const summary of this.summaries.values()) {
      if (summary.sessionId === sessionId) {
        return summary;
      }
    }
    return null;
  }
}