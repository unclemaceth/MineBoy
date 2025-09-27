-- Season system migration
-- Supports TEAM and INDIVIDUAL seasons with proper attribution

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS user_teams CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;

-- seasons table with scope support
CREATE TABLE IF NOT EXISTS seasons (
  id           SERIAL PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  scope        TEXT NOT NULL CHECK (scope IN ('INDIVIDUAL','TEAM')),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seasons_scope_active_idx ON seasons(scope, is_active);
CREATE INDEX IF NOT EXISTS seasons_slug_idx ON seasons(slug);

-- user_teams (TEAM seasons only)
CREATE TABLE IF NOT EXISTS user_teams (
  season_id    INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet       TEXT    NOT NULL,
  team_slug    TEXT    NOT NULL,
  chosen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, wallet)
);

CREATE INDEX IF NOT EXISTS user_teams_team_idx ON user_teams(team_slug);
CREATE INDEX IF NOT EXISTS user_teams_wallet_idx ON user_teams(wallet);

-- per-claim team attribution (immutable once set)
CREATE TABLE IF NOT EXISTS claim_team_attributions (
  claim_id     TEXT    PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  team_slug    TEXT    NOT NULL,
  season_id    INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  wallet       TEXT    NOT NULL,
  amount_wei   NUMERIC NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cta_season_team_idx ON claim_team_attributions(season_id, team_slug);
CREATE INDEX IF NOT EXISTS cta_season_wallet_idx ON claim_team_attributions(season_id, wallet);
CREATE INDEX IF NOT EXISTS cta_wallet_idx ON claim_team_attributions(wallet);

-- Add confirmed_at to claims if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'claims' AND column_name = 'confirmed_at') THEN
        ALTER TABLE claims ADD COLUMN confirmed_at TIMESTAMPTZ;
        UPDATE claims SET confirmed_at = to_timestamp(created_at / 1000) WHERE confirmed_at IS NULL;
        ALTER TABLE claims ALTER COLUMN confirmed_at SET NOT NULL;
    END IF;
END $$;

-- Create initial seasons if they don't exist
INSERT INTO seasons (slug, scope, starts_at, is_active) VALUES 
('s1-individual-2025', 'INDIVIDUAL', NOW(), true),
('s1-team-2025', 'TEAM', NOW(), true)
ON CONFLICT (slug) DO NOTHING;
