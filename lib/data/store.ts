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

  async createCandidate(email: string): Promise<Candidate> {
    const candidate: Candidate = {
      id: randomUUID(),
      email,
      createdAt: new Date(),
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async findCandidateById(id: string): Promise<Candidate | null> {
    return this.candidates.get(id) ?? null;
  }

  async findCandidateByEmail(email: string): Promise<Candidate | null> {
    for (const candidate of this.candidates.values()) {
      if (candidate.email === email) {
        return candidate;
      }
    }
    return null;
  }

  async createProblem(problem: Problem): Promise<Problem> {
    this.problems.set(problem.id, problem);
    return problem;
  }

  async findProblemById(id: string): Promise<Problem | null> {
    return this.problems.get(id) ?? null;
  }

  async listProblems(): Promise<Problem[]> {
    return [...this.problems.values()];
  }

  async createSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async updateSession(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  async listSessionsByCandidate(candidateId: string): Promise<Session[]> {
    return [...this.sessions.values()].filter(
      (session) => session.candidateId === candidateId,
    );
  }

  async createRun(run: Run): Promise<Run> {
    this.runs.set(run.id, run);
    return run;
  }

  async listRunsBySession(sessionId: string): Promise<Run[]> {
    return [...this.runs.values()]
      .filter((run) => run.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(message: Message): Promise<Message> {
    this.messages.set(message.id, message);
    return message;
  }

  async listMessagesBySession(sessionId: string): Promise<Message[]> {
    return [...this.messages.values()]
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createPerformanceSummary(summary: PerformanceSummary): Promise<PerformanceSummary> {
    this.summaries.set(summary.id, summary);
    return summary;
  }

  async findPerformanceSummaryBySession(sessionId: string): Promise<PerformanceSummary | null> {
    for (const summary of this.summaries.values()) {
      if (summary.sessionId === sessionId) {
        return summary;
      }
    }
    return null;
  }
}