# Dynamic Hashrate Deployment Guide

## 🚀 Overview

This deployment adds **secure, server-driven dynamic hashrates** based on pickaxe type:
- **DripAxe**: 8000 H/s
- **PickHammer**: 7000 H/s
- **Blue Steel**: 6000 H/s
- **Base/Unknown**: 5000 H/s

**Key Security Feature:** Backend determines hashrate from Alchemy metadata. Frontend **cannot override** this value, preventing physics validation bypass.

---

## 📋 Prerequisites

1. **NodeCache** package (already in backend dependencies)
2. **Alchemy API Key** (already configured)
3. Backend and Frontend deployed

---

## 🔧 Backend Deployment (Render)

### Step 1: Environment Variables

**IMPORTANT:** You need to update ONE env var on Render:

#### Update Existing Env Var:
```bash
# OLD VALUE (was 5000):
MINER_MAX_HPS=5000

# NEW VALUE (set to max possible):
MINER_MAX_HPS=8000
```

**Why?** This env var is now a fallback/max cap. The actual hashrate is determined per-pickaxe by the backend. Setting it to 8000 ensures DripAxe users aren't capped.

#### Verify These Exist (should already be set):
```bash
ALCHEMY_API_KEY=3YobnRFCSYEuIC5c1ySEs
NEXT_PUBLIC_ALCHEMY_API_KEY=3YobnRFCSYEuIC5c1ySEs
```

### Step 2: Deploy Backend

1. Go to Render dashboard: https://dashboard.render.com
2. Find your backend service: `mineboy-g5xo`
3. Click "Environment" tab
4. Update `MINER_MAX_HPS` to `8000`
5. Click "Manual Deploy" → "Deploy latest commit"
6. Wait for deployment to complete (~2-3 minutes)

### Step 3: Verify Backend Logs

After deployment, check logs for:
```
[PICKAXE_FETCH] Getting hashrate for 0x3322...D25:133...
[PickaxeCache] Fetching metadata for 0x3322...D25:133...
[PickaxeCache] 0x3322...d25:133 -> Type: The DripAxe, HashRate: 8000 H/s
[PICKAXE_HASHRATE] Using 8000 H/s for wallet:0x3322...D25:133
```

If you see these logs, the backend is working correctly! ✅

---

## 🎨 Frontend Deployment (Vercel)

### Step 1: Environment Variables

**NO CHANGES NEEDED!** Frontend uses existing env vars:
- `NEXT_PUBLIC_ALCHEMY_API_KEY` (already set)
- `NEXT_PUBLIC_API_BASE` (already set)

### Step 2: Deploy Frontend

Vercel will auto-deploy from the `B` branch push. Monitor at:
https://vercel.com/macs-projects-20ae48e1/minerboy-web

### Step 3: Verify Frontend

1. Open https://mineboy.vercel.app
2. Connect wallet
3. Select a pickaxe
4. Check browser console for:
```
[PICKAXE_HASHRATE] Using pickaxe hashrate: 8000 H/s
[START] New STRICT mining session: ..., maxHps=8000, wallet=...
```

If you see `maxHps=8000` for DripAxe (or 7000/6000 for others), it's working! ✅

---

## 🧪 Testing Checklist

### Test 1: DripAxe (8000 H/s)
1. Select DripAxe pickaxe
2. Start mining
3. Check console: `maxHps=8000`
4. Submit claim
5. **Expected:** Claim succeeds (not rejected as "too fast")

### Test 2: PickHammer (7000 H/s)
1. Select PickHammer pickaxe
2. Start mining
3. Check console: `maxHps=7000`
4. Submit claim
5. **Expected:** Claim succeeds

### Test 3: Blue Steel (6000 H/s)
1. Select Blue Steel pickaxe
2. Start mining
3. Check console: `maxHps=6000`
4. Submit claim
5. **Expected:** Claim succeeds

### Test 4: Old Cartridge (5000 H/s)
1. If you still have an old cartridge, select it
2. Start mining
3. Check console: `maxHps=5000`
4. Submit claim
5. **Expected:** Claim succeeds

### Test 5: NPC Multiplier Display
1. If you own ≥1 NPC, check HUD
2. **Expected:** Shows "1.2x NAPC (X)" where X is your NPC count
3. If you own 0 NPCs, check HUD
4. **Expected:** Shows "1.0x BASE"

---

## 🔍 Troubleshooting

### Issue: Claims Rejected as "Too Fast"

**Symptom:** Backend logs show:
```
[ANTI-BOT] REJECTED too fast: 50000 hashes in 5000ms (min: 8000ms)
```

**Cause:** Backend is still using old `MINER_MAX_HPS=5000`

**Fix:**
1. Check Render env var: `MINER_MAX_HPS` should be `8000`
2. Redeploy backend
3. Clear backend cache (restart service)

---

### Issue: All Pickaxes Mine at 5000 H/s

**Symptom:** Console shows `maxHps=5000` for all pickaxes

**Cause:** Backend can't fetch metadata from Alchemy

**Fix:**
1. Check backend logs for Alchemy errors
2. Verify `ALCHEMY_API_KEY` is set correctly
3. Check Alchemy API quota/rate limits
4. Verify pickaxe contract address is correct: `0x3322b37349AeFD6F50F7909B641f2177c1D34D25`

---

### Issue: NPC Multiplier Shows 0 NPCs (but I own some)

**Symptom:** HUD shows "1.0x BASE" but you own NPCs

**Cause:** Frontend can't read NPC contract

**Fix:**
1. Check browser console for wagmi errors
2. Verify NPC contract address: `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`
3. Check wallet connection (disconnect/reconnect)
4. Wait 30 seconds (refetch interval)

---

### Issue: Metadata Cache Not Working

**Symptom:** Backend logs show repeated Alchemy fetches for same pickaxe

**Cause:** NodeCache not initialized or cache cleared

**Fix:**
1. Check backend logs for `[PickaxeCache] Cache hit: ...`
2. If no cache hits, restart backend service
3. Verify NodeCache is installed: `npm list node-cache`

---

## 📊 Monitoring

### Backend Metrics to Watch

1. **Alchemy API Calls:**
   - Should see 1 call per unique pickaxe per hour
   - Cache hits should be > 90% after first hour

2. **Physics Validation:**
   - Should see NO "too fast" rejections for legitimate users
   - Timing ratios should be 0.85-1.5x (within slack tolerance)

3. **Job Creation Time:**
   - Should be < 200ms (including Alchemy fetch)
   - Cache hits should be < 50ms

### Frontend Metrics to Watch

1. **Mining Speed:**
   - DripAxe: ~8000 H/s displayed
   - PickHammer: ~7000 H/s displayed
   - Blue Steel: ~6000 H/s displayed

2. **Claim Success Rate:**
   - Should be > 95% for legitimate mining
   - No increase in "too fast" errors

---

## 🔄 Rollback Plan

If issues occur, rollback is simple:

### Backend Rollback:
1. Go to Render dashboard
2. Set `MINER_MAX_HPS=5000`
3. Redeploy previous commit
4. All pickaxes will mine at base rate (safe fallback)

### Frontend Rollback:
1. Revert to previous commit on GitHub
2. Vercel will auto-deploy
3. Frontend will use `job.maxHps` from backend (still works)

**Note:** Rollback is non-breaking. System degrades gracefully to base hashrate.

---

## ✅ Success Criteria

Deployment is successful when:

1. ✅ DripAxe users mine at 8000 H/s
2. ✅ PickHammer users mine at 7000 H/s
3. ✅ Blue Steel users mine at 6000 H/s
4. ✅ Claims succeed for all pickaxe types
5. ✅ No "too fast" physics rejections for legitimate users
6. ✅ NPC multiplier displays correctly in HUD
7. ✅ Backend logs show metadata caching working
8. ✅ Alchemy API calls are < 100/hour (with caching)

---

## 📝 Post-Deployment

### 1. Announce to Users

**Example Message:**
```
🚀 NEW: Dynamic Mining Speeds!

Your pickaxe now determines your mining speed:
• DripAxe: 8000 H/s (60% faster!)
• PickHammer: 7000 H/s (40% faster!)
• Blue Steel: 6000 H/s (20% faster!)

Plus, NPC holders get a 1.2x multiplier on all rewards!

Happy mining! ⛏️
```

### 2. Monitor for 24 Hours

- Watch for physics validation errors
- Check Alchemy API usage
- Monitor claim success rates
- Gather user feedback

### 3. Optimize if Needed

- Adjust cache TTL if metadata changes frequently
- Tune physics validation slack if needed
- Add more pickaxe types to hashrate map

---

## 🔐 Security Notes

1. **Client Cannot Override Hashrate**
   - Frontend displays hashrate but doesn't control it
   - Worker uses `job.maxHps` from backend (immutable)
   - Tampering with worker has no effect on validation

2. **Physics Validation Still Works**
   - Backend validates claims against correct pickaxe hashrate
   - Prevents GPU mining and bot attacks
   - Slack tolerance remains at 85%

3. **Metadata Caching**
   - Reduces Alchemy API calls
   - Prevents rate limiting
   - 1-hour TTL balances freshness vs. performance

---

## 📞 Support

If you encounter issues:
1. Check backend logs on Render
2. Check browser console on frontend
3. Review `DYNAMIC_HASHRATE_SECURITY_AUDIT.md`
4. Contact dev team with logs

---

**Deployment Date:** _[Fill in after deployment]_  
**Deployed By:** _[Your name]_  
**Status:** _[Success/Issues/Rollback]_
