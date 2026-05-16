/**
 * LiveKit token API – matches AI-GF token_server.
 * GET /api/token?room=ROOM&identity=USER returns { token, url }.
 * GET /api/credentials returns contents of credentials.json (dev).
 */

export interface LiveKitTokenResponse {
  token: string;
  url: string;
}

const DEFAULT_ROOM = "voice-room";

/**
 * Fetch pre-written credentials from FastAPI (credentials.json in dev).
 * Returns { token, url } or throws if not available.
 */
export async function fetchLiveKitCredentials(
  baseUrl: string
): Promise<LiveKitTokenResponse> {
  const url = new URL("/api/credentials", baseUrl.replace(/\/$/, ""));
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    if (res.status === 404) throw new Error("credentials.json not found");
    const text = await res.text();
    throw new Error(`Credentials API error ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as LiveKitTokenResponse;
  if (!data.token || !data.url) throw new Error("Credentials missing token or url");
  return data;
}

/**
 * Fetch a LiveKit JWT and server URL from token API (GET /api/token).
 */
export async function fetchLiveKitToken(
  baseUrl: string,
  room: string = DEFAULT_ROOM,
  identity: string = "user"
): Promise<LiveKitTokenResponse> {
  const url = new URL("/api/token", baseUrl.replace(/\/$/, ""));
  url.searchParams.set("room", room);
  url.searchParams.set("identity", identity);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token API error ${res.status}: ${text || res.statusText}`);
  }
  const data = (await res.json()) as LiveKitTokenResponse;
  if (!data.token || !data.url) throw new Error("Token API did not return token and url");
  return data;
}

/**
 * Get connection info: try /api/credentials first (dev), then /api/token.
 */
export async function fetchLiveKitConnection(
  baseUrl: string,
  room: string = DEFAULT_ROOM,
  identity: string = "user"
): Promise<LiveKitTokenResponse> {
  try {
    return await fetchLiveKitCredentials(baseUrl);
  } catch {
    return fetchLiveKitToken(baseUrl, room, identity);
  }
}

export { DEFAULT_ROOM };
