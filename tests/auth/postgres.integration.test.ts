import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/db/prisma";
import { AuthEngine } from "@/lib/auth/engine";
import { PostgresAuthStore } from "@/lib/auth/postgres";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("PostgresAuthStore (integration)", () => {
  beforeAll(async () => {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: DATABASE_URL ?? "" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.authSession.deleteMany();
    await prisma.pendingCode.deleteMany();
    await prisma.candidate.deleteMany();
    await prisma.problem.deleteMany();
  });

  it("issues a code in one process and verifies it from another (durability)", async () => {
    const processA = new AuthEngine(new PostgresAuthStore(), {
      now: () => new Date("2026-01-01T00:00:00Z"),
    });
    const processB = new AuthEngine(new PostgresAuthStore(), {
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    const issued = await processA.requestCode("candidate@example.com");
    expect(issued.ok).toBe(true);
    const code = issued.ok ? issued.code : "";

    const pending = await processB.getPendingCode("candidate@example.com");
    expect(pending?.code).toBe(code);

    const verified = await processB.verifyCode("candidate@example.com", code);
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      throw new Error("expected verification to succeed across processes");
    }
    expect(verified.candidate.email).toBe("candidate@example.com");
    expect(verified.candidate.id).toBeTruthy();
  });

  it("looks up a returning candidate with the same identity on a new connection", async () => {
    const now = () => new Date("2026-01-01T00:00:00Z");
    const first = new AuthEngine(new PostgresAuthStore(), { now });
    const second = new AuthEngine(new PostgresAuthStore(), { now });

    const a = await first.requestCode("candidate@example.com");
    const b = await second.requestCode("candidate@example.com");
    const codeA = a.ok ? a.code : "";
    const codeB = b.ok ? b.code : "";
    const viaA = await first.verifyCode("candidate@example.com", codeA);
    const viaB = await second.verifyCode("candidate@example.com", codeB);

    if (!viaA.ok || !viaB.ok) {
      throw new Error("expected both sign-ins to succeed");
    }
    expect(viaB.candidate.id).toBe(viaA.candidate.id);
  });

  it("resolves an existing auth Session from a different store instance", async () => {
    const now = () => new Date("2026-01-01T00:00:00Z");
    const issuing = new AuthEngine(new PostgresAuthStore(), { now });
    const resolving = new AuthEngine(new PostgresAuthStore(), { now });

    const requested = await issuing.requestCode("candidate@example.com");
    const code = requested.ok ? requested.code : "";
    const verified = await issuing.verifyCode("candidate@example.com", code);
    expect(verified.ok).toBe(true);
    const token = verified.ok ? verified.token : "";

    const candidate = await resolving.getCandidate(token);
    expect(candidate?.email).toBe("candidate@example.com");
  });

  it("signs out by deleting the auth Session durably", async () => {
    const now = () => new Date("2026-01-01T00:00:00Z");
    const engine = new AuthEngine(new PostgresAuthStore(), { now });

    const requested = await engine.requestCode("candidate@example.com");
    const code = requested.ok ? requested.code : "";
    const verified = await engine.verifyCode("candidate@example.com", code);
    expect(verified.ok).toBe(true);
    const token = verified.ok ? verified.token : "";

    const resolvingStore = new PostgresAuthStore();
    await resolvingStore.deleteSession(token);
    await expect(engine.getCandidate(token)).resolves.toBeNull();
  });

  it("survives a pending code upgrade and single-use deletion (consumption)", async () => {
    const now = () => new Date("2026-01-01T00:00:00Z");
    const engine = new AuthEngine(new PostgresAuthStore(), { now });

    const requested = await engine.requestCode("candidate@example.com");
    const code = requested.ok ? requested.code : "";
    const verified = await engine.verifyCode("candidate@example.com", code);
    expect(verified.ok).toBe(true);

    const pending = await new PostgresAuthStore().findPendingCode("candidate@example.com");
    expect(pending).toBeNull();
  });
});