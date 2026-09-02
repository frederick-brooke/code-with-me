"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { pillButtonClassName } from "@/app/components/pill-button";

type ConversationStartOutcome = {
  ok: true;
  signedUrl: string;
  dynamicVariables: Record<string, string | number | boolean>;
} | {
  ok: false;
  status: number;
  message: string;
};

async function fetchConversationStart(
  sessionId: string,
): Promise<ConversationStartOutcome> {
  const response = await fetch(`/api/assessor/conversation?sessionId=${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, status: response.status, message: body.error ?? "Unknown error" };
  }
  const body = (await response.json()) as {
    signedUrl: string;
    dynamicVariables: Record<string, string | number | boolean>;
  };
  return { ok: true, signedUrl: body.signedUrl, dynamicVariables: body.dynamicVariables };
}

function AssessorVoiceControls({
  sessionId,
  candidateId,
}: {
  sessionId: string;
  candidateId: string;
}) {
  const conversation = useConversation();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = conversation.status === "connected";
  const busy = starting || conversation.status === "connecting";

  const start = useCallback(async () => {
    if (busy) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const outcome = await fetchConversationStart(sessionId);
      if (!outcome.ok) {
        setError(outcome.status === 503 ? "The Assessor is not configured on this deployment." : outcome.message);
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      conversation.startSession({
        signedUrl: outcome.signedUrl,
        dynamicVariables: outcome.dynamicVariables,
        userId: candidateId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the conversation.");
    } finally {
      setStarting(false);
    }
  }, [busy, candidateId, conversation, sessionId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {connected
          ? "You're live with the Assessor. Use your microphone to talk, or mute below."
          : "Start a voice conversation with the Assessor to introduce the Problem and ask questions."}
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <button
              type="button"
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              className={pillButtonClassName}
            >
              {conversation.isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={() => conversation.endSession()}
              className={`${pillButtonClassName} border-0 text-red-600 dark:text-red-400`}
            >
              End conversation
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className={`${pillButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {starting ? "Starting…" : "Start conversation"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AssessorConversation({
  sessionId,
  candidateId,
}: {
  sessionId: string;
  candidateId: string;
}) {
  return (
    <ConversationProvider>
      <AssessorVoiceControls sessionId={sessionId} candidateId={candidateId} />
    </ConversationProvider>
  );
}