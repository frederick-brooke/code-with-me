import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type {
  AuthEngineOptions,
  Candidate,
  RequestCodeResult,
  VerifyCodeResult,
} from "@/lib/auth/types";
import type { AuthStore } from "@/lib/auth/types";

const CODE_LENGTH = 6;
export const DEFAULT_CODE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_COOLDOWN_MS = 60 * 1000;
export const DEFAULT_MAX_PER_HOUR = 5;
export const DEFAULT_MAX_PER_HOUR_WINDOW_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function codesMatch(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

export class AuthEngine {
  private readonly now: () => Date;
  private readonly codeTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly maxAttempts: number;
  private readonly cooldownMs: number;
  private readonly maxPerHour: number;

  constructor(
    private readonly store: AuthStore,
    options: AuthEngineOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.maxPerHour = options.maxPerHour ?? DEFAULT_MAX_PER_HOUR;
  }

  async requestCode(rawEmail: string): Promise<RequestCodeResult> {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "invalid-email" };
    }

    const now = this.now().getTime();
    const requests = await this.store.findCodeRequests(email);
    const recent = requests.filter((t) => t.getTime() > now - DEFAULT_MAX_PER_HOUR_WINDOW_MS);

    if (recent.length >= this.maxPerHour) {
      return { ok: false, error: "rate-limited" };
    }

    const last = recent.at(-1);
    if (last && now - last.getTime() < this.cooldownMs) {
      return { ok: false, error: "cooldown-active" };
    }

    const requestedAt = new Date(now);
    const code = generateCode();
    const expiresAt = new Date(now + this.codeTtlMs);
    await this.store.savePendingCode({ code, email, expiresAt, remainingAttempts: this.maxAttempts });
    await this.store.recordCodeRequest(email, requestedAt);

    return { ok: true, email, code };
  }

  async verifyCode(rawEmail: string, rawCode: string): Promise<VerifyCodeResult> {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "invalid-email" };
    }

    const code = rawCode.trim();
    const pending = await this.store.findPendingCode(email);
    if (!pending) {
      return { ok: false, error: "invalid-code" };
    }

    if (pending.expiresAt.getTime() <= this.now().getTime()) {
      await this.store.deletePendingCode(email);
      return { ok: false, error: "expired-code" };
    }

    if (pending.remainingAttempts <= 0) {
      await this.store.deletePendingCode(email);
      return { ok: false, error: "too-many-attempts" };
    }

    if (!codesMatch(pending.code, code)) {
      const remaining = pending.remainingAttempts - 1;
      if (remaining <= 0) {
        await this.store.deletePendingCode(email);
        return { ok: false, error: "too-many-attempts" };
      }
      await this.store.savePendingCode({ ...pending, remainingAttempts: remaining });
      return { ok: false, error: "invalid-code" };
    }

    await this.store.deletePendingCode(email);

    const candidate = await this.findOrCreateCandidate(email);
    const token = generateToken();
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);
    await this.store.createSession({ token, candidateId: candidate.id, expiresAt });

    return { ok: true, token, candidate };
  }

  async getPendingCode(email: string): Promise<{
    code: string;
    email: string;
    expiresAt: Date;
  } | null> {
    const pending = await this.store.findPendingCode(normalizeEmail(email));
    if (!pending) {
      return null;
    }
    return { code: pending.code, email: pending.email, expiresAt: pending.expiresAt };
  }

  async getCandidate(token: string): Promise<Candidate | null> {
    const session = await this.store.findSession(token);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      await this.store.deleteSession(token);
      return null;
    }

    return this.store.findCandidateById(session.candidateId);
  }

  async signOut(token: string): Promise<void> {
    await this.store.deleteSession(token);
  }

  private async findOrCreateCandidate(email: string): Promise<Candidate> {
    const existing = await this.store.findCandidateByEmail(email);
    if (existing) {
      return existing;
    }
    return this.store.createCandidate(email);
  }
}