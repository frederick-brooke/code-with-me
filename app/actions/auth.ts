"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authEngine, SESSION_COOKIE } from "@/lib/auth";
import { clearSessionCookie, createSessionCookie } from "@/lib/auth/session";
import type { RequestCodeError, VerifyCodeError } from "@/lib/auth/types";

export type RequestCodeActionState =
  | { status: "start" }
  | { status: "sent"; email: string; code: string }
  | { status: "error"; error: RequestCodeError };

export async function requestCodeAction(
  _prev: RequestCodeActionState,
  formData: FormData,
): Promise<RequestCodeActionState> {
  const email = String(formData.get("email") ?? "");
  const result = await authEngine.requestCode(email);

  if (!result.ok) {
    return { status: "error", error: result.error };
  }

  return { status: "sent", email: result.email, code: result.code };
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