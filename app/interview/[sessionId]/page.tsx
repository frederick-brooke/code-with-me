import Link from "next/link";
import { redirect } from "next/navigation";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { SessionEngine } from "@/lib/engine/session-engine";
import { SignOutButton } from "@/app/components/sign-out-button";
import { pillButtonClassName } from "@/app/components/pill-button";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  const engine = new SessionEngine(await getDataStore());
  const view = await engine.getSession(sessionId);
  if (!view || view.session.candidateId !== candidate.id) {
    redirect("/");
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-12 px-16 py-12">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">Session in progress</span>
          <SignOutButton />
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {view.problem?.title ?? view.session.problemId}
          </h1>
        </header>

        <section className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm leading-7 text-zinc-600 dark:border-white/[.145] dark:bg-black dark:text-zinc-400">
          <p>
            The Assessor voice conversation and the code editor arrive with the
            interview surface. Your Session is live and stored.
          </p>
        </section>

        <Link
          href="/"
          className={`${pillButtonClassName} w-fit border-0 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white`}
        >
          Back to problems
        </Link>
      </main>
    </div>
  );
}