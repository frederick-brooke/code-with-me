"use server";

import { redirect } from "next/navigation";
import { getCachedCurrentCandidate } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { launchSession } from "@/lib/engine/launch";

export async function launchSessionAction(formData: FormData): Promise<void> {
  const candidate = await getCachedCurrentCandidate();
  if (!candidate) {
    redirect("/sign-in");
  }

  const problemId = String(formData.get("problemId") ?? "");
  const session = await launchSession(await getDataStore(), {
    candidateId: candidate.id,
    problemId,
  });
  redirect(`/interview/${session.id}`);
}