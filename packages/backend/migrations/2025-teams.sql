-- teams
CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  emoji      TEXT,
  color      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- seasons
CREATE TABLE IF NOT EXISTS seasons (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at    TIMESTAMPTZ
);

-- user_teams (one per wallet per season)
CREATE TABLE IF NOT EXISTS user_teams (
  wallet     TEXT NOT NULL,
  season_id  INT NOT NULL REFERENCES seasons(id),
  team_id    INT NOT NULL REFERENCES teams(id),
  chosen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet, season_id)
);

CREATE INDEX IF NOT EXISTS idx_user_teams_team   ON user_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_wallet ON user_teams(wallet);
