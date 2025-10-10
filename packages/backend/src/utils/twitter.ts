/**
 * X (Twitter) API Integration for MineBoy
 * Posts daily game stats and updates
 */

import { TwitterApi } from 'twitter-api-v2';

const X_ENABLED = !!(
  process.env.X_API_KEY &&
  process.env.X_API_SECRET &&
  process.env.X_ACCESS_TOKEN &&
  process.env.X_ACCESS_SECRET
);

let client: TwitterApi | null = null;

if (X_ENABLED) {
  try {
    client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });
    console.log('[X:MineBoy] Client initialized');
  } catch (error) {
    console.error('[X:MineBoy] Failed to initialize client:', error);
  }
}

/**
 * Post a tweet to X
 */
export async function postTweet(message: string): Promise<void> {
  if (!X_ENABLED || !client) {
    console.log('[X:MineBoy] X API not configured (missing credentials)');
    return;
  }

  try {
    // Truncate to 280 characters if needed
    const truncated = message.length > 280 
      ? message.substring(0, 277) + '...' 
      : message;

    console.log('[X:MineBoy] Posting tweet...');
    const result = await client.v2.tweet(truncated);
    console.log(`[X:MineBoy] ✅ Tweet posted (ID: ${result.data.id})`);
  } catch (error: any) {
    console.error('[X:MineBoy] Failed to post tweet:', error.message || error);
    
    // Log rate limit info if available
    if (error.rateLimit) {
      console.error('[X:MineBoy] Rate limit:', {
        limit: error.rateLimit.limit,
        remaining: error.rateLimit.remaining,
        reset: new Date(error.rateLimit.reset * 1000).toISOString(),
      });
    }
  }
}

/**
 * Format game stats for X (280 character limit)
 */
export function formatGameStatsForX(stats: {
  totalClaims: number;
  activeMiners: number;
  totalMiners: number;
  topMiner?: { wallet: string; arcadeName?: string; mnestr: string };
  topTeam?: { name: string; score: string };
  date: string;
}): string {
  // Use arcade name if available, otherwise shorten wallet
  const topMinerDisplay = stats.topMiner
    ? stats.topMiner.arcadeName || `${stats.topMiner.wallet.slice(0, 6)}...${stats.topMiner.wallet.slice(-4)}`
    : 'N/A';
  
  const topMinerMnestr = stats.topMiner
    ? parseFloat(stats.topMiner.mnestr).toFixed(0)
    : '0';

  const lines = [
    `⛏️ MineBoy Daily: ${stats.date}`,
    ``,
    `${stats.totalClaims.toLocaleString()} claims today`,
    `${stats.activeMiners} active miners`,
    `${stats.totalMiners.toLocaleString()} total miners`,
    ``,
    `🏆 Top: ${topMinerDisplay} (${topMinerMnestr} MNESTR)`,
  ];

  // Add team if available
  if (stats.topTeam) {
    const teamMnestr = parseFloat(stats.topTeam.score).toFixed(0);
    lines.push(`🏅 Team ${stats.topTeam.name}: ${teamMnestr} MNESTR`);
  }

  return lines.join('\n');
}

