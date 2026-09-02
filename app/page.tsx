import Link from "next/link";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { SignOutButton } from "@/app/components/sign-out-button";
import { pillButtonClassName } from "@/app/components/pill-button";

export default async function Home() {
  const candidate = await getCachedCurrentCandidate();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex w-full items-center justify-between">
          <span className="text-sm font-medium">
            {candidate
              ? `Signed in as ${candidate.email}`
              : "Not signed in"}
          </span>
          {candidate ? (
            <SignOutButton />
          ) : (
            <Link
              href="/sign-in"
              className={pillButtonClassName}
            >
              Sign in
            </Link>
          )}
        </div>

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            {candidate ? `Welcome back, ${candidate.email}` : "Welcome"}
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Practice a mock live-coding interview with an AI voice assessor.
            Problems and your past Sessions will live here.
          </p>
        </div>
      </main>
    </div>
  );
}
