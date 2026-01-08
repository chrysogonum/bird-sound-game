# PRD: SoundField: Birds

**Version:** 2.0 (Ralphified)
**Status:** Implementation-ready

---

## 1. Overview

SoundField: Birds is a rhythm-game–style, audio-first experience that trains players to identify bird sounds in real time. Players identify species, spatial position (left/right channel), and timing accuracy within a performance-based format.

**Core Principle:** Audio-first, visual-augmented. Audio is always primary; spectrograms are optional scaffolding that can fade with skill.

**Analogy:**
- DDR arrows → bird vocalizations (Events)
- Guitar Hero frets → species choices
- Timing window → accuracy scoring

---

## 2. Goals and Non-Goals

### Goals (v1)
- Train auditory scene analysis for birders
- Make bird sound identification fast, instinctive, and embodied
- Start accessible, scale to realistic soundscapes
- Use only publicly available bird audio
- Focus on common southeastern U.S. birds (30–50 species)

### Non-Goals (v1)
- No free-text entry of bird names
- No full 3D spatial audio or head tracking
- No rare birds or vagrants
- No AI-based sound classification (human ID only)
- No audio speed changes or pitch shifting (LOCKED constraint)

---

## 3. Users

### Primary
- Beginner → intermediate birders
- eBird / Merlin users improving sound ID
- Casual gamers using headphones

### Secondary
- Advanced birders seeking speed and multi-species challenge
- Bird group tour leaders
- Educators (classrooms, workshops)

---

## 4. Core Concepts and Terminology (Glossary)

| Term | Definition |
|------|------------|
| **Event** | A single bird vocalization instance with species, timing, and channel assignment |
| **Channel** | Audio output: left ear or right ear |
| **Lane** | Visual display area for spectrogram Tiles (left lane = left channel, right lane = right channel) |
| **Tile** | Spectrogram image representing one Event, scrolling toward the Hit Zone |
| **Hit Zone** | Visual target area where Tiles arrive at present-moment |
| **Scoring Window** | Time range (ms) during which player input is accepted for an Event |
| **Pack** | Curated species subset with metadata rules (frequency weights, vocalization types, difficulty modifiers) |
| **Mode** | Gameplay ruleset defining how Events appear (Campaign, Practice, Challenge, Random Soundfield) |
| **Clip** | Preprocessed audio file for a single vocalization |
| **Vocalization Type** | Song or call classification |
| **Round** | Single gameplay session (10–60 seconds) |

---

## 5. Game Loop

### Round Structure (10–60 seconds)
1. Audio lane plays bird vocalizations as Events
2. Each Event has:
   - Defined Scoring Window
   - Channel assignment (left/right)
   - Species identity
3. Player identifies:
   - Which species (via radial wheel)
   - Which Channel (tap left/right screen side)
   - At correct moment (within Scoring Window)
4. Score updates continuously with immediate feedback
5. Round ends → performance summary → retry or advance

### Event Lifecycle
1. Event scheduled at time T with Channel C
2. Tile appears in Lane C, scrolling toward Hit Zone
3. Audio plays at time T in Channel C
4. Scoring Window opens (T - tolerance) to (T + tolerance)
5. Player input evaluated; feedback displayed
6. Scoring Window closes

---

## 6. Modes and Packs

### Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Campaign** | Structured progression with gradual species unlock | Guided learning |
| **Practice** | Single species focus, call/song toggle, adjustable tempo | Focused drilling |
| **Challenge** | Timed, high-score focused, daily seed option | Competition |
| **Random Soundfield** | Continuous randomized Events from selected Pack | Free play, skill assessment |

### Packs

A Pack is a curated species subset with:
- Species list with frequency weights
- Allowed vocalization types (song/call ratio)
- Difficulty modifiers (overlap multiplier, tempo multiplier)
- Optional seasonal context

#### Example Packs

| Pack | Focus | Species Examples | Rules |
|------|-------|------------------|-------|
| **Common SE Birds** | Tier A ultra-common | Cardinal, Carolina Wren, Blue Jay, Crow | Baseline difficulty |
| **Spring Warblers** | Song-heavy, confusable | Yellow-rumped, Pine, Parula, Common Yellowthroat | 90% songs, 1.3x overlap, 1.2x tempo |
| **Sparrows** | Short chips, subtle differences | Song, Chipping, Field, White-throated, Savannah | Calls emphasized, tight timing |
| **Woodpeckers** | Percussive, rhythmic | Red-bellied, Downy, Hairy, Pileated, Sapsucker | Drums + calls, exaggerated stereo |

### Mode × Pack Matrix

| Mode | Pack Example | Experience |
|------|--------------|------------|
| Campaign | Common SE Birds | Guided learning |
| Random Soundfield | All SE Birds | Realistic chaos |
| Challenge | Sparrows | Confusion stress-test |
| Practice | Woodpeckers | Focused drilling |
| Challenge (Daily) | Spring Warblers | Shared leaderboard |

### Species Scope (v1)
- Geographic: Southeastern U.S. (NC, SC, GA, TN, VA, FL)
- Count: 30–50 common species
- Tiering:
  - Tier A: Ultra-common, distinctive (Cardinal, Blue Jay, Crow)
  - Tier B: Common but confusable (sparrows, warblers)

---

## 7. Audio System

### Functional Requirements

| Requirement | Specification | Verification |
|-------------|---------------|--------------|
| Sample-accurate timing | Events trigger within ±5ms of scheduled time | Automated timing test |
| Independent channel panning | Each Event panned to left or right independently | Stereo test with simultaneous L/R Events |
| Overlapping playback | ≥4 simultaneous Events supported | Load test with 4 concurrent Events |
| Low latency | <50ms input-to-audio on mobile | Latency measurement tool |
| Mono source files | All Clips stored as mono; stereo applied at playback | Asset validation script |
| No audio mutation | No speed changes, pitch shifting, or distortion | Code review; automated regression |

### Clip Preprocessing Pipeline

Each source recording must be:
1. Trimmed to 0.5–3.0 seconds
2. Loudness-normalized (target: -16 LUFS)
3. Stored as mono WAV or compressed format
4. Tagged with required metadata (see Data Model)

### Audio Sources
- **Primary:** Macaulay Library (Cornell Lab)
- **Supplemental:** Xeno-canto
- **Selection criteria:** High SNR, clear species ID, call/song labeled, minimal overlap

### Future-Ready (not v1)
- Binaural / HRTF rendering
- Distance simulation (volume + filtering)

---

## 8. Spectrogram System

### Functional Requirements

| Requirement | Specification | Verification |
|-------------|---------------|--------------|
| Generated from playback audio | Tile matches exact Clip used | Visual + audio alignment test |
| Log-frequency scale | Consistent Y-axis mapping | Visual inspection |
| Tight crop | No padding beyond vocalization | Asset validation |
| Consistent color mapping | Same palette across all Tiles | Visual inspection |
| Time-aligned scrolling | Tile arrives at Hit Zone when audio plays | Timing alignment test |

### Lane Display

- Left Channel Events → Left Lane
- Right Channel Events → Right Lane
- Tiles scroll horizontally toward Hit Zone at center
- Only active Event Tiles visible (no background noise rendered)
- Minimal UI chrome; no axis labels

### Visual Dependency Modes

| Mode | Spectrogram Visibility | Target User |
|------|------------------------|-------------|
| A | Full spectrogram | Beginner |
| B | Fading spectrogram (transparency increases over round) | Intermediate |
| C | Audio-only (no spectrogram) | Advanced |

### Feedback Rendering
- Correct selection → Tile glows
- Incorrect selection → Tile shakes/dims
- Reinforces sound ↔ shape ↔ species mapping

### Accessibility
- Enables hard-of-hearing participation
- Supports visual learning styles
- Allows mixed-modality training

---

## 9. Input System

### Constraints
- Fast (no typing)
- Scales to 50 species
- Usable while listening (minimal visual attention)

### Radial Species Wheel
- Displays 8–12 species per Round (pre-selected per Level)
- Species represented by icons (high-contrast, colorblind-safe)
- Optional grouping: color, taxonomy, silhouette, mnemonic cues

### Input Actions
1. **Channel selection:** Tap left or right screen side
2. **Species selection:** Tap or flick species icon on wheel

### Timing Logic
- Input must occur within Event's Scoring Window
- Early/late inputs within window earn partial credit
- Input outside window = miss

---

## 10. Scoring and Feedback

### Scoring Dimensions

Each Event scores on three independent axes:

| Dimension | Correct | Incorrect |
|-----------|---------|-----------|
| Species | +50 | 0 |
| Channel (L/R) | +25 | 0 |
| Timing (within window) | +25 (perfect) / +10 (partial) | 0 |

### Example Scores
- Perfect (species + channel + timing): +100
- Correct species, wrong channel: +50
- Correct channel, wrong species: +25
- Miss (outside window or no input): 0

### Immediate Feedback
- Visual flash on Hit Zone
- Short audio confirmation tone
- Score increment display

### End-of-Round Summary
- Overall accuracy percentage
- Per-species breakdown
- Confusion matrix ("You confused X with Y")
- Side-by-side spectrogram thumbnails for confused pairs
- Short audio replay option
- Progress toward mastery metrics

---

## 11. Difficulty Model and Level Progression

### Difficulty Axes (Independent Scaling)

| Axis | Range | Effect |
|------|-------|--------|
| Event Density | Low → High | Reduced silence between Events |
| Overlap Probability | 0% → 75% | Simultaneous Events in both Channels |
| Species Count | 4 → 12 per Round | More choices on wheel |
| Scoring Window Width | 2000ms → 300ms | Tighter timing tolerance |
| Spectrogram Mode | A → B → C | Reduced visual scaffolding |

### Level Progression (Campaign)

| Level | Density | Overlap | Species | Window | Spectrogram |
|-------|---------|---------|---------|--------|-------------|
| 1 | Low | None | 4–6 | 2000ms | Full |
| 2 | Low | None | 6–8 | 1500ms | Full |
| 3 | Medium | Rare | 6–8 | 1200ms | Full |
| 4 | Medium | Occasional | 8–10 | 1000ms | Fading |
| 5+ | High | Frequent | 10–12 | 500ms | Audio-only option |

### Difficulty Constraints (LOCKED)
- Difficulty scales by Event density, not content mutation
- Explicitly prohibited:
  - Audio speed changes
  - Pitch shifting
  - Visual deception

### Pack-Specific Modifiers
- `overlap_multiplier`: Scales base overlap probability
- `tempo_multiplier`: Scales Event spacing
- Applied on top of Level difficulty

### Unlock Models
- Campaign progress (complete Level N to unlock N+1)
- Skill thresholds (accuracy % unlocks advanced Packs)
- Seasonal availability (optional future feature)

### Mastery Tracking (Per Pack)
- Accuracy percentage
- Best streak
- Identified confusion pairs
- Response time trends

---

## 12. Data Model (JSON Specs)

### Clip Schema
```json
{
  "clip_id": "string (unique)",
  "species_code": "string (4-letter code)",
  "common_name": "string",
  "vocalization_type": "song | call",
  "duration_ms": "number (500–3000)",
  "quality_score": "number (1–5)",
  "source": "macaulay | xenocanto",
  "source_id": "string",
  "file_path": "string",
  "spectrogram_path": "string | null"
}
```

### Pack Schema
```json
{
  "pack_id": "string (unique)",
  "display_name": "string",
  "description": "string",
  "species": ["species_code", "..."],
  "vocalization_weights": {
    "song": "number (0–1)",
    "call": "number (0–1)"
  },
  "overlap_multiplier": "number (0.5–2.0, default 1.0)",
  "tempo_multiplier": "number (0.5–2.0, default 1.0)",
  "seasonal_context": "string | null"
}
```

### Level Schema
```json
{
  "level_id": "number",
  "pack_id": "string",
  "mode": "campaign | practice | challenge | random",
  "round_duration_sec": "number (10–60)",
  "species_count": "number (4–12)",
  "event_density": "low | medium | high",
  "overlap_probability": "number (0–0.75)",
  "scoring_window_ms": "number (300–2000)",
  "spectrogram_mode": "full | fading | none"
}
```

### Event Schema (Runtime)
```json
{
  "event_id": "string (unique per round)",
  "clip_id": "string",
  "species_code": "string",
  "channel": "left | right",
  "scheduled_time_ms": "number",
  "scoring_window_start_ms": "number",
  "scoring_window_end_ms": "number"
}
```

### PlayerProgress Schema
```json
{
  "player_id": "string",
  "unlocked_levels": ["level_id", "..."],
  "unlocked_packs": ["pack_id", "..."],
  "pack_stats": {
    "pack_id": {
      "accuracy_pct": "number",
      "best_streak": "number",
      "total_rounds": "number",
      "confusion_pairs": [["species_a", "species_b", "count"], "..."],
      "avg_response_time_ms": "number"
    }
  }
}
```

---

## 13. Tech Architecture (High Level)

### Frontend
- Engine: Unity / Godot / WebAudio-based stack
- Platform: Mobile-first, desktop compatible
- Headphone requirement: Mandatory prompt on first launch

### Audio Engine
- Sample-accurate scheduling
- Real-time stereo panning
- Polyphonic playback (≥4 voices)
- Latency target: <50ms on mobile

### Spectrogram Renderer
- Pre-generated Tiles (preferred for v1)
- Alternative: Real-time FFT rendering
- Continuous scrolling strip per Lane
- Present-moment cursor with short look-back window

### Backend (Minimal for v1)
- Static audio/spectrogram asset hosting (CDN)
- Metadata JSON files
- Optional: Leaderboard service for Challenge mode

### Local Storage
- Player progress (IndexedDB / PlayerPrefs)
- Cached audio Packs
- Settings (volume, accessibility options)

### Calibration
- Left/right audio test on first launch
- Optional latency calibration

---

## 14. Metrics of Success

### Learning Metrics
| Metric | Measurement | Success Threshold |
|--------|-------------|-------------------|
| Accuracy improvement | Δ accuracy over 10 sessions | >15% improvement |
| Confusion reduction | Decrease in confusion pair frequency | >50% reduction |
| Response time | Average ms from Event to correct input | <800ms by Level 5 |

### Engagement Metrics
| Metric | Measurement | Success Threshold |
|--------|-------------|-------------------|
| Session length | Average minutes per session | >5 minutes |
| Daily retention | % users returning next day | >40% |
| Level completion | % users completing Level 5 | >25% |
| Streak maintenance | Average daily streak length | >3 days |

---

## 15. Implementation Plan (Ralph Loops)

### Phase A: Audio Ingestion & Tagging

**Objective:** Build asset pipeline to ingest, preprocess, and tag bird audio Clips.

**Deliverables:**
- `scripts/audio_ingest.py` — Download and normalize audio from sources
- `scripts/audio_tagger.py` — Generate metadata JSON for each Clip
- `data/clips/` — Directory of processed mono audio files
- `data/clips.json` — Master Clip manifest

**Acceptance Criteria:**
- [ ] Script downloads sample Clips from Macaulay/Xeno-canto
- [ ] Output files are mono, 0.5–3.0s duration
- [ ] Loudness normalized to -16 LUFS (±1 LUFS)
- [ ] Each Clip has valid metadata matching Clip Schema
- [ ] clips.json validates against schema

**Smoke Tests:**
1. Run `audio_ingest.py` with 5 test URLs → outputs 5 mono WAV files
2. Run `audio_tagger.py` → generates clips.json with 5 entries
3. Validate clips.json against JSON schema → passes

---

### Phase B: Stereo Playback & Timing Engine

**Objective:** Build audio engine supporting sample-accurate, panned, overlapping playback.

**Deliverables:**
- `src/audio/AudioEngine.ts` — Core playback scheduler
- `src/audio/ChannelMixer.ts` — Stereo panning implementation
- `tests/audio_timing_test.ts` — Timing accuracy validation

**Acceptance Criteria:**
- [ ] Play single Clip on left channel only
- [ ] Play single Clip on right channel only
- [ ] Play two Clips simultaneously on opposite channels
- [ ] Schedule Clip at future time T; verify playback starts within ±10ms
- [ ] Support ≥4 simultaneous Clips without dropout

**Smoke Tests:**
1. Play "cardinal.wav" on left → audio heard only in left ear
2. Schedule 4 Events at T+0, T+500, T+1000, T+1500 → all play at correct times
3. Overlap test: 2 different species at same time, different channels → both audible

---

### Phase C: Core Input & Scoring Loop

**Objective:** Implement radial wheel input and scoring system.

**Deliverables:**
- `src/input/RadialWheel.ts` — Species selection UI component
- `src/input/ChannelInput.ts` — Left/right tap detection
- `src/scoring/ScoreEngine.ts` — Score calculation per Event
- `src/scoring/FeedbackRenderer.ts` — Immediate visual/audio feedback
- `tests/scoring_test.ts` — Scoring logic validation

**Acceptance Criteria:**
- [ ] Radial wheel displays 8 species icons
- [ ] Tap left side registers "left" channel selection
- [ ] Tap species icon registers species selection
- [ ] Correct species + channel + timing → +100 points
- [ ] Correct species, wrong channel → +50 points
- [ ] Wrong species, correct channel → +25 points
- [ ] Input outside Scoring Window → 0 points
- [ ] Visual flash on correct; shake on incorrect

**Smoke Tests:**
1. Display wheel with 8 species → all icons visible and tappable
2. Play Event on left, tap left + correct species → score shows +100
3. Play Event on right, tap left + correct species → score shows +50

---

### Phase D: Level Definitions & Scaling

**Objective:** Implement Level system with configurable difficulty parameters.

**Deliverables:**
- `data/levels.json` — Level configuration manifest
- `src/game/LevelLoader.ts` — Parse and apply Level configs
- `src/game/EventScheduler.ts` — Generate Events based on Level params
- `src/game/RoundManager.ts` — Round lifecycle (start, update, end)
- `tests/level_test.ts` — Level loading and Event generation tests

**Acceptance Criteria:**
- [ ] Level 1 generates Events with 2000ms window, 4–6 species, no overlap
- [ ] Level 3 generates occasional overlapping Events
- [ ] Level 5 generates Events with 500ms window
- [ ] Event density increases from Level 1 to Level 5
- [ ] Round ends after configured duration (10–60s)

**Smoke Tests:**
1. Load Level 1 → wheel shows 4–6 species
2. Play Level 1 round → no overlapping Events occur
3. Play Level 5 round → overlapping Events occur, tight timing required

---

### Phase E: UX Polish & End-Round Feedback

**Objective:** Implement round summary, confusion analytics, and UI polish.

**Deliverables:**
- `src/ui/RoundSummary.ts` — End-of-round statistics display
- `src/ui/ConfusionMatrix.ts` — Species confusion visualization
- `src/ui/CalibrationFlow.ts` — Headphone and L/R calibration
- `src/ui/HUD.ts` — In-game score display, timer, progress

**Acceptance Criteria:**
- [ ] Round summary shows accuracy %, per-species breakdown
- [ ] Confusion matrix highlights species pairs with >2 confusions
- [ ] Calibration plays test tone in left, then right ear
- [ ] HUD updates score in real-time during round
- [ ] High-contrast, colorblind-safe icon palette

**Smoke Tests:**
1. Complete round with 80% accuracy → summary shows "80%"
2. Confuse Cardinal/Pyrrhuloxia 3 times → confusion matrix highlights pair
3. Run calibration → user can confirm L/R audio works

---

### Phase F: Mode Implementation (Campaign, Practice, Challenge)

**Objective:** Implement all four gameplay Modes.

**Deliverables:**
- `src/modes/CampaignMode.ts` — Linear progression through Levels
- `src/modes/PracticeMode.ts` — Single species, adjustable settings
- `src/modes/ChallengeMode.ts` — Timed, high-score, optional daily seed
- `src/modes/RandomMode.ts` — Continuous random Events from Pack
- `src/ui/ModeSelect.ts` — Mode selection menu

**Acceptance Criteria:**
- [ ] Campaign: Complete Level 1 → unlocks Level 2
- [ ] Practice: Select single species → only that species plays
- [ ] Challenge: 60-second timed round → final score displayed
- [ ] Random: Continuous Events until player quits
- [ ] Daily seed: Same seed produces same Event sequence for all players

**Smoke Tests:**
1. Start Campaign → begin at Level 1; complete → Level 2 unlocked
2. Start Practice with "Cardinal" → only cardinal Clips play
3. Start Challenge with daily seed "2024-01-15" → reproducible Event order

---

### Phase G: Pack Schema & Loader

**Objective:** Implement Pack system for species grouping and difficulty modifiers.

**Deliverables:**
- `data/packs/` — Directory of Pack JSON files
- `src/packs/PackLoader.ts` — Load and validate Pack definitions
- `src/packs/PackSelector.ts` — UI for Pack selection
- `tests/pack_test.ts` — Pack loading validation

**Acceptance Criteria:**
- [ ] Load "common_se_birds" Pack → 30+ species available
- [ ] Load "spring_warblers" Pack → 6 warbler species, 90% songs
- [ ] Pack modifiers (overlap_multiplier, tempo_multiplier) applied to Level
- [ ] Invalid Pack JSON fails validation with clear error

**Smoke Tests:**
1. Load spring_warblers Pack → wheel shows only warbler species
2. Apply 1.3x overlap_multiplier → more frequent overlaps than base Level

---

### Phase H: Pack-Specific Difficulty Modifiers

**Objective:** Apply Pack modifiers to Event generation.

**Deliverables:**
- `src/game/DifficultyCalculator.ts` — Combine Level + Pack modifiers
- Updates to `EventScheduler.ts` — Apply calculated difficulty
- `tests/difficulty_test.ts` — Modifier application tests

**Acceptance Criteria:**
- [ ] tempo_multiplier 1.2 → Events 20% more frequent
- [ ] overlap_multiplier 1.5 → 50% more overlaps than base
- [ ] vocalization_weights respected → 90% songs for warbler Pack
- [ ] Modifiers stack correctly with Level difficulty

**Smoke Tests:**
1. Level 3 + tempo 1.2x → Events noticeably faster than Level 3 baseline
2. Sparrow Pack (calls emphasized) → >80% of Events are calls

---

### Phase I: Random Soundfield Mode (Full Implementation)

**Objective:** Implement continuous randomized mode as primary free-play experience.

**Deliverables:**
- Full `src/modes/RandomMode.ts` implementation
- `src/game/InfiniteScheduler.ts` — Continuous Event generation
- Difficulty scaling within session (ramps up over time)

**Acceptance Criteria:**
- [ ] Events drawn randomly from selected Pack
- [ ] Channel (L/R) assigned randomly per Event
- [ ] Difficulty ramps: minute 1 = Level 1, minute 5 = Level 3+
- [ ] Session continues until player quits or fails threshold
- [ ] Score persists across session; high score saved

**Smoke Tests:**
1. Play Random for 2 minutes → Event difficulty noticeably increases
2. Quit Random → high score saved to PlayerProgress
3. Same Pack, different session → different Event order

---

### Phase J: Progression & Stats Persistence

**Objective:** Implement player progress tracking and persistence.

**Deliverables:**
- `src/storage/ProgressStore.ts` — Local storage wrapper
- `src/stats/StatsCalculator.ts` — Compute mastery metrics
- `src/ui/ProgressView.ts` — Display unlocks and stats
- `data/player_progress.json` — Local storage schema

**Acceptance Criteria:**
- [ ] Unlocked Levels persist across sessions
- [ ] Unlocked Packs persist across sessions
- [ ] Per-Pack accuracy, streak, confusion pairs tracked
- [ ] Response time trends calculated and stored
- [ ] Progress exportable as JSON

**Smoke Tests:**
1. Complete Level 2 → close app → reopen → Level 3 accessible
2. Confuse Cardinal/Wren 5 times → confusion pair appears in stats
3. Export progress → valid JSON matching PlayerProgress Schema

---

### Phase K: Spectrogram Generation Pipeline

**Objective:** Generate Tile images for all Clips.

**Deliverables:**
- `scripts/spectrogram_gen.py` — Generate spectrogram PNG for each Clip
- `data/spectrograms/` — Directory of Tile images
- Updates to clips.json — Add spectrogram_path field

**Acceptance Criteria:**
- [ ] Each Clip has corresponding spectrogram PNG
- [ ] Log-frequency scale applied
- [ ] Tight crop (no padding beyond vocalization)
- [ ] Consistent color palette across all Tiles
- [ ] spectrogram_path in clips.json points to valid file

**Smoke Tests:**
1. Run generation on 10 Clips → 10 PNG files created
2. Visual inspection: no empty space padding, colors consistent
3. clips.json spectrogram_path fields all resolve to existing files

---

### Phase L: Rolling Spectrogram Renderer

**Objective:** Implement scrolling Lane display with Tiles.

**Deliverables:**
- `src/visual/LaneRenderer.ts` — Continuous scrolling strip per channel
- `src/visual/TileManager.ts` — Spawn, scroll, and despawn Tiles
- `src/visual/HitZoneIndicator.ts` — Present-moment cursor

**Acceptance Criteria:**
- [ ] Left Lane displays Tiles for left-channel Events
- [ ] Right Lane displays Tiles for right-channel Events
- [ ] Tile arrives at Hit Zone exactly when audio plays
- [ ] Tiles despawn after passing Hit Zone
- [ ] Smooth scrolling at 60fps

**Smoke Tests:**
1. Single left Event → Tile appears in left Lane, scrolls to center
2. Simultaneous L/R Events → Tiles appear in both Lanes
3. Tile reaches Hit Zone → audio plays at that moment

---

### Phase M: Visual Difficulty Modulation

**Objective:** Implement spectrogram visibility modes (full/fading/none).

**Deliverables:**
- `src/visual/VisibilityController.ts` — Manage Tile opacity
- Updates to Level/settings → spectrogram_mode parameter
- `src/ui/VisualSettings.ts` — Player toggle for visibility mode

**Acceptance Criteria:**
- [ ] Mode A: Tiles fully visible throughout
- [ ] Mode B: Tiles fade to 20% opacity over round duration
- [ ] Mode C: Tiles hidden; audio-only gameplay
- [ ] Player can override Level default in settings
- [ ] Setting persists across sessions

**Smoke Tests:**
1. Level 1 (Mode A) → Tiles stay visible
2. Level 4 (Mode B) → Tiles visibly fade over 30 seconds
3. Force Mode C → no Tiles rendered; audio still plays

---

### Phase N: Confusion Analytics & Feedback

**Objective:** Implement detailed post-round confusion analysis.

**Deliverables:**
- `src/stats/ConfusionTracker.ts` — Track per-round confusion events
- `src/ui/ConfusionDrillLauncher.ts` — Launch focused drill on confused pairs
- Updates to RoundSummary — Integrate confusion display
- Audio replay feature for confused Events

**Acceptance Criteria:**
- [ ] Confused pairs displayed with count at round end
- [ ] Side-by-side spectrogram thumbnails for top 3 confused pairs
- [ ] "Replay" button plays both confused sounds sequentially
- [ ] "Drill" button launches Practice mode with confused pair only
- [ ] Confusion data aggregated in PlayerProgress stats

**Smoke Tests:**
1. Confuse A/B 4 times in round → summary shows A↔B with count 4
2. Tap "Replay" → hear species A, then species B
3. Tap "Drill" → enters Practice with only A and B species

---

### Phase Summary

| Phase | Objective | Key Deliverable |
|-------|-----------|-----------------|
| A | Audio ingestion | clips.json + audio files |
| B | Playback engine | AudioEngine with stereo + timing |
| C | Input & scoring | RadialWheel + ScoreEngine |
| D | Level system | LevelLoader + EventScheduler |
| E | UX polish | RoundSummary + calibration |
| F | All Modes | Campaign, Practice, Challenge, Random |
| G | Pack system | PackLoader + Pack files |
| H | Pack modifiers | DifficultyCalculator |
| I | Random Soundfield | InfiniteScheduler |
| J | Persistence | ProgressStore + StatsCalculator |
| K | Spectrogram gen | spectrogram_gen.py + PNGs |
| L | Lane renderer | LaneRenderer + TileManager |
| M | Visual modes | VisibilityController |
| N | Confusion analytics | ConfusionTracker + drills |

---

*End of PRD*
