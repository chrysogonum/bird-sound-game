# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChipNotes! is a rhythm-game–style audio training application that teaches players to identify bird sounds. Players identify species, spatial position (left/right channel), and timing accuracy within a performance-based format.

**Core principle:** Audio-first, visual-augmented. Audio is always primary; spectrograms are optional scaffolding.

## Build and Development Commands

```bash
# Setup
make install          # Install npm + Python dependencies

# Development
make dev              # Start development server
make build            # Production build (runs lint + test first)
make test             # Run all tests (Vitest)
make lint             # Run ESLint

# Validation
make validate-schemas # Validate all JSON schemas
make validate-clips   # Validate clips.json
make validate-packs   # Validate pack definitions
```

## Phase-Based Development (Ralph Loops)

The project uses phased development with Make targets. Each phase has a build target and smoke test:

```bash
make phase-a          # Audio ingestion & tagging
make smoke-a          # Smoke test Phase A

# Or run both together:
make ralph PHASE=a    # Runs phase-a then smoke-a
```

Phases A-N cover: Audio Ingestion → Playback Engine → Input/Scoring → Levels → UX → Modes → Packs → Difficulty → Random Mode → Persistence → Spectrograms → Lane Renderer → Visual Modes → Confusion Analytics.

## Architecture

### Directory Structure
- `src/` - TypeScript source (organized by domain: audio/, input/, scoring/, game/, modes/, ui/, visual/, packs/, storage/, stats/)
- `scripts/` - Python preprocessing scripts (audio_ingest.py, audio_tagger.py, spectrogram_gen.py, validate_schema.py)
- `data/` - Runtime data (clips/, packs/, spectrograms/, clips.json, levels.json)
- `schemas/` - JSON schemas (clip.schema.json, level.schema.json, pack.schema.json)
- `tests/` - Vitest test files

### Key Data Schemas
- **Clip**: Preprocessed audio file with species code, vocalization type, duration, file paths
- **Pack**: Curated species subset with frequency weights, vocalization ratios, difficulty modifiers
- **Level**: Difficulty configuration (event density, overlap probability, scoring window, spectrogram mode)
- **Event**: Runtime vocalization instance with timing, channel, and scoring window

### Audio Requirements
- All clips must be mono, 0.5-3.0 seconds, normalized to -16 LUFS
- No audio speed changes or pitch shifting (locked constraint)
- Stereo panning applied at playback, not in source files

### Scoring System
- Species correct: +50, Channel correct: +25, Timing perfect: +25 (partial: +10)
- Maximum per event: +100 points
