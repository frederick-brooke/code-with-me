import { randomUUID } from "node:crypto";
import type { AuthSession, AuthStore, Candidate, PendingCode } from "@/lib/auth/types";

export class InMemoryAuthStore implements AuthStore {
  private candidates = new Map<string, Candidate>();
  private pendingCodes = new Map<string, PendingCode>();
  private sessions = new Map<string, AuthSession>();
  private codeRequests = new Map<string, Date[]>();

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

  async createCandidate(email: string): Promise<Candidate> {
    const candidate: Candidate = {
      id: randomUUID(),
      email,
      createdAt: new Date(),
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async savePendingCode(pending: PendingCode): Promise<void> {
    this.pendingCodes.set(pending.email, pending);
  }

  async findPendingCode(email: string): Promise<PendingCode | null> {
    return this.pendingCodes.get(email) ?? null;
  }

  async deletePendingCode(email: string): Promise<void> {
    this.pendingCodes.delete(email);
  }

  async recordCodeRequest(email: string, timestamp: Date): Promise<void> {
    const existing = this.codeRequests.get(email) ?? [];
    this.codeRequests.set(email, [...existing, timestamp]);
  }

  async findCodeRequests(email: string): Promise<Date[]> {
    return this.codeRequests.get(email) ?? [];
  }

  async createSession(session: AuthSession): Promise<void> {
    this.sessions.set(session.token, session);
  }

  async findSession(token: string): Promise<AuthSession | null> {
    return this.sessions.get(token) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}