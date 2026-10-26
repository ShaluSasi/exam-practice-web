/**
 * Sign-in flow: the browser gets a Google ID token from Google Identity
 * Services, posts it here, we verify it against Google's public keys, save
 * the account in D1 and set our own signed, HttpOnly session cookie.
 * No Google client secret is needed.
 *
 * The Android app gets its ID token from Android's Credential Manager instead
 * (still issued for our web client ID), and gets the session as a token it
 * sends in an `Authorization: Bearer` header.
 */
import { HttpError, assertSameOrigin, b64url, bytesFromB64url, isAppOrigin, json, readJson, textFromB64url, type Env } from "./http";

export type Role = "student" | "teacher" | "admin";

/** What the signed session cookie carries. Role is not cached here: it is read from D1. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

interface Session extends SessionUser {
  exp: number;
}

const COOKIE = "pq_session";
const SESSION_DAYS = 30;
const GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/** The account's role: listed admin emails (ADMIN_EMAILS) are admins whatever D1 says. */
function roleOf(env: Env, email: string, stored: Role | undefined): Role {
  const admins = (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase()) ? "admin" : (stored ?? "student");
}

export async function signIn(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) throw new HttpError(503, "Google sign-in is not configured");
  assertSameOrigin(request, url);

  const body = (await readJson(request)) as { credential?: unknown } | null;
  if (typeof body?.credential !== "string") throw new HttpError(400, "Missing credential");

  const claims = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID);
  if (!claims) throw new HttpError(401, "Invalid Google sign-in");

  const user: SessionUser = {
    id: claims.sub,
    email: claims.email.toLowerCase(),
    // No name from Google: use the part before the @, never the whole address (names are shown to other students).
    name: claims.name || claims.email.split("@")[0] || "Student",
    picture: claims.picture ?? null,
  };
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO users (id, email, name, picture, created_at, last_login_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT (id) DO UPDATE SET email = ?2, name = ?3, picture = ?4, last_login_at = ?5
     RETURNING role, imported_at`,
  )
    .bind(user.id, user.email, user.name, user.picture, now)
    .first<{ role: Role; imported_at: number | null }>();

  const maxAge = SESSION_DAYS * 86400;
  const token = await signSession({ ...user, exp: Math.floor(now / 1000) + maxAge }, env.SESSION_SECRET);
  const result = { user: { ...user, role: roleOf(env, user.email, row?.role) }, canImport: row?.imported_at == null };
  // The app can't use our cookie (its pages are on another origin), so it keeps the token and sends it back.
  // The website never sees the token: the cookie stays HttpOnly.
  if (isAppOrigin(request)) return json({ ...result, token });
  return json(result, { "Set-Cookie": cookie(token, maxAge, url) });
}

export async function me(request: Request, env: Env, url: URL): Promise<Response> {
  const session = await readSession(request, env);
  if (!session) return json({ user: null });
  const row = await env.DB.prepare("SELECT role, imported_at FROM users WHERE id = ?")
    .bind(session.id)
    .first<{ role: Role; imported_at: number | null }>();
  // Cookie from before the account was saved (or a wiped database): sign in again. Clear the cookie
  // too, or every later request still carries a user id that saving progress would fail on.
  if (!row) return json({ user: null }, { "Set-Cookie": cookie("", 0, url) });
  return json({ user: { ...session, role: roleOf(env, session.email, row.role) }, canImport: row.imported_at == null });
}

export function signOut(request: Request, url: URL): Response {
  assertSameOrigin(request, url);
  return json({ ok: true }, { "Set-Cookie": cookie("", 0, url) });
}

/** The signed-in user, or null for a guest. */
export function optionalUser(request: Request, env: Env): Promise<SessionUser | null> {
  return readSession(request, env);
}

/** The signed-in user, or a 401. */
export async function requireUser(request: Request, env: Env): Promise<SessionUser> {
  const user = await readSession(request, env);
  if (!user) throw new HttpError(401, "Please sign in");
  return user;
}

/**
 * The signed-in user if their role is one of `roles`, else 403.
 * e.g. `requireRole(request, env, ["teacher", "admin"])`.
 */
export async function requireRole(request: Request, env: Env, roles: Role[]): Promise<SessionUser & { role: Role }> {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(user.id).first<{ role: Role }>();
  if (!row) throw new HttpError(403, "Not allowed");
  const role = roleOf(env, user.email, row.role);
  if (!roles.includes(role)) throw new HttpError(403, "Not allowed");
  return { ...user, role };
}

// ---------- Google ID token verification ----------

interface GoogleClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

let certCache: { keys: (JsonWebKey & { kid?: string })[]; until: number } | null = null;

async function googleKeys(): Promise<(JsonWebKey & { kid?: string })[]> {
  if (certCache && certCache.until > Date.now()) return certCache.keys;
  const res = await fetch(GOOGLE_CERTS);
  if (!res.ok) throw new Error(`Google certs fetch failed: ${res.status}`);
  const { keys } = await res.json<{ keys: (JsonWebKey & { kid?: string })[] }>();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("Cache-Control") ?? "")?.[1] ?? 3600);
  certCache = { keys, until: Date.now() + maxAge * 1000 };
  return keys;
}

async function verifyGoogleIdToken(token: string, clientId: string): Promise<GoogleClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let header: { alg?: string; kid?: string };
  let claims: GoogleClaims;
  try {
    header = JSON.parse(textFromB64url(h));
    claims = JSON.parse(textFromB64url(p));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) return null;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    sig = bytesFromB64url(s);
  } catch {
    return null;
  }
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.includes(claims.iss)) return null;
  if (claims.aud !== clientId) return null;
  if (!(claims.exp > now)) return null;
  if (!claims.email || !claims.email_verified) return null;
  return claims;
}

// ---------- Session cookie (HMAC-SHA256 signed) ----------

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function signSession(session: Session, secret: string): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

async function readSession(request: Request, env: Env): Promise<SessionUser | null> {
  if (!env.SESSION_SECRET) return null;
  // The app sends the same signed token as a bearer token; the website sends the cookie.
  const raw =
    /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "")?.[1] ??
    request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(env.SESSION_SECRET),
      bytesFromB64url(sig),
      new TextEncoder().encode(payload),
    );
    if (!ok) return null;
    const { exp, ...user } = JSON.parse(textFromB64url(payload)) as Session;
    return exp > Date.now() / 1000 ? user : null;
  } catch {
    return null;
  }
}

function cookie(value: string, maxAge: number, url: URL): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
