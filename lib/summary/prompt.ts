import type { Message, Run, SessionRecord } from "@/lib/data/types";

/**
 * The instructing prompt for the dedicated Performance Summary LLM call. The
 * summary is a written artifact, never spoken aloud. It covers exactly the four
 * sections the spec/PRD name: what went well, even-better-if, problems, and a
 * technical review of the solution.
 */
export const SUMMARY_SYSTEM_PROMPT = `You are writing the Performance Summary for a mock live-coding interview.

This is a WRITTEN artifact shown to the Candidate after the interview ends — never spoken aloud, never read out, never delivered by voice.

Review the Candidate's Session Record and write a balanced, specific review in Markdown with exactly these four sections, in this order:

## What went well
Concrete strengths shown across the session: approach, communication, code quality, use of Runs.

## Even better if
Specific, actionable improvements the Candidate could try next time.

## Problems
Difficulties the Candidate hit, and their root causes where the Record shows them. Be honest but constructive.

## Technical review
A candid technical review of the final solution in the Record: correctness, efficiency, edge cases, code structure — against the Problem's statement. Never rewrite a full solution; describe it and evaluate it.

Stay faithful to the Record. Do not invent Runs, code, or conversations that are not present. If part of the Record is missing (for example an empty transcript), say so plainly instead of fabricating. Give a concrete, specific summary that reflects the Candidate's real trajectory — never a generic template.`;

export const TRANSCRIPT_LINE_CAP = 200;

/** The transcript for the prompt: the most recent lines, so token use stays bounded. */
export function recentTranscript(messages: Message[], cap = TRANSCRIPT_LINE_CAP): Message[] {
  return messages.slice(Math.max(0, messages.length - cap));
}

function countLabel(run: Run): string {
  return `${run.passedCount} passed, ${run.failedCount} failed`;
}

/**
 * Assembles the Session Record into the user message fed to the summary LLM.
 * Built from fields that exclude hidden-test internals, so the summary call can
 * never observe hidden inputs or expected outputs (consistent with ADR-0001/0005).
 */
export function buildSummaryUserMessage(record: SessionRecord): string {
  const lines: string[] = [];

  lines.push("# Session Record", "");

  if (record.problem) {
    lines.push(
      `## Problem`,
      `Title: ${record.problem.title} (${record.problem.difficulty})`,
      `Statement:\n${record.problem.statement}`,
    );
  } else {
    lines.push(`## Problem`, `Problem unavailable`);
  }
  lines.push("");

  lines.push(`## Final code`, "```python", record.currentCode || "(no code on record)", "```", "");

  if (record.runs.length > 0) {
    lines.push(`## Runs (chronological)`);
    record.runs.forEach((run, index) => {
      lines.push(
        `Run ${index + 1} — ${countLabel(run)}`,
        "```python",
        run.code,
        "```",
        "",
      );
    });
  } else {
    lines.push(`## Runs`, `The Candidate made no Runs.`, "");
  }

  const transcript = recentTranscript(record.messages);
  if (transcript.length > 0) {
    lines.push(`## Transcript (speaker: text)`);
    for (const message of transcript) {
      lines.push(`${message.speaker}: ${message.text}`);
    }
    lines.push("");
  } else {
    lines.push(`## Transcript`, `The Candidate and Assessor had no recorded conversation.`, "");
  }

  lines.push(
    `## Session`,
    `Started: ${record.session.startedAt.toISOString()}`,
    `Ended: ${record.session.endedAt ? record.session.endedAt.toISOString() : "still live"}`,
  );

  return lines.join("\n");
}