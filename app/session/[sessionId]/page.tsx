import Link from "next/link";
import { redirect } from "next/navigation";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";
import { SignOutButton } from "@/app/components/sign-out-button";
import { pillButtonClassName } from "@/app/components/pill-button";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function speakerLabel(speaker: "candidate" | "assessor"): string {
  return speaker === "candidate" ? "You" : "Assessor";
}

export default async function SessionRecordPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const store = await getDataStore();
  const engine = new SessionEngine(store);
  const record = await engine.getSessionRecord(sessionId);
  if (!record || record.session.candidateId !== candidate.id) {
    redirect("/");
  }

  const summary = await store.findPerformanceSummaryBySession(sessionId);
  const problem = record.problem;

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-10 px-16 py-12">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">Session Record</span>
          <SignOutButton />
        </div>

        <header className="flex flex-col gap-3">
          <Link href="/" className={`${pillButtonClassName} w-fit border-0 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white`}>
            ← Back to problems
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {problem ? `${problem.title} (${problem.difficulty})` : "Session Record"}
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {problem?.statement}
          </p>
          <p className="text-sm text-zinc-500">
            Started {formatDate(record.session.startedAt)}
            {record.session.endedAt ? ` · Ended ${formatDate(record.session.endedAt)}` : ""}
          </p>
        </header>

        <section
          aria-label="Performance summary"
          className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Performance Summary
          </span>
          {summary ? (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {summary.content}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              A summary has not been generated for this Session yet.
            </p>
          )}
        </section>

        <section
          aria-label="Run history"
          className="flex flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Run history
          </span>
          {record.runs.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The Candidate made no Runs in this Session.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {record.runs.map((run, index) => (
                <li key={run.id} className="flex flex-col gap-2">
                  <p className="text-sm font-medium">
                    Run {index + 1} — {run.passedCount} passed · {run.failedCount} failed
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {formatDate(run.createdAt)}
                    </span>
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-zinc-100 p-3 font-mono text-xs leading-6 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {run.code}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label="Transcript"
          className="flex flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Transcript
          </span>
          {record.messages.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This Session has no recorded conversation.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {record.messages.map((message) => (
                <li key={message.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {speakerLabel(message.speaker)}
                  </span>
                  <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                    {message.text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}