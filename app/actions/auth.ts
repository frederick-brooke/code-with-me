"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authEngine, SESSION_COOKIE } from "@/lib/auth";
import { clearSessionCookie, createSessionCookie } from "@/lib/auth/session";
import { isMailConfigured, loginCodeSender } from "@/lib/mail";
import type { RequestCodeError, VerifyCodeError } from "@/lib/auth/types";

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type RequestCodeActionState =
  | { status: "start" }
  | {
      status: "error";
      error: RequestCodeError | "send-failed" | "no-active-code";
      email?: string;
    }
  | { status: "sent"; email: string; code?: string };

async function sendOrSurface(email: string, code: string): Promise<RequestCodeActionState> {
  try {
    const magicLink = `${APP_URL}/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    await loginCodeSender.sendLoginCode({ to: email, code, magicLink });
  } catch (error) {
    console.error("Failed to send login code", error);
    return { status: "error", error: "send-failed", email };
  }

  // No mail key configured (local dev): surface the code on screen instead.
  const visibleCode = isMailConfigured ? undefined : code;
  return { status: "sent", email, code: visibleCode };
}

export async function requestCodeAction(
  _prev: RequestCodeActionState,
  formData: FormData,
): Promise<RequestCodeActionState> {
  const email = String(formData.get("email") ?? "");
  const result = await authEngine.requestCode(email);

  if (!result.ok) {
    return { status: "error", error: result.error };
  }

  return sendOrSurface(result.email, result.code);
}

export async function resendCodeAction(
  _prev: RequestCodeActionState,
  formData: FormData,
): Promise<RequestCodeActionState> {
  const email = String(formData.get("email") ?? "");
  const pending = await authEngine.getPendingCode(email);

  if (!pending) {
    return { status: "error", error: "no-active-code" };
  }

  return sendOrSurface(pending.email, pending.code);
}

export type VerifyCodeActionState =
  | { status: "idle" }
  | { status: "error"; error: VerifyCodeError };

export async function verifyCodeAction(
  _prev: VerifyCodeActionState,
  formData: FormData,
): Promise<VerifyCodeActionState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");

  const result = await authEngine.verifyCode(email, code);
  if (!result.ok) {
    return { status: "error", error: result.error };
  }

  await createSessionCookie(result.token);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await authEngine.signOut(token);
  }
  await clearSessionCookie();
  redirect("/");
}