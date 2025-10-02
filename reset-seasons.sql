-- Reset all seasons and start fresh Season 5
-- Run this directly in your Render PostgreSQL database

-- 1. Deactivate all existing seasons
UPDATE seasons SET is_active = false;

-- 2. Create Season 5 - Individual
INSERT INTO seasons (slug, scope, starts_at, ends_at, is_active)
VALUES ('s5-individual-2025', 'INDIVIDUAL', NOW(), NULL, true)
ON CONFLICT (slug) DO UPDATE SET is_active = true, starts_at = NOW();

-- 3. Create Season 5 - Team
INSERT INTO seasons (slug, scope, starts_at, ends_at, is_active)
VALUES ('s5-team-2025', 'TEAM', NOW(), NULL, true)
ON CONFLICT (slug) DO UPDATE SET is_active = true, starts_at = NOW();

-- 4. Verify the new seasons
SELECT id, slug, scope, starts_at, is_active FROM seasons WHERE is_active = true;

