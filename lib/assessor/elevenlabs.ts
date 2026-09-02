const ELEVENLABS_SIGNED_URL_ENDPOINT =
  "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url";

/**
 * Requests a short-lived WebSocket URL from ElevenLabs so a Candidate can start
 * a conversation with the managed Assessor without the API key leaving the server.
 */
export async function requestAssessorSignedUrl({
  apiKey,
  agentId,
  fetchImpl = fetch,
}: {
  apiKey: string;
  agentId: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const url = `${ELEVENLABS_SIGNED_URL_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`;
  const response = await fetchImpl(url, {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: HTTP ${response.status}`);
  }

  const body = (await response.json()) as { signed_url?: string };
  if (typeof body.signed_url !== "string" || body.signed_url.length === 0) {
    throw new Error("Missing signed_url in ElevenLabs response");
  }
  return body.signed_url;
}