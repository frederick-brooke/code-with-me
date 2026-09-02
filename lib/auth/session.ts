import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { authEngine, SESSION_COOKIE } from "@/lib/auth";
import type { Candidate } from "@/lib/auth/types";

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function createSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentCandidate(): Promise<Candidate | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return authEngine.getCandidate(token);
}

export const getCachedCurrentCandidate = cache(getCurrentCandidate);