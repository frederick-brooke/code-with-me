import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthStore } from "@/lib/auth/index";
import { createDataStore, createSeededDataStore, resolveDataStoreKind } from "@/lib/data/index";
import { InMemoryAuthStore } from "@/lib/auth/store";
import { InMemoryDataStore } from "@/lib/data/store";
import { PostgresAuthStore } from "@/lib/auth/postgres";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("seam store selection", () => {
  it("selects the Postgres auth store when DATABASE_URL is configured", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.stubEnv("NODE_ENV", "development");
    const store = createAuthStore();
    expect(store).toBeInstanceOf(PostgresAuthStore);
  });

  it("selects the in-memory auth store in development without a database", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const store = createAuthStore();
    expect(store).toBeInstanceOf(InMemoryAuthStore);
  });

  it("throws in production without a configured database (auth)", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createAuthStore()).toThrow(/DATABASE_URL/);
  });

  it("resolves the Postgres data store when DATABASE_URL is configured", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    expect(resolveDataStoreKind()).toBe("postgres");
  });

  it("resolves the in-memory seeded data store in development without a database", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const store = await createDataStore();
    expect(store).toBeInstanceOf(InMemoryDataStore);
    const seeded = await createSeededDataStore();
    expect(await store.listProblems()).toHaveLength((await seeded.listProblems()).length);
  });

  it("throws in production without a configured database (data)", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveDataStoreKind()).toThrow(/DATABASE_URL/);
  });
});