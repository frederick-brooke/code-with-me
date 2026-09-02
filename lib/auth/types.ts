export interface Candidate {
  id: string;
  email: string;
  createdAt: Date;
}

export interface PendingCode {
  code: string;
  email: string;
  expiresAt: Date;
  remainingAttempts: number;
}

export interface AuthSession {
  token: string;
  candidateId: string;
  expiresAt: Date;
}

export interface AuthStore {
  findCandidateById(id: string): Candidate | null;
  findCandidateByEmail(email: string): Candidate | null;
  createCandidate(email: string): Candidate;
  savePendingCode(pending: PendingCode): void;
  findPendingCode(email: string): PendingCode | null;
  deletePendingCode(email: string): void;
  createSession(session: AuthSession): void;
  findSession(token: string): AuthSession | null;
  deleteSession(token: string): void;
}

export type RequestCodeError = "invalid-email";

export type RequestCodeResult =
  | { ok: true; email: string; code: string }
  | { ok: false; error: RequestCodeError };

export type VerifyCodeError =
  | "invalid-email"
  | "invalid-code"
  | "expired-code"
  | "too-many-attempts";

export type VerifyCodeResult =
  | { ok: true; token: string; candidate: Candidate }
  | { ok: false; error: VerifyCodeError };

export interface AuthEngineOptions {
  now?: () => Date;
  codeTtlMs?: number;
  sessionTtlMs?: number;
  maxAttempts?: number;
}