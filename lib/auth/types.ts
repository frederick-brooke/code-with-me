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
  findCandidateById(id: string): Promise<Candidate | null>;
  findCandidateByEmail(email: string): Promise<Candidate | null>;
  createCandidate(email: string): Promise<Candidate>;
  savePendingCode(pending: PendingCode): Promise<void>;
  findPendingCode(email: string): Promise<PendingCode | null>;
  deletePendingCode(email: string): Promise<void>;
  recordCodeRequest(email: string, timestamp: Date): Promise<void>;
  findCodeRequests(email: string): Promise<Date[]>;
  createSession(session: AuthSession): Promise<void>;
  findSession(token: string): Promise<AuthSession | null>;
  deleteSession(token: string): Promise<void>;
}

export type RequestCodeError = "invalid-email" | "cooldown-active" | "rate-limited";

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
  cooldownMs?: number;
  maxPerHour?: number;
}