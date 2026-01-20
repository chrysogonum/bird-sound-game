# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChipNotes! is a rhythm-game–style audio training application that teaches players to identify bird sounds. Players identify species, spatial position (left/right channel), and timing accuracy within a performance-based format.

**Core principle:** Audio-first, visual-augmented. Audio is always primary; spectrograms are optional scaffolding.

## Project Status

**Current Version:** v3.27 (January 2026)
**Status:** Production - Shipped and live at [chipnotes.app](https://chipnotes.app)
**Phase:** All 20 phases (A-T) complete. Post-launch iteration and refinement.

## Build and Development Commands

```bash
# Setup
make install          # Install npm + Python dependencies

# Development
make dev              # Start development server (http://localhost:3000)
make build            # Production build (runs lint + test first)
make test             # Run all tests (Vitest)
make lint             # Run ESLint

# Validation
make validate-schemas # Validate all JSON schemas
make validate-clips   # Validate clips.json
make validate-packs   # Validate pack definitions
```

## Deployment

**IMPORTANT:** ChipNotes uses GitHub Pages with the `gh-pages` package. The `dist/` folder is gitignored, so changes must be deployed via the npm deploy script, NOT by committing dist files.

### Production Deployment Workflow

```bash
# From src/ui-app directory:
cd src/ui-app
npm run deploy        # Builds and deploys to gh-pages branch
```

**What happens:**
1. `predeploy` hook runs `npm run build` (TypeScript compile + Vite build)
2. Vite outputs to `../../dist/` (gitignored)
3. `gh-pages -d ../../dist` pushes dist/ to `gh-pages` branch
4. GitHub Pages serves from `gh-pages` branch to chipnotes.app (via CNAME)
5. Deployment takes ~1-2 minutes to propagate

### Mobile Testing (Local Network)

```bash
cd src/ui-app
npm run dev -- --host  # Exposes dev server on local network
# Access from mobile: http://192.168.x.x:3000
```

### Version Numbering

- Update version in `src/ui-app/screens/MainMenu.tsx` (footer)
- Add version history entry in `src/ui-app/screens/Help.tsx`
- Follow semantic versioning: v3.27 → v3.28 (for minor changes/fixes)
- Commit source changes to `main` branch, then deploy separately

### Deployment Checklist

1. Make code changes and test locally
2. Update version number in MainMenu.tsx
3. Add version history entry in Help.tsx
4. Commit changes to `main` branch: `git add . && git commit && git push`
5. Deploy to production: `cd src/ui-app && npm run deploy`
6. Wait 1-2 minutes, verify at chipnotes.app

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

### Adding New Bird Audio Clips ⚠️ CRITICAL WORKFLOW

**Complete workflow to add new clips to the game:**

1. **Download clips from Xeno-Canto** (downloads to temporary candidates folder):
   ```bash
   python3 scripts/audio_ingest.py \
     --output data/candidates_XXXX \
     --species "Common Name" \
     --max-per-species 5 \
     --vocalization-type call  # or song
   ```
   This creates preprocessed WAV files (mono, 0.5-3s, -16 LUFS) with manifest.json

2. **Copy WAV files to main clips folder**:
   ```bash
   cp data/candidates_XXXX/*.wav data/clips/
   ```

3. **Add clip metadata to clips.json** (merge candidate manifest into clips.json):
   ```python
   python3 -c "
   import json

   # Load clips.json
   with open('data/clips.json') as f:
       clips = json.load(f)

   # Load candidate manifest
   with open('data/candidates_XXXX/manifest.json') as f:
       candidates = json.load(f)

   # Add each candidate to clips.json
   for candidate in candidates:
       clip_entry = {
           'clip_id': candidate['source_id'].replace('XC', 'XXXX_'),
           'species_code': 'XXXX',  # 4-letter code
           'common_name': candidate['species_name'],
           'file_path': f\"data/clips/{candidate['file_path'].split('/')[-1]}\",
           'vocalization_type': candidate['vocalization_type'],
           'duration_ms': candidate['duration_ms'],
           'loudness_lufs': candidate['loudness_lufs'],
           'source': 'xenocanto',
           'source_id': candidate['source_id'],
           'quality_score': 5,  # A=5, B=4, C=3, D=2, E=1
           'recordist': candidate.get('recordist', '')
       }
       clips.append(clip_entry)

   # Save updated clips.json
   with open('data/clips.json', 'w') as f:
       json.dump(clips, f, indent=2)

   print(f'Added {len(candidates)} clips')
   "
   ```

4. **Generate spectrograms**:
   ```bash
   python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms
   ```
   This generates PNG spectrograms AND updates clips.json with spectrogram_path

5. **Review clips in the browser** (optional but recommended):
   ```bash
   python3 scripts/review_clips.py --filter XXXX
   ```
   Open http://localhost:8888 to listen, view spectrograms, and mark clips as canonical/rejected

6. **Commit changes**:
   ```bash
   git add data/clips.json data/clips/XXXX_*.wav data/spectrograms/XXXX_*.png
   git commit -m "Add N XXXX clips for [species name]"
   ```

**IMPORTANT GOTCHAS:**
- Species code in filenames MUST match `species_code` in clips.json
- Always run spectrogram_gen.py AFTER adding to clips.json (it updates paths)
- If species code is wrong (e.g., RUBY instead of RCKI), rename files AND update manifest before step 2
- Spectrograms won't show until clips.json has correct spectrogram_path entries

### Species Data - Single Source of Truth ⚠️ CRITICAL

**docs/IBP-AOS-list25.csv is the SINGLE SOURCE OF TRUTH for all bird species information:**

- 4-letter bird codes (SPEC column)
- Common names (COMMONNAME column)
- Scientific names (SCINAME column)
- Taxonomic ordering (row order = AOS/eBird 2025 taxonomy)

**Generated Files:**
- `data/species.json` - Full species list with all metadata
- `data/taxonomic_order.json` - Species code to taxonomic order mapping

**Regenerating from CSV:**
```bash
make generate-species-data
# OR directly:
python3 scripts/generate_species_data.py
```

**IMPORTANT:** Never manually edit `species.json` or `taxonomic_order.json`. Always regenerate from the CSV when:
- Adding new species
- Updating scientific names
- Updating common names
- Taxonomy updates (new AOS checklist)

**When adding or migrating species codes, you MUST update ALL of these locations:**
1. `data/clips.json` - Clip metadata
2. `data/clips/*.wav` - Audio file names
3. `data/spectrograms/*.png` - Spectrogram file names
4. `data/icons/*.png` - Icon file names
5. `data/packs/*.json` - Pack species lists
6. **`data/levels.json`** - Level species pools (⚠️ CRITICAL - often missed!)
7. `data/species.json` + `data/taxonomic_order.json` - Regenerate from CSV

Use the migration script: `scripts/migrate_species_codes.py`
Verify with audit: `make audit-species-data`

This ensures consistency across:
- Game UI (PreRoundPreview, GameplayScreen, etc.)
- Audio ingestion tools
- Clip review tools (`data/review-clips.html`)
- File naming conventions
- All taxonomic sorting features

### Spectrogram Requirements ⚠️ CRITICAL

**LOCKED SETTINGS - DO NOT MODIFY:**

All spectrograms MUST be generated with these exact settings from `scripts/spectrogram_gen.py`:
- **Output dimensions:** 400x200px (2:1 aspect ratio)
- **Frequency range:** 500-10000 Hz (bird vocalization range)
- **Colormap:** magma (purple-red-yellow gradient)
- **FFT settings:** n_fft=1024, hop_length=256
- **Normalization:** 5th-95th percentile vmin/vmax

**Display Requirements:**

When displaying spectrograms in ANY UI (review tools, game UI, etc.):
- **MUST use:** `height: auto` and `object-fit: contain`
- **NEVER use:** `height: 100px` or `object-fit: cover` (this crops the image!)
- **Why:** Spectrograms must show the full frequency range without cropping to preserve visual learning consistency

**Regenerating spectrograms:**
```bash
# ALWAYS use the official script - never inline matplotlib code
python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms
```
