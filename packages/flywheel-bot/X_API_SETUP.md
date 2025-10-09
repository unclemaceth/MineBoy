# X (Twitter) API Integration Setup

This guide walks you through setting up X API integration for daily flywheel stats posting.

## Overview

Your flywheel bot now posts daily summaries to **both Discord and X** using the same webhook system. The X integration:
- Posts once per day at UTC midnight (or your configured hour)
- Uses the free tier (500 posts/month, 100 reads/month)
- Automatically formats summaries to fit 280 character limit
- Runs in parallel with Discord notifications

## Setup Steps

### 1. Create X Developer Account

1. Go to [developer.x.com](https://developer.x.com)
2. Sign in with your X account (the account you want to post from)
3. Apply for a developer account
   - Choose "Free" tier
   - Complete the application form
   - Accept the developer agreement

### 2. Create a Project and App

1. Once approved, go to the [Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Create a new **Project**
   - Name: "MineBoy Flywheel Bot" (or your preference)
   - Use case: "Making a bot"
3. Create a new **App** within the project
   - Name: "flywheel-daily-stats" (or your preference)
   - This generates your API keys

### 3. Get Your API Credentials

You need 4 credentials:

#### App-level credentials:
1. **API Key** (also called Consumer Key)
2. **API Secret Key** (also called Consumer Secret)

#### User-level credentials:
3. **Access Token**
4. **Access Token Secret**

**To get these:**
1. In your app settings, go to "Keys and tokens"
2. Copy the **API Key** and **API Secret Key**
3. Generate **Access Token & Secret** under "Authentication Tokens"
   - Set permissions to "Read and Write" (you need write to post tweets)
4. Copy all 4 values immediately (secrets won't be shown again)

### 4. Add Credentials to Your Environment

Add these to your deployment environment (Render, Railway, etc.):

```bash
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_SECRET=your_access_token_secret_here
```

#### For Render.com:
1. Go to your service dashboard
2. Navigate to "Environment" tab
3. Add each variable as a secret
4. Save changes (this will trigger a redeploy)

#### For local testing:
Add to your `.env` file:
```bash
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_SECRET=your_access_token_secret_here
```

### 5. Deploy

The integration is already built and ready. Once you add the environment variables:

1. **If using Render:** It will auto-deploy when you save the env vars
2. **If deploying manually:**
   ```bash
   cd packages/flywheel-bot
   npm run build
   npm start
   ```

### 6. Verify

Check your logs for:
```
[X] Client initialized
[DailySummary] Scheduling daily summary at 0:00 UTC
```

On the next scheduled post (default: midnight UTC), you should see:
```
[DailySummary] Sent to Discord
[X] Posting tweet...
[X] ✅ Tweet posted (ID: 1234567890)
[DailySummary] Sent to X
```

## Tweet Format

The X post is auto-formatted to fit 280 characters:

```
MineBoy Daily: 2025-10-09

Buys: 12 (245.6 APE, avg 20.5)
Sales: 10 (289.3 APE, +17.8%)
MNESTR burned: 1250000
Gas: 0.123 APE
```

## Free Tier Limits

Your free tier includes:
- **500 posts per month** (~16 per day)
- **100 reads per month**

Since you're posting **once per day**, you'll use ~30 posts/month, well within the limit.

## Troubleshooting

### "X API not configured"
**Cause:** Missing environment variables  
**Fix:** Ensure all 4 credentials are set (see step 4)

### "Rate limit exceeded"
**Cause:** Too many API calls  
**Fix:** 
- Check that you're only posting once per day
- Verify DAILY_SUMMARY_UTC_HOUR is set (default: 0)
- Wait for the rate limit to reset (shown in logs)

### "Authentication failed"
**Cause:** Invalid credentials or expired tokens  
**Fix:** 
- Regenerate Access Token & Secret in developer portal
- Update environment variables
- Ensure app permissions are "Read and Write"

### Tweets not posting but no errors
**Cause:** App doesn't have write permissions  
**Fix:**
1. Go to developer portal → Your App → Settings
2. Under "App permissions", set to "Read and Write"
3. Regenerate your Access Token & Secret (required after permission change)
4. Update environment variables with new tokens

## Optional: Test Posting

To test without waiting for the scheduled time, you can create a test script:

```typescript
// packages/flywheel-bot/scripts/test-x-post.ts
import { postTweet } from '../src/utils/twitter.js';

const testMessage = `MineBoy Flywheel Bot Test

This is a test post from the automated system.

${new Date().toISOString()}`;

postTweet(testMessage)
  .then(() => console.log('Test complete'))
  .catch((err) => console.error('Test failed:', err));
```

Run with:
```bash
tsx scripts/test-x-post.ts
```

## Disable X Posting

To disable X posting without removing code:
- Simply remove the 4 X_API_* environment variables
- The bot will log "[X] X API not configured" and skip posting

## Rate Limit Monitoring

The integration automatically logs rate limit info when errors occur:
```
[X] Rate limit: {
  limit: 500,
  remaining: 467,
  reset: 2025-10-09T00:00:00Z
}
```

## Next Steps

Once working, you can expand the integration:
- Post buy/sell alerts for high-value transactions
- Thread multiple tweets for longer summaries
- Add media (charts, images) using `client.v1.uploadMedia()`
- Monitor mentions/replies (requires read API calls)

For more features, consider upgrading to the Basic tier ($100/month):
- 3,000 posts per month
- 10,000 reads per month
- 50 concurrent streaming connections

