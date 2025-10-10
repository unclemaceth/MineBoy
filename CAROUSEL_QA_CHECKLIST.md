# MineBoy Carousel - QA Checklist

**Feature**: Multi-device carousel allowing 1-3 simultaneous MineBoy instances
**Feature Flag**: `NEXT_PUBLIC_MINEBOY_CAROUSEL=true`

---

## 🎯 Pre-Flight Setup

### Environment Configuration
- [ ] Feature flag enabled in `.env.local`: `NEXT_PUBLIC_MINEBOY_CAROUSEL=true`
- [ ] App rebuilt after setting flag: `npm run build` or dev server restarted
- [ ] Browser console clear, no errors on load
- [ ] Network tab confirms all assets loading correctly

### Test Wallet Setup
- [ ] Test wallet has at least 3 APE Miner cartridges (different tokenIds)
- [ ] Test wallet has sufficient ApeChain APE for gas (0.1+ APE recommended)
- [ ] Test wallet connected via Rabby/MetaMask/WalletConnect
- [ ] Confirmed wallet network is ApeChain (chainId: 33139)

---

## 🚀 Basic Functionality Tests

### 1. Landing Page (No Devices)
- [ ] Loads with clean gradient background
- [ ] Shows "MineBoy™ Carousel" title
- [ ] Shows "CONNECT WALLET" button when disconnected
- [ ] Shows "INSERT CARTRIDGE" button when connected
- [ ] Footer buttons (Instructions, Leaderboard) work
- [ ] Welcome modal appears on first load (if not dismissed)

### 2. First Device Insertion
- [ ] Click "INSERT CARTRIDGE" opens CartridgeSelectionModal
- [ ] Modal shows all owned cartridges
- [ ] Select cartridge #1, modal closes
- [ ] Device appears in **blue shell**
- [ ] Device renders fully (buttons, LCDs, LEDs, shell)
- [ ] HUD shows correct pickaxe type and ID
- [ ] No carousel controls (dots/arrows) appear (only 1 device)

### 3. Second Device Insertion
- [ ] Click "+ ADD MINEBOY (1/3)" button (top-right)
- [ ] CartridgeSelectionModal opens
- [ ] Select different cartridge #2, modal closes
- [ ] Device appears in **orange shell**
- [ ] Carousel controls appear (dots, arrows, status "[1/2] MineBoy")
- [ ] Can swipe/arrow between devices
- [ ] Inactive device has reduced opacity and scale
- [ ] Both devices remain mounted (check React DevTools)

### 4. Third Device Insertion
- [ ] Click "+ ADD MINEBOY (2/3)" button
- [ ] Select cartridge #3
- [ ] Device appears in **green shell**
- [ ] Status shows "[1/3] MineBoy" or active index
- [ ] All 3 devices remain mounted
- [ ] "+ADD MINEBOY" button disappears (max reached)

### 5. Device Ejection
- [ ] Click side button on device #2 (orange)
- [ ] Eject confirmation modal appears
- [ ] Confirm ejection
- [ ] Device #2 removed, carousel updates
- [ ] Remaining devices shift (green becomes #2)
- [ ] "+ADD MINEBOY" button reappears
- [ ] Can re-insert the same cartridge

---

## ⛏️ Mining Operations Tests

### 6. Single Device Mining
- [ ] Select device #1 (blue)
- [ ] Press A button or Z key
- [ ] Mining starts (fan spins, MNE LED blinks)
- [ ] Hash LCD updates in real-time
- [ ] Progress LCD shows "Mining..." or progress %
- [ ] Hash Rate LCD shows H/s
- [ ] Visualizer shows nibbles animating
- [ ] Console logs show `[MineBoyDevice][blue] Mining:` with sessionId/minerId

### 7. Multi-Device Mining (Parallel)
- [ ] With 3 devices inserted
- [ ] Switch to device #1, press A (start mining)
- [ ] Switch to device #2, press A (start mining)
- [ ] Switch to device #3, press A (start mining)
- [ ] All 3 LEDs should show MNE blinking (visible when switching)
- [ ] **CRITICAL**: All 3 devices mine simultaneously in background
- [ ] Switch between devices - each shows correct hash/HR/progress
- [ ] Console logs show 3 unique sessionIds (one per cartridge)

### 8. Worker Isolation & Cleanup
- [ ] Start mining on device #1
- [ ] Eject device #1 (side button)
- [ ] Confirm ejection
- [ ] Page reloads (expected behavior)
- [ ] Check console: should see `[MineBoyDevice] Unmounting blue cart... cleaning up`
- [ ] No worker errors or "hardKill" failures

### 9. Session Locking (Anti-Bot)
- [ ] Start mining on cartridge #1 (device #1)
- [ ] Eject device #1, re-insert same cartridge
- [ ] Try to start mining immediately
- [ ] Should show "CARTRIDGE LOCKED" warning (60s cooldown)
- [ ] Wait 60s, should allow mining again
- [ ] **Multi-device test**: Insert cartridge #1 in device #1, cartridge #2 in device #2
- [ ] Start mining on both
- [ ] Eject device #2, re-insert cartridge #2 as device #3
- [ ] Should work (different slot, same cartridge session)

---

## 🎮 Navigation & Interaction Tests

### 10. Carousel Navigation - Arrows
- [ ] Click right arrow → moves to next device
- [ ] Click left arrow → moves to previous device
- [ ] Wraps around (device 3 → device 1)
- [ ] Active device opacity/scale correct
- [ ] Inactive devices dimmed and unclickable

### 11. Carousel Navigation - Keyboard
- [ ] Press Right Arrow → moves to next device
- [ ] Press Left Arrow → moves to previous device
- [ ] Z key → triggers A button on **active** device only
- [ ] X key → triggers B button on **active** device only
- [ ] D key → opens debug modal for **active** device only

### 12. Carousel Navigation - Swipe (Mobile/Touch)
- [ ] Swipe left → moves to next device
- [ ] Swipe right → moves to previous device
- [ ] Smooth animation
- [ ] No double-swipe issues

### 13. Carousel Dots Indicator
- [ ] Dots show correct count (1-3 dots)
- [ ] Active dot is highlighted (white)
- [ ] Inactive dots are dimmed (white/30%)
- [ ] Click dot #2 → jumps to device #2

### 14. Focus Management
- [ ] Switch to device #2 (orange)
- [ ] Device #2 should have keyboard focus (check with Tab key)
- [ ] Keyboard shortcuts (Z/X/Arrows) work on active device
- [ ] Screen reader announces "MineBoy Orange - Cartridge #X" (if SR enabled)

---

## 🛡️ Anti-Bot & Backend Integration Tests

### 15. Rate Limiting (Per-Wallet)
- [ ] Start mining on device #1
- [ ] Rapidly press A 10+ times (trying to get multiple jobs)
- [ ] Should show "RATE LIMIT EXCEEDED" message
- [ ] Cooldown timer displayed
- [ ] After cooldown, can mine again

### 16. Cadence Gating (Per-Cartridge)
- [ ] Complete a job on device #1 (find hash, claim)
- [ ] Immediately press A again on device #1
- [ ] Should show "No job available (cadence gate) - wait a moment"
- [ ] Wait 10-15s, press A again
- [ ] New job issued successfully

### 17. Heartbeat (Session Keep-Alive)
- [ ] Start mining on device #1
- [ ] Leave tab open for 2+ minutes
- [ ] Device continues mining (check HR LCD, progress)
- [ ] No "Session expired" errors
- [ ] Console logs show `[Heartbeat] ...` every ~10s

### 18. Claim Verification (Physics Checks)
- [ ] Start mining on device #1
- [ ] Find a hash naturally (wait for "HASH FOUND")
- [ ] Press B or click "Claim"
- [ ] Claim succeeds (transaction submitted)
- [ ] Backend accepts claim
- [ ] New job issued
- [ ] **Anti-cheat**: If hash found "too fast" (< 1s), should reject with "CLAIM TOO FAST" message

---

## 🔧 Edge Cases & Error Handling

### 19. Wallet Disconnect During Mining
- [ ] Start mining on device #1
- [ ] Disconnect wallet (via wallet extension)
- [ ] Device should stop mining
- [ ] "DISCONNECTED" shown in status LCD
- [ ] Reconnect wallet
- [ ] Can restart mining

### 20. Network Switch During Mining
- [ ] Start mining on device #1 (ApeChain)
- [ ] Switch network to Ethereum mainnet (via wallet)
- [ ] Device should stop mining or show error
- [ ] Switch back to ApeChain
- [ ] Can restart mining

### 21. Browser Tab Visibility (Background Mining)
- [ ] Start mining on all 3 devices
- [ ] Switch to different browser tab (e.g., YouTube)
- [ ] Leave tab inactive for 1+ minute
- [ ] Switch back to MineBoy tab
- [ ] **CRITICAL**: All 3 devices should still be mining
- [ ] Hash rates and progress correct
- [ ] No workers terminated

### 22. Page Reload (State Loss)
- [ ] Start mining on device #2
- [ ] Refresh page (Cmd+R or F5)
- [ ] Page reloads to landing (no devices)
- [ ] Expected: all sessions closed, clean slate
- [ ] Re-insert cartridges
- [ ] Can mine normally

### 23. Duplicate Cartridge Prevention
- [ ] Insert cartridge #1 as device #1
- [ ] Click "+ ADD MINEBOY"
- [ ] Try to select cartridge #1 again
- [ ] Should show alert: "This cartridge is already inserted in another MineBoy"
- [ ] Modal stays open, can select different cartridge

### 24. Max Devices Limit
- [ ] Insert 3 devices
- [ ] "+ ADD MINEBOY" button hidden
- [ ] Try to insert via URL param or dev tools hack (if possible)
- [ ] Should be blocked at orchestrator level

### 25. Modal Interactions (Global vs Device-Local)
- [ ] Open Wallet Modal from device #1
- [ ] Wallet Modal overlays entire screen (z-index correct)
- [ ] Close modal
- [ ] Open Debug Modal from device #2
- [ ] Debug Modal shows device #2's info (color, sessionId)
- [ ] Close modal
- [ ] Open MineStrategy (Flywheel) Modal
- [ ] Modal global, shared state correct

---

## 🎨 Visual & UX Tests

### 26. Shell Colors
- [ ] Device #1 is **blue** (original color)
- [ ] Device #2 is **orange** (gradient colors shifted)
- [ ] Device #3 is **green** (gradient colors shifted)
- [ ] Shell gradients smooth, no artifacts
- [ ] Eject device #1, re-insert → becomes blue again (color based on slot, not cartridge)

### 27. Animations & Transitions
- [ ] Swipe transition smooth (300ms ease-out)
- [ ] Opacity fade on inactive devices
- [ ] Scale transform on inactive devices (0.97)
- [ ] Dots animate on click
- [ ] Arrows have hover state
- [ ] No visual jank or flicker

### 28. Responsive Design (Mobile)
- [ ] Test on iPhone 13 (390x844)
- [ ] Test on Android phone (similar resolution)
- [ ] Swipe gestures work
- [ ] Buttons sized correctly
- [ ] Text readable
- [ ] No horizontal scroll

### 29. Accessibility (A11Y)
- [ ] Screen reader announces device count "[1/3] MineBoy"
- [ ] Inactive devices have `aria-hidden="true"`
- [ ] Active device focusable (tabindex=0)
- [ ] Buttons have `aria-label` attributes
- [ ] Keyboard navigation works (Tab, Shift+Tab)
- [ ] High contrast mode readable (if OS supports)

---

## 📊 Performance & Monitoring

### 30. Worker Performance
- [ ] Open DevTools → Performance tab
- [ ] Start mining on 3 devices
- [ ] Record for 30s
- [ ] Check CPU usage (should be < 80% total)
- [ ] No main thread blocking (< 50ms frames)
- [ ] Web Workers running in parallel (check worker threads)

### 31. Memory Usage
- [ ] Open DevTools → Memory tab
- [ ] Take heap snapshot (baseline)
- [ ] Insert 3 devices, start mining
- [ ] Run for 5 minutes
- [ ] Take another heap snapshot
- [ ] Memory growth < 50MB (no major leaks)
- [ ] Eject all devices
- [ ] Take final snapshot
- [ ] Memory released (back near baseline)

### 32. Console Logs (Dev Mode)
- [ ] Dev mode enabled: `NODE_ENV=development`
- [ ] Console shows device lifecycle:
    - `[MineBoyDevice] Mounted`
    - `[MineBoyDevice][blue] Mining: { sessionId, tokenId, minerId, hr }`
    - `[MineBoyDevice][FOUND] { color, tokenId, result }`
    - `[MineBoyDevice] Unmounting... cleaning up`
- [ ] No excessive logging (< 10 logs/second)
- [ ] No errors or warnings (except expected)

### 33. Network Requests
- [ ] Open DevTools → Network tab
- [ ] Start mining on device #1
- [ ] Check requests:
    - POST `/v2/session/open` (once)
    - POST `/v2/session/heartbeat` (every ~10s)
    - GET `/v2/jobs` (when A pressed)
    - POST `/v2/claims` (when hash claimed)
- [ ] No failed requests (200/201 status)
- [ ] Response times < 500ms

---

## 🔍 Regression Tests (Original Features)

### 34. HUD & Scrolling Messages
- [ ] HUD displays correct pickaxe type/ID
- [ ] Multiplier badge shows (if NPCs owned)
- [ ] Season points display correct
- [ ] Scrolling messages animate smoothly
- [ ] Click message bar → opens PaidMessageModal

### 35. Modals (All Global Modals)
- [ ] WalletModal: Connect/disconnect works
- [ ] NavigationModal: Leaderboard, Instructions, Mint pages load
- [ ] RelayBridgeModal: Bridge UI functional
- [ ] PaidMessageModal: Can submit paid messages
- [ ] MineStrategyModal: Flywheel modal functional

### 36. Sound Effects
- [ ] Button press sound (A, B, D-pad)
- [ ] Mining start sound (smooth loop)
- [ ] Mining stop sound (fade out)
- [ ] Confirm sound (hash found)
- [ ] Fail sound (error)
- [ ] Sound settings persist (localStorage)

---

## ✅ Final Verification

### 37. Production Readiness
- [ ] No console errors (except expected API 401s for Thirdweb, if any)
- [ ] No TypeScript errors in build
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Feature flag documented in README or ENV_VARS.md
- [ ] Git commit messages clear and descriptive

### 38. Rollback Plan
- [ ] Feature flag can be toggled off: `NEXT_PUBLIC_MINEBOY_CAROUSEL=false`
- [ ] Original `page.tsx` still functional (fallback works)
- [ ] No breaking changes to backend API
- [ ] Can revert to single-device behavior instantly

### 39. Documentation
- [ ] EXTRACTION_PLAN.md complete
- [ ] CAROUSEL_QA_CHECKLIST.md (this file) complete
- [ ] Code comments clear for future devs
- [ ] Component props documented (MineBoyDevice, MineBoyCarousel)

---

## 🎉 Sign-Off

**Tester**: _________________  
**Date**: _________________  
**Build Version**: _________________  
**Deployment Target**: [ ] Staging [ ] Production

**Overall Status**: [ ] ✅ PASS [ ] ❌ FAIL [ ] ⚠️ ISSUES FOUND

**Notes/Issues**:
```
[Add any bugs, edge cases, or concerns here]
```

---

**END OF QA CHECKLIST**


