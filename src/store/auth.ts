import { create } from "zustand";
import { API_ORIGIN, APP_BUILD, isNative } from "../lib/platform";
import { useConnection } from "./connection";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: "student" | "teacher" | "admin";
}

/**
 * - `loading`: checking the session cookie.
 * - `unavailable`: Google sign-in is not configured (or the API is down); the
 *   app keeps working as a guest and hides the sign-in UI.
 */
type Status = "loading" | "unavailable" | "signedOut" | "signedIn";

interface AuthState {
  status: Status;
  user: User | null;
  clientId: string | null;
  /** True until this account's first sign-in has copied in the device's guest scores. */
  canImport: boolean;
  error: string | null;
  init: () => Promise<void>;
  signInWithCredential: (credential: string) => Promise<void>;
  /** The app: Google sign-in through Android (Google blocks its web sign-in inside apps). */
  signInNative: () => Promise<void>;
  signOut: () => Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** `ApiError` status when the server could not be reached at all. */
export const OFFLINE = 0;

/** A stalled mobile connection must not leave a spinner forever. */
const TIMEOUT_MS = 20_000;

/** The app keeps its session token here (the website uses an HttpOnly cookie instead). */
const TOKEN_KEY = "prepquest-session";

function sessionToken(): string | null {
  try {
    return isNative ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the app stays signed in until it is closed.
  }
}

/** Calls our API: GET without a body, POST (JSON) with one. Fails with status `OFFLINE` when unreachable. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const token = sessionToken();
  let res: Response;
  try {
    res = await fetch(API_ORIGIN + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "X-App-Build": String(APP_BUILD),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: isNative ? "omit" : "same-origin",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(OFFLINE, "You're offline. Check your internet connection.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 426) useConnection.setState({ updateRequired: true });
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data;
}

let nativeInitializedFor: string | null = null;

export const useAuth = create<AuthState>()((set, get) => ({
  status: "loading",
  user: null,
  clientId: null,
  canImport: false,
  error: null,

  init: async () => {
    try {
      const [{ clientId }, { user, canImport }] = await Promise.all([
        api<{ clientId: string | null }>("/api/auth/config"),
        api<{ user: User | null; canImport?: boolean }>("/api/auth/me"),
      ]);
      // Signed in while this check was on its way: its answer is older than the sign-in.
      if (get().user) return;
      if (user) set({ status: "signedIn", user, clientId, canImport: !!canImport });
      else {
        setSessionToken(null); // the app's token, if any, is no longer valid
        set({ status: clientId ? "signedOut" : "unavailable", user: null, clientId });
      }
    } catch {
      if (!get().user) set({ status: "unavailable", user: null });
    }
  },

  signInWithCredential: async (credential) => {
    set({ error: null });
    try {
      const { user, canImport, token } = await api<{ user: User; canImport: boolean; token?: string }>("/api/auth/google", {
        credential,
      });
      if (token) setSessionToken(token);
      set({ status: "signedIn", user, canImport });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Sign-in failed" });
    }
  },

  signInNative: async () => {
    const clientId = get().clientId;
    if (!clientId) return;
    set({ error: null });
    try {
      const { SocialLogin } = await import("@capgo/capacitor-social-login");
      if (nativeInitializedFor !== clientId) {
        await SocialLogin.initialize({ google: { webClientId: clientId } });
        nativeInitializedFor = clientId;
      }
      const { result } = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
      const idToken = "idToken" in result ? result.idToken : null;
      if (!idToken) throw new Error("Google sign-in failed");
      await get().signInWithCredential(idToken);
    } catch (e) {
      // Closing Google's account picker is not an error worth showing.
      const message = e instanceof Error ? e.message : "";
      if (!/cancel/i.test(message)) set({ error: message || "Google sign-in failed" });
    }
  },

  signOut: async () => {
    await api("/api/auth/logout", {}).catch(() => undefined);
    setSessionToken(null);
    if (isNative) {
      void import("@capgo/capacitor-social-login")
        .then(({ SocialLogin }) => SocialLogin.logout({ provider: "google" }))
        .catch(() => undefined);
    }
    window.google?.accounts.id.disableAutoSelect();
    set((s) => ({ status: s.clientId ? "signedOut" : "unavailable", user: null, canImport: false }));
  },
}));

/** Session ended on the server (expired cookie or token): show the sign-in button again. */
export function markSignedOut() {
  setSessionToken(null);
  useAuth.setState((s) => ({ status: s.clientId ? "signedOut" : "unavailable", user: null, canImport: false }));
}

// ---------- Google Identity Services loader ----------

interface GsiButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            ux_mode?: "popup" | "redirect";
            use_fedcm_for_button?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<NonNullable<Window["google"]>> | null = null;
let initializedFor: string | null = null;

/** Loads Google's sign-in script once and initialises it for our client ID. */
export function loadGoogle(clientId: string) {
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error("Google script failed")));
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return gsiPromise.then((google) => {
    if (initializedFor !== clientId) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => void useAuth.getState().signInWithCredential(credential),
        ux_mode: "popup",
        use_fedcm_for_button: true,
      });
      initializedFor = clientId;
    }
    return google;
  });
}

export type { GsiButtonOptions };
