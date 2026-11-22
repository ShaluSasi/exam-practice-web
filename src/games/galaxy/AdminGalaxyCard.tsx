import { Gem, Rocket } from "lucide-react";
import clsx from "clsx";
import type { AdminGalaxy } from "../../content/api";
import { formatDate } from "../../components/AdminParts";
import { BADGES, LASERS, UPGRADES, rankOf, type SavedGalaxy, type UpgradeId } from "./progress";
import { isSectionId, maxLevel, sectionOf } from "./sections";

const n = (v: number) => v.toLocaleString("en-IN");
const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const missionName = (id: string) => (isSectionId(id) ? `${sectionOf(id).symbol} ${sectionOf(id).name}` : id);
const pct = (right: number, total: number) => (total ? `${Math.round((right / total) * 100)}%` : "–");

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <p className="font-display text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

/** Admins' view of a student's Galaxy Guardian: saved progress, each mission's best and the latest runs. */
export function AdminGalaxyCard({ galaxy }: { galaxy: AdminGalaxy }) {
  const state = galaxy.state as SavedGalaxy | null;
  const played = galaxy.sections.length > 0 || (state?.lifetime.runs ?? 0) > 0;
  const rank = rankOf(state?.lifetime.score ?? 0);
  const runs = state?.lifetime.runs ?? galaxy.sections.reduce((t, s) => t + s.plays, 0);
  const correct = galaxy.sections.reduce((t, s) => t + s.correct, 0);
  const answered = galaxy.sections.reduce((t, s) => t + s.answered, 0);
  // Missions from the scoreboard runs, plus any only in the saved progress (e.g. runs that scored nothing).
  const missions = [
    // A run that couldn't reach the scoreboard (e.g. before signing in) can still be the saved best.
    ...galaxy.sections.map((s) => {
      const rec = state?.sections[s.section as keyof SavedGalaxy["sections"]];
      return rec ? { ...s, best: Math.max(s.best, rec.best), bestLevel: Math.max(s.bestLevel, rec.bestLevel) } : s;
    }),
    ...Object.entries(state?.sections ?? {})
      .filter(([id]) => !galaxy.sections.some((s) => s.section === id))
      .map(([id, rec]) => ({ section: id, best: rec?.best ?? 0, bestLevel: rec?.bestLevel ?? 0, bestWave: 0, plays: rec?.plays ?? 0, correct: 0, answered: 0, lastAt: 0 })),
  ];

  return (
    <section className="mt-4 rounded-[24px] border-2 border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          <Rocket className="size-5 text-brand" /> Galaxy Guardian
        </h2>
        <span className="text-xs font-semibold text-muted">
          {galaxy.savedAt ? `Progress saved ${dateTime(galaxy.savedAt)}` : played ? "Progress not saved to the account yet" : ""}
        </span>
      </div>

      {!played ? (
        <p className="py-6 text-center text-sm text-muted">Hasn't played Galaxy Guardian while signed in yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="Rank" value={state ? rank.name : "–"} />
            <Tile label="Runs" value={n(runs)} />
            <Tile label="Total score" value={state ? n(state.lifetime.score) : "–"} />
            <Tile label="Best wave" value={state?.lifetime.bestWave ?? Math.max(0, ...galaxy.sections.map((s) => s.bestWave))} />
            <Tile label="Accuracy" value={pct(correct, answered)} />
            <Tile
              label="Stardust"
              value={
                state ? (
                  <span className="inline-flex items-center gap-1">
                    <Gem className="size-4 text-brand" />
                    {n(state.stardust)}
                  </span>
                ) : (
                  "–"
                )
              }
            />
          </div>

          {state && (
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="font-bold">Badges ({state.badges.length}/{BADGES.length}): </span>
                <span className="text-muted">{state.badges.length ? BADGES.filter((b) => state.badges.includes(b.id)).map((b) => b.name).join(", ") : "none yet"}</span>
              </p>
              <p>
                <span className="font-bold">Upgrades: </span>
                <span className="text-muted">
                  {(Object.keys(UPGRADES) as UpgradeId[]).map((u) => `${UPGRADES[u].name} ${state.upgrades[u] ?? 0}/${UPGRADES[u].costs.length}`).join(" · ")}
                </span>
              </p>
              <p>
                <span className="font-bold">Lasers: </span>
                <span className="text-muted">
                  {LASERS.filter((l) => state.owned.includes(l.id))
                    .map((l) => (l.id === state.laser ? `${l.name} (in use)` : l.name))
                    .join(", ")}
                </span>
              </p>
              <p>
                <span className="font-bold">Best combo: </span>
                <span className="text-muted">
                  {state.lifetime.bestCombo} · {n(state.lifetime.bosses)} motherships · {n(state.lifetime.asteroids)} asteroids
                </span>
              </p>
            </div>
          )}

          {missions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Missions</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {missions.map((m) => {
                  const top = isSectionId(m.section) ? maxLevel(m.section) : 0;
                  return (
                    <li key={m.section} className="rounded-2xl border-2 border-line bg-bg p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display font-extrabold">{missionName(m.section)}</span>
                        <span className="text-xs font-semibold text-muted">{m.lastAt ? dateTime(m.lastAt) : ""}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className={clsx("block h-full rounded-full", top && m.bestLevel >= top ? "bg-ok" : "bg-brand")}
                            style={{ width: `${top ? Math.min(100, (m.bestLevel / top) * 100) : 0}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          Level {m.bestLevel}
                          {top ? `/${top}` : ""}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        Best {n(m.best)}
                        {m.bestWave ? ` · wave ${m.bestWave}` : ""} · {m.plays} run{m.plays === 1 ? "" : "s"}
                        {m.answered ? ` · ${pct(m.correct, m.answered)} right` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {galaxy.recent.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Latest runs</p>
              <ul className="divide-y-2 divide-line rounded-2xl border-2 border-line">
                {galaxy.recent.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="w-28 shrink-0 text-xs font-semibold text-muted">{formatDate(r.at)}</span>
                    <span className="min-w-0 flex-1 font-semibold">{missionName(r.section)}</span>
                    <span className="text-xs text-muted">
                      Wave {r.wave} · L{r.level} · {r.correct}/{r.answered} right
                    </span>
                    <span className="w-20 text-right font-display font-extrabold tabular-nums">{n(r.score)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
