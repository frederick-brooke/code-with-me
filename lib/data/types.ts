import type { Candidate } from "@/lib/auth/types";

export type { Candidate } from "@/lib/auth/types";

export type Difficulty = "easy" | "medium" | "hard";

export type SessionPhase = "introduction" | "solve" | "wrap-up" | "debrief";

export type Speaker = "candidate" | "assessor";

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  starterTemplate?: string;
  sampleTests: TestCase[];
  hiddenTests: TestCase[];
}

export interface Session {
  id: string;
  candidateId: string;
  problemId: string;
  phase: SessionPhase;
  startedAt: Date;
  endedAt: Date | null;
}

export interface Run {
  id: string;
  sessionId: string;
  code: string;
  passedCount: number;
  failedCount: number;
  createdAt: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  createdAt: Date;
}

export interface PerformanceSummary {
  id: string;
  sessionId: string;
  content: string;
  createdAt: Date;
}

export interface DataStore {
  createCandidate(email: string): Promise<Candidate>;
  findCandidateById(id: string): Promise<Candidate | null>;
  findCandidateByEmail(email: string): Promise<Candidate | null>;

  createProblem(problem: Problem): Promise<Problem>;
  findProblemById(id: string): Promise<Problem | null>;
  listProblems(): Promise<Problem[]>;

  createSession(session: Session): Promise<Session>;
  findSessionById(id: string): Promise<Session | null>;
  updateSession(session: Session): Promise<Session>;
  listSessionsByCandidate(candidateId: string): Promise<Session[]>;

  createRun(run: Run): Promise<Run>;
  listRunsBySession(sessionId: string): Promise<Run[]>;

  createMessage(message: Message): Promise<Message>;
  listMessagesBySession(sessionId: string): Promise<Message[]>;

  createPerformanceSummary(summary: PerformanceSummary): Promise<PerformanceSummary>;
  findPerformanceSummaryBySession(sessionId: string): Promise<PerformanceSummary | null>;
}