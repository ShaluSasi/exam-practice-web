/**
 * Wraps `task` so it runs one at a time per id. A call made while a run for
 * the same id is in progress waits for it, then runs again, so work queued
 * meanwhile is always picked up. Different ids run independently.
 */
export function serialized(task: (id: string) => Promise<void>): (id: string) => Promise<void> {
  const running = new Map<string, Promise<void>>();
  return async (id) => {
    while (running.has(id)) await running.get(id)!.catch(() => undefined);
    const done = task(id);
    running.set(id, done);
    try {
      await done;
    } finally {
      if (running.get(id) === done) running.delete(id);
    }
  };
}
