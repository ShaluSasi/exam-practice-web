import { create } from "zustand";

/** App-wide connection state, set by API calls (store/auth.ts `api`). */
interface ConnectionState {
  /** The server no longer supports this build (HTTP 426 or /api/config). */
  updateRequired: boolean;
}

export const useConnection = create<ConnectionState>()(() => ({ updateRequired: false }));
