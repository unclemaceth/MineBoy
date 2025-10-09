/**
 * X (Twitter) API Integration
 * Phase 3: Monitoring & Ops
 * 
 * Posts daily summaries to X using the v2 API
 * Free tier: 500 posts/month, 100 reads/month
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
    console.log('[X] Client initialized');
  } catch (error) {
    console.error('[X] Failed to initialize client:', error);
  }
}

/**
 * Post a tweet to X
 * Automatically handles 280 character limit
 */
export async function postTweet(message: string): Promise<void> {
  if (!X_ENABLED || !client) {
    console.log('[X] X API not configured (missing credentials)');
    return;
  }

  try {
    // Truncate to 280 characters if needed
    const truncated = message.length > 280 
      ? message.substring(0, 277) + '...' 
      : message;

    console.log('[X] Posting tweet...');
    const result = await client.v2.tweet(truncated);
    console.log(`[X] ✅ Tweet posted (ID: ${result.data.id})`);
  } catch (error: any) {
    console.error('[X] Failed to post tweet:', error.message || error);
    
    // Log rate limit info if available
    if (error.rateLimit) {
      console.error('[X] Rate limit:', {
        limit: error.rateLimit.limit,
        remaining: error.rateLimit.remaining,
        reset: new Date(error.rateLimit.reset * 1000).toISOString(),
      });
    }
  }
}

/**
 * Format daily summary for X (280 character limit)
 * Strips emojis and markdown, focuses on key metrics
 */
export function formatSummaryForX(stats: {
  buys: number;
  apeSpent: number;
  sales: number;
  apeReceived: number;
  mnestrBurned: number;
  gasSpent: number;
  date: string;
}): string {
  const avgBuy = stats.buys > 0 ? (stats.apeSpent / stats.buys).toFixed(1) : '0';
  const avgMarkup = stats.sales > 0 && stats.apeSpent > 0
    ? (((stats.apeReceived / stats.apeSpent) - 1) * 100).toFixed(1)
    : '0';

  // Build tweet optimized for 280 chars
  const lines = [
    `MineBoy Daily: ${stats.date}`,
    ``,
    `Buys: ${stats.buys} (${stats.apeSpent.toFixed(1)} APE, avg ${avgBuy})`,
    `Sales: ${stats.sales} (${stats.apeReceived.toFixed(1)} APE, +${avgMarkup}%)`,
    `MNESTR burned: ${stats.mnestrBurned.toFixed(0)}`,
    `Gas: ${stats.gasSpent.toFixed(3)} APE`,
  ];

  return lines.join('\n');
}

