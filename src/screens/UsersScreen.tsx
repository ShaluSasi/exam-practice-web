import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Download, Search, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";
import type { AdminUser, AdminUsers } from "../content/api";
import { region } from "../config/regions";
import { Avatar } from "../components/Account";
import { Chip, Header, Problem, Spinner, formatDate } from "../components/AdminParts";
import { Button } from "../components/Button";
import { addDays, dayOf } from "../lib/day";
import { api } from "../store/auth";
import { useNav } from "../store/nav";

type Preset = "today" | "yesterday" | "week" | "month" | "thisMonth" | "all" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Pick dates" },
];

/** The days a preset covers, India time; null for all time. */
function rangeOf(preset: Exclude<Preset, "custom">): { from: string; to: string } | null {
  const today = dayOf(Date.now());
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: addDays(today, -29), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "all":
      return null;
  }
}

type Sort = "lastSeen" | "name" | "days" | "visits" | "rounds" | "joined";
const SORTS: { id: Sort; label: string; compare: (a: AdminUser, b: AdminUser) => number }[] = [
  { id: "lastSeen", label: "Last seen", compare: (a, b) => b.lastSeenAt - a.lastSeenAt },
  { id: "joined", label: "Newest accounts", compare: (a, b) => b.joinedAt - a.joinedAt },
  { id: "days", label: "Most days active", compare: (a, b) => b.days - a.days || b.lastSeenAt - a.lastSeenAt },
  { id: "visits", label: "Most visits", compare: (a, b) => b.visits - a.visits || b.lastSeenAt - a.lastSeenAt },
  { id: "rounds", label: "Most rounds", compare: (a, b) => b.rounds - a.rounds || b.lastSeenAt - a.lastSeenAt },
  { id: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
];

// ---------- Filters kept on this device ----------

const STORE_KEY = "prepquest-admin-users";

interface Saved {
  preset: Preset;
  from: string;
  to: string;
  exclude: string[];
  hideAdmins: boolean;
}

function loadSaved(): Saved {
  const today = dayOf(Date.now());
  const fallback: Saved = { preset: "week", from: addDays(today, -6), to: today, exclude: [], hideAdmins: true };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Partial<Saved> | null;
    if (!s || typeof s !== "object") return fallback;
    return {
      preset: PRESETS.some((p) => p.id === s.preset) ? s.preset! : fallback.preset,
      from: typeof s.from === "string" ? s.from : fallback.from,
      to: typeof s.to === "string" ? s.to : fallback.to,
      exclude: Array.isArray(s.exclude) ? s.exclude.filter((e): e is string => typeof e === "string") : [],
      hideAdmins: typeof s.hideAdmins === "boolean" ? s.hideAdmins : true,
    };
  } catch {
    return fallback;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // No storage: the filters just aren't remembered.
  }
}

/** Emails or "@domain" entries typed into the exclude box. */
const parseEntries = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length > 1);

// ---------- Display ----------

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-surface px-4 py-3">
      <p className="font-display text-2xl font-extrabold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs font-bold text-muted">{label}</p>
    </div>
  );
}

function UserRow({ user, onExclude }: { user: AdminUser; onExclude: (email: string) => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 border-line bg-surface p-4">
      <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
        <Avatar name={user.name} picture={user.picture} size="size-10" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-display font-bold">
            <span className="truncate">{user.name}</span>
            {user.role !== "student" && (
              <span title={user.role} className="shrink-0 text-brand">
                <ShieldCheck className="size-4" aria-label={user.role} />
              </span>
            )}
          </p>
          <p className="truncate text-sm text-muted [overflow-wrap:anywhere]">{user.email}</p>
        </div>
      </div>
      <div className="flex flex-[2_1_20rem] flex-wrap items-center gap-1.5">
        <Chip className="bg-brand-soft text-brand">Last seen {dateTime(user.lastSeenAt)}</Chip>
        <Chip>
          {user.days} day{user.days === 1 ? "" : "s"}
        </Chip>
        <Chip>
          {user.visits} visit{user.visits === 1 ? "" : "s"}
        </Chip>
        {user.signIns > 0 && (
          <Chip>
            {user.signIns} sign-in{user.signIns === 1 ? "" : "s"}
          </Chip>
        )}
        <Chip>
          {user.rounds} round{user.rounds === 1 ? "" : "s"}
        </Chip>
        {user.grade != null && <Chip>{region.gradeLabel(user.grade)}</Chip>}
        <Chip>Joined {formatDate(user.joinedAt)}</Chip>
      </div>
      <button
        type="button"
        onClick={() => onExclude(user.email)}
        title="Leave this email out of the list"
        className="ml-auto rounded-xl px-2.5 py-1.5 text-xs font-bold text-muted hover:bg-surface-2 hover:text-fg"
      >
        Exclude
      </button>
    </li>
  );
}

function downloadCsv(users: AdminUser[], name: string) {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    // A leading = + - @ would run as a formula in a spreadsheet.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Name", "Email", "Role", "Class", "Joined", "Last seen", "Days active", "Visits", "Sign-ins", "Rounds"];
  const lines = users.map((u) =>
    [u.name, u.email, u.role, u.grade, new Date(u.joinedAt).toISOString(), new Date(u.lastSeenAt).toISOString(), u.days, u.visits, u.signIns, u.rounds]
      .map(cell)
      .join(","),
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Screen ----------

export function UsersScreen() {
  const go = useNav((s) => s.go);
  const [saved] = useState(loadSaved);
  const [preset, setPreset] = useState<Preset>(saved.preset);
  const [from, setFrom] = useState(saved.from);
  const [to, setTo] = useState(saved.to);
  const [exclude, setExclude] = useState<string[]>(saved.exclude);
  const [hideAdmins, setHideAdmins] = useState(saved.hideAdmins);
  const [excludeText, setExcludeText] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("lastSeen");
  const [data, setData] = useState<AdminUsers | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const requestNo = useRef(0);

  // The days asked for: a preset's, or the picked ones.
  const range = preset === "custom" ? (from && to ? { from: from <= to ? from : to, to: from <= to ? to : from } : null) : rangeOf(preset);
  const query = new URLSearchParams({
    ...(range ? range : {}),
    ...(exclude.length ? { exclude: exclude.join(",") } : {}),
    ...(hideAdmins ? { admins: "0" } : {}),
  }).toString();

  useEffect(() => save({ preset, from, to, exclude, hideAdmins }), [preset, from, to, exclude, hideAdmins]);

  useEffect(() => {
    const no = ++requestNo.current;
    setProblem(null);
    setData(null);
    api<AdminUsers>(`/api/admin/users?${query}`)
      .then((d) => no === requestNo.current && setData(d))
      .catch((e) => no === requestNo.current && setProblem(e instanceof Error ? e.message : "Could not load the users."));
  }, [query, reload]);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = q ? data.users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : data.users;
    return [...list].sort(SORTS.find((s) => s.id === sort)!.compare);
  }, [data, search, sort]);

  const totals = useMemo(
    () => shown.reduce((t, u) => ({ visits: t.visits + u.visits, rounds: t.rounds + u.rounds }), { visits: 0, rounds: 0 }),
    [shown],
  );

  const addExcluded = (entries: string[]) => {
    if (!entries.length) return;
    setExclude((list) => [...new Set([...list, ...entries])]);
  };

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = rangeOf(p);
      if (r) {
        setFrom(r.from);
        setTo(r.to);
      }
    }
  };

  const pickDate = (which: "from" | "to", value: string) => {
    setPreset("custom");
    if (which === "from") setFrom(value);
    else setTo(value);
  };

  const rangeText = range ? (range.from === range.to ? dayLabel(range.from) : `${dayLabel(range.from)} – ${dayLabel(range.to)}`) : "All time";
  const input = "rounded-xl border-2 border-line bg-bg px-3 py-2 text-base outline-none focus:border-brand";

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <Header title="Users" subtitle="Everyone who used the app, by day (India time)" onBack={() => go("admin")} />

        <section className="mb-5 grid gap-4 rounded-[24px] border-2 border-line bg-surface p-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Dates</p>
            <div role="radiogroup" aria-label="Dates" className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={preset === p.id}
                  onClick={() => choosePreset(p.id)}
                  className={clsx(
                    "rounded-full border-2 px-4 py-2 text-sm font-bold transition",
                    preset === p.id ? "border-fg bg-fg text-bg" : "border-line bg-bg hover:border-fg/30",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-bold">
                From
                <input type="date" value={from} max={to || undefined} onChange={(e) => pickDate("from", e.target.value)} className={input} />
              </label>
              <label className="grid gap-1 text-sm font-bold">
                To
                <input type="date" value={to} min={from || undefined} onChange={(e) => pickDate("to", e.target.value)} className={input} />
              </label>
              {preset === "custom" && from && (
                <Button variant="ghost" className="px-4 py-2 text-sm" onClick={() => setTo(from)}>
                  Just {dayLabel(from)}
                </Button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Leave out</p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addExcluded(parseEntries(excludeText));
                setExcludeText("");
              }}
            >
              <input
                type="text"
                value={excludeText}
                onChange={(e) => setExcludeText(e.target.value)}
                placeholder="Emails, or @domain.com for a whole domain"
                aria-label="Emails to leave out"
                className={clsx(input, "min-w-0 flex-[1_1_16rem]")}
              />
              <Button variant="ghost" className="px-4 py-2 text-sm" type="submit" disabled={!parseEntries(excludeText).length}>
                Exclude
              </Button>
            </form>
            {exclude.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {exclude.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs font-bold">
                    {e}
                    <button
                      type="button"
                      aria-label={`Include ${e} again`}
                      onClick={() => setExclude((list) => list.filter((x) => x !== e))}
                      className="grid size-5 place-items-center rounded-full text-muted hover:bg-line hover:text-fg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => setExclude([])} className="px-2 py-1 text-xs font-bold text-muted hover:text-fg">
                  Clear all
                </button>
              </div>
            )}
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={hideAdmins} onChange={(e) => setHideAdmins(e.target.checked)} className="size-5 accent-brand" />
              Leave out admin accounts
            </label>
          </div>
        </section>

        {problem ? (
          <Problem message={problem} onRetry={() => setReload((n) => n + 1)} />
        ) : !data ? (
          <Spinner />
        ) : (
          <>
            <p className="mb-2 text-sm font-bold text-muted">{rangeText}</p>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={search ? "Users shown" : "Users active"} value={shown.length} />
              <Stat label={range ? "New accounts" : "Accounts"} value={range ? data.newUsers : data.totalUsers} />
              <Stat label="Visits" value={totals.visits} />
              <Stat label="Rounds finished" value={totals.rounds} />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-[1_1_14rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search name or email"
                  className={clsx(input, "w-full pl-9")}
                />
              </label>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className={clsx(input, "font-bold")}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                className="px-4 py-2 text-sm"
                disabled={!shown.length}
                onClick={() => downloadCsv(shown, `users-${range ? `${range.from}_${range.to}` : "all"}.csv`)}
              >
                <Download className="size-4" /> CSV
              </Button>
            </div>

            {data.truncated && (
              <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">
                Only the {data.users.length.toLocaleString()} most recently seen users are listed. Pick fewer days to see the rest.
              </p>
            )}

            {shown.length === 0 ? (
              <p className="rounded-[24px] border-2 border-line bg-surface p-8 text-center font-semibold text-muted">No users for these filters.</p>
            ) : (
              <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-2">
                {shown.map((u) => (
                  <UserRow key={u.id} user={u} onExclude={(email) => addExcluded([email])} />
                ))}
              </motion.ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
