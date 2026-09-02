"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestCodeAction,
  resendCodeAction,
  verifyCodeAction,
  type RequestCodeActionState,
  type VerifyCodeActionState,
} from "@/app/actions/auth";

const initialRequestState: RequestCodeActionState = { status: "start" };
const initialVerifyState: VerifyCodeActionState = { status: "idle" };

type RequestError =
  | "invalid-email"
  | "cooldown-active"
  | "rate-limited"
  | "send-failed"
  | "no-active-code";

type VerifyError = "invalid-email" | "invalid-code" | "expired-code" | "too-many-attempts";

function requestErrorMessage(error: RequestError): string {
  switch (error) {
    case "invalid-email":
      return "That email address doesn't look right. Try again.";
    case "cooldown-active":
      return "You just requested a code. Wait about a minute and try again.";
    case "rate-limited":
      return "Too many codes for this address recently. Try again in an hour.";
    case "send-failed":
      return "We couldn't send the email. Try again.";
    case "no-active-code":
      return "That code has expired or was already used. Request a new one.";
  }
}

function verifyErrorMessage(error: VerifyError): string {
  switch (error) {
    case "invalid-email":
      return "That email address doesn't look right. Try again.";
    case "invalid-code":
      return "That code didn't match. Check it and try again.";
    case "expired-code":
      return "That code has expired. Request a new one.";
    case "too-many-attempts":
      return "Too many wrong attempts. Request a new code.";
  }
}

export default function SignInPage() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestCodeAction,
    initialRequestState,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendCodeAction,
    initialRequestState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCodeAction,
    initialVerifyState,
  );

  const sentState =
    requestState.status === "sent" ? requestState : resendState.status === "sent" ? resendState : null;
  const sendError =
    resendState.status === "error"
      ? resendState
      : requestState.status === "error"
        ? requestState
        : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to practise</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No password needed — we&apos;ll send you a one-time code by email.
        </p>
      </div>

      {sentState ? (
        <form action={verifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={sentState.email} />
          <label className="flex flex-col gap-2" htmlFor="code">
            <span className="text-sm font-medium">Your one-time code</span>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              className="h-11 rounded-lg border border-black/10 px-3 dark:border-white/15"
            />
          </label>

          {sentState.code && (
            <p className="text-xs text-zinc-500">
              No mail server is configured here, so your code is:{" "}
              <span className="font-mono font-semibold">{sentState.code}</span>
            </p>
          )}

          {verifyState.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {verifyErrorMessage(verifyState.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={verifyPending}
            className="h-11 rounded-full bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {verifyPending ? "Checking…" : "Sign in"}
          </button>
          <Link
            href="/sign-in"
            className="text-center text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Start over
          </Link>
        </form>
      ) : sendError?.status === "error" && sendError.error === "send-failed" ? (
        <form action={resendAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={sendError.email ?? ""} />
          <p className="text-sm text-red-600 dark:text-red-400">
            {requestErrorMessage(sendError.error)}
          </p>
          <button
            type="submit"
            disabled={resendPending}
            className="h-11 rounded-full bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {resendPending ? "Sending…" : "Try again"}
          </button>
        </form>
      ) : (
        <form action={requestAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2" htmlFor="email">
            <span className="text-sm font-medium">Email address</span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              className="h-11 rounded-lg border border-black/10 px-3 dark:border-white/15"
            />
          </label>

          {sendError?.status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {requestErrorMessage(sendError.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={requestPending}
            className="h-11 rounded-full bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {requestPending ? "Sending…" : "Send code"}
          </button>
        </form>
      )}
    </main>
  );
}