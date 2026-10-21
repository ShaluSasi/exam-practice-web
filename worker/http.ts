export interface Env {
  /** OAuth 2.0 Web client ID from Google Cloud Console. Public. */
  GOOGLE_CLIENT_ID: string;
  /** Random string used to sign session cookies. Keep secret. */
  SESSION_SECRET: string;
  /** Accounts and saved scores. Schema: migrations/*.sql */
  DB: D1Database;
  /** The built React app (static assets). */
  ASSETS: Fetcher;
  /** Oldest app build (app-version.json) still supported. Older apps are asked to update. */
  MIN_APP_BUILD: string;
}

/**
 * Where the Android app's pages run: Capacitor serves them from the phone, so
 * its API calls are cross-origin. They carry the session as a bearer token
 * instead of the cookie.
 */
export const APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

export const isAppOrigin = (request: Request) => APP_ORIGINS.includes(request.headers.get("Origin") ?? "");

/** Lets the app read API responses. */
export function withCors(request: Request, response: Response): Response {
  if (!isAppOrigin(request)) return response;
  const res = new Response(response.body, response);
  res.headers.set("Access-Control-Allow-Origin", request.headers.get("Origin")!);
  res.headers.append("Vary", "Origin");
  return res;
}

/** Answers the browser's CORS preflight for the app. */
export function preflight(request: Request): Response {
  if (!isAppOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("Origin")!,
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Build",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Blocks cross-site form posts: browsers always send Origin on POST. The app's origin is allowed too. */
export function assertSameOrigin(request: Request, url: URL): void {
  if (request.headers.get("Origin") !== url.origin && !isAppOrigin(request)) throw new HttpError(403, "Bad origin");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function json(data: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(data, { headers: { "Cache-Control": "no-store", ...headers } });
}

export function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bytesFromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function textFromB64url(s: string): string {
  return new TextDecoder().decode(bytesFromB64url(s));
}
