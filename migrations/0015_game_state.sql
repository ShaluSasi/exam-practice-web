-- A signed-in player's saved game progress (worker/games.ts), one row per game:
-- for Galaxy Guardian, stardust, upgrades, lasers, badges, lifetime totals,
-- today's missions and the best level reached in each mission. Finished runs
-- stay in game_runs, which the scoreboards use.

CREATE TABLE game_state (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  game       TEXT NOT NULL,
  -- The game's saved progress as JSON (src/games/galaxy/progress.ts `SavedGalaxy`).
  state      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
