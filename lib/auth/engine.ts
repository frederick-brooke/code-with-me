import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type {
  AuthEngineOptions,
  Candidate,
  RequestCodeResult,
  VerifyCodeResult,
} from "@/lib/auth/types";
import type { AuthStore } from "@/lib/auth/types";

const CODE_LENGTH = 6;
const DEFAULT_CODE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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

  constructor(
    private readonly store: AuthStore,
    options: AuthEngineOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  }

  async requestCode(rawEmail: string): Promise<RequestCodeResult> {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "invalid-email" };
    }

    const code = generateCode();
    const expiresAt = new Date(this.now().getTime() + this.codeTtlMs);
    this.store.savePendingCode({ code, email, expiresAt });

    return { ok: true, email, code };
  }

  async verifyCode(rawEmail: string, rawCode: string): Promise<VerifyCodeResult> {
    const email = normalizeEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "invalid-email" };
    }

    const pending = this.store.findPendingCode(email);
    if (!pending || !codesMatch(pending.code, rawCode)) {
      return { ok: false, error: "invalid-code" };
    }

    if (pending.expiresAt.getTime() <= this.now().getTime()) {
      this.store.deletePendingCode(email);
      return { ok: false, error: "expired-code" };
    }

    this.store.deletePendingCode(email);

    const candidate = this.findOrCreateCandidate(email);
    const token = generateToken();
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);
    this.store.createSession({ token, candidateId: candidate.id, expiresAt });

    return { ok: true, token, candidate };
  }

  async getCandidate(token: string): Promise<Candidate | null> {
    const session = this.store.findSession(token);
    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= this.now().getTime()) {
      this.store.deleteSession(token);
      return null;
    }

    return this.store.findCandidateById(session.candidateId);
  }

  async signOut(token: string): Promise<void> {
    this.store.deleteSession(token);
  }

  private findOrCreateCandidate(email: string): Candidate {
    const existing = this.store.findCandidateByEmail(email);
    if (existing) {
      return existing;
    }
    return this.store.createCandidate(email);
  }
}