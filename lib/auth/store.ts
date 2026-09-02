import { randomUUID } from "node:crypto";
import type { AuthSession, AuthStore, Candidate, PendingCode } from "@/lib/auth/types";

export class InMemoryAuthStore implements AuthStore {
  private candidates = new Map<string, Candidate>();
  private pendingCodes = new Map<string, PendingCode>();
  private sessions = new Map<string, AuthSession>();

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

  createCandidate(email: string): Candidate {
    const candidate: Candidate = {
      id: randomUUID(),
      email,
      createdAt: new Date(),
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  savePendingCode(pending: PendingCode): void {
    this.pendingCodes.set(pending.email, pending);
  }

  findPendingCode(email: string): PendingCode | null {
    return this.pendingCodes.get(email) ?? null;
  }

  deletePendingCode(email: string): void {
    this.pendingCodes.delete(email);
  }

  createSession(session: AuthSession): void {
    this.sessions.set(session.token, session);
  }

  findSession(token: string): AuthSession | null {
    return this.sessions.get(token) ?? null;
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }
}