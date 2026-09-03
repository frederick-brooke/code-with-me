import type { SessionPhase } from "@/lib/data/types";

/** The arc order, Introduction to Debrief. Client-safe (no server imports). */
export const PHASE_ORDER: SessionPhase[] = [
  "introduction",
  "clarifying",
  "approach",
  "implementation",
  "wrap-up",
  "debrief",
];
