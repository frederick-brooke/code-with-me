import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthEngine, SESSION_COOKIE } from "@/lib/auth";
import { DEFAULT_SESSION_TTL_MS } from "@/lib/auth/engine";
import type { Candidate } from "@/lib/auth/types";

const SESSION_TTL_SECONDS = Math.floor(DEFAULT_SESSION_TTL_MS / 1000);

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
  return getAuthEngine().getCandidate(token);
}

export const getCachedCurrentCandidate = cache(getCurrentCandidate);