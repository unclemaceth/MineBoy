# MineBoy Carousel Extraction Plan
**Status**: IN PROGRESS - Phase 3 of 4  
**Date**: October 10, 2025

## Extraction Strategy (Optimized)

### ✅ Phase 1: Foundation (COMPLETE)
- EnhancedShell color variants
- MineBoyCarousel container
- pagev2.tsx safety copy
- MineBoyDeviceExtracted skeleton

### 🔄 Phase 2: Full Device Extraction (IN PROGRESS)
**Approach**: Write complete working MineBoyDevice in ONE file

**What goes in MineBoyDevice** (device-specific):
- All state from lines 83-160
- Worker hooks (lines 228-320)
- All effects (lines 330-600)
- Event handlers (lines 608-1528):
  - handleConnect
  - handleInsertCartridge
  - handleAlchemyCartridgeSelect
  - handleCartridgeSelect
  - handleA (start/stop mining)
  - handleB (claim)
  - handleClaim (full claim flow)
  - handleGetNewJob
  - handleReinsertCartridge
  - handleDpad
  - handleEjectButton
  - confirmEjectCart
  - fetchLockInfo
  - Keyboard shortcuts
- LCD display logic (lines 1529-1640)
- **FULL UI render** (lines 1641-3419):
  - HUD
  - Side button
  - Enhanced shell
  - CRT screen
  - All LCDs
  - All buttons
  - LEDs
  - D-pad
  - A/B buttons
  - Fan
  - Cartridge slot
  - All modals (Debug, Eject, JobExpired, etc.)
  - Claim overlay

**What stays in page.tsx** (global orchestrator):
- Single-tab enforcement
- Welcome modal
- Navigation modal (M/I/L buttons)
- WalletModal (global)
- RelayBridgeModal (global)
- Cartridge selection orchestration
- Global scrolling messages
- Season points
- Vault address state

### Phase 3: Orchestrator (NEXT)
Transform pagev2.tsx into simple orchestrator

### Phase 4: Testing (FINAL)
QA checklist validation

---

## File Structure

```
apps/minerboy-web/src/
├── app/
│   ├── page.tsx (ORIGINAL - untouched)
│   └── pagev2.tsx (NEW - orchestrator)
├── components/
│   ├── MineBoyDevice.tsx (NEW - full device)
│   ├── MineBoyCarousel.tsx (NEW - carousel)
│   └── art/
│       └── EnhancedShell.tsx (MODIFIED - color support)
```

---

## Time Estimate

- Phase 2 (Device Extraction): 2-3 hours (writing complete file)
- Phase 3 (Orchestrator): 30 mins
- Phase 4 (Testing): 1 hour
- **Total Remaining**: ~4 hours

---

Last updated: Oct 10, 2025 21:45 UTC


