// packages/backend/src/seasons.ts
// Season management functions for TEAM and INDIVIDUAL seasons

export type SeasonScope = 'TEAM' | 'INDIVIDUAL';

export type Season = {
  id: number;
  slug: string;
  scope: SeasonScope;
  starts_at: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
};

export type TeamAttribution = {
  claim_id: string;
  team_slug: string;
  season_id: number;
  wallet: string;
  amount_wei: string;
  confirmed_at: string;
  created_at: string;
};

/**
 * Get the currently active season for a given scope
 */
export async function getActiveSeason(db: any, scope: SeasonScope): Promise<Season | null> {
  const result = await db.pool.query(
    `SELECT * FROM seasons WHERE scope=$1 AND is_active=true ORDER BY starts_at DESC LIMIT 1`,
    [scope]
  );
  return result.rows[0] || null;
}

/**
 * End the currently active season for a given scope
 */
export async function endActiveSeason(db: any, scope: SeasonScope): Promise<void> {
  await db.pool.query(
    `UPDATE seasons SET is_active=false, ends_at=NOW() WHERE scope=$1 AND is_active=true`,
    [scope]
  );
}

/**
 * Create a new season
 */
export async function createSeason(
  db: any, 
  { slug, scope, startsAt }: { slug: string; scope: SeasonScope; startsAt?: Date }
): Promise<Season> {
  const result = await db.pool.query(
    `INSERT INTO seasons(slug, scope, starts_at, is_active)
     VALUES($1,$2, COALESCE($3, NOW()), true)
     RETURNING *`,
    [slug, scope, startsAt ?? new Date()]
  );
  return result.rows[0];
}

/**
 * Get season by slug
 */
export async function getSeasonBySlug(db: any, slug: string): Promise<Season | null> {
  const result = await db.pool.query(`SELECT * FROM seasons WHERE slug=$1`, [slug]);
  return result.rows[0] || null;
}

/**
 * Get all seasons for a scope (for listing)
 */
export async function getSeasons(db: any, scope?: SeasonScope): Promise<Season[]> {
  let query = `SELECT * FROM seasons`;
  let params: any[] = [];
  
  if (scope) {
    query += ` WHERE scope=$1`;
    params.push(scope);
  }
  
  query += ` ORDER BY starts_at DESC`;
  
  const result = await db.pool.query(query, params);
  return result.rows;
}

/**
 * Choose a team for the active TEAM season
 */
export async function chooseTeam(
  db: any,
  wallet: string,
  teamSlug: string
): Promise<{ season: Season; attributedClaims: number; alreadyChosen: boolean }> {
  const season = await getActiveSeason(db, 'TEAM');
  if (!season) throw new Error('No active TEAM season');

  const lcWallet = wallet.toLowerCase();

  await db.pool.query('BEGIN');
  try {
    // insert-or-noop user choice
    const ins = await db.pool.query(
      `INSERT INTO user_teams (season_id, wallet, team_slug)
       VALUES ($1,$2,$3)
       ON CONFLICT (season_id, wallet) DO NOTHING
       RETURNING team_slug`,
      [season.id, lcWallet, teamSlug]
    );

    const alreadyChosen = ins.rowCount === 0;

    // effective team (if already chosen, read it)
    const teamRow = alreadyChosen
      ? await db.pool.query(`SELECT team_slug FROM user_teams WHERE season_id=$1 AND wallet=$2`, [season.id, lcWallet])
      : ins;
    const effectiveTeam = teamRow.rows[0]?.team_slug;
    if (!effectiveTeam) throw new Error('Failed to read team choice');

    // 🔑 retro-attribute ONLY claims within TEAM season window (BIGINT ms -> timestamptz)
    const attrib = await db.pool.query(
      `INSERT INTO claim_team_attributions (claim_id, team_slug, season_id, wallet, amount_wei, confirmed_at)
       SELECT
         c.id,
         $2,
         $1,
         LOWER(c.wallet),
         c.amount_wei,
         to_timestamp(COALESCE(c.confirmed_at, c.created_at) / 1000)
       FROM claims c
       WHERE c.status = 'confirmed'
         AND LOWER(c.wallet) = LOWER($3)
         AND to_timestamp(COALESCE(c.confirmed_at, c.created_at) / 1000)
             BETWEEN $4::timestamptz AND COALESCE($5::timestamptz, NOW())
         AND NOT EXISTS (
           SELECT 1 FROM claim_team_attributions x
           WHERE x.season_id = $1 AND x.claim_id = c.id
         )
       ON CONFLICT DO NOTHING
       RETURNING claim_id`,
      [season.id, effectiveTeam, lcWallet, season.starts_at, season.ends_at]
    );

    await db.pool.query('COMMIT');
    return { season, attributedClaims: attrib.rowCount, alreadyChosen };
  } catch (e) {
    await db.pool.query('ROLLBACK');
    throw e;
  }
}

/**
 * Check if a wallet has chosen a team for the active TEAM season
 */
export async function getUserTeamChoice(
  db: any,
  wallet: string,
  seasonSlug?: string
): Promise<{ chosen: boolean; team_slug?: string; season: Season | null }> {
  const season = seasonSlug === 'active' || !seasonSlug
    ? await getActiveSeason(db, 'TEAM')
    : await getSeasonBySlug(db, seasonSlug);
    
  if (!season) {
    return { chosen: false, season: null };
  }

  const result = await db.pool.query(
    `SELECT team_slug FROM user_teams WHERE season_id=$1 AND LOWER(wallet)=LOWER($2)`,
    [season.id, wallet]
  );

  return {
    chosen: !!result.rows[0],
    team_slug: result.rows[0]?.team_slug,
    season
  };
}

/**
 * Attribute a newly confirmed claim to a team (if in active TEAM season)
 */
export async function attributeClaimToTeam(
  db: any,
  claimId: string,
  wallet: string,
  amountWei: string,
  confirmedAt: Date
): Promise<void> {
  const season = await getActiveSeason(db, 'TEAM');
  if (!season) return; // No active TEAM season

  // Check if wallet has chosen a team for this season
  const teamChoice = await db.pool.query(
    `SELECT team_slug FROM user_teams WHERE season_id=$1 AND LOWER(wallet)=LOWER($2)`,
    [season.id, wallet]
  );

  if (!teamChoice.rows[0]) return; // No team chosen

  const teamSlug = teamChoice.rows[0].team_slug;

  // Insert attribution (ignore if already exists)
  await db.pool.query(
    `INSERT INTO claim_team_attributions (claim_id, team_slug, season_id, wallet, amount_wei, confirmed_at)
     VALUES($1, $2, $3, $4, $5, $6)
     ON CONFLICT (claim_id) DO NOTHING`,
    [claimId, teamSlug, season.id, wallet.toLowerCase(), amountWei, confirmedAt]
  );
}

/**
 * Get individual leaderboard for a season
 */
export async function getIndividualLeaderboard(
  db: any,
  season: Season,
  limit: number = 25,
  offset: number = 0
): Promise<Array<{ wallet: string; total_wei: string; rank: number }>> {
  const endTime = season.ends_at || new Date().toISOString();
  
  const result = await db.pool.query(
    `SELECT
       LOWER(wallet) AS wallet,
       SUM(amount_wei::numeric) AS total_wei,
       ROW_NUMBER() OVER (ORDER BY SUM(amount_wei::numeric) DESC) AS rank
     FROM claims
     WHERE status='confirmed'
       AND confirmed_at >= EXTRACT(EPOCH FROM $1::timestamptz) * 1000
       AND confirmed_at <= EXTRACT(EPOCH FROM $2::timestamptz) * 1000
     GROUP BY LOWER(wallet)
     ORDER BY total_wei DESC
     LIMIT $3 OFFSET $4`,
    [season.starts_at, endTime, limit, offset]
  );

  return result.rows;
}

/**
 * Get team leaderboard for a season
 */
export async function getTeamLeaderboard(
  db: any,
  season: Season
): Promise<Array<{ team_slug: string; members: number; total_wei: string; rank: number }>> {
  const res = await db.pool.query(
    `WITH cleaned AS (
       SELECT team_slug, wallet, NULLIF(amount_wei, '') AS amt
       FROM claim_team_attributions
       WHERE season_id = $1
     )
     SELECT
       team_slug,
       COUNT(DISTINCT wallet) AS members,
       COALESCE(SUM(amt::numeric), 0) AS total_wei,
       ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(amt::numeric),0) DESC) AS rank
     FROM cleaned
     GROUP BY team_slug
     ORDER BY total_wei DESC`,
    [season.id]
  );
  return res.rows;
}
