"use client";

import { useEffect, useState } from "react";
import type { SessionPhase } from "@/lib/data/types";
import { PHASE_ORDER } from "@/lib/data/phases";
import { subscribeToPhase } from "@/lib/live/phase-subscriber";

const PHASE_LABELS: Record<SessionPhase, string> = {
  introduction: "Introduction",
  clarifying: "Clarifying",
  approach: "Approach",
  implementation: "Implementation",
  "wrap-up": "Wrap-up",
  debrief: "Debrief",
};

function PhaseTrail({ current }: { current: SessionPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(current);
  return (
    <nav aria-label="Interview phases" className="flex flex-wrap items-center gap-2 text-xs">
      {PHASE_ORDER.map((phase, index) => {
        const isCurrent = phase === current;
        const isDone = index < currentIndex;
        return (
          <span key={phase} className="flex items-center gap-2">
            {index > 0 && <span className="text-zinc-300">/</span>}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={[
                isCurrent
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : isDone
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400",
                "rounded-full border border-black/10 px-2.5 py-1 font-medium dark:border-white/15",
              ].join(" ")}
            >
              {PHASE_LABELS[phase]}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

/** Reads the Candidate's own Session phase; null when signed out, missing, or not owned. */
async function readCandidatePhase(sessionId: string): Promise<SessionPhase | null> {
  const response = await fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/phase`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { data: { phase: SessionPhase } };
  return body.data.phase;
}

/**
 * The phase trail above the Problem title. Server-rendered once with the phase
 * at load, it keeps itself current by polling the live phase endpoint, so a
 * phase the Assessor sets mid-interview is reflected without a page reload.
 */
export function LivePhaseTrail({
  sessionId,
  initialPhase,
}: {
  sessionId: string;
  initialPhase: SessionPhase;
}) {
  const [phase, setPhase] = useState(initialPhase);

  useEffect(
    () => subscribeToPhase(sessionId, { readPhase: readCandidatePhase }, setPhase),
    [sessionId],
  );

  return <PhaseTrail current={phase} />;
}