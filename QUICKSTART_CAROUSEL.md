# MineBoy Carousel - Quick Start Guide 🚀

**Get the carousel up and running in 5 minutes!**

---

## ⚡ Enable the Feature (Development)

### Step 1: Add Feature Flag
Create or edit `.env.local` in the `apps/minerboy-web/` directory:

```bash
NEXT_PUBLIC_MINEBOY_CAROUSEL=true
```

### Step 2: Restart Dev Server
```bash
cd /Users/mattrenshaw/ApeBit\ Miner/apps/minerboy-web
npm run dev
```

### Step 3: Open in Browser
Navigate to `http://localhost:3000`

---

## 🎮 Quick Test Sequence (5 minutes)

### Test 1: Landing Page
- ✅ Should see "MineBoy™ Carousel" title
- ✅ Connect your wallet
- ✅ Click "INSERT CARTRIDGE"

### Test 2: First Device
- ✅ Select cartridge #1 from modal
- ✅ Device appears in **BLUE shell**
- ✅ Press A button (or Z key) to start mining
- ✅ Watch fan spin, hash LCD update

### Test 3: Add Second Device
- ✅ Click "+ ADD MINEBOY (1/3)" button (top-right)
- ✅ Select cartridge #2 (different from #1)
- ✅ Device appears in **ORANGE shell**
- ✅ Carousel controls appear (arrows, dots)
- ✅ Switch to device #2, press A to mine

### Test 4: Parallel Mining
- ✅ Both devices should be mining simultaneously
- ✅ Switch between them (arrow keys or buttons)
- ✅ Each device shows correct hash rate/progress
- ✅ **CRITICAL**: Both fans spin (even when not active)

### Test 5: Add Third Device
- ✅ Click "+ ADD MINEBOY (2/3)"
- ✅ Select cartridge #3
- ✅ Device appears in **GREEN shell**
- ✅ All 3 devices mine in background
- ✅ Switch between them smoothly

---

## 🛑 Disable the Feature (Rollback)

### Option 1: Feature Flag (Instant)
Edit `.env.local`:
```bash
NEXT_PUBLIC_MINEBOY_CAROUSEL=false
```
Restart dev server. Falls back to original single-device mode.

### Option 2: Remove Flag Entirely
Delete the `NEXT_PUBLIC_MINEBOY_CAROUSEL` line from `.env.local`.  
Defaults to `false` (original behavior).

---

## 🐛 Troubleshooting

### Problem: "Carousel not showing, still seeing original UI"
**Solution**: 
1. Check `.env.local` has `NEXT_PUBLIC_MINEBOY_CAROUSEL=true`
2. Restart dev server (`Ctrl+C`, then `npm run dev`)
3. Hard refresh browser (`Cmd+Shift+R` or `Ctrl+Shift+R`)

### Problem: "Devices not mining in background"
**Solution**:
1. Open DevTools → Console
2. Look for `[MineBoyDevice][blue/orange/green] Mining: ...` logs
3. Check each device has unique `sessionId`
4. Verify all 3 Web Workers active (DevTools → Sources → Threads)

### Problem: "Can't add more than 1 device"
**Solution**:
1. Check backend `WALLET_SESSION_LIMIT` (default: 3)
2. Ensure each device uses different cartridge (no duplicates)
3. Check console for "This cartridge is already inserted" error

### Problem: "Build fails or TypeScript errors"
**Solution**:
```bash
npm run lint
npm run build
```
If errors persist, check:
- `MineBoyDevice.tsx` imports correct
- `MineBoyCarousel.tsx` props match interface
- `pagev2.tsx` exports correctly

---

## 📝 Next Steps

1. ✅ **Test thoroughly** - Run through CAROUSEL_QA_CHECKLIST.md (39 tests)
2. ✅ **Deploy to Staging** - Enable flag in staging environment
3. ✅ **Beta Test** - Select 10-20 power users for early access
4. ✅ **Monitor Metrics** - Watch CPU/memory/network usage
5. ✅ **Production Rollout** - Gradual deployment (10% → 100%)

---

## 📞 Need Help?

- **Documentation**: See `CAROUSEL_IMPLEMENTATION_COMPLETE.md`
- **QA Checklist**: See `CAROUSEL_QA_CHECKLIST.md`
- **Architecture**: See `EXTRACTION_PLAN.md`
- **Issues**: Open GitHub issue (label: `carousel-feature`)

---

**Happy Mining! ⛏️✨**

