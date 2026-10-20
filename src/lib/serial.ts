/**
 * Wraps `task` so it runs one at a time per id. A call made while a run for
 * the same id is in progress waits for it, then runs again, so work queued
 * meanwhile is always picked up.
 */
export function serialized(task: (id: string) => Promise<void>): (id: string) => Promise<void> {
  let running: { id: string; done: Promise<void> } | null = null;
  return async (id) => {
    while (running?.id === id) await running.done.catch(() => undefined);
    const run = { id, done: task(id) };
    running = run;
    try {
      await run.done;
    } finally {
      if (running === run) running = null;
    }
  };
}
