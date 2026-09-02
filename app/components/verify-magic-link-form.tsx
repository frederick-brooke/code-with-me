"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { verifyCodeAction, type VerifyCodeActionState } from "@/app/actions/auth";

const wrapperClassName =
  "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center";

function verifyErrorMessage(
  error: "invalid-email" | "invalid-code" | "expired-code" | "too-many-attempts",
): string {
  switch (error) {
    case "invalid-email":
      return "That link isn't for a valid email. Request a new one.";
    case "invalid-code":
      return "This link has already been used. Request a new one.";
    case "expired-code":
      return "This link has expired. Request a new one.";
    case "too-many-attempts":
      return "Too many wrong attempts. Request a new code.";
  }
}

export function VerifyMagicLinkForm({
  email,
  code,
}: {
  email?: string;
  code?: string;
}) {
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(verifyCodeAction, {
    status: "idle",
  } as VerifyCodeActionState);

  useEffect(() => {
    if (!autoSubmitted && email && code && formRef.current) {
      setAutoSubmitted(true);
      formRef.current.requestSubmit();
    }
  }, [autoSubmitted, email, code]);

  if (!email || !code) {
    return (
      <main className={wrapperClassName}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This sign-in link is missing details. Request a new one.
        </p>
        <Link
          href="/sign-in"
          className="text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          Back to sign-in
        </Link>
      </main>
    );
  }

  return (
    <main className={wrapperClassName}>
      {state.status === "error" ? (
        <>
          <p className="text-sm text-red-600 dark:text-red-400">
            {verifyErrorMessage(state.error)}
          </p>
          <Link
            href="/sign-in"
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Back to sign-in
          </Link>
        </>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {pending || autoSubmitted
            ? "Signing you in…"
            : "Signing you in… click below if it doesn't."}
        </p>
      )}

      <form
        ref={formRef}
        action={action}
        className="flex flex-col items-center gap-2"
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />
        <button
          type="submit"
          className="rounded-full border border-solid border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.06]"
        >
          Continue
        </button>
      </form>
    </main>
  );
}