# SoundField: Birds

A rhythm-game–style training app that teaches players to identify bird sounds in real time. Think **Guitar Hero for birding**.

## What Is This?

Players identify:
- **Which bird** (species via radial wheel)
- **Which ear** (left/right channel)
- **At the right moment** (timing accuracy)

**Core Principle:** Audio-first, visual-augmented. Audio is always primary; spectrograms are optional scaffolding that fade as skill improves.

## Demo

```
Bird call plays in LEFT ear
→ Player taps LEFT side of screen
→ Player selects "Carolina Wren" on wheel
→ +100 points (species + channel + timing correct)
```

## Features

- **4 Game Modes:** Campaign, Practice, Challenge, Random Soundfield
- **Sound Packs:** Curated species groups (Common SE Birds, Spring Warblers, Sparrows, Woodpeckers)
- **Progressive Difficulty:** Event density, overlap, timing windows, spectrogram visibility
- **Real Audio:** Sourced from Xeno-canto, normalized and tagged
- **Confusion Analytics:** Learn which species you mix up

## Current Species (v1)

Southeastern U.S. focus:
- Northern Cardinal (NOCA)
- Carolina Wren (CARW)
- Blue Jay (BLJA)
- American Crow (AMCR)
- Tufted Titmouse (TUTI)
- *...expanding to 30-50 species*

## Tech Stack

| Layer | Technology |
|-------|------------|
| Game Code | TypeScript |
| Audio Engine | Web Audio API |
| Asset Pipelines | Python |
| Testing | Vitest |
| Build | Make |

## Quick Start

```bash
# Install dependencies
make install

# Run tests
make test

# Start dev server
make dev
```

## Development

This project uses phased development with Make targets:

```bash
make phase-a    # Audio ingestion
make phase-b    # Playback engine
make phase-c    # Input & scoring
make phase-d    # Level system
make phase-e    # UX polish
make phase-f    # Game modes
# ... phases G-N for packs, spectrograms, analytics
```

Validate any phase:
```bash
make smoke-b    # Run Phase B tests
make ralph PHASE=c  # Build + test Phase C
```

## Project Structure

```
src/
├── audio/      # AudioEngine, ChannelMixer
├── input/      # RadialWheel, ChannelInput
├── scoring/    # ScoreEngine, FeedbackRenderer
├── game/       # LevelLoader, EventScheduler, RoundManager
├── ui/         # HUD, RoundSummary, ConfusionMatrix, Calibration
├── modes/      # Campaign, Practice, Challenge, Random
├── packs/      # PackLoader, PackSelector
├── visual/     # LaneRenderer, TileManager
├── storage/    # ProgressStore
└── stats/      # StatsCalculator, ConfusionTracker

scripts/        # Python: audio_ingest, spectrogram_gen
data/           # clips/, packs/, levels.json
schemas/        # JSON schemas for validation
tests/          # Vitest test files
```

## Scoring

| Result | Points |
|--------|--------|
| Species correct | +50 |
| Channel correct | +25 |
| Timing perfect | +25 |
| Timing partial | +10 |
| **Maximum** | **+100** |

## Implementation Status

### Engine (Complete)

| Phase | Description | Tests | Status |
|-------|-------------|-------|--------|
| A | Audio ingestion & tagging | ✓ | ✅ |
| B | Stereo playback engine | 23 | ✅ |
| C | Input & scoring loop | 37 | ✅ |
| D | Level system | 35 | ✅ |
| E | UX polish & feedback | 45 | ✅ |
| F | Game modes | 54 | ✅ |
| G | Pack system | 44 | ✅ |
| H | Difficulty modifiers | 29 | ✅ |
| I | Random Soundfield | 47 | ✅ |
| J | Progression & stats | 59 | ✅ |
| K | Spectrogram generation | ✓ | ✅ |
| L | Lane renderer | 52 | ✅ |
| M | Visual modes | 60 | ✅ |
| N | Confusion analytics | 37 | ✅ |

**Engine: 522 tests passing**

### UI (React + PixiJS)

| Phase | Description | Status |
|-------|-------------|--------|
| O | Project setup & navigation | ✅ |
| P | Gameplay layout (static) | ✅ |
| Q | Engine integration | ✅ |
| R | Tile animation & feedback | ✅ |
| S | Supporting screens | ✅ |
| T | Polish & mobile testing | ✅ |

**UI: ALL PHASES COMPLETE** • PWA-ready • 204KB gzipped

**Stack:** React (screens) + PixiJS (gameplay) • Mobile-first • Portrait • PWA

## Documentation

See `PRD-SoundField-Birds.md` for full requirements, data models, and acceptance criteria.

## License

TBD

---

*Built with [Claude Code](https://claude.ai/code) using Ralph loops*
