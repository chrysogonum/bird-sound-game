# Clip Studio Redesign - Implementation Plan

## Overview

Merge `clip_editor.py` (extraction) and `review_clips.py` (curation) into a single unified "Clip Studio" tool that handles the complete workflow: search → extract → review → curate → commit.

## Design Goals

1. **Single unified tool** for the complete clip workflow
2. **Pack-based filtering** in left panel (all birds, regional packs, thematic packs)
3. **Professional UI design** using dark theme with teal accents
4. **Preserve batch mode** 3-panel layout (it works great!)
5. **No interruption** to current EU extraction work (safe to deploy alongside)

## Architecture - Three-Panel Layout

```
┌──────────────┬───────────────────────────────┬──────────────────┐
│ LEFT PANEL   │ CENTER PANEL                  │ RIGHT PANEL      │
│ (280px)      │ (flex-grow)                   │ (360px)          │
│              │                               │                  │
│ [Pack Filter]│ ┌─ Species Header ──────────┐│ Extracted Clips  │
│  ○ All Birds │ │ Wood Warbler (WOWA)       ││ (8 clips)        │
│  ○ EU Packs  │ │ Phylloscopus sibilatrix   ││                  │
│    • Warblers│ └───────────────────────────┘│ [Clip Card 1]    │
│    • Raptors │                               │  ├─ Spectrogram  │
│    • Woodland│ ┌─ Source Recordings ───────┐│  ├─ Metadata     │
│  ○ NZ Packs  │ │ [XC1000139 song] [XC99...││  ├─ ⭐ Canonical  │
│  ○ NA Packs  │ └───────────────────────────┘│  ├─ ✏️ Edit      │
│              │                               │  └─ 🗑️ Delete    │
│ Species List │ ┌─ Waveform Editor ─────────┐│                  │
│ (filtered)   │ │ [███▓▓▓░░░░░░░░░░░░░░░░░] ││ [Clip Card 2]    │
│              │ │     │◄─selection─►│       ││  ...              │
│ □ WOWA  0/9  │ │ [▶ Play] [▶ Selection]   ││                  │
│ □ BLUE  0/10 │ └───────────────────────────┘│ [💾 Save All]    │
│ □ EUBB  0/7  │                               │                  │
│ ✓ SEWA 10/10 │ ┌─ Extract Controls ────────┐│                  │
│ ✓ RIWA  8/10 │ │ Start: 2.45s  Duration: 2s││                  │
│ ✓ CCHI 10/10 │ │ Type: [song ▾] Recordist ││                  │
│              │ │ [🎯 Extract Clip]         ││                  │
│              │ └───────────────────────────┘│                  │
└──────────────┴───────────────────────────────┴──────────────────┘
```

## Key Features

### 1. Pack-Based Filtering (Left Panel)
- Load all packs from `data/packs/*.json`
- Group by region: NA, NZ, EU
- Special "All Birds" option (loads all clips.json)
- Filter species list by selected pack
- Show pack stats: "35 species, 280 clips extracted"
- Persist selection in localStorage

### 2. Extraction Features (Center Panel)
- **Source chips** - Click to load XC recordings from candidate manifests
- **XC input** - Enter XC ID to download and load new recording
- **Waveform display** - Click to set start time, drag slider for duration
- **Playback controls** - Play full recording or just your selection
- **Extract form:**
  - Vocalization type dropdown (auto-filled from XC API)
  - Recordist input (auto-filled from XC API)
  - Extract button - saves clip + spectrogram to clips.json

### 3. Curation Features (Right Panel)
Each clip card shows:
- Spectrogram thumbnail (400x200 → 180x90 scaled)
- Clip ID, duration, quality score
- Vocalization type (editable dropdown)
- Recordist (editable input)
- Quality score (1-5 stars, clickable)
- **⭐ Canonical button** (max 1 per species, gold when active)
- **✏️ Edit button** (toggle edit mode)
- **🗑️ Delete button** (marks for rejection)
- **▶ Play button** (audio playback)

### 4. Git Integration
- **💾 Save All Changes** button in right panel header
- Creates backup (clips.json.backup)
- Validates canonical uniqueness (1 per species)
- Logs rejected XC IDs to rejected_xc_ids.json
- Deletes rejected files (WAV + PNG)
- Generates descriptive commit message
- Runs `git add data/clips.json && git commit -m "..."`

### 5. Professional UI Design
- ChipNotes dark theme (#1a1a1a background, #4db6ac accent)
- IBM Plex Mono for code/data, Inter for UI text
- Smooth transitions and hover states
- Icon buttons with tooltips
- Visual states: canonical (gold), modified (blue glow), rejected (red fade)
- Sticky headers, scrollable panels
- Loading states with skeleton screens
- Toast notifications for saves/errors

## Implementation

### Backend APIs (Python)

**New API endpoints:**
```python
/api/update-clip          POST   Update clip metadata (canonical, quality, voc_type, recordist)
/api/delete-clip          POST   Mark clip for deletion
/api/save-changes         POST   Commit all changes (backup, validate, delete files, git commit)
/api/packs                GET    List all packs grouped by region
/api/clips-by-pack        GET    List clips filtered by pack_id
```

**New functions:**
```python
def load_packs() -> dict:
    """Load all pack JSONs, return dict keyed by region"""

def filter_species_by_pack(pack_id: str) -> list:
    """Return species codes from pack definition"""

def validate_canonical_uniqueness(clips: list) -> bool:
    """Ensure max 1 canonical per species"""

def log_rejected_xc_ids(clip_ids: list) -> None:
    """Append to data/rejected_xc_ids.json"""

def delete_clip_files(clip: dict) -> None:
    """Delete WAV and PNG for rejected clip"""

def generate_commit_message(changes: dict) -> str:
    """Format descriptive commit message"""

def git_commit_clips() -> bool:
    """Backup, validate, commit clips.json"""
```

### Frontend (HTML/CSS/JS)

**Key HTML structure:**
```html
<div class="three-panel-studio">
  <aside class="left-panel">
    <div class="pack-filter">
      <!-- Region toggles (NA/NZ/EU/All) -->
      <!-- Pack list (collapsible by region) -->
    </div>
    <div class="species-list">
      <!-- Species cards with checkboxes, counts, progress -->
    </div>
  </aside>

  <main class="center-panel">
    <header class="species-header">
      <!-- Species name, scientific name, stats -->
    </header>
    <div class="sources-bar">
      <!-- Source buttons (XC IDs) -->
    </div>
    <div class="waveform-editor">
      <!-- Canvas, playback controls, extraction form -->
    </div>
  </main>

  <aside class="right-panel">
    <header class="clips-header">
      <h2>Extracted Clips (8)</h2>
      <button class="btn-save-all">💾 Save All</button>
    </header>
    <div class="clips-list">
      <!-- Clip cards with inline editing -->
    </div>
  </aside>
</div>
```

**CSS Design System:**
```css
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #222;
  --bg-tertiary: #2a2a2a;
  --accent: #4db6ac;
  --accent-hover: #5dc6bc;
  --text-primary: #e0e0e0;
  --text-secondary: #999;
  --border: #333;
  --success: #6a6;
  --warning: #f90;
  --error: #c66;
  --canonical: #ffd700;
}
```

**JavaScript State Management:**
```javascript
const state = {
  selectedRegion: 'all',  // 'na', 'nz', 'eu', 'all'
  selectedPack: null,     // pack_id or null
  selectedSpecies: null,  // species_code
  packs: {},              // loaded pack definitions
  species: [],            // filtered by pack
  clips: [],              // for selected species
  modifications: {},      // pending changes before save
  candidates: []          // source recordings
};
```

## Workflow Example: Extracting Clips for EU Warblers

1. **Launch Clip Studio:**
   ```bash
   python3 scripts/clip_studio.py --batch
   ```

2. **Filter by pack:** Select "European Warblers" from dropdown

3. **Select species:** Click "WOWA - Wood Warbler" (0 clips)

4. **Load source:** Click "XC1000139" chip (from candidate manifest)

5. **Extract clip:**
   - Click waveform to set start time
   - Adjust duration slider (0.5-3.0s)
   - Click "🎯 Extract Clip"
   - Spectrogram auto-generated
   - Clip appears in right panel

6. **Curate clip:**
   - Verify vocalization type (song/call/etc.)
   - Adjust quality score if needed
   - Mark as canonical (⭐ Canon button)

7. **Repeat** for 2-3 more clips per species

8. **Save changes:**
   - Click "💾 Save All" in right panel
   - Automatic git commit with descriptive message

## Technical Notes

### Resampling Quality
- Uses `librosa.resample()` for 48kHz→44.1kHz conversion
- **NEVER use `np.interp`** - causes electronic/metallic artifacts

### Spectrogram Settings (Locked)
All spectrograms generated with these exact settings:
- Output: 400x200px (2:1 aspect ratio)
- Frequency: 500-10000 Hz
- Colormap: magma
- FFT: n_fft=1024, hop_length=256
- Normalization: 5th-95th percentile

### Canonical Enforcement
- Max 1 canonical per species (enforced client-side and server-side)
- Clicking "Canon" clears all other canonicals for that species
- Validation runs on save

## Success Criteria

- [x] Single unified tool replaces clip_editor.py + review_clips.py
- [x] Pack-based filtering works (all packs from data/packs/*.json)
- [x] Extraction workflow unchanged (waveform, extract, save)
- [x] Curation features work (canonical, delete, edit metadata)
- [x] Git integration works (backup, commit with descriptive messages)
- [x] Professional UI design (ChipNotes theme, smooth interactions)
- [x] No interruption to current EU extraction work
- [x] All 3 agents' findings integrated (extraction + curation + packs)

## Status

✅ **Implementation Complete**
- File: `scripts/clip_studio.py` (2,041 lines)
- Professional dark theme with IBM Plex Mono + Inter fonts
- All features implemented and tested
- Server running on port 8889 (configurable)

## Known Issues

1. **Pack names showing "null"** in European Packs dropdown
   - Need to fix pack name loading from pack JSON files
   - Pack IDs are loading correctly, but display names are not

## Usage

```bash
# Launch Clip Studio
python3 scripts/clip_studio.py --batch

# Opens at http://localhost:8889
```
