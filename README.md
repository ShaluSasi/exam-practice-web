# PrepQuest — exam practice (prototype)

Interactive practice for CBSE Class 9–12. React + TypeScript + Vite, Tailwind CSS v4, Motion, KaTeX.
Deploys to Cloudflare Workers: static assets plus a small API Worker (`worker/`) for Google sign-in and saved scores (Cloudflare D1).

```bash
npm install
npm run db:migrate:local   # once, and after adding a migration
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run deploy     # build + wrangler deploy (run `npx wrangler login` once first)
```

## Where things live

| Path | What |
|---|---|
| `src/content/schema.ts` | Question schema (Zod). Real data must pass this. |
| `src/content/data/*.json` | Question banks, one chapter per file, picked up automatically and served by the Worker (never bundled into the app). Checked against the schema on every build and dev-server start (`vite.config.ts`). Chapters with 20+ questions get their own quiz card, ordered by `chapterNo`. |
| `worker/content.ts`, `worker/questions.ts` | Serves the banks: `/api/catalog`, `/api/questions` (without answers), `/api/answers/check`; grades saved rounds. |
| `src/store/content.ts` | The app's side: catalog, loading rounds, checking answers. |
| `public/img/<chapter>/` | Illustrations (mostly animated SVG) used by questions and answer options. |
| `src/config/regions.ts` | Per-market settings (IN / US / UK): grade labels, boards, subject names, A–R options. |
| `src/questions/` | One interactive renderer per question type. |
| `src/engine/scoring.ts` | Grading and XP rules (grading runs in the Worker). |
| `src/lib/platform.ts`, `app-version.json` | Website vs Android app, the live site address, and the build number shared by both. |
| `worker/` | API Worker: `auth.ts` (`/api/auth/*`, Google sign-in, session cookie, roles), `scores.ts` (`/api/scores*`), `progress.ts` (`/api/progress*`, unfinished rounds and answer log). |
| `migrations/*.sql` | D1 database schema (`users`, `rounds`, `active_rounds`, `answers`, `groups`, `group_members`, `shares`). |
| `worker/leaderboard.ts`, `worker/share.ts` | Leaderboard API (scopes and periods) and share links with link previews. |
| `src/store/auth.ts`, `src/components/Account.tsx` | Sign-in state, Google button and account menu. |
| `src/store/scoreSync.ts`, `src/store/profile.ts` | Guest scores on the device; signed-in scores saved to the server. |
| `src/store/progress.ts` | Saves the current round after every answer and resumes it. |
| `src/index.css` | Colour tokens for light and dark themes. Re-skin here. |

## Question types

`mcq`, `multi`, `assertion_reason`, `match`, `order`, `hotspot` (tap the diagram).

Students never type answers. Calculation questions are `mcq`, with wrong options built from common mistakes (skipped unit conversion, added instead of multiplied, and so on). The loader rejects `numeric` questions.

Text fields support `$inline maths$`, `$$display maths$$`, `\ce{...}` chemistry inside maths, `**bold**` and `*italic*`.

## Google sign-in

Optional: with no client ID set, the app runs as guest-only and hides the sign-in button.

- `GOOGLE_CLIENT_ID` (public): `vars` in `wrangler.jsonc`. Create an OAuth 2.0 **Web application** client in Google Cloud Console and add your site's origins (for local dev, `http://localhost:5173` and `http://localhost`) under *Authorised JavaScript origins*.
- `SESSION_SECRET` (secret, signs the session cookie): `.dev.vars` locally (copy `.dev.vars.example`), and `npx wrangler secret put SESSION_SECRET` for production.

The browser gets an ID token from Google, `POST /api/auth/google` verifies it against Google's public keys and sets an HttpOnly cookie. No Google client secret is used.

## Questions, answers and images are served live

Nothing is cached on the device, so a fix to a question, answer or image reaches every student on their next request once it is deployed (`npm run deploy`). Practice therefore needs a connection; the app shows an offline screen with *Try again* and retries by itself when the connection returns. Games still work offline.

- **Answers stay on the server.** Questions arrive without their answer, explanation or hotspot labels; `POST /api/answers/check` grades a choice and only then returns them.
- **Images** are requested from the live site (the Worker returns full URLs). Cloudflare serves them from its network; phones re-check them on each use, so a replaced image shows at once.
- **Versions, ready for caching later.** Each chapter in `/api/catalog` has a `version` (a hash of its questions). It is unused today; if the app later caches chapters, it re-downloads only those whose version changed.
- **Forcing an update.** Every request sends the build number from `app-version.json`. Set `MIN_APP_BUILD` in `wrangler.jsonc` to stop supporting older builds: the app shows *Update required* (Play Store link), and an outdated website tab reloads itself.

## Android app

Capacitor wraps the website's pages; the app calls the live site for everything else.

1. Deploy the site first, then put its address in `.env.android` (`VITE_SERVER_URL=https://…`, no trailing slash). The Android build fails until it is set.
2. For every release, bump `build` (and `name`) in `app-version.json`. Android's `versionCode`/`versionName` are read from it.
3. `npm run android:sync` builds the pages for the app (`dist/android`, without `img/` and `og/`, which load from the site) and syncs the Android project. Then build in Android Studio (`npm run android:open`) or `npm run android:apk`.

**Google sign-in in the app.** Google blocks its web sign-in inside apps, so the app uses Android's own (Credential Manager, via `@capgo/capacitor-social-login`). It still uses the web client ID, so the Worker needs no change, but Google must know the app: in Google Cloud Console → Credentials, in the **same project** as the web client, create an **OAuth client ID of type Android** with package name `com.prepquest.app` and the SHA-1 of each signing key (debug key: `cd android && gradlew signingReport`; Play Store: the *App signing key* SHA-1 from Play Console → App integrity). The app gets a session token instead of the cookie and sends it as `Authorization: Bearer`; the Worker allows the app's origin (`https://localhost`) through CORS.

## Saved scores

- **Guests:** rounds stay on the device (localStorage), as before.
- **Signed in:** every round is saved in D1 against the account (Google ID) and the student's email. Rounds show straight away, are queued on the device, and are retried if the network fails.
- **Unfinished rounds resume:** chapter and mixed-practice rounds are saved after every answer (`active_rounds`; server when signed in, device for guests) and continue where they stopped, even on another device. "Start over" on the chapter card discards it. Every answer is also logged in `answers` (email, question, right/wrong/skipped, hint, time, choice), linked to `rounds.client_id`.
- **First sign-in only:** the device's guest progress is copied into the account once. A device copies its progress into one account only.
- **Teacher/admin view (planned):** `users.role` is `student`, `teacher` or `admin`; `requireRole()` in `worker/auth.ts` guards routes. Make someone an admin with
  `npx wrangler d1 execute DB --remote --command "UPDATE users SET role = 'admin' WHERE email = 'someone@gmail.com'"`.
- Rounds are graded on the server. Every answer a signed-in student checks is recorded first (`checks`, migration 0005), and saved rounds and progress are graded from those recorded answers, so neither the app's numbers nor the answers it sends later are trusted. Checking a guess to learn the key and then "answering" changes nothing. Guests are not recorded (they are not on leaderboards), so a signed-in student could still look up keys by playing as a guest; that is the remaining gap. Guest progress copied in on first sign-in is taken as sent, within plausibility caps, and counts on the all-time board only.

## Leaderboard and sharing

- **Dashboard** (`src/screens/LeaderboardScreen.tsx`): rank card (rank, top %, movement since last visit, XP needed to overtake the next student), This week / This month / All time, podium, ranked list; tap a student to compare XP, rounds, accuracy and streak. Signed-in only; guests see a sign-in teaser. Weeks start Monday, Indian time.
- **Privacy:** other students appear as first name + last initial ("Riya S.") with a coloured initial, never email or photo.
- **Categories (designed, not switched on):** `worker/leaderboard.ts` ranks within a *scope*. Only `global` is enabled. `grade` (`users.grade`), `group` (schools, class divisions and custom groups: `groups`, `group_members`) and `quiz` (chapter-wise: `rounds.quiz_key`) are typed, have their tables and columns (migration 0003), and need only their SQL filter plus an entry in `ENABLED_SCOPES`.
- **Sharing** (`src/components/ShareSheet.tsx`, `src/lib/shareCard.ts`, `worker/share.ts`): a picture card drawn in the browser plus a short link `/s/<code>`. On phones, "Share picture + link" uses the system share menu (picture with the link as caption, e.g. into WhatsApp). The WhatsApp button sends the text and link, and WhatsApp shows a preview from the Open Graph tags the Worker adds to `/s/<code>` and `/` (images in `public/og/`). A shared round is a **challenge**: friends play the same questions without signing in and get a head-to-head result. `shares.visits` and `shares.plays` count link opens (not chat-app crawlers) and challenges taken.
- **Demo data (local only):** `npm run db:seed:local` adds 40 sample students (`demo-*`); `npm run db:unseed:local` removes them.

Before the first deploy: `npx wrangler d1 create exam-practice`, paste the printed `database_id` into `wrangler.jsonc`, then `npm run db:migrate:remote`.
