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
  createCandidate(email: string): Candidate;
  findCandidateById(id: string): Candidate | null;
  findCandidateByEmail(email: string): Candidate | null;

  createProblem(problem: Problem): Problem;
  findProblemById(id: string): Problem | null;
  listProblems(): Problem[];

  createSession(session: Session): Session;
  findSessionById(id: string): Session | null;
  listSessionsByCandidate(candidateId: string): Session[];

  createRun(run: Run): Run;
  listRunsBySession(sessionId: string): Run[];

  createMessage(message: Message): Message;
  listMessagesBySession(sessionId: string): Message[];

  createPerformanceSummary(summary: PerformanceSummary): PerformanceSummary;
  findPerformanceSummaryBySession(sessionId: string): PerformanceSummary | null;
}