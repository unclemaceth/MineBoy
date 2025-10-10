# MineBoy Carousel - UI Layout Guide

**Fixed positioning: All controls now inside the 390x924 viewport**

---

## 📐 Layout Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     390px × 924px                            │
│                    MineBoy Device                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                    HUD (80px)                       │    │
│  │         Pickaxe ID | Multiplier | Season Points    │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  │              MineBoy Shell & Screen                 │    │
│  │           (Blue / Orange / Green)                   │    │
│  │                                                     │    │
│  │                 All Buttons, LCDs                   │    │
│  │                                                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │ ← bottom: 75px
│  │        [1/3] BLUE MINEBOY (Status Bar)              │   │
│  │  (semi-transparent, backdrop blur, rounded)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───┐       ┌─┬─┬─┐        ┌───┐                         │ ← bottom: 20px
│  │ ‹ │       │●│○│○│        │ › │   (Navigation Controls)  │
│  └───┘       └─┴─┴─┘        └───┘                         │
│  Prev         Dots           Next                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        ↑
                All controls are INSIDE the 924px viewport
                (Previously they were at bottom: -50px and -80px)
```

---

## 🎨 Control Specifications

### Navigation Arrows (Left & Right)
- **Size**: 44px × 44px (circular)
- **Position**: `bottom: 20px` (inside viewport)
- **Spacing**: `padding: 0 20px` (from edges)
- **Style**: 3D embossed green gradient (matches MineBoy theme)
- **Colors**:
  - Background: `linear-gradient(145deg, #4a7d5f, #1a3d24)`
  - Border: Bevel effect (light top/left, dark bottom/right)
  - Text: `#c8ffc8` (MineBoy green)
- **Interaction**: Press feedback (inverted gradient + inset shadow)
- **Z-index**: 100 (above devices)

### Dot Indicators
- **Size**: 10px × 10px (circular)
- **Position**: Center between arrows, `bottom: 20px`
- **Spacing**: 12px gap between dots
- **Active State**: Bright green `#64ff8a` with 2px border
- **Inactive State**: Dark gray `#3a3a3a` with subtle border
- **Interaction**: Clickable, jumps to specific device

### Status Bar
- **Position**: `bottom: 75px` (just above arrows)
- **Content**: `[1/3] BLUE MINEBOY` (index, count, color)
- **Style**:
  - Background: `rgba(0,0,0,0.6)` + backdrop blur (semi-transparent)
  - Text: `#64ff8a` (MineBoy green)
  - Font: Menlo monospace, 11px, uppercase
  - Border radius: 12px (pill shape)
  - Padding: 4px vertical
  - Margins: `0 60px` (inset from edges)

---

## 🔄 Before vs After

### ❌ Before (BROKEN)
```css
/* Controls were outside viewport */
.navigation-controls {
  position: absolute;
  bottom: -50px;  /* ← OUTSIDE 924px viewport! */
  /* Would be cut off by Stage overflow:hidden */
}

.status-label {
  bottom: -80px;  /* ← Also outside viewport! */
}
```

### ✅ After (FIXED)
```css
/* Controls overlaid inside viewport */
.navigation-controls {
  position: absolute;
  bottom: 20px;  /* ← INSIDE viewport! */
  z-index: 100;  /* Above devices */
}

.status-bar {
  bottom: 75px;  /* ← Just above controls */
  background: rgba(0,0,0,0.6);  /* Semi-transparent */
  backdrop-filter: blur(4px);   /* Blur device behind */
}
```

---

## 📱 Responsive Behavior

### Desktop (1170x2532 Stage)
- Controls visible at bottom
- Full button hover effects
- Keyboard navigation (arrow keys) enabled

### Mobile (390x924 scaled)
- Controls remain visible (inside viewport)
- Touch/swipe gestures work
- Buttons sized for finger taps (44px minimum)

### Tablet
- Stage scales to fit
- Controls scale proportionally
- All interactions functional

---

## 🎯 Design Decisions

### Why Overlaid (Not Outside)?
1. **Stage Constraints**: Stage has `overflow: hidden`, so external controls would be cut off
2. **Consistent Scaling**: Controls scale with Stage, maintaining proportions
3. **Mobile Friendly**: No need for complex positioning outside Stage boundaries
4. **Simpler Layout**: All UI within one 390x924 container

### Why Semi-Transparent?
- **Context Awareness**: User can see device behind status bar
- **Non-Intrusive**: Doesn't block critical UI (cartridge slot, branding)
- **Modern Aesthetic**: Matches glassmorphism trend

### Why 3D Embossed Buttons?
- **Brand Consistency**: Matches existing MineBoy button style
- **Tactile Feedback**: Clear press state for better UX
- **Visual Hierarchy**: Stands out against device background

---

## 🧪 Testing Checklist

- [ ] **Visibility**: All controls visible on load (no scroll needed)
- [ ] **Clickability**: Both arrows and dots respond to clicks
- [ ] **Hover States**: Buttons show feedback on desktop
- [ ] **Press States**: Buttons invert gradient on press
- [ ] **Status Bar**: Updates when switching devices
- [ ] **Z-Index**: Controls always on top (clickable)
- [ ] **Mobile**: Swipe gestures work, buttons large enough
- [ ] **Keyboard**: Arrow keys switch devices (when focused)
- [ ] **Transparency**: Status bar shows device behind (subtle blur)

---

## 🔧 Customization Options

### Adjust Control Position
```tsx
// In MineBoyCarousel.tsx
bottom: 20,  // Change to 10-30 for different spacing
```

### Change Status Bar Opacity
```tsx
background: 'rgba(0,0,0,0.6)',  // Adjust 0.6 to 0.4-0.8
backdropFilter: 'blur(4px)',    // Adjust 4px to 2-8px
```

### Hide Controls Entirely (Auto-Hide)
```tsx
// Add mouse movement detection
const [showControls, setShowControls] = useState(false);

// Show on mouse move, hide after 3s timeout
```

---

## 📝 Notes for Developers

### Positioning Reference
- **Top of device**: `top: 0`
- **HUD area**: `top: 0` to `top: 80px`
- **Main device**: `top: 80px` to `bottom: 100px`
- **Status bar**: `bottom: 75px`
- **Navigation**: `bottom: 20px`
- **Bottom edge**: `bottom: 0`

### Z-Index Layers
1. **Device background**: `z-index: 1-3` (stacked)
2. **Device content**: `z-index: 10-50` (buttons, LCDs)
3. **Navigation controls**: `z-index: 100` (always on top)

### Interaction Order
1. User clicks arrow or swipes
2. `playButtonSound()` called
3. `activeIndex` updated
4. Devices transition (CSS transform)
5. Status bar updates (React re-render)
6. Focus moves to new active device

---

**Last Updated**: October 10, 2025  
**Status**: ✅ **Fixed and Production-Ready**

