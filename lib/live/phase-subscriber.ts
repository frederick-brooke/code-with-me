import type { SessionPhase } from "@/lib/data/types";
import { PHASE_ORDER } from "@/lib/data/phases";

export const DEFAULT_PHASE_POLL_MS = 2000;

export interface PhaseSource {
  readPhase(sessionId: string): Promise<SessionPhase | null>;
}

/** The arc's final phase: the Session is over, so no further phase will arrive. */
const TERMINAL_PHASE = PHASE_ORDER[PHASE_ORDER.length - 1];

/**
 * Polls a Session's phase from a source and calls the listener whenever the
 * phase changes, starting immediately. Returns an unsubscribe function.
 *
 * A transient read failure is swallowed: the trail keeps its last-known phase
 * and the poll continues. A `null` read — the Session is gone or the Candidate
 * no longer owns it — keeps the last-known phase but stops the poll, so a
 * defunct Session never churns the network. Reaching the terminal Debrief
 * phase also stops the poll: the arc cannot move past it.
 */
export function subscribeToPhase(
  sessionId: string,
  source: PhaseSource,
  listener: (phase: SessionPhase) => void,
  intervalMs = DEFAULT_PHASE_POLL_MS,
): () => void {
  let active = true;
  let lastPhase: SessionPhase | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (active) {
      timer = setTimeout(poll, intervalMs);
    }
  };

  const poll = async () => {
    let phase: SessionPhase | null;
    try {
      phase = await source.readPhase(sessionId);
    } catch {
      schedule();
      return;
    }
    if (!active) {
      return;
    }
    if (phase === null) {
      return;
    }
    if (phase !== lastPhase) {
      lastPhase = phase;
      listener(phase);
    }
    if (phase === TERMINAL_PHASE) {
      return;
    }
    schedule();
  };

  void poll();

  return () => {
    active = false;
    if (timer !== null) {
      clearTimeout(timer);
    }
  };
}