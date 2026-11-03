-- New rounds drawn by guests (not signed in) per network per day
-- (worker/questions.ts), so a guest can't practise endlessly by clearing the
-- browser's data. `network` is a hash of the IP address (its /64 for IPv6),
-- never the address itself. Rows older than a couple of days are deleted.

CREATE TABLE guest_rounds (
  network TEXT NOT NULL,
  -- Days since 1970 (UTC).
  day     INTEGER NOT NULL,
  n       INTEGER NOT NULL,
  PRIMARY KEY (network, day)
);
