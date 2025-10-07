# Phase 3: Monitoring & Ops

This document describes the monitoring, alerting, and operational visibility features added to the flywheel bot.

## 🔔 Discord Alerts

### Setup

1. **Create Discord Webhook:**
   - Go to your Discord server → Server Settings → Integrations → Webhooks
   - Click "New Webhook"
   - Choose a channel (e.g., `#flywheel-bot`)
   - Copy the webhook URL

2. **Add to Render Environment:**
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
   ```

3. **Optional: Configure Daily Summary Time:**
   ```
   DAILY_SUMMARY_UTC_HOUR=0  # Default: midnight UTC
   ```

### Alert Types

| Alert | When | Example |
|-------|------|---------|
| ✅ **Success** | NPC purchased, Burn completed | "NPC Purchased: Token #1262 for 46.407 APE" |
| ⚠️ **Warning** | Emergency stop enabled, Rate limits hit | "Emergency Stop Enabled" |
| ❌ **Error** | Swap failed, Buy failed, Listing failed | "Swap/Burn failed: slippage too high" |
| ℹ️ **Info** | Bot started, Daily summary | "Flywheel Bot Started: Emergency Stop Disabled" |

### De-duplication

Error alerts are automatically de-duplicated for **10 minutes** to prevent Discord spam. The same error won't be sent more than once every 10 minutes.

---

## 📊 Health Status

### Check Bot Health

Run the health check script to see current bot status:

```bash
npm run health
```

**Output:**
```
═══════════════════════════════════════
        FLYWHEEL BOT HEALTH STATUS
═══════════════════════════════════════

🤖 Status: ✅ Running
⚠️  Emergency Stop: ✅ Disabled
🔒 Burn Lock: 🔓 Free
📦 Version: 466cc64

💰 **Balances:**
   Flywheel: 3.21 APE
   Treasury: 0.49 APE
   Treasury: 0 MNESTR

📊 **Activity:**
   Last Buy: 2025-10-07T02:25:37Z
   Last List: 2025-10-07T02:33:10Z
   Last Burn: 2025-10-07T02:40:12Z

📈 **Counters:**
   Total Buys: 12
   Total Burns: 5
   Swap Failures: 0
   Buy Failures: 0
   List Failures: 0

═══════════════════════════════════════
```

---

## 📅 Daily Summary

Every day at the configured UTC hour (default: midnight), the bot posts a summary to Discord:

```
📊 **Daily Summary** (2025-10-07)

**Trading:**
• Buys: 12 (spent 534.28 APE, avg 44.52 APE)
• Sales: 8 (received 640.14 APE, avg markup 19.8%)

**Burning:**
• MNESTR burned: 481,203
• Burns executed: 5

**Costs:**
• Gas spent: 0.1234 APE

**Failures:**
  None

**Current Balances:**
• Flywheel: 3.21 APE
• Treasury: 0.49 APE, 0 MNESTR

**Status:** ✅ Running
```

---

## 🚨 Anomaly Detection

The bot automatically alerts on:

1. **No Activity (6+ hours)** - No buys/listings during market hours (UTC 10-22)
2. **Treasury Stuck (2+ hours)** - No burn while treasury has APE
3. **Gas Anomaly** - Transaction gas > `MAX_FEE_GWEI` or 3× median
4. **Price Anomaly** - Listing price deviates >30% from 24h median
5. **Burn Anomaly** - Swap output <20% below expected

---

## 🛠️ Operational Runbooks

### Pause Everything
```bash
# In Render dashboard → flywheel-bot → Environment:
EMERGENCY_STOP=1
```
Bot will pause within 10 seconds. Discord alert will confirm.

### Resume Bot
```bash
EMERGENCY_STOP=0
```

### Clear Stuck Burn
If burn is stuck (locked for >10 min):
```bash
npm run cleanup-redis
```
Or manually delete Redis key: `flywheel:burn:lock`

### Raise Gas Caps Temporarily
```bash
# If gas prices spike, temporarily increase caps:
MAX_FEE_GWEI=100
MAX_PRIORITY_FEE_GWEI=5
```

### Quarantine Marketplace
If Magic Eden is returning bad data:
```bash
# Edit src/market/magiceden.ts
# Remove router from ROUTER_WHITELIST
# Redeploy
```

---

## 📈 Metrics Logged

For future analytics/dashboards:

- **Latencies:** Buy→List time, Sale→Burn time (ms)
- **Slippage:** Realized slippage % vs. `minOut`
- **Gas:** Per action (wrap/approve/swap/list)
- **Hit Rates:** Listings fetched vs. validated
- **Revert Reasons:** Normalized strings with counts

These metrics are logged to console and can be forwarded to a log aggregator (Datadog, Logtail, etc.).

---

## 🔐 Security

### Access Control
- **Rotate `ADMIN_TOKEN` monthly** (if backend APIs use it)
- **Never log `DISCORD_WEBHOOK_URL`** in public logs
- **Restrict emergency stop** to authorized operators only

### SLOs (Service Level Objectives)
- **Swap success rate:** >99% per 24h
- **Burn delay (p95):** <10 minutes from sale detection
- **Bot uptime:** >99.5% excluding emergency stops

---

## 🎯 Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run health` | Check bot status |
| `npm run dev` | Run bot locally |
| `npm start` | Run bot (production) |
| `npm run relist-quick` | Manually relist owned NPCs |
| `npm run cleanup-redis` | Clear Redis locks |
| `npm run check-lp` | Check LP wallet balance |

| Environment Variable | Default | Purpose |
|---------------------|---------|---------|
| `DISCORD_WEBHOOK_URL` | *(none)* | Discord webhook for alerts |
| `DAILY_SUMMARY_UTC_HOUR` | `0` | UTC hour for daily summary |
| `EMERGENCY_STOP` | `0` | `1` to pause bot |
| `MAX_FEE_GWEI` | `50` | Max gas fee cap |
| `MAX_PRIORITY_FEE_GWEI` | `2` | Max priority fee cap |

---

## 📞 Support

If you see persistent errors or anomalies:
1. Check Discord alerts for error details
2. Run `npm run health` for current status
3. Check Render logs for full context
4. If needed, set `EMERGENCY_STOP=1` to pause

**Common Issues:**
- **"Swap failed: slippage"** → Increase slippage tolerance or check DEX liquidity
- **"Router not whitelisted"** → Magic Eden changed router, update whitelist
- **"No listings available"** → Floor price may be above `MAX_NPC_PRICE`
- **"Rate limit hit"** → Normal during high activity, bot will retry

---

**Phase 3 Complete!** ✅

You now have full visibility into bot operations with real-time alerts, daily summaries, and anomaly detection.
