-- Finished game runs, for the game scoreboards (worker/games.ts).
--
-- A game is split into sections, e.g. Galaxy Guardian's missions
-- ("mul" for multiplication, "div" for division, "mixed", ...). Each
-- section has its own scoreboard ranked by a student's best run; the
-- game's overall board adds up each student's best score per section.

CREATE TABLE game_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- ID made by the browser; makes retries after a network error safe.
  client_id   TEXT NOT NULL,
  game        TEXT NOT NULL,
  section     TEXT NOT NULL,
  score       INTEGER NOT NULL,
  -- Furthest wave and difficulty level reached.
  wave        INTEGER NOT NULL,
  level       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  answered    INTEGER NOT NULL,
  best_combo  INTEGER NOT NULL,
  played_at   INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, client_id)
);
CREATE INDEX game_runs_board ON game_runs (game, section, played_at);
CREATE INDEX game_runs_played ON game_runs (game, played_at);
CREATE INDEX game_runs_user ON game_runs (user_id, game, played_at DESC);
