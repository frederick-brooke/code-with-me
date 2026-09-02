import { InMemoryDataStore } from "@/lib/data/store";
import { seedProblems } from "@/lib/data/seeds/problems";
import type { DataStore } from "@/lib/data/types";

export type * from "@/lib/data/types";
export { seedProblems } from "@/lib/data/seeds/problems";
export { InMemoryDataStore } from "@/lib/data/store";

export async function createSeededDataStore(): Promise<DataStore> {
  const store = new InMemoryDataStore();
  for (const problem of seedProblems) {
    await store.createProblem(problem);
  }
  return store;
}