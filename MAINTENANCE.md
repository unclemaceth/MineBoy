# MineBoy Maintenance Mode

This document explains how to use the maintenance mode system for alpha testing and updates.

## Overview

The maintenance mode system allows you to temporarily disable public access to MineBoy while keeping admin functions available. Users see a clean "we're updating" screen instead of errors.

## Quick Commands

### Turn ON Maintenance Mode
```bash
curl -X POST "https://mineboy-g5xo.onrender.com/v2/admin/maintenance/on" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"message":"Quick update in progress","untilIso":"2025-09-23T21:00:00Z"}'
```

### Turn OFF Maintenance Mode
```bash
curl -X POST "https://mineboy-g5xo.onrender.com/v2/admin/maintenance/off" \
  -H "x-admin-token: doChain
ApeChain
ApeChain
Network
ApeChain Curtis
Curtis
Method
getNFTs - Get NFTs owned by an address
Language

JavaScript
SDK
fetch
Network URL
URL
https://apechain-curtis.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs

Copy
Copy the code below into your code editor
Request

Copy
const options = {method: 'GET', headers: {accept: 'application/json'}};

fetch('https://apechain-curtis.g.alchemy.com/v2/3YobnRFCSYEuIC5c1ySEs/getNFTsForOwner?owner=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&withMetadata=true&pageSize=100', options)
  .then(response => response.json())
  .then(response => console.log(response))
  .catch(err => console.error(err));
Docs
"
```

### Check Status
```bash
curl "https://mineboy-g5xo.onrender.com/v2/maintenance"
```

## Authentication

Replace `YOUR_ADMIN_TOKEN` with your actual admin token from the `ADMIN_TOKEN` environment variable.

## What Gets Blocked

When maintenance mode is ON:
- ✅ **Allowed**: `/health`, `/v2/admin/*`, `/v2/debug/*`
- ❌ **Blocked**: All other endpoints return HTTP 503

## What Users See

### Normal Mode
- Full MineBoy experience
- Mining, claiming, leaderboard all work

### Maintenance Mode
- Clean overlay: "MineBoy is taking a breather 🛠️"
- Custom message (if provided)
- ETA display (if provided)
- Automatic recovery when maintenance ends

## Admin Endpoints

### Enable Maintenance
**POST** `/v2/admin/maintenance/on`
```json
{
  "message": "Custom maintenance message (optional)",
  "untilIso": "2025-09-23T21:00:00Z (optional)"
}
```

### Disable Maintenance
**POST** `/v2/admin/maintenance/off`
- No body required

### Check Status
**GET** `/v2/maintenance`
```json
{
  "enabled": true,
  "message": "Quick update in progress",
  "untilIso": "2025-09-23T21:00:00Z"
}
```

## Environment Variables

You can also set maintenance mode via environment variables (requires restart):

```bash
MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE="We're shipping an update."
MAINTENANCE_UNTIL="2025-09-23T21:00:00Z"
```

## Use Cases

### Alpha Testing
- Turn on maintenance before deploying updates
- Test new features safely
- Turn off when ready for users

### Emergency Response
- Quickly disable access if issues arise
- Keep admin functions available for debugging
- Turn off when resolved

### Scheduled Maintenance
- Set maintenance with ETA
- Users see expected return time
- Automatic recovery

## Technical Details

- **Non-invasive**: Uses Fastify `onRequest` hook
- **Runtime toggles**: No redeploy needed
- **Proper HTTP semantics**: Returns 503 with `Retry-After: 120`
- **Safe fallback**: Network errors don't trigger maintenance mode
- **Admin bypass**: Health and admin endpoints always work

## Troubleshooting

### Maintenance Mode Won't Turn Off
1. Check your admin token: `echo $ADMIN_TOKEN`
2. Verify the endpoint: `curl -v "https://mineboy-g5xo.onrender.com/v2/maintenance"`
3. Check server logs for errors

### Users Still See Normal App
1. Verify maintenance is enabled: `curl "https://mineboy-g5xo.onrender.com/v2/maintenance"`
2. Check if frontend is caching responses
3. Wait up to 30 seconds for frontend polling to detect changes

### Admin Endpoints Blocked
- Admin endpoints should never be blocked
- Check the bypass list in the maintenance route
- Verify you're using the correct admin token

## Security Notes

- Admin token is required for all maintenance controls
- Maintenance state is in-memory (resets on server restart)
- Environment variables provide persistent defaults
- All admin endpoints bypass maintenance mode

---

**For alpha testing with live users, this system provides a clean way to temporarily disable access while keeping full admin control.**
