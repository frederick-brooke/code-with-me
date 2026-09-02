import type { PrismaClient } from "@/lib/db/prisma";
import { prisma } from "@/lib/db/prisma";
import type { AuthSession, AuthStore, Candidate, PendingCode } from "@/lib/auth/types";

export class PostgresAuthStore implements AuthStore {
  private codeRequests = new Map<string, Date[]>();

  constructor(private readonly db: PrismaClient = prisma) {}

  async findCandidateById(id: string): Promise<Candidate | null> {
    const row = await this.db.candidate.findUnique({ where: { id } });
    return row ? { id: row.id, email: row.email, createdAt: row.createdAt } : null;
  }

  async findCandidateByEmail(email: string): Promise<Candidate | null> {
    const row = await this.db.candidate.findUnique({ where: { email } });
    return row ? { id: row.id, email: row.email, createdAt: row.createdAt } : null;
  }

  async createCandidate(email: string): Promise<Candidate> {
    const row = await this.db.candidate.create({ data: { email } });
    return { id: row.id, email: row.email, createdAt: row.createdAt };
  }

  async savePendingCode(pending: PendingCode): Promise<void> {
    await this.db.pendingCode.upsert({
      where: { email: pending.email },
      update: {
        code: pending.code,
        expiresAt: pending.expiresAt,
        remainingAttempts: pending.remainingAttempts,
      },
      create: {
        email: pending.email,
        code: pending.code,
        expiresAt: pending.expiresAt,
        remainingAttempts: pending.remainingAttempts,
      },
    });
  }

  async findPendingCode(email: string): Promise<PendingCode | null> {
    const row = await this.db.pendingCode.findUnique({ where: { email } });
    if (!row) {
      return null;
    }
    return {
      code: row.code,
      email: row.email,
      expiresAt: row.expiresAt,
      remainingAttempts: row.remainingAttempts,
    };
  }

  async deletePendingCode(email: string): Promise<void> {
    await this.db.pendingCode.deleteMany({ where: { email } });
  }

  async recordCodeRequest(email: string, timestamp: Date): Promise<void> {
    const existing = this.codeRequests.get(email) ?? [];
    this.codeRequests.set(email, [...existing, timestamp]);
  }

  async findCodeRequests(email: string): Promise<Date[]> {
    return this.codeRequests.get(email) ?? [];
  }

  async createSession(session: AuthSession): Promise<void> {
    await this.db.authSession.create({
      data: {
        token: session.token,
        candidateId: session.candidateId,
        expiresAt: session.expiresAt,
      },
    });
  }

  async findSession(token: string): Promise<AuthSession | null> {
    const row = await this.db.authSession.findUnique({ where: { token } });
    if (!row) {
      return null;
    }
    return {
      token: row.token,
      candidateId: row.candidateId,
      expiresAt: row.expiresAt,
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.authSession.deleteMany({ where: { token } });
  }
}