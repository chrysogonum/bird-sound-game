# Adding Birds to ChipNotes!

This guide documents the audio ingestion workflows for adding bird species to ChipNotes. There are two distinct approaches depending on the audio source.

## Overview: Two Ingestion Workflows

| Workflow | Source | Species Codes | Use When |
|----------|--------|---------------|----------|
| **Standard (NA)** | Xeno-canto, Cornell Macaulay | 4-letter alpha codes (NOCA, BLJA) | Pre-clipped recordings (~0.5-3s), clear single vocalizations |
| **Manual Selection** | DOC NZ, long-form recordings | eBird 6-letter codes (tui1, nezbel1) | Long recordings requiring manual clip extraction |

---

## Standard Workflow (North American Birds)

**Best for:** Xeno-canto, Cornell Macaulay Library - sources where recordings are relatively short (3-90 seconds) and contain clear vocalizations.

### How It Works

There are two approaches for NA birds:

**Recommended: Manual Extraction with Clip Editor** — gives precise control over which segments are extracted.

**Alternative: Auto-Extraction with audio_ingest.py** — automatically extracts the loudest 3-second window from each recording (faster but less precise).

### Tool Decision Guide

| Tool | When to Use |
|------|-------------|
| `clip_editor.py` | **Primary** — manual extraction from XC recordings with waveform UI. Auto-populates recordist and vocalization type from XC API. |
| `audio_ingest.py` | Bulk auto-extraction (quick additions where manual selection isn't needed) |
| `augment_species.py` | Adding more clips to species already in game (auto-filters existing/rejected) |
| `clip_selector.py` | Extracting from local long-form recordings (NZ workflow) |

### Steps (Clip Editor — Recommended)

#### 1. Find Good XC Recordings
Search Xeno-canto for top-rated (quality A/B) recordings for each species.

#### 2. Extract Clips with Clip Editor
```bash
# Load a specific XC recording for a species
python scripts/clip_editor.py --xc 123456 --species RWBL

# Or browse/add clips for a species
python scripts/clip_editor.py --species RWBL
```

The clip editor:
- Downloads the full XC recording
- Queries XC API to auto-populate recordist and vocalization type
- Renders waveform in browser (http://localhost:8889)
- Extracts clips with normalization to -16 LUFS, mono
- Adds directly to `clips.json` (no merge_candidates step needed)

### Steps (Auto-Extraction — Alternative)

#### 1. Download Audio
```bash
# Xeno-canto auto-extraction
python scripts/audio_ingest.py --output data/candidates_NOCA --species "Northern Cardinal" --max-per-species 10
```

#### 2. Process Audio
The ingest scripts automatically:
- Convert to mono WAV
- Normalize to -16 LUFS
- Verify duration (0.5-3.0 seconds)
- Output to candidates directory

#### 3. Update Clip Metadata
```bash
# Merge new clips into clips.json (SAFE - appends only)
python scripts/merge_candidates.py data/candidates_{CODE}
```

⚠️ **WARNING:** Never use `audio_tagger.py` directly - it overwrites clips.json!

#### 4. Generate Spectrograms
```bash
python scripts/spectrogram_gen.py --input data/clips --output data/spectrograms
```

#### 5. Review & Curate
```bash
python scripts/review_clips.py
# Open http://localhost:8888 in browser
```

Use the review tool to:
- Mark canonical clips (best example of each species)
- Reject poor quality clips
- Verify species identification

#### 6. Create Icons
- Check `data/icons/PROMPTS.md` for design prompts
- Generate using DALL-E 3 or commission artist
- Save as `data/icons/{CODE}.png` (4-letter code)

#### 7. Create/Update Pack
- Edit or create `data/packs/{pack_name}.json`
- Use 4-letter alpha codes in species array

#### 8. Validate & Test
```bash
make validate-schemas
make dev
# Test in browser
```

---

## Manual Selection Workflow (NZ Birds & Long Recordings)

**Best for:**
- NZ Department of Conservation (DOC) recordings
- Long-form field recordings requiring clip extraction
- Any source where recordings need manual segmentation

This workflow was developed for NZ birds but is useful for any region where:
- Recordings are longer than 3 seconds
- Multiple vocalizations exist in single files
- Manual selection of best segments is needed

### Key Differences from Standard Workflow

| Aspect | Standard (NA) | Manual Selection (NZ) |
|--------|---------------|----------------------|
| Species codes | 4-letter (NOCA) | eBird 6-letter (tui1) |
| Icon naming | `{4-letter}.png` | `{ebird-code}.png` |
| Clips file | `clips.json` | `clips-nz.json` |
| Clips directory | `data/clips/` | `data/clips-nz/` |
| Display codes | Code = display | Separate mapping in `nz_display_codes.json` |
| Naming | English common names | Māori names primary |

### Steps

#### 1. Download Raw Audio
```bash
# Download all NZ DOC recordings to data/raw-nz/
python scripts/nz_ingest.py

# Download specific species only
python scripts/nz_ingest.py --species tui1 nezbel1 morepo2

# Dry run (show what would be downloaded)
python scripts/nz_ingest.py --dry-run
```

Downloaded files go to `data/raw-nz/` as full-length MP3s.

#### 2. Extract Clips with Clip Selector Tool

The **Clip Selector Tool** is a web-based interface for manually selecting segments from long recordings.

```bash
# Launch the clip selector
python scripts/clip_selector.py --input data/raw-nz/

# Filter to specific species
python scripts/clip_selector.py --input data/raw-nz/ --species tui1,nezbel1
```

Open http://localhost:8889 in your browser.

**Clip Selector Features:**
- Waveform visualization of full recording
- Scrub/playback controls
- Adjustable selection window (0.5-3.0 seconds)
- Preview selected segment before extraction
- Automatic normalization to -16 LUFS
- Spectrogram generation on extract

**Workflow in Clip Selector:**
1. Select a recording from the list
2. Listen and scrub through to find clear vocalizations
3. Click to set start point
4. Adjust duration slider (0.5-3.0s)
5. Preview the selection
6. Click "Extract" to save
7. Repeat for multiple clips per recording

Extracted clips are automatically:
- Converted to mono WAV at 44.1kHz
- Normalized to -16 LUFS
- Saved to `data/clips-nz/`
- Added to `data/clips-nz.json`

#### 3. Review & Curate
```bash
python scripts/review_clips.py --clips data/clips-nz.json
# Open http://localhost:8888
```

Same review tool as NA workflow, but operating on NZ clips.

#### 4. Create Display Code Mapping

NZ birds use eBird codes internally but display shorter codes and Māori names. Edit `data/nz_display_codes.json`:

```json
{
  "codes": {
    "tui1": { "code": "TUI", "tileName": "Tūī" },
    "nezbel1": { "code": "BELL", "tileName": "Korimako" },
    "nezrob2": { "code": "NIRO", "tileName": "Toutouwai (NI)" },
    "nezrob3": { "code": "SIRO", "tileName": "Toutouwai (SI)" }
  }
}
```

**Naming Conventions:**
- Māori names take priority for well-known species
- Subspecies use parenthetical qualifiers: `(NI)`, `(SI)`, `(Ch.)`
- See `docs/nz-bird-naming.md` for full conventions

#### 5. Create Icons

Icons use eBird codes (not display codes):
```
data/icons/tui1.png
data/icons/nezbel1.png
data/icons/nezrob2.png
```

#### 6. Create/Update Packs

NZ packs use eBird codes and include a `region` field:

```json
{
  "pack_id": "nz_common",
  "region": "nz",
  "display_name": "Garden & Bush",
  "description": "Common NZ birds...",
  "species": ["tui1", "nezbel1", "nezfan1"],
  "vocalization_weights": { "song": 0.6, "call": 0.4 }
}
```

#### 7. Update Taxonomic Order (Optional)

For taxonomic sorting support:
```bash
python scripts/add_nz_species_to_taxonomy.py
```

This adds NZ eBird codes to `data/taxonomic_order.json`.

#### 8. Validate & Test
```bash
make validate-schemas
make validate-packs
make dev
# Test NZ packs in browser
```

---

## Clip Selector Tool Reference

The Clip Selector (`scripts/clip_selector.py`) is a powerful tool for any audio that requires manual segmentation.

### When to Use It

Use the Clip Selector when:
- Source recordings are longer than 3 seconds
- You need to extract specific vocalizations from field recordings
- Multiple usable clips exist within one file
- Audio quality varies within a recording and you need to select best sections

### Command Line Options

```bash
python scripts/clip_selector.py [OPTIONS]

Options:
  --input, -i DIR     Input directory with raw audio files (required)
  --output, -o DIR    Output directory for clips (default: data/clips-nz/)
  --port PORT         Server port (default: 8889)
  --species CODES     Comma-separated species filter (optional)
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← / → | Scrub 0.5s |
| [ / ] | Fine scrub 0.1s |
| E | Extract current selection |
| N | Next recording |
| P | Previous recording |

### Output Format

Extracted clips follow the naming convention:
```
{DISPLAY_CODE}_{source-filename}_{clip_number}.wav
```

Example: `BELL_bellbird-06_1.wav`, `BELL_bellbird-06_2.wav`

---

## Adapting Manual Selection for Other Regions

The NZ workflow can be adapted for other regions (UK, Australia, etc.):

1. **Create region-specific ingest script** (like `nz_ingest.py`)
   - Define species catalog with eBird codes
   - Map to audio source URLs
   - Include regional metadata (Māori names, etc.)

2. **Create separate clips file** (`clips-{region}.json`)

3. **Create display codes mapping** (`{region}_display_codes.json`)

4. **Use Clip Selector** for manual extraction

5. **Update game engine** to load region-specific clips based on pack

---

## File Reference

### Scripts

| Script | Purpose |
|--------|---------|
| `audio_ingest.py` | Download & process from Xeno-canto |
| `cornell_ingest.py` | Process Cornell Macaulay downloads |
| `nz_ingest.py` | Download NZ DOC audio |
| `clip_selector.py` | Manual clip extraction from raw recordings |
| `clip_editor.py` | **Fix/replace existing clips, add clips by species** |
| `review_clips.py` | Review & curate clips |
| `spectrogram_gen.py` | Generate spectrograms |
| `merge_candidates.py` | Safely add clips to clips.json |

### Data Files

| File | Purpose |
|------|---------|
| `data/clips.json` | NA clip metadata |
| `data/clips-nz.json` | NZ clip metadata |
| `data/nz_display_codes.json` | NZ eBird → display code mapping |
| `data/taxonomic_order.json` | Phylogenetic sort order |
| `data/species.json` | Species names & scientific names |

### Documentation

| File | Purpose |
|------|---------|
| `docs/add-birds.md` | This file |
| `docs/nz-bird-naming.md` | NZ naming conventions |
| `docs/nz-birds-plan.md` | NZ feature planning (historical) |
| `scripts/README_REVIEW_TOOL.md` | Review tool documentation |

---

## Editing & Fixing Existing Clips

The **Clip Editor** (`scripts/clip_editor.py`) is a tool for fixing problematic clips and adding more clips to existing species. It differs from the Clip Selector in that it's designed around *existing clips in your game* rather than raw source recordings.

### When to Use Each Tool

| Tool | Use Case |
|------|----------|
| `clip_editor.py` | Fix a problematic clip, add clips to existing species, browse clips by species |
| `clip_selector.py` | Extract clips from long raw recordings (NZ/DOC workflow) |
| `review_clips.py` | Curate clips (mark canonical, reject poor quality) |

### Clip Editor Features

- **Browse by species** - See all existing clips for a species
- **Auto-download sources** - Fetches full XC recording when you click a clip
- **Replace clips** - Extract new segment and overwrite problematic clip (with backup)
- **Add new clips** - Extract additional clips from same or new sources
- **Proper naming** - New clips named `{SPECIES}_{XCID}_{N}` (e.g., `EAME_906697_1`)

### Command Line Options

```bash
python scripts/clip_editor.py [OPTIONS]

Options:
  --clip CLIP_ID      Load a specific clip for editing (by ID or filename)
  --species CODE      Browse/edit clips for a species (4-letter code)
  --xc XCID           Download and load a Xeno-Canto recording
  --source FILE       Load a local source file
  --port PORT         Server port (default: 8889)
```

### Example Workflows

#### Fix a problematic clip
```bash
# A clip has background noise or wrong bird - need to re-extract
python scripts/clip_editor.py --clip EAME_906697

# Opens browser showing:
# - All EAME clips on the right
# - Source recording (auto-downloaded from XC) in waveform editor
# - Click problematic clip, find clean segment, click "Replace Selected Clip"
```

#### Add more clips to existing species
```bash
# Species needs more variety
python scripts/clip_editor.py --species RWBL

# Browse existing clips, load a new XC recording, extract additional clips
```

#### Add clips from new XC recording
```bash
# Found a great recording on Xeno-Canto
python scripts/clip_editor.py --xc 123456 --species RWBL

# Waveform loads immediately, extract multiple clips
```

### Workflow in Browser

1. **Right panel** shows all existing clips for the species
2. **Click a clip** to load its XC source into the waveform editor
3. **Scrub and preview** to find clean vocalizations
4. **Set selection** by clicking waveform, adjust duration slider
5. **Extract New Clip** creates a new clip with proper naming
6. **Replace Selected Clip** overwrites the selected clip (backs up old version)

### Backup Behavior

When replacing a clip, the old audio and spectrogram are backed up to:
```
data/backups/{YYYYMMDD}/{clip_id}.wav
data/backups/{YYYYMMDD}/{clip_id}.png
```

---

## Troubleshooting

### Clip Selector won't start
- Ensure dependencies: `pip install numpy soundfile pyloudnorm`
- Check port 8889 isn't in use

### Audio not playing in browser
- Check browser audio permissions
- Try a different browser (Chrome recommended)

### Clips too quiet after extraction
- Check source audio levels
- Verify -16 LUFS normalization is working
- Use review tool to compare volumes

### Schema validation fails for NZ packs
- Ensure `region: "nz"` is set in pack JSON
- Verify species codes are valid eBird format (3-10 lowercase alphanumeric)

---

*Last updated: January 2026 (v4.10 - clip_editor.py as primary tool, XC API auto-metadata)*
