/**
 * API Worker. Static assets (the React app) are served by Cloudflare directly;
 * only `/`, `/api/*`, `/s/*` and `/games/*` reach this code (see `run_worker_first` in wrangler.jsonc).
 */
import { me, signIn, signOut } from "./auth";
import { getGameBoard, getGameRanks, saveRuns } from "./games";
import { HttpError, error, json, type Env } from "./http";
import { getLeaderboard } from "./leaderboard";
import { clearProgress, getProgress, saveProgress } from "./progress";
import { getScores, importDevice, saveRounds } from "./scores";
import { countPlay, createShare, gamePage, getShare, homePage, sharePage } from "./share";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const page = /^\/s\/([^/]+)\/?$/.exec(url.pathname);
      if (page && request.method === "GET") return await sharePage(request, env, url, page[1]);
      if (url.pathname === "/" && request.method === "GET") return await homePage(env, url);
      const gameLink = /^\/games\/([a-z]+)\/?$/.exec(url.pathname);
      if (gameLink && request.method === "GET") return await gamePage(env, url, gameLink[1]);

      const share = /^\/api\/share\/([^/]+)(\/play)?$/.exec(url.pathname);
      if (share && request.method === "GET" && !share[2]) return await getShare(env, share[1]);
      if (share && request.method === "POST" && share[2]) return await countPlay(request, env, url, share[1]);

      switch (`${request.method} ${url.pathname}`) {
        case "GET /api/auth/config":
          return json({ clientId: env.GOOGLE_CLIENT_ID || null });
        case "GET /api/auth/me":
          return await me(request, env);
        case "POST /api/auth/google":
          return await signIn(request, env, url);
        case "POST /api/auth/logout":
          return signOut(request, url);
        case "GET /api/scores":
          return await getScores(request, env);
        case "POST /api/scores/rounds":
          return await saveRounds(request, env, url);
        case "POST /api/scores/import":
          return await importDevice(request, env, url);
        case "GET /api/progress":
          return await getProgress(request, env);
        case "POST /api/progress/save":
          return await saveProgress(request, env, url);
        case "POST /api/progress/clear":
          return await clearProgress(request, env, url);
        case "GET /api/leaderboard":
          return await getLeaderboard(request, env, url);
        case "POST /api/share":
          return await createShare(request, env, url);
        case "POST /api/games/runs":
          return await saveRuns(request, env, url);
        case "GET /api/games/board":
          return await getGameBoard(request, env, url);
        case "GET /api/games/ranks":
          return await getGameRanks(request, env, url);
        default:
          return error(404, "Not found");
      }
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.message);
      console.error(e);
      return error(500, "Something went wrong");
    }
  },
} satisfies ExportedHandler<Env>;
