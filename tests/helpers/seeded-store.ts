import { InMemoryDataStore } from "@/lib/data/store";
import { seedProblems } from "@/lib/data/seeds/problems";
import type { DataStore } from "@/lib/data/types";

export function makeSeededStore(): DataStore {
  const store = new InMemoryDataStore();
  for (const problem of seedProblems) {
    store.createProblem(problem);
  }
  return store;
}