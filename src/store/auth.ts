import { create } from "zustand";

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

/** Calls our API: GET without a body, POST (JSON) with one. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data;
}

export const useAuth = create<AuthState>()((set) => ({
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
      if (user) set({ status: "signedIn", user, clientId, canImport: !!canImport });
      else set({ status: clientId ? "signedOut" : "unavailable", user: null, clientId });
    } catch {
      set({ status: "unavailable", user: null });
    }
  },

  signInWithCredential: async (credential) => {
    set({ error: null });
    try {
      const { user, canImport } = await api<{ user: User; canImport: boolean }>("/api/auth/google", { credential });
      set({ status: "signedIn", user, canImport });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Sign-in failed" });
    }
  },

  signOut: async () => {
    await api("/api/auth/logout", {}).catch(() => undefined);
    window.google?.accounts.id.disableAutoSelect();
    set((s) => ({ status: s.clientId ? "signedOut" : "unavailable", user: null, canImport: false }));
  },
}));

/** Session ended on the server (expired cookie): show the sign-in button again. */
export function markSignedOut() {
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
