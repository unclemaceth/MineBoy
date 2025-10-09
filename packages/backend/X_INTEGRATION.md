# X API Integration - MineBoy Backend

## Overview

The MineBoy backend now posts daily game stats to X (Twitter) once per day.

**Posts include:**
- Total claims today (24h)
- Active miners (last 10 min)
- Total miners (all time)
- Top miner today (wallet + APE earned)
- Top team today (if teams are active)

## How It Works

```
Daily Summary Job (runs at 12:00 UTC)
    ↓
Query database for game stats
    ↓
Format for X (280 char limit)
    ↓
Post to @mineboy_app
```

**Scheduled Time:** 12:00 UTC (noon)  
**Can be changed with:** `MINEBOY_SUMMARY_UTC_HOUR` env var

## Setup

### 1. Environment Variables

The backend uses the **same X API credentials** as the flywheel bot:

```bash
X_API_KEY=xxxxx
X_API_SECRET=xxxxx
X_ACCESS_TOKEN=xxxxx
X_ACCESS_SECRET=xxxxx
```

⚠️ **Important:** Make sure these are set in your backend deployment environment (Render/Railway/etc)

### 2. Deploy

The integration auto-starts when the backend starts:

```bash
cd packages/backend
npm start
```

**Look for in logs:**
```
[X:MineBoy] Client initialized
[MineBoy:DailySummary] Scheduling daily summary at 12:00 UTC
[MineBoy:DailySummary] Next summary in X.X hours
```

## Example Tweet

```
⛏️ MineBoy Daily: 2025-10-09

1,234 claims today
42 active miners
567 total miners

🏆 Top: 0x1234...5678 (123 APE)
🔥 Team FireStarters: 9876 APE
```

**Character count:** ~150 characters (well under 280 limit)

## Testing

**Test immediately (posts to X):**
```bash
cd packages/backend
npm run test:x
```

This will post a test tweet with sample data.

**Check environment:**
```bash
# In Render shell or locally
echo $X_API_KEY
echo $X_API_SECRET
echo $X_ACCESS_TOKEN
echo $X_ACCESS_SECRET
```

## Configuration

### Change Posting Time

Default is 12:00 UTC (noon). To change:

```bash
# Post at 18:00 UTC (6 PM)
MINEBOY_SUMMARY_UTC_HOUR=18
```

### Disable X Posting

Remove the X_API_* environment variables. The backend will log:
```
[X:MineBoy] X API not configured (missing credentials)
```

And silently skip posting.

## Files

- `src/utils/twitter.ts` - X API client
- `src/utils/dailySummary.ts` - Daily stats job
- `src/server.ts` - Starts job on server startup
- `scripts/test-x-post.ts` - Test script

## Posting Schedule

**Backend (MineBoy game stats):** 12:00 UTC  
**Flywheel bot (trading stats):** 00:00 UTC (midnight)

Different times ensure they don't overlap and users see updates throughout the day.

## Troubleshooting

### "X API not configured"
- Check that all 4 env vars are set
- Restart the backend after adding them

### "Failed to post tweet"
- Check rate limits (500 posts/month on free tier)
- Verify access token has "Read and Write" permissions
- Check X API status: [status.twitterapi.com](https://status.twitterapi.com)

### No logs appear
- Job might not be started
- Check server logs for initialization errors
- Verify `startDailySummaryJob()` is called in `server.ts`

## Data Sources

Stats are queried from PostgreSQL:

- **Claims:** `claims` table (status='confirmed')
- **Miners:** Distinct wallets in `claims`
- **Teams:** `teams`, `user_teams`, joined with `claims`
- **Leaderboard:** Aggregated from `claims` grouped by wallet

All times are in milliseconds (Unix timestamp).

## Rate Limits

**Free tier:** 500 posts/month  
**Backend usage:** 1 post/day = ~30/month  
**Combined with flywheel:** ~60/month total  

**Plenty of headroom!** 88% of free tier unused.

## Future Enhancements

Potential additions:
- Post when big milestones hit (1M claims, etc)
- Weekly team standings
- Monthly recap threads
- Special event announcements
- Reply to mentions (requires read API calls)

Upgrade to Basic tier ($100/month) for:
- 3,000 posts/month
- 10,000 reads/month
- Better support for engagement features

