/**
 * Calendar days in India time (UTC+5:30, no daylight saving), as "YYYY-MM-DD".
 * The admin Users page (worker/users.ts) files and filters visits by these days,
 * so a day means the same on the server and on any admin's device.
 */
const OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The India-time day `ms` falls on. */
export const dayOf = (ms: number): string => new Date(ms + OFFSET_MS).toISOString().slice(0, 10);

/** When an India-time day starts, in ms. */
export const dayStart = (day: string): number => Date.parse(`${day}T00:00:00Z`) - OFFSET_MS;

/** The day `n` days after `day` (before, if negative). */
export const addDays = (day: string, n: number): string => dayOf(dayStart(day) + n * DAY_MS);
