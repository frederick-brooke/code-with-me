import { AuthEngine } from "@/lib/auth/engine";
import { InMemoryAuthStore } from "@/lib/auth/store";
import { PostgresAuthStore } from "@/lib/auth/postgres";
import type { AuthStore } from "@/lib/auth/types";

/**
 * Resolves the auth store seam. With a configured DATABASE_URL the Postgres
 * store runs; otherwise production fails fast at startup and development
 * falls back to the in-memory store.
 */
export function createAuthStore(): AuthStore {
  if (process.env.DATABASE_URL) {
    return new PostgresAuthStore();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return new InMemoryAuthStore();
}

let cachedAuthEngine: AuthEngine | undefined;

/**
 * The app-wide auth engine. Constructed lazily: `next build` runs with
 * NODE_ENV=production and must be able to typecheck and collect page data
 * without a database, so building the engine (and the production fail-fast
 * throw) is deferred until the first actual use at request time.
 */
export function getAuthEngine(): AuthEngine {
  cachedAuthEngine ??= new AuthEngine(createAuthStore());
  return cachedAuthEngine;
}

export const SESSION_COOKIE = "candidate_session";