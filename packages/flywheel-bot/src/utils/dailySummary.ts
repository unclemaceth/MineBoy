/**
 * Daily Summary Job
 * Phase 3: Monitoring & Ops
 * 
 * Posts a daily summary to Discord at UTC midnight (or configured hour)
 */

import { alertInfo } from './discord.js';
import { postTweet, formatSummaryForX } from './twitter.js';
import { health, getHealthStatus } from './health.js';
import { setTimeout as wait } from 'timers/promises';

// Daily stats tracking
const dailyStats = {
  buys: 0,
  apeSpent: 0,
  sales: 0,
  apeReceived: 0,
  mnestrBurned: 0,
  gasSpent: 0,
  failuresByType: {} as Record<string, number>,
  lastResetDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
};

export function recordDailyBuy(apeAmount: number) {
  dailyStats.buys++;
  dailyStats.apeSpent += apeAmount;
}

export function recordDailySale(apeAmount: number) {
  dailyStats.sales++;
  dailyStats.apeReceived += apeAmount;
}

export function recordDailyBurn(mnestrAmount: number) {
  dailyStats.mnestrBurned += mnestrAmount;
}

export function recordDailyGas(gasApe: number) {
  dailyStats.gasSpent += gasApe;
}

export function recordDailyFailure(type: string) {
  dailyStats.failuresByType[type] = (dailyStats.failuresByType[type] || 0) + 1;
}

/**
 * Reset daily stats (called at UTC midnight)
 */
function resetDailyStats() {
  const today = new Date().toISOString().split('T')[0];
  
  if (dailyStats.lastResetDate !== today) {
    dailyStats.buys = 0;
    dailyStats.apeSpent = 0;
    dailyStats.sales = 0;
    dailyStats.apeReceived = 0;
    dailyStats.mnestrBurned = 0;
    dailyStats.gasSpent = 0;
    dailyStats.failuresByType = {};
    dailyStats.lastResetDate = today;
  }
}

/**
 * Send daily summary to Discord
 */
async function sendDailySummary() {
  try {
    resetDailyStats(); // Ensure we're on the right day
    
    const status = await getHealthStatus();
    
    const avgBuy = dailyStats.buys > 0 ? (dailyStats.apeSpent / dailyStats.buys).toFixed(2) : '0';
    const avgMarkup = dailyStats.sales > 0 && dailyStats.apeSpent > 0
      ? (((dailyStats.apeReceived / dailyStats.apeSpent) - 1) * 100).toFixed(1)
      : '0';
    
    const failureLines = Object.entries(dailyStats.failuresByType)
      .map(([type, count]) => `  ${type}: ${count}`)
      .join('\n') || '  None';
    
    const summary = [
      `📊 **Daily Summary** (${new Date().toISOString().split('T')[0]})`,
      '',
      `**Trading:**`,
      `• Buys: ${dailyStats.buys} (spent ${dailyStats.apeSpent.toFixed(2)} APE, avg ${avgBuy} APE)`,
      `• Sales: ${dailyStats.sales} (received ${dailyStats.apeReceived.toFixed(2)} APE, avg markup ${avgMarkup}%)`,
      '',
      `**Burning:**`,
      `• MNESTR burned: ${dailyStats.mnestrBurned.toFixed(0)}`,
      `• Burns executed: ${health.totalBurns}`,
      '',
      `**Costs:**`,
      `• Gas spent: ${dailyStats.gasSpent.toFixed(4)} APE`,
      '',
      `**Failures:**`,
      failureLines,
      '',
      `**Current Balances:**`,
      `• Flywheel: ${status.balances.flywheelAPE} APE`,
      `• Treasury: ${status.balances.treasuryAPE} APE, ${status.balances.treasuryMNESTR} MNESTR`,
      '',
      `**Status:** ${status.emergencyStop ? '🛑 STOPPED' : '✅ Running'}`,
    ].join('\n');
    
    // Send to Discord
    await alertInfo('Daily Summary', summary);
    console.log('[DailySummary] Sent to Discord');
    
    // Send to X (Twitter)
    const date = new Date().toISOString().split('T')[0];
    const xSummary = formatSummaryForX({
      buys: dailyStats.buys,
      apeSpent: dailyStats.apeSpent,
      sales: dailyStats.sales,
      apeReceived: dailyStats.apeReceived,
      mnestrBurned: dailyStats.mnestrBurned,
      gasSpent: dailyStats.gasSpent,
      date,
    });
    await postTweet(xSummary);
    console.log('[DailySummary] Sent to X');
  } catch (error) {
    console.error('[DailySummary] Failed to send:', error);
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
  const targetHour = Number(process.env.DAILY_SUMMARY_UTC_HOUR || '0'); // Default: midnight UTC
  
  console.log(`[DailySummary] Scheduling daily summary at ${targetHour}:00 UTC`);
  
  while (true) {
    try {
      const delay = msUntilNextUTCHour(targetHour);
      console.log(`[DailySummary] Next summary in ${(delay / 1000 / 3600).toFixed(1)} hours`);
      
      await wait(delay);
      await sendDailySummary();
      
      // Wait 1 minute to avoid double-send if process is slow
      await wait(60_000);
    } catch (error) {
      console.error('[DailySummary] Error in job loop:', error);
      await wait(60_000); // Wait 1 minute before retry
    }
  }
}

export { dailyStats };
