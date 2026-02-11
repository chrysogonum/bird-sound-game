# 🎨 Clip Studio - Unified Audio Clip Workflow

**The ONE tool for extracting, reviewing, and curating bird audio clips in ChipNotes!**

## What is Clip Studio?

Clip Studio merges `clip_editor.py` (extraction) and `review_clips.py` (curation) into a single unified interface. No more switching between tools - do everything in one place!

## Features

✅ **Extract clips** from Xeno-Canto recordings with waveform editor
✅ **Review and curate** metadata (vocalization type, quality, recordist)
✅ **Mark canonical clips** (enforces 1 per species)
✅ **Delete rejected clips** permanently
✅ **Pack-based filtering** (work on specific regions/themes)
✅ **Git integration** with automatic commits
✅ **Real-time updates** - no server restarts needed

## Quick Start

```bash
# Launch Clip Studio in batch mode
python3 scripts/clip_studio.py --batch

# Opens at http://localhost:8889
```

## Three-Panel Layout

### Left Panel: Species List
- **Pack filter dropdown** - Filter by region (NA/NZ/EU) or pack (Warblers, Raptors, etc.)
- **Species list** with counts:
  - 📦 Extracted clips count
  - 📥 Candidate sources available
- Auto-sorted: species with 0 clips first (ready to work on!)

### Center Panel: Waveform Editor
- **Source chips** - Click to load XC recordings from candidate manifests
- **XC input** - Enter XC ID to download and load new recording
- **Waveform display** - Click to set start time, drag slider for duration
- **Playback controls** - Play full recording or just your selection
- **Extract form:**
  - Vocalization type dropdown (auto-filled from XC API)
  - Recordist input (auto-filled from XC API)
  - Extract button - saves clip + spectrogram to clips.json

### Right Panel: Extracted Clips
- **Spectrogram thumbnails** - Visual preview of each clip
- **Metadata editor** (inline):
  - Vocalization type dropdown
  - Quality score (1-5 stars)
  - Recordist input
- **Actions:**
  - ▶ Play clip
  - ⭐ Canon - Mark as canonical (max 1 per species, enforced)
  - ✗ Delete - Mark for rejection
- **Save All** button - Commits all changes to git with descriptive message

## Workflow Example

### Extracting Clips for EU Warblers

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

## Pack Filtering

Use the pack filter dropdown to focus on specific regions or themes:

- **All Birds** - Shows all species in clips.json
- **North America** - NA packs (Woodpeckers, Spring Warblers, etc.)
- **New Zealand** - NZ packs (South Island, North Island)
- **Europe** - EU packs (Warblers & Skulkers, Raptors, Woodland)

## Git Integration

The "Save All" button:

1. Creates backup of clips.json
2. Validates canonical uniqueness (1 per species)
3. Deletes rejected files (WAV + PNG)
4. Removes rejected clips from clips.json
5. Commits to git with descriptive message

Example commit message:
```
Clip Studio: 3 clips rejected, 6 files deleted
```

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

## Comparison with Legacy Tools

| Feature | clip_editor.py | review_clips.py | **clip_studio.py** |
|---------|----------------|-----------------|-------------------|
| Extract clips | ✅ | ❌ | ✅ |
| Edit metadata | ❌ | ✅ | ✅ |
| Mark canonical | ❌ | ✅ | ✅ |
| Delete clips | ❌ | ✅ | ✅ |
| Pack filtering | ❌ | ❌ | ✅ |
| Git commits | ❌ | ✅ | ✅ |
| Unified UI | ❌ | ❌ | ✅ |

## Troubleshooting

### Port already in use
```bash
# Kill existing server
pkill -f clip_studio.py

# Or use different port
python3 scripts/clip_studio.py --batch --port 8890
```

### Candidate sources not showing
- Verify candidate folders exist: `data/candidates_*`
- Check `.ingest_manifest.json` files have species codes
- Verify XC recordings downloaded (`.mp3` or `.wav` files)

### Spectrograms not generating
- Install librosa: `pip install librosa`
- Check logs for matplotlib errors
- Verify write permissions on `data/spectrograms/`

## Development

### File Structure
- `clip_studio.py` - Main script (all-in-one)
- Port: 8889 (configurable with `--port`)
- Temp files: `/tmp/clip-studio/`

### API Endpoints
- `GET /api/init` - Initial state
- `GET /api/packs` - All pack definitions
- `GET /api/species` - Species list with counts
- `GET /api/clips?species=CODE` - Clips for species
- `GET /api/candidates?species=CODE` - Candidate sources
- `GET /api/waveform?source=PATH` - Waveform data
- `GET /api/load-xc?id=XCID` - Download XC recording
- `POST /api/extract` - Extract clip
- `POST /api/update-clip` - Update clip metadata
- `POST /api/delete-clip` - Delete clip
- `POST /api/save-changes` - Save all and commit

## Future Enhancements

Potential additions (not yet implemented):

- [ ] Search XC API directly from UI
- [ ] Batch extract multiple clips from one source
- [ ] Audio visualization improvements (spectrogram overlay on waveform)
- [ ] Keyboard shortcuts (spacebar = play, E = extract, etc.)
- [ ] Undo/redo for metadata changes
- [ ] Export pack statistics (clip counts, quality distribution)

## Credits

Built by merging the best features of:
- `clip_editor.py` - Waveform extraction UI
- `review_clips.py` - Metadata curation UI

Unified by Claude Code (February 2026)
