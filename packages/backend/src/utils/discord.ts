/**
 * Discord Webhook Integration for MineBoy
 * Posts game stats to Discord
 */

import { setTimeout as sleep } from "node:timers/promises";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

type DiscordMsg = {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    timestamp?: string;
  }>;
};

async function postDiscord(payload: DiscordMsg, attempt = 1): Promise<void> {
  if (!WEBHOOK) {
    console.log('[Discord:MineBoy] Webhook not configured (DISCORD_WEBHOOK_URL missing)');
    return;
  }
  
  if (attempt === 1) {
    console.log('[Discord:MineBoy] Sending notification...');
  }
  
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Handle rate limit (429) with retry-after
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "1");
      await sleep((retry + 0.5) * 1000);
      if (attempt <= 5) return postDiscord(payload, attempt + 1);
    }

    if (!res.ok && attempt <= 3) {
      await sleep(300 * attempt);
      return postDiscord(payload, attempt + 1);
    }
    
    if (res.ok && attempt === 1) {
      console.log('[Discord:MineBoy] ✅ Notification sent');
    }
  } catch (e) {
    if (attempt === 1) {
      console.warn('[Discord:MineBoy] Failed to send notification:', e instanceof Error ? e.message : String(e));
    }
  }
}

/**
 * Post daily game stats to Discord
 */
export function postGameStats(stats: {
  totalClaims: number;
  activeMiners: number;
  totalMiners: number;
  topMiner?: { wallet: string; arcadeName?: string; mnestr: string };
  topTeam?: { name: string; score: string };
  date: string;
}) {
  // Use arcade name if available, otherwise show wallet
  const topMinerDisplay = stats.topMiner
    ? stats.topMiner.arcadeName 
      ? `🎮 ${stats.topMiner.arcadeName}`
      : `${stats.topMiner.wallet.slice(0, 6)}...${stats.topMiner.wallet.slice(-4)}`
    : 'N/A';
  
  const topMinerMnestr = stats.topMiner
    ? parseFloat(stats.topMiner.mnestr).toFixed(2)
    : '0';

  const fields = [
    { name: 'Claims Today', value: stats.totalClaims.toLocaleString(), inline: true },
    { name: 'Active Miners', value: stats.activeMiners.toString(), inline: true },
    { name: 'Total Miners', value: stats.totalMiners.toLocaleString(), inline: true },
    { name: 'Top Miner', value: `${topMinerDisplay}\n${topMinerMnestr} MNESTR mined`, inline: false },
  ];

  if (stats.topTeam) {
    const teamMnestr = parseFloat(stats.topTeam.score).toFixed(2);
    fields.push({
      name: 'Top Team',
      value: `${stats.topTeam.name}\n${teamMnestr} MNESTR mined`,
      inline: false
    });
  }

  return postDiscord({
    username: "MineBoy",
    embeds: [{
      title: `⛏️ MineBoy Daily Summary (${stats.date})`,
      color: 0x00AE86, // MineBoy green/teal
      fields,
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Post info message to Discord
 */
export function postInfo(title: string, text?: string) {
  return postDiscord({
    username: "MineBoy",
    embeds: [{
      title: `ℹ️ ${title}`,
      description: text?.substring(0, 4096),
      color: 0x3498DB, // Blue
      timestamp: new Date().toISOString(),
    }],
  });
}

/**
 * Post error to Discord
 */
export function postError(title: string, details: Record<string, unknown> = {}) {
  const fields = Object.entries(details).map(([k, v]) => ({
    name: k,
    value: String(v).substring(0, 1024),
    inline: true,
  }));
  
  return postDiscord({
    username: "MineBoy",
    embeds: [{
      title: `❌ ${title}`,
      color: 0xE74C3C, // Red
      fields,
      timestamp: new Date().toISOString(),
    }],
  });
}

