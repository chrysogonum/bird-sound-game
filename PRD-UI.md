# PRD: SoundField: Birds — UI Implementation

**Version:** 1.0 (Draft)
**Status:** Needs decisions
**Depends on:** PRD-SoundField-Birds.md (engine complete)

---

## 1. Overview

This PRD covers the visual UI layer that connects the completed game engine to a playable experience. The engine (522 tests, Phases A-N) is complete; this PRD specifies how to render it.

---

## 2. Technical Decisions (Locked)

### 2.1 Framework

- **Screens/UI:** React (menus, summaries, settings)
- **Gameplay rendering:** PixiJS (lanes, tiles, animations)
- **Integration:** React wrapper around PixiJS canvas for gameplay screen

### 2.2 Target Platform

1. **Mobile web** (primary)
2. **Desktop web** (supported)

### 2.3 Orientation

**Portrait-only** — simpler layout, optimized for phone use while birding.

### 2.4 Deploy Strategy

**Web app → PWA** — start as hosted web app, add service worker for offline/installable PWA.

---

## 3. Screen Map

```
┌─────────────────────────────────────────┐
│                                         │
│  [Splash] → [Main Menu]                 │
│                  │                      │
│      ┌───────────┼───────────┐          │
│      ▼           ▼           ▼          │
│  [Campaign]  [Practice]  [Challenge]    │
│      │           │           │          │
│      └───────────┼───────────┘          │
│                  ▼                      │
│          [Pack Select]                  │
│                  │                      │
│                  ▼                      │
│          [Calibration] (first time)     │
│                  │                      │
│                  ▼                      │
│          [Gameplay] ←──────────┐        │
│                  │             │        │
│                  ▼             │        │
│          [Round Summary] ──────┘        │
│                  │                      │
│                  ▼                      │
│          [Progress/Stats]               │
│                                         │
└─────────────────────────────────────────┘
```

---

## 4. Screen Specifications

### 4.1 Main Menu

```
┌────────────────────────┐
│                        │
│    SOUNDFIELD: BIRDS   │
│                        │
│    [  Campaign   ]     │
│    [  Practice   ]     │
│    [  Challenge  ]     │
│    [  Random     ]     │
│                        │
│    [Settings] [Stats]  │
│                        │
└────────────────────────┘
```

**Elements:**
- Logo/title
- 4 mode buttons (vertical stack)
- Settings gear icon
- Stats/progress icon

### 4.2 Pack Select

```
┌────────────────────────┐
│  ← Back    Select Pack │
│                        │
│  ┌──────┐  ┌──────┐    │
│  │Common│  │Warbler│   │
│  │ 🔓   │  │  🔓  │    │
│  └──────┘  └──────┘    │
│  ┌──────┐  ┌──────┐    │
│  │Sparrow│ │Woodpkr│   │
│  │  🔒  │  │  🔒  │    │
│  └──────┘  └──────┘    │
│                        │
└────────────────────────┘
```

**Elements:**
- Grid of pack cards
- Lock/unlock state
- Species count badge
- Difficulty indicator

### 4.3 Gameplay Screen (Core)

```
┌────────────────────────────────────────┐
│  Score: 1250      ●●●○○  Timer: 0:45   │
├────────────────────────────────────────┤
│                                        │
│   [LEFT LANE]      │    [RIGHT LANE]   │
│                    │                   │
│   ┌─────────┐      │    ┌─────────┐    │
│   │ spectrogram    │    │ spectrogram  │
│   │  tile    │     │    │  tile   │    │
│   └────↓────┘      │    └────↓────┘    │
│        ↓           │         ↓         │
│   ═══[HIT]═══      │    ═══[HIT]═══    │
│                    │                   │
├────────────────────────────────────────┤
│           [TAP LEFT / TAP RIGHT]       │
├────────────────────────────────────────┤
│                                        │
│        ┌───┐  ┌───┐  ┌───┐             │
│     ┌───┐          ┌───┐               │
│        │  RADIAL WHEEL  │              │
│     └───┘          └───┘               │
│        └───┘  └───┘  └───┘             │
│                                        │
└────────────────────────────────────────┘
```

**Zones:**
1. **HUD** (top): Score, streak dots, timer
2. **Lanes** (middle): Left/right spectrogram tiles scrolling down
3. **Channel Input** (middle): Tap left half = left ear, right half = right ear
4. **Species Wheel** (bottom): Radial selection of 8-12 species

### 4.4 Round Summary

```
┌────────────────────────┐
│      ROUND COMPLETE    │
│                        │
│      Score: 2450       │
│      Accuracy: 87%     │
│      Streak: 12        │
│                        │
│  ┌─────────────────┐   │
│  │ NOCA ████████ 95%│  │
│  │ CARW ██████░░ 75%│  │
│  │ BLJA █████░░░ 60%│  │
│  └─────────────────┘   │
│                        │
│  Confused: CARW ↔ TUTI │
│  [Drill This Pair]     │
│                        │
│  [Retry] [Next] [Menu] │
└────────────────────────┘
```

---

## 5. Visual Design System

### 5.1 Color Palette (Colorblind-Safe)

```
Primary:      #2D5A27 (forest green)
Secondary:    #4A90D9 (sky blue)
Accent:       #F5A623 (goldfinch yellow)
Background:   #1A1A2E (dark navy)
Surface:      #2D2D44 (card bg)
Text:         #FFFFFF
Text-muted:   #A0A0B0
Success:      #4CAF50
Error:        #E57373
```

### 5.2 Typography

```
Headings:     Inter Bold, 24-32px
Body:         Inter Regular, 16-18px
Score:        Mono (JetBrains Mono), 20px
Labels:       Inter Medium, 14px
```

### 5.3 Spacing

```
Base unit:    8px
Padding:      16px (cards), 24px (screens)
Gap:          12px (elements), 24px (sections)
Border-radius: 8px (buttons), 12px (cards)
```

---

## 6. Interaction Specifications

### 6.1 Channel Selection (Left/Right)

| Input | Action |
|-------|--------|
| Tap left half of screen | Select LEFT channel |
| Tap right half of screen | Select RIGHT channel |
| Visual feedback | Side flashes briefly |

**Dead zone:** Optional 10% center strip to prevent mis-taps.

### 6.2 Species Selection (Radial Wheel)

| Input | Action |
|-------|--------|
| Tap species icon | Select that species |
| Drag/flick | Scroll wheel (if >8 species) |
| Hold | Show species name tooltip |

**Layout:** 8-12 species arranged in circle/arc at bottom of screen.

### 6.3 Combined Input Flow

```
1. Audio plays in LEFT ear
2. Player taps LEFT side of screen (channel)
3. Player taps "Cardinal" on wheel (species)
4. Score evaluated, feedback shown
```

Both inputs must occur within the scoring window.

---

## 7. Animation Specifications

### 7.1 Tile Scroll (LOCKED)

```
Direction:    Top → Bottom (toward hit zone at bottom)
Speed:        Configurable, default 200px/sec
Easing:       Linear
```

### 7.2 Hit Feedback

| Result | Animation |
|--------|-----------|
| Perfect | Tile glows green, expands slightly, fades |
| Partial | Tile glows yellow, fades |
| Miss | Tile shakes, turns red, fades |

**Duration:** 200-300ms

### 7.3 Score Pop

```
+100 appears above hit zone
Floats up 30px
Fades over 500ms
```

---

## 8. Audio Sync Requirements

### 8.1 Tile-Audio Alignment

```
Tile reaches hit zone → Audio plays
Tolerance: ±10ms (from engine)
```

### 8.2 Feedback Sounds

| Event | Sound |
|-------|-------|
| Correct | Short chime (100ms) |
| Wrong | Low thud (100ms) |
| Perfect streak (5+) | Rising tone |

---

## 9. Mobile Considerations

### 9.1 Touch Targets

- Minimum: 44x44px (Apple HIG)
- Species icons: 56x56px minimum
- Mode buttons: Full width, 56px height

### 9.2 Headphone Detection

```
On app launch:
  IF no headphones detected:
    Show modal: "Headphones Required"
    Block gameplay until connected
```

### 9.3 Safe Areas

- Respect notch/dynamic island (iOS)
- Respect navigation bar (Android)
- Bottom padding for home indicator

---

## 10. Implementation Phases

### Phase O: Project Setup & Core Layout

**Objective:** Scaffold UI project, implement screen navigation.

**Deliverables:**
- Framework setup (React + Canvas or PixiJS)
- Router/navigation between screens
- Main menu screen
- Basic styling system

**Smoke Test:** Navigate between all placeholder screens.

---

### Phase P: Gameplay Screen - Static Layout

**Objective:** Build gameplay screen layout without game logic.

**Deliverables:**
- HUD component (score, timer, streak)
- Lane containers (left/right)
- Hit zone indicators
- Radial wheel (static, 8 species)

**Smoke Test:** Gameplay screen renders with mock data.

---

### Phase Q: Gameplay Screen - Engine Integration

**Objective:** Connect UI to game engine.

**Deliverables:**
- Wire AudioEngine to play clips
- Wire EventScheduler to spawn tiles
- Wire ScoreEngine to HUD
- Wire RadialWheel to input handlers
- Implement channel tap detection

**Smoke Test:** Play a complete round with real audio/scoring.

---

### Phase R: Tile Animation & Feedback

**Objective:** Implement scrolling tiles and hit feedback.

**Deliverables:**
- TileManager rendering spectrograms
- Scroll animation toward hit zone
- Hit/miss feedback animations
- Score pop animations

**Smoke Test:** Tiles scroll, feedback shows on input.

---

### Phase S: Supporting Screens

**Objective:** Build remaining screens.

**Deliverables:**
- Pack select screen
- Round summary screen
- Settings screen
- Progress/stats screen
- Calibration flow

**Smoke Test:** Full flow from menu → gameplay → summary → menu.

---

### Phase T: Polish & Mobile Testing

**Objective:** Refine UX, test on devices.

**Deliverables:**
- Touch target tuning
- Performance optimization
- Headphone detection
- Safe area handling
- Loading states

**Smoke Test:** Play full session on mobile device.

---

## 11. Dependencies

- Engine complete (Phases A-N) ✅
- Audio clips (5 current, expand later)
- Spectrogram PNGs (5 current)
- Species icons (need to source/create)

---

*End of UI PRD*
