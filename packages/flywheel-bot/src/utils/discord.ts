/**
 * Discord Webhook Integration
 * Phase 3: Monitoring & Ops
 */

import { setTimeout as sleep } from "node:timers/promises";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

type DiscordMsg = {
  content?: string;              // plain text
  username?: string;             // display name for the webhook
  avatar_url?: string;           // optional icon
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;              // 0xRRGGBB
    fields?: { name: string; value: string; inline?: boolean }[];
    timestamp?: string;          // new Date().toISOString()
  }>;
};

async function postDiscord(payload: DiscordMsg, attempt = 1): Promise<void> {
  if (!WEBHOOK) {
    console.log('[Discord] Webhook not configured (DISCORD_WEBHOOK_URL missing)');
    return;
  }
  
  if (attempt === 1) {
    console.log('[Discord] Sending notification...');
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
      await sleep(300 * attempt); // tiny backoff
      return postDiscord(payload, attempt + 1);
    }
    
    if (res.ok && attempt === 1) {
      console.log('[Discord] ✅ Notification sent');
    }
  } catch (e) {
    // Silently fail - don't crash bot if Discord is down
    if (attempt === 1) {
      console.warn('[Discord] Failed to send notification:', e instanceof Error ? e.message : String(e));
    }
  }
}

// Convenience helpers
export function alertError(title: string, details: Record<string, unknown> = {}) {
  const fields = Object.entries(details).map(([k, v]) => ({
    name: k,
    value: String(v).substring(0, 1024), // Discord field limit
    inline: true,
  }));
  return postDiscord({
    username: "Flywheel Bot",
    embeds: [{
      title: `⚠️ ${title}`,
      color: 0xE74C3C, // Red
      fields,
      timestamp: new Date().toISOString(),
    }],
  });
}

export function alertInfo(title: string, text?: string) {
  return postDiscord({
    username: "Flywheel Bot",
    embeds: [{
      title: `ℹ️ ${title}`,
      description: text?.substring(0, 4096), // Discord description limit
      color: 0x3498DB, // Blue
      timestamp: new Date().toISOString(),
    }],
  });
}

export function alertSuccess(title: string, details?: Record<string, unknown>) {
  return postDiscord({
    username: "Flywheel Bot",
    embeds: [{
      title: `✅ ${title}`,
      color: 0x2ECC71, // Green
      fields: details ? Object.entries(details).map(([k, v]) => ({
        name: k, 
        value: String(v).substring(0, 1024), 
        inline: true,
      })) : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

export function alertWarning(title: string, details?: Record<string, unknown>) {
  return postDiscord({
    username: "Flywheel Bot",
    embeds: [{
      title: `⚡ ${title}`,
      color: 0xF39C12, // Orange
      fields: details ? Object.entries(details).map(([k, v]) => ({
        name: k, 
        value: String(v).substring(0, 1024), 
        inline: true,
      })) : undefined,
      timestamp: new Date().toISOString(),
    }],
  });
}

// De-duplication tracking for repeated errors
const recentAlerts = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export function alertErrorDeduped(title: string, details: Record<string, unknown> = {}) {
  const key = `${title}:${JSON.stringify(details)}`;
  const now = Date.now();
  const lastSent = recentAlerts.get(key);
  
  if (lastSent && (now - lastSent) < DEDUPE_WINDOW_MS) {
    return; // Skip duplicate
  }
  
  recentAlerts.set(key, now);
  
  // Cleanup old entries (keep map size bounded)
  if (recentAlerts.size > 100) {
    const oldestKey = recentAlerts.keys().next().value;
    if (oldestKey) {
      recentAlerts.delete(oldestKey);
    }
  }
  
  return alertError(title, details);
}
