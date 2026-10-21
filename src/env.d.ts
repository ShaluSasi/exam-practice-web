/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Android app only (.env.android): the live site, e.g. https://exam-practice.example.workers.dev */
  readonly VITE_SERVER_URL?: string;
}

/** This build's number from app-version.json (vite.config.ts). */
declare const __APP_BUILD__: number;
