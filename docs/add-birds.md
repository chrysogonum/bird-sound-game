# Adding Birds to ChipNotes!

This guide documents the audio ingestion workflows for adding bird species to ChipNotes. There are two distinct approaches depending on the audio source.

## Overview: Two Ingestion Workflows

| Workflow | Source | Species Codes | Use When |
|----------|--------|---------------|----------|
| **Standard (NA)** | Xeno-canto, Cornell Macaulay | 4-letter alpha codes (NOCA, BLJA) | Pre-clipped recordings (~0.5-3s), clear single vocalizations |
| **Manual Selection** | DOC NZ, long-form recordings | eBird 6-letter codes (tui1, nezbel1) | Long recordings requiring manual clip extraction |

---

## Standard Workflow (North American Birds)

**Best for:** Xeno-canto, Cornell Macaulay Library, and other sources with pre-segmented recordings.

### Prerequisites
- Audio files are already ~0.5-3 seconds
- Each file contains a single clear vocalization
- Minimal background noise

### Steps

#### 1. Download Audio
```bash
# Xeno-canto (using API key)
python scripts/audio_ingest.py --species NOCA,BLJA --source xc

# Cornell (requires pre-approval)
python scripts/cornell_ingest.py --input <cornell_downloads> --output data/clips
```

#### 2. Process Audio
The ingest scripts automatically:
- Convert to mono WAV
- Normalize to -16 LUFS
- Verify duration (0.5-3.0 seconds)
- Output to `data/clips/`

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
| `clip_selector.py` | **Manual clip extraction tool** |
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

*Last updated: January 2026 (v4.0 - NZ Birds release)*
