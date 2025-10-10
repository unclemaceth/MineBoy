# MineBoy Carousel Implementation Status

**Date**: October 10, 2025  
**Status**: **Foundation Complete** - Ready for Device Extraction

---

## ✅ Completed Components

### 1. **EnhancedShell Color Variants** ✅
**File**: `/apps/minerboy-web/src/components/art/EnhancedShell.tsx`

- ✅ Added `color` prop: `'blue' | 'orange' | 'green'`
- ✅ Implemented hue-shifted gradients for each color
- ✅ Unique gradient IDs to prevent conflicts when multiple shells render
- ✅ Default color: `blue` (no breaking changes)

**Usage**:
```tsx
<EnhancedShell width={390} height={844} color="orange" />
```

---

### 2. **MineBoyCarousel Container** ✅
**File**: `/apps/minerboy-web/src/components/MineBoyCarousel.tsx`

- ✅ Stacks up to 3 MineBoy devices (all stay mounted)
- ✅ Arrow navigation (keyboard ← →)
- ✅ Swipe gestures (40px threshold)
- ✅ Dot indicators for quick switching
- ✅ Focus management (moves focus to active device)
- ✅ Analytics events (`carousel_mount`, `carousel_switch`)
- ✅ Only active device is interactive (`pointer-events: none` for others)
- ✅ z-index management (active on top)
- ✅ Accessibility labels and headings

**Interface**:
```tsx
interface MineBoyCarouselProps {
  devices: Array<{
    cartridge: OwnedCartridge;
    color: 'blue' | 'orange' | 'green';
  }>;
  onEject: (index: number) => void;
  playButtonSound?: () => void;
}
```

---

### 3. **MineBoyDevice Skeleton** ⚠️ PARTIAL
**File**: `/apps/minerboy-web/src/components/MineBoyDevice.tsx`

**✅ Complete**:
- TypeScript interface with all required props
- `forwardRef` for focus management
- Worker cleanup on unmount
- Session logging in dev mode
- Accessibility heading
- isActive handling (opacity, transform, pointer-events)
- Color-aware shell rendering

**❌ Needs Implementation**:
- Full UI extraction from `page.tsx` (3420 lines)
- All state management (mining, job, attempts, hr, etc.)
- All event handlers (A, B, D-pad, Connect, etc.)
- All LCD panels
- All modals (Debug, Eject Confirm, Job Expired)
- Complete worker integration

---

## 🚧 In Progress

### Device Extraction Strategy

**Challenge**: `page.tsx` is 3420 lines containing all MineBoy logic  
**Approach**: Systematic extraction in phases

#### Phase 1: State & Hooks (Lines 82-600)
**What to extract**:
- All device-local state (`useState`)
- Worker hooks (`useMinerWorker`)
- Session management (`useSession`)
- Miner store (`useMinerStore`)
- Effects for heartbeat, cooldown, blink, etc.

**Keep in page.tsx (global)**:
- Wallet connection (`useActiveAccount`)
- Global modals (WalletModal, NavigationModal)
- Cartridge selection UI

#### Phase 2: Event Handlers (Lines 600-1200)
**What to extract**:
- `handleConnect` / `handleDisconnect`
- `handleA` / `handleB`
- `handleDpad`
- `handleInsertCartridge` / `handleEjectButton`
- `handleClaim` / `handleGetNewJob`
- All other button handlers

#### Phase 3: UI Components (Lines 1640-3400)
**What to extract**:
- HUD
- Shell background
- CRT screen (terminal/visualizer)
- All LCD panels (Hash, Status, HashRate, Progress)
- All buttons (A, B, D-pad, Connect, Menu, Wallet)
- LEDs
- Fan
- Cartridge slot
- MineBoy branding
- NPC art

**Keep in page.tsx**:
- Stage wrapper
- Global modals (WalletModal, NavigationModal, RelayBridgeModal)

#### Phase 4: Modals (Lines 2700-3400)
**What to extract (device-specific)**:
- Debug Modal
- Eject Confirm Modal
- Job Expired Modal
- PaidMessageModal
- MineStrategyModal
- ClaimOverlay

**Keep in page.tsx (global)**:
- WalletModal
- NavigationModal
- RelayBridgeModal
- CartridgeSelectionModal

---

## 📋 Remaining TODOs

### 1. **Feature Branch & Flag** ⏳ PENDING
```bash
git checkout -b feature/carousel-mineboys
```

Add to `.env.local`:
```bash
NEXT_PUBLIC_MINEBOY_CAROUSEL=true
```

---

### 2. **Complete Device Extraction** ⏳ IN PROGRESS
**Estimated Effort**: 4-6 hours

**Steps**:
1. Copy state declarations (lines 82-220 from page.tsx)
2. Copy worker integration (lines 228-320)
3. Copy all effects (lines 330-600)
4. Copy event handlers (lines 600-1200)
5. Copy LCD text logic (lines 1400-1600)
6. Copy full JSX render (lines 1640-3400)
7. Test incrementally

**Testing Checklist**:
- [ ] Device renders without errors
- [ ] Mining starts/stops correctly
- [ ] Worker cleanup on unmount
- [ ] Session management works
- [ ] All buttons functional
- [ ] Modals open/close
- [ ] Sound effects play

---

### 3. **Page.tsx Refactor** ⏳ PENDING
**File**: `/apps/minerboy-web/src/app/page.tsx`

Transform into orchestrator:
```tsx
function Home() {
  const [selectedCartridges, setSelectedCartridges] = useState<OwnedCartridge[]>([]);
  const featureFlag = process.env.NEXT_PUBLIC_MINEBOY_CAROUSEL === 'true';
  
  const devices = selectedCartridges.slice(0, 3).map((cart, idx) => ({
    cartridge: cart,
    color: ['blue', 'orange', 'green'][idx] as const,
  }));

  return (
    <Stage>
      {featureFlag && devices.length > 0 ? (
        <MineBoyCarousel
          devices={devices}
          onEject={(idx) => {
            setSelectedCartridges(prev => prev.filter((_, i) => i !== idx));
          }}
          playButtonSound={playButtonSound}
        />
      ) : (
        /* Current single-device UI (fallback) */
        <div>...</div>
      )}
      
      {/* Global modals */}
      <WalletModal ... />
      <NavigationModal ... />
      <RelayBridgeModalSDK ... />
    </Stage>
  );
}
```

---

### 4. **Session Isolation Logging** ⏳ PENDING
Add to MineBoyDevice `useEffect`:
```tsx
useEffect(() => {
  if (process.env.NODE_ENV === 'development' && mining) {
    console.log('[MineBoyDevice] Mining state:', {
      sessionId: sessionId?.slice(0, 8) + '...',
      tokenId: cartridge.tokenId,
      minerId: getMinerIdCached().slice(0, 8) + '...',
      color,
      hr,
      attempts,
    });
  }
}, [mining, sessionId, cartridge.tokenId, color, hr, attempts]);
```

---

### 5. **Keyboard Routing** ⏳ PENDING
Currently handled by MineBoyCarousel for ← → (carousel navigation).

**Needs**:
- Game keys (A, B, D-pad, etc.) routed only to active device
- Window-level listener in carousel, delegates to active device

---

### 6. **Styling Polish** ⏳ PENDING
- [x] Inactive device opacity: 0.75
- [x] Inactive device scale: 0.97
- [x] Transition: 0.3s ease
- [ ] Test on mobile (touch targets)
- [ ] Verify no layout thrash during switch

---

### 7. **QA Checklist** ⏳ PENDING
- [ ] 1 device: navigation hidden, mining works
- [ ] 2 devices: background device keeps mining while hidden
- [ ] 3 devices: all three mine simultaneously
- [ ] Switch devices while claiming: no double-submit
- [ ] Eject mid-mining: worker terminates cleanly
- [ ] Mobile swipe: threshold feels good (~40px)
- [ ] Color gradients: no banding, visually distinct

---

### 8. **Telemetry** ⏳ PENDING
Already implemented in MineBoyCarousel:
- [x] `carousel_mount` (device_count, colors)
- [x] `carousel_switch` (from_index, to_index, direction)

**Needs**:
- [ ] `device.mining.hr_tick` per device (sampled, tagged by index/color)

---

## 🏗️ Architecture Summary

### Current Structure (Before Carousel)
```
page.tsx (3420 lines)
├─ All state, logic, UI
└─ Single MineBoy device
```

### Target Structure (After Carousel)
```
page.tsx (~200 lines - orchestrator)
├─ Wallet connection
├─ Cartridge selection
├─ Global modals
└─ MineBoyCarousel
    ├─ MineBoyDevice #1 (blue)
    │   ├─ Own state, worker, session
    │   └─ Full UI & modals
    ├─ MineBoyDevice #2 (orange)
    └─ MineBoyDevice #3 (green)
```

---

## 🚀 Next Steps

### Immediate (1-2 hours)
1. **Finish MineBoyDevice extraction**
   - Copy state + hooks from page.tsx lines 82-600
   - Copy event handlers from lines 600-1200
   - Copy render JSX from lines 1640-3400

### Short-term (2-4 hours)
2. **Refactor page.tsx** to orchestrator pattern
3. **Add feature flag** (`NEXT_PUBLIC_MINEBOY_CAROUSEL`)
4. **Test with 1 device** (verify nothing broke)

### Medium-term (4-6 hours)
5. **Test with 2-3 devices** (verify background mining)
6. **QA all interactions** (eject, switch, claim)
7. **Mobile testing** (swipe, touch targets)
8. **Performance audit** (GPU overdraw, layout thrash)

### Long-term (Future)
9. **Analytics review** (carousel usage metrics)
10. **A/B test** feature flag in production
11. **Remove old single-device code** (if successful)

---

## 🐛 Known Risks

### Worker Contention
**Risk**: Three workers @ 5k H/s each = 15k H/s CPU load  
**Mitigation**: Pause workers when tab is backgrounded

### Session Limits
**Risk**: Wallet max sessions = 3 (hard coded in backend)  
**Mitigation**: UI prevents 4th device, shows "Max devices reached"

### Pointer Events
**Risk**: Some browsers still deliver wheel/scroll to inactive layers  
**Mitigation**: Explicitly block all events on inactive devices

---

## 📊 Progress

| Component | Status | Lines | Effort |
|-----------|--------|-------|--------|
| EnhancedShell | ✅ | 95 | Done |
| MineBoyCarousel | ✅ | 220 | Done |
| MineBoyDevice skeleton | ⚠️ | 180 | 50% |
| MineBoyDevice full | ❌ | ~3000 | 0% |
| page.tsx refactor | ❌ | ~200 | 0% |
| **TOTAL** | **⏳** | **~3695** | **15%** |

---

## 🎯 Definition of Done

- [ ] All 3 colors render correctly (blue, orange, green)
- [ ] Carousel navigation works (arrows, keyboard, swipe, dots)
- [ ] Each device mines independently in background
- [ ] Only active device is interactive
- [ ] Worker cleanup on unmount (no leaks)
- [ ] Session management per device
- [ ] Feature flag toggles old/new behavior
- [ ] All tests pass
- [ ] Performance acceptable (no lag during switch)
- [ ] Analytics tracking carousel usage
- [ ] Mobile UX validated
- [ ] Production-ready (no console errors)

---

## 📖 References

- **Original Spec**: GPT-4 implementation guide (see chat history)
- **Session Management**: `packages/backend/src/sessions.ts`
- **Anti-Bot**: `packages/backend/src/jobs.ts` (lines 215-256)
- **Worker**: `apps/minerboy-web/src/hooks/useMinerWorker.ts`

---

**Last Updated**: Oct 10, 2025 by Cursor AI


