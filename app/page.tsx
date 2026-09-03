import Link from "next/link";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { DIFFICULTIES, filterProblemsByDifficulty, isDifficulty } from "@/lib/data/filter";
import { SessionEngine } from "@/lib/engine/session-engine";
import { SignOutButton } from "@/app/components/sign-out-button";
import { pillButtonClassName } from "@/app/components/pill-button";
import { launchSessionAction } from "@/app/actions/sessions";

const DIFFICULTY_LABEL: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_BADGE: Record<
  (typeof DIFFICULTIES)[number],
  string
> = {
  easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  hard: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** A short excerpt of the summary: the first sentence, truncated. */
function summaryExcerpt(content: string): string {
  const firstSentence = content.split(/\.\s+|\n+/)[0]?.trim() ?? "";
  if (firstSentence.length <= 140) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, 137)}…`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string }>;
}) {
  const { difficulty } = await searchParams;
  const candidate = await getCachedCurrentCandidate();
  const store = await getDataStore();
  const engine = new SessionEngine(store);

  const allProblems = await store.listProblems();
  const problems = filterProblemsByDifficulty(allProblems, difficulty);
  const activeDifficulty = isDifficulty(difficulty) ? difficulty : undefined;
  const sessions = candidate ? await engine.listSessionsForCandidate(candidate.id) : [];

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-12 px-16 py-12">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">
            {candidate ? `Signed in as ${candidate.email}` : "Not signed in"}
          </span>
          {candidate ? (
            <SignOutButton />
          ) : (
            <Link href="/sign-in" className={pillButtonClassName}>
              Sign in
            </Link>
          )}
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {candidate ? `Welcome back, ${candidate.email}` : "Pick a problem to practise"}
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Choose a Problem and start a mock live-coding interview with the
            AI voice Assessor.
          </p>
        </header>

        <nav
          aria-label="Filter by difficulty"
          className="flex items-center gap-2"
        >
          <Link
            href="/"
            className={
              activeDifficulty === undefined
                ? `${pillButtonClassName} bg-black text-white dark:bg-white dark:text-black`
                : pillButtonClassName
            }
          >
            All
          </Link>
          {DIFFICULTIES.map((value) => (
            <Link
              key={value}
              href={`/?difficulty=${value}`}
              className={
                activeDifficulty === value
                  ? `${pillButtonClassName} bg-black text-white dark:bg-white dark:text-black`
                  : pillButtonClassName
              }
            >
              {DIFFICULTY_LABEL[value]}
            </Link>
          ))}
        </nav>

        <section aria-label="Available problems" className="flex flex-col gap-4">
          {problems.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No Problems match that difficulty yet.
            </p>
          ) : (
            problems.map((problem) => (
              <article
                key={problem.id}
                className="flex flex-col gap-3 rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{problem.title}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${DIFFICULTY_BADGE[problem.difficulty]}`}
                  >
                    {DIFFICULTY_LABEL[problem.difficulty]}
                  </span>
                </div>
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  {problem.statement}
                </p>
                {candidate ? (
                  <form action={launchSessionAction} className="mt-2">
                    <input type="hidden" name="problemId" value={problem.id} />
                    <button type="submit" className={pillButtonClassName}>
                      Start interview
                    </button>
                  </form>
                ) : (
                  <Link href="/sign-in" className={`${pillButtonClassName} w-fit`}>
                    Sign in to start
                  </Link>
                )}
              </article>
            ))
          )}
        </section>

        {sessions.length > 0 && (
          <section aria-label="Past sessions" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Past Sessions</h2>
            <ul className="flex flex-col gap-2">
              {sessions.map(({ session, problemTitle, summary }) => {
                const target =
                  session.phase === "debrief"
                    ? `/session/${session.id}`
                    : `/interview/${session.id}`;
                return (
                  <li
                    key={session.id}
                    className="rounded-2xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black"
                  >
                    <Link
                      href={target}
                      className="flex items-center justify-between gap-4 px-6 py-4 text-sm"
                    >
                      <span className="flex flex-col gap-1">
                        <span className="font-medium">{problemTitle}</span>
                        <span className="text-zinc-500 capitalize">{session.phase}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {summary && (
                          <span className="max-w-xs truncate text-xs text-zinc-500">
                            {summaryExcerpt(summary.content)}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500">
                          {formatDate(session.startedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}