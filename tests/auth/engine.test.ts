import { describe, expect, it } from "vitest";
import { AuthEngine } from "@/lib/auth/engine";
import { InMemoryAuthStore } from "@/lib/auth/store";

function makeEngine(overrides?: {
  now?: () => Date;
  codeTtlMs?: number;
  sessionTtlMs?: number;
  maxAttempts?: number;
}) {
  const store = new InMemoryAuthStore();
  const engine = new AuthEngine(store, {
    now: overrides?.now ?? (() => new Date("2026-01-01T00:00:00Z")),
    codeTtlMs: overrides?.codeTtlMs ?? 15 * 60 * 1000,
    sessionTtlMs: overrides?.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000,
    maxAttempts: overrides?.maxAttempts ?? 5,
  });
  return { engine, store };
}

describe("AuthEngine", () => {
  describe("requestCode", () => {
    it("issues a 6-digit code for a valid email", async () => {
      const { engine } = makeEngine();
      const result = await engine.requestCode("candidate@example.com");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.email).toBe("candidate@example.com");
        expect(result.code).toMatch(/^\d{6}$/);
      }
    });

    it("normalises the email so verification works with the bare form", async () => {
      const { engine } = makeEngine();
      const requested = await engine.requestCode("  Candidate@Example.com ");
      expect(requested.ok).toBe(true);
      const code = requested.ok ? requested.code : "";

      const result = await engine.verifyCode("candidate@example.com", code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.candidate.email).toBe("candidate@example.com");
      }
    });

    it("rejects a malformed email", async () => {
      const { engine } = makeEngine();
      const result = await engine.requestCode("not-an-email");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("invalid-email");
      }
    });
  });

  describe("verifyCode", () => {
    it("signs in a returning candidate with the same identity", async () => {
      const { engine } = makeEngine();
      const first = await engine.requestCode("candidate@example.com");
      expect(first.ok).toBe(true);
      const firstCode = first.ok ? first.code : "";

      const firstSignIn = await engine.verifyCode("candidate@example.com", firstCode);
      expect(firstSignIn.ok).toBe(true);
      if (!firstSignIn.ok) throw new Error("expected ok");
      const firstCandidate = firstSignIn.candidate;

      const second = await engine.requestCode("candidate@example.com");
      const secondCode = second.ok ? second.code : "";
      const secondSignIn = await engine.verifyCode("candidate@example.com", secondCode);
      expect(secondSignIn.ok).toBe(true);
      if (!secondSignIn.ok) throw new Error("expected ok");

      expect(secondSignIn.candidate.id).toBe(firstCandidate.id);
      expect(secondSignIn.candidate.email).toBe("candidate@example.com");
    });

    it("rejects a wrong code", async () => {
      const { engine } = makeEngine();
      await engine.requestCode("candidate@example.com");

      const result = await engine.verifyCode("candidate@example.com", "000000");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("invalid-code");
      }
    });

    it("accepts a code with surrounding whitespace", async () => {
      const { engine } = makeEngine();
      const requested = await engine.requestCode("candidate@example.com");
      expect(requested.ok).toBe(true);
      const code = requested.ok ? requested.code : "";

      const result = await engine.verifyCode("candidate@example.com", `  ${code} `);
      expect(result.ok).toBe(true);
    });

    it("locks out a code after repeated wrong attempts", async () => {
      const { engine } = makeEngine({ maxAttempts: 3 });
      const requested = await engine.requestCode("candidate@example.com");
      expect(requested.ok).toBe(true);

      for (let i = 0; i < 2; i++) {
        const wrong = await engine.verifyCode("candidate@example.com", "000000");
        expect(wrong.ok).toBe(false);
        if (!wrong.ok) {
          expect(wrong.error).toBe("invalid-code");
        }
      }

      const locked = await engine.verifyCode("candidate@example.com", "000000");
      expect(locked.ok).toBe(false);
      if (!locked.ok) {
        expect(locked.error).toBe("too-many-attempts");
      }

      const code = requested.ok ? requested.code : "";
      const afterLock = await engine.verifyCode("candidate@example.com", code);
      expect(afterLock.ok).toBe(false);
    });

    it("rejects an expired code", async () => {
      let now = new Date("2026-01-01T00:00:00Z");
      const { engine } = makeEngine({ now: () => now, codeTtlMs: 15 * 60 * 1000 });

      const requested = await engine.requestCode("candidate@example.com");
      expect(requested.ok).toBe(true);
      const code = requested.ok ? requested.code : "";

      now = new Date("2026-01-01T00:20:00Z");
      const result = await engine.verifyCode("candidate@example.com", code);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("expired-code");
      }
    });

    it("consumes the code on successful verification", async () => {
      const { engine } = makeEngine();
      const requested = await engine.requestCode("candidate@example.com");
      expect(requested.ok).toBe(true);
      const code = requested.ok ? requested.code : "";

      await engine.verifyCode("candidate@example.com", code);
      const second = await engine.verifyCode("candidate@example.com", code);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error).toBe("invalid-code");
      }
    });
  });

  describe("session context", () => {
    it("resolves the current Candidate from a session token", async () => {
      const { engine } = makeEngine();
      const requested = await engine.requestCode("candidate@example.com");
      const code = requested.ok ? requested.code : "";
      const verified = await engine.verifyCode("candidate@example.com", code);
      expect(verified.ok).toBe(true);
      const token = verified.ok ? verified.token : "";

      const candidate = await engine.getCandidate(token);
      expect(candidate?.email).toBe("candidate@example.com");
    });

    it("returns null for an unknown token", async () => {
      const { engine } = makeEngine();
      const candidate = await engine.getCandidate("no-such-token");
      expect(candidate).toBeNull();
    });

    it("returns null for an expired session", async () => {
      let now = new Date("2026-01-01T00:00:00Z");
      const { engine } = makeEngine({ now: () => now });

      const requested = await engine.requestCode("candidate@example.com");
      const code = requested.ok ? requested.code : "";
      const verified = await engine.verifyCode("candidate@example.com", code);
      expect(verified.ok).toBe(true);
      const token = verified.ok ? verified.token : "";

      now = new Date("2026-02-02T00:00:00Z");
      const candidate = await engine.getCandidate(token);
      expect(candidate).toBeNull();
    });
  });

  describe("signOut", () => {
    it("clears the current Candidate's session", async () => {
      const { engine } = makeEngine();
      const requested = await engine.requestCode("candidate@example.com");
      const code = requested.ok ? requested.code : "";
      const verified = await engine.verifyCode("candidate@example.com", code);
      expect(verified.ok).toBe(true);
      const token = verified.ok ? verified.token : "";

      await engine.signOut(token);

      const candidate = await engine.getCandidate(token);
      expect(candidate).toBeNull();
    });
  });
});