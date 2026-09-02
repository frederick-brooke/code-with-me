import { InMemoryDataStore } from "@/lib/data/store";
import { PostgresDataStore, seedPostgresProblems } from "@/lib/data/postgres";
import { seedProblems } from "@/lib/data/seeds/problems";
import type { DataStore } from "@/lib/data/types";

export type * from "@/lib/data/types";
export { seedProblems } from "@/lib/data/seeds/problems";
export { InMemoryDataStore } from "@/lib/data/store";
export { PostgresDataStore, seedPostgresProblems } from "@/lib/data/postgres";

export async function createSeededDataStore(): Promise<DataStore> {
  const store = new InMemoryDataStore();
  for (const problem of seedProblems) {
    await store.createProblem(problem);
  }
  return store;
}

export type DataStoreKind = "postgres" | "memory";

/**
 * Resolves which store the app should use. With a configured DATABASE_URL
 * the Postgres store runs; otherwise production fails fast at startup and
 * development falls back to the in-memory store.
 */
export function resolveDataStoreKind(): DataStoreKind {
  if (process.env.DATABASE_URL) {
    return "postgres";
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return "memory";
}

/**
 * The app-facing data seam. The Postgres store seeds Problems idempotently.
 */
export async function createDataStore(): Promise<DataStore> {
  if (resolveDataStoreKind() === "postgres") {
    await seedPostgresProblems();
    return new PostgresDataStore();
  }
  return createSeededDataStore();
}

let cachedDataStore: DataStore | undefined;

/**
 * The app-wide data store, constructed once and cached for the process.
 * `next dev` rebuilds modules as it re-dashboards, so without the cache each
 * request would rebuild the seeded in-memory store and a launched Session
 * would never appear back on Home. Mirrors `getAuthEngine`.
 */
export async function getDataStore(): Promise<DataStore> {
  cachedDataStore ??= await createDataStore();
  return cachedDataStore;
}