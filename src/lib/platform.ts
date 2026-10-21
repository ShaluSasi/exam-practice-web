import { Capacitor } from "@capacitor/core";

/** True inside the Android app, false on the website. */
export const isNative = Capacitor.isNativePlatform();

/**
 * The live website, which also serves the API, questions and images. On the
 * website it is this page's own origin; the app's pages are served from the
 * phone, so it calls the site set at build time (.env.android).
 */
export const SITE_ORIGIN = isNative ? (import.meta.env.VITE_SERVER_URL ?? "") : window.location.origin;

/** Prefix for API calls: relative on the website, the live site from the app. */
export const API_ORIGIN = isNative ? SITE_ORIGIN : "";

/** This build's number (app-version.json). The server asks older builds to update. */
export const APP_BUILD = __APP_BUILD__;

export const STORE_URL = "https://play.google.com/store/apps/details?id=com.prepquest.app";
