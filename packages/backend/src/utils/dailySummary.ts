/**
 * Daily MineBoy Game Stats Summary
 * Posts game updates to Discord and X once per day
 */

import { getDB } from '../db.js';
import { postTweet, formatGameStatsForX } from './twitter.js';
import { postGameStats } from './discord.js';
import { setTimeout as wait } from 'timers/promises';
import { formatEther } from 'ethers';

/**
 * Send daily game stats summary to X
 */
async function sendDailySummary() {
  try {
    const db = getDB();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('[MineBoy:DailySummary] Collecting stats...');
    
    // Get 24h stats (claims from last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const dailyClaimsResult = await db.pool.query(`
      SELECT COUNT(*) as total_claims
      FROM claims
      WHERE status='confirmed' AND confirmed_at >= $1
    `, [oneDayAgo]);
    
    const totalClaimsToday = parseInt(dailyClaimsResult.rows[0]?.total_claims || '0');
    
    // Get active miners (last 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    const activeMinersResult = await db.pool.query(`
      SELECT COUNT(DISTINCT wallet) as active_miners
      FROM claims
      WHERE status='confirmed' AND confirmed_at >= $1
    `, [tenMinutesAgo]);
    
    const activeMiners = parseInt(activeMinersResult.rows[0]?.active_miners || '0');
    
    // Get total miners (all time)
    const totalMinersResult = await db.pool.query(`
      SELECT COUNT(DISTINCT wallet) as total_miners
      FROM claims
      WHERE status='confirmed'
    `);
    
    const totalMiners = parseInt(totalMinersResult.rows[0]?.total_miners || '0');
    
    // Get top miner today (last 24h)
    const topMinerResult = await db.pool.query(`
      SELECT 
        wallet,
        SUM(amount_wei::numeric) as total_wei
      FROM claims
      WHERE status='confirmed' AND confirmed_at >= $1
      GROUP BY wallet
      ORDER BY total_wei DESC
      LIMIT 1
    `, [oneDayAgo]);
    
    let topMiner;
    if (topMinerResult.rows.length > 0) {
      const row = topMinerResult.rows[0];
      topMiner = {
        wallet: row.wallet,
        ape: formatEther(row.total_wei)
      };
    }
    
    // Get top team today (last 24h)
    let topTeam;
    try {
      const topTeamResult = await db.pool.query(`
        SELECT 
          t.name,
          t.emoji,
          COALESCE(SUM(c.amount_wei::numeric), 0)::text as total_score
        FROM teams t
        LEFT JOIN user_teams ut ON ut.team_id = t.id
        LEFT JOIN claims c ON LOWER(c.wallet) = LOWER(ut.wallet) 
          AND c.status='confirmed' 
          AND c.confirmed_at >= $1
        WHERE t.is_active = true
        GROUP BY t.id, t.name, t.emoji
        ORDER BY COALESCE(SUM(c.amount_wei::numeric), 0) DESC
        LIMIT 1
      `, [oneDayAgo]);
      
      if (topTeamResult.rows.length > 0) {
        const row = topTeamResult.rows[0];
        topTeam = {
          name: row.name,
          emoji: row.emoji,
          score: formatEther(row.total_score)
        };
      }
    } catch (error) {
      console.log('[MineBoy:DailySummary] No team data available');
    }
    
    // Prepare stats object
    const statsData = {
      totalClaims: totalClaimsToday,
      activeMiners,
      totalMiners,
      topMiner,
      topTeam,
      date,
    };
    
    // Post to Discord
    console.log('[MineBoy:DailySummary] Posting to Discord...');
    await postGameStats(statsData);
    console.log('[MineBoy:DailySummary] ✅ Posted to Discord');
    
    // Post to X
    const xSummary = formatGameStatsForX(statsData);
    console.log('[MineBoy:DailySummary] Posting to X...');
    console.log(xSummary);
    
    await postTweet(xSummary);
    console.log('[MineBoy:DailySummary] ✅ Posted to X');
    
  } catch (error) {
    console.error('[MineBoy:DailySummary] Failed to send:', error);
  }
}

/**
 * Calculate milliseconds until next target UTC hour
 */
function msUntilNextUTCHour(targetHour: number): number {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(targetHour, 0, 0, 0);
  
  // If target hour already passed today, schedule for tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  
  return next.getTime() - now.getTime();
}

/**
 * Start daily summary job (runs once per day at configured UTC hour)
 */
export async function startDailySummaryJob() {
  // Post at 12:00 UTC (noon) - different from flywheel's midnight
  const targetHour = Number(process.env.MINEBOY_SUMMARY_UTC_HOUR || '12');
  
  console.log(`[MineBoy:DailySummary] Scheduling daily summary at ${targetHour}:00 UTC`);
  
  while (true) {
    try {
      const delay = msUntilNextUTCHour(targetHour);
      console.log(`[MineBoy:DailySummary] Next summary in ${(delay / 1000 / 3600).toFixed(1)} hours`);
      
      await wait(delay);
      await sendDailySummary();
      
      // Wait 1 minute to avoid double-send if process is slow
      await wait(60_000);
    } catch (error) {
      console.error('[MineBoy:DailySummary] Error in job loop:', error);
      await wait(60_000); // Wait 1 minute before retry
    }
  }
}

