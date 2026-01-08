# Product Requirements Document (PRD)
## Working Title: **SoundField: Birds**
**Version:** 1.0 (Canonical)  
**Status:** Scope-locked, implementation-ready  
**Purpose:** Authoritative specification for agentic build execution

---

## 0. Product Vision & Goals

### Vision
Create a rhythm-game–style, audio-first experience that trains players to identify bird sounds **in real time**, focusing on:
- Species identity  
- Spatial position (left/right; future depth)  
- Temporal accuracy  

This is **DDR / Guitar Hero for the ears**, not a quiz app.

### Core Goals
- Train auditory scene analysis for birders  
- Make bird sound identification fast, instinctive, and embodied  
- Start accessible and scale to realistic soundscapes  
- Use **only publicly available** bird audio  
- Initial focus on **common southeastern U.S. birds**

### Non-Goals (v1)
- No free-text entry of bird names  
- No full 3D spatial audio or head tracking  
- No rare birds or vagrants  
- No AI-based sound classification (human ID only)

---

## 1. Target Users

### Primary
- Beginner → intermediate birders  
- eBird / Merlin users improving sound ID  
- Casual gamers using headphones  

### Secondary
- Advanced birders seeking speed and multi-species challenge  
- Bird group tour leaders
- Educators (classrooms, workshops)

---

## 2. Core Gameplay Loop

**Round Length:** 10–60 seconds

1. A timed audio “lane” plays bird vocalizations  
2. Each sound has:
   - A defined time window  
   - A stereo position (left/right)  
3. Player identifies:
   - Which bird  
   - Which side  
   - At the correct moment  
4. Score updates continuously with immediate feedback  
5. Round ends → performance summary → retry or advance  

**Analogy**
- DDR arrows → bird calls  
- Guitar Hero frets → species choices  
- Timing window → accuracy

---

## 3. Audio & Data Requirements (Critical)

### 3.1 Source Data (Public Only)

**Primary**
- Macaulay Library (Cornell Lab)

**Supplemental**
- Xeno-canto

**Selection Criteria**
- High signal-to-noise ratio  
- Clear species ID  
- Call vs song labeled  
- Minimal overlap (mixing handled in-engine)

---

### 3.2 Audio Preprocessing Pipeline

Each clip must be:
- Trimmed to **0.5–3.0 seconds**
- Loudness-normalized (LUFS target)
- Tagged with:
  - `species_code`
  - `common_name`
  - `vocalization_type` (song/call)
  - `quality_score`
  - `duration`
- Stored as **mono**

**Stereo positioning is applied at playback, never baked in.**

---

### 3.3 Playback Engine Requirements

Must support:
- Sample-accurate timing  
- Independent left/right panning per event  
- Overlapping sounds  
- Low latency (especially mobile)

Future-ready for:
- Binaural / HRTF rendering  
- Distance simulation (volume + filtering)

---

## 4. Bird Scope (v1)

### Geographic Scope
Southeastern United States  
(Mental model: NC, SC, GA, TN, VA, FL)

### Species Scope
- **Target:** 30–50 common species

**Examples**
- American Goldfinch
- Downy Woodpecker
- Northern Cardinal  
- Carolina Wren  
- Tufted Titmouse  
- Carolina Chickadee  
- Blue Jay  
- American Crow  
- Cedar Waxwing
- Eastern Towhee  
- Northern Mockingbird  
- Red-bellied Woodpecker  
- Eastern Bluebird  
- White-throated Sparrow  
- Yellow-rumped Warbler  
- Mourning Dove  
- Common Grackle  

**Tiering**
- Tier A: Ultra-common, distinctive  
- Tier B: Common but confusable  

---

## 5. Difficulty & Level Design

### Difficulty Axes
Difficulty increases independently along:
1. Sound density  
2. Species diversity  
3. Spatial complexity  
4. Timing tolerance  

### Example Progression

**Level 1 – Single Lane**
- One bird at a time  
- One ear only  
- Long gaps  
- Large timing window  
- 4–6 species  

**Level 2 – Alternating Stereo**
- One bird at a time  
- Alternates left/right  
- Shorter gaps  

**Level 3 – Overlap Lite**
- Occasional overlap  
- Different species per ear  
- Calls only  

**Level 4 – Mixed Vocalizations**
- Songs + calls  
- Same species may repeat  
- Faster tempo  

**Level 5+ – Soundscape Mode**
- Multiple birds  
- Frequent overlap  
- Confusables  
- Tight timing windows  

---

## 6. User Input System

### Constraints
- Fast  
- No typing  
- Scales to 50 species  
- Usable while listening  

### v1 Input Model: Radial Species Wheel
- Radial menu with **8–12 birds per round**
- Birds pre-selected per level
- Player actions:
  - Tap left/right screen side → ear
  - Tap or flick bird icon → species

**Optional Assists**
- Grouping by color, taxonomy, silhouette, mnemonic cues

### Timing Logic
- Each sound has a scoring window  
- Input must occur within window  
- Early/late inputs earn partial credit  

---

## 7. Scoring & Feedback

### Scoring Dimensions
Each event scores:
- Species correctness  
- Spatial correctness (L/R)  
- Timing accuracy  

**Example**
- Perfect: +100  
- Correct species, wrong side: +50  
- Correct side, wrong species: +25  
- Miss: 0  

### Feedback
**Immediate**
- Visual flash  
- Short audio tone  

**End of Round**
- Accuracy breakdown  
- Confusion matrix (“You confuse X with Y”)  
- Progress toward mastery  

---

## 8. Game Modes (v1)

1. **Campaign**
   - Structured progression  
   - Gradual species unlock  

2. **Practice Mode**
   - Single species focus  
   - Call/song toggle  
   - Slow playback  

3. **Challenge Mode**
   - Timed  
   - High-score focused  
   - Daily seed  

---

## 9. UX & Accessibility

### Audio
- Headphone recommendation (mandatory prompt)
- Left/right calibration test
- Volume normalization

### Visual
- Minimal distraction during play
- High-contrast icons
- Colorblind-safe palette

### Accessibility (Future)
- Adjustable tempo
- Larger timing windows
- Visual-only practice mode

---

## 10. Technical Architecture (High Level)

### Frontend
- Unity / Godot / WebAudio-based stack
- Mobile-first, desktop compatible

### Backend
- Static audio asset hosting
- Metadata JSON
- Optional leaderboard service

### Data Storage
- Species metadata
- Player progress
- Local caching of audio packs

---

## 11. Metrics of Success

### Learning Metrics
- Accuracy improvement over time
- Reduced confusion pairs
- Faster response times

### Engagement Metrics
- Daily streaks
- Level completion rate
- Session length

---

## 12. Ralph-Loop Phase Breakdown

- **Phase A:** Audio ingestion & tagging  
- **Phase B:** Stereo playback & timing engine  
- **Phase C:** Core input & scoring loop  
- **Phase D:** Level definitions & scaling  
- **Phase E:** UX polish & feedback  
- **Phase F:** Species expansion & practice tools  

---

## 13. Modes vs Sound Pools (Core Design)

Two orthogonal concepts:
- **Sound Pools:** What birds can appear  
- **Gameplay Modes:** How they appear  

This separation is foundational for scalability.

---

## 14. Standard Random Mode (Foundational)

**Working Name:** Free Soundscape / Random Soundfield

### Description
Continuously randomized mode where any bird from the selected pool may vocalize at any time, constrained by difficulty.

### Rules
- Species drawn randomly from pool  
- Call/song randomized  
- Stereo position randomized  
- Overlap probability increases with difficulty  
- Timing windows tighten with difficulty  

### Difficulty Scaling
- Level 1: Max 1 bird  
- Level 2: Rare overlap  
- Level 3: Frequent overlap  
- Level 4+: Dawn-chorus chaos  

### Use Cases
- Skill assessment  
- Free play  
- High-score chasing  

---

## 15. Sound Packs (Key Feature)

### Definition
A **Sound Pack** is a curated subset of species plus metadata rules.

Each pack defines:
- Species list
- Relative frequency weights
- Allowed vocalization types
- Optional seasonal context

---

## 16. Example Sound Packs

### 16.1 Spring Warbler Songs
- Focus: Song-heavy, high-pitched, confusable  
- Species: Yellow-rumped, Pine, BT Green, Parula, Prairie, Common Yellowthroat  
- Rules:
  - ~90% songs
  - Faster tempo
  - Higher overlap
- Outcome: Warbler separation under pressure

### 16.2 Sparrow Pack
- Focus: Short chips, subtle differences  
- Species: Song, Chipping, Field, White-throated, Savannah  
- Rules:
  - Calls emphasized
  - Short clips
  - Tight timing windows
- Outcome: Fine-grained discrimination

### 16.3 Woodpeckers & Drummers
- Focus: Percussive, rhythmic sounds  
- Species: Red-bellied, Downy, Hairy, Pileated, Sapsucker  
- Rules:
  - Drums + calls
  - Rhythm scoring bonus
  - Exaggerated stereo
- Outcome: Non-vocal sound recognition

---

## 17. Sound Pack Data Model

```json
{
  "pack_id": "spring_warblers",
  "display_name": "Spring Warbler Songs",
  "species": ["parula", "yewar", "btgnwa"],
  "vocalization_weights": {
    "song": 0.9,
    "call": 0.1
  },
  "overlap_multiplier": 1.3,
  "tempo_multiplier": 1.2
}

## 18. Mode × Pack Matrix

| Mode              | Pack Example    | Experience            |
| ----------------- | --------------- | --------------------- |
| Campaign          | Common Birds    | Guided learning       |
| Random Soundfield | All SE Birds    | Realistic chaos       |
| Challenge         | Sparrow Pack    | Confusion stress-test |
| Practice          | Woodpeckers     | Focused drilling      |
| Daily Seed        | Spring Warblers | Shared leaderboard    |

19. Progression & Unlocking
Unlock Models
Campaign progress
Skill thresholds
Seasonal availability
Mastery Tracking (Per Pack)
Accuracy %
Best streak
Confusion pairs
Response-time trends
20. Extended Ralph-Loop Phases
Phase G: Sound pack schema & loader
Phase H: Pack-specific difficulty modifiers
Phase I: Random Soundfield mode
Phase J: Pack-based progression & stats
21. Core Design Principle
Audio-First, Visual-Augmented
Audio is always primary
Spectrograms are optional scaffolding
Visuals can fade or disappear with skill
22. Spectrogram System (Authoritative)
Concept
Each vocalization produces a time-aligned spectrogram tile that scrolls toward a hit zone.
Rules
Generated from the same audio used for playback
Log-frequency scale
Tightly cropped to vocalization
Consistent color mapping
Structural integrity is never altered.
23. Spectrogram Display Constraints
Only active vocalization visible
No background noise
No axis labels
Minimal UI chrome
24. Stereo Mapping & Lanes
Left-ear sounds → left lane
Right-ear sounds → right lane
Simultaneous birds → simultaneous lanes
Future:
Vertical offset / brightness → distance cue
25. Visual Dependency Spectrum
Mode A: Audio + full spectrogram (Beginner)
Mode B: Audio + fading spectrogram (Intermediate)
Mode C: Audio-only (Advanced)
26. Spectrograms as Input Aid
Correct selection → glow
Incorrect → shake/dim
Reinforces sound ↔ shape ↔ species mapping
27. Confusion Analytics
End-of-round feedback may include:
Confused species pairs
Side-by-side spectrogram thumbnails
Short audio replays
Optional drills
28. Accessibility & Inclusivity
Spectrograms enable:
Hard-of-hearing participation
Visual learning styles
Mixed-modality training
29. Asset Model
Each vocalization includes:
Audio clip
Spectrogram image (or render instructions)
Metadata
30. Additional Ralph-Loop Phases
Phase K: Spectrogram generation pipeline
Phase L: Rolling spectrogram renderer
Phase M: Visual difficulty modulation
Phase N: Confusion analytics & feedback
31. Strategic Differentiation
SoundField: Birds is the only bird-sound game that:
Trains real-time auditory scene analysis
Uses optional, accurate spectrogram scaffolding
Operates in a performance-based rhythm format
Locked Difficulty Rules (Authoritative)
Difficulty scales by event density, not content:
Reduced silence
Increased overlap
Increased species diversity
Narrower timing windows
Optional spectrogram fading
Explicitly excluded
Audio speed changes
Pitch shifting
Visual deception
Rolling Spectrogram Lanes
Each channel has:
One continuous strip
A present-moment cursor
A short look-back window
Players learn to anticipate and identify before completion—mirroring real field birding skill.
