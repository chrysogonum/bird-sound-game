# Clip Review & Metadata Editor

**Authoritative tool for curating bird audio clips in ChipNotes!**

## Overview

This is the ONE canonical tool for reviewing and editing audio clip metadata. It replaces all previous ad-hoc review HTML files and `review_server.py`.

**Key Features:**
- ✅ View spectrograms and play audio
- ✅ Edit vocalization types (song, call, drum, flight call, etc.)
- ✅ Set canonical clips (one per species)
- ✅ Adjust quality scores (1-5)
- ✅ Reject clips (permanently deletes files)
- ✅ Filter by species, source, quality
- ✅ Saves directly to clips.json with git commit
- ✅ Backup before save + validation

## Quick Start

```bash
# Launch the review tool
python scripts/review_clips.py

# Opens browser to http://localhost:8888
# Review clips → Make changes → Click "Save Changes"
```

## Use Cases

### 1. Review New Species
```bash
# After adding Western Birds
python scripts/review_clips.py --filter STJA,WESJ,BCCH,WCSP
```

### 2. Audit Existing Pack
```bash
# Review all warbler clips for quality improvements
python scripts/review_clips.py --filter BLBW,COYE,OVEN,AMRE,NOPA,PROW
```

### 3. Find Low Quality Clips
Use the Quality filter dropdown:
- "Quality 5" - Show only perfect clips
- "Quality 4+" - Show good clips
- "Quality 3+" - Show acceptable clips

### 4. Compare Sources
Use the Source filter dropdown:
- "Cornell Only" - Review Cornell Lab clips
- "Xeno-Canto Only" - Review community recordings

## Workflow

1. **Filter** - Use controls to show specific clips
   - Species codes (comma-separated): `BLBW,COYE,OVEN`
   - Source: Cornell / Xeno-Canto / All
   - Quality: 5 / 4+ / 3+ / All

2. **Review** - For each species section:
   - 👀 View spectrograms to check audio quality
   - ▶️ Play clips to evaluate sound
   - 🎵 Edit vocalization type if incorrect
   - ⭐ Adjust quality score if needed

3. **Curate** - Make canonical selections:
   - ⭐ Click "Set Canonical" on the best clip for each species
   - ✗ Click "Reject" on poor quality clips (deletes files!)
   - Each species must have exactly ONE canonical

4. **Save** - Click "💾 Save Changes"
   - Creates backup: `data/clips.json.backup`
   - Validates canonical uniqueness
   - Deletes rejected files from disk
   - Updates `data/clips.json`
   - Creates git commit with summary

## Metadata Fields

### Vocalization Type
Granular classification based on Cornell taxonomy:
- **song** - Territorial/breeding songs
- **call** - General contact calls
- **flight call** - Calls given in flight
- **alarm call** - Distress/warning calls
- **chip** - Short contact notes
- **drum** - Woodpecker drumming (mechanical)
- **wing sound** - Mechanical sounds from wings
- **rattle** - Rattling vocalizations
- **trill** - Trilled songs/calls
- **other** - Other vocalization types

### Quality Score (1-5)
- **5** - Perfect, canonical-worthy
- **4** - Very good, usable
- **3** - Acceptable, minor issues
- **2** - Poor, background noise
- **1** - Unusable, reject candidate

### Canonical Flag
- Exactly **one per species**
- Usually highest quality song from Cornell
- Fallback to best Xeno-Canto if no Cornell available

### Rejected Flag
- Marks clip for deletion
- Files are **permanently deleted** on save
- Use for duplicates, poor quality, wrong species

## Safety Features

### Backup
Before saving, creates: `data/clips.json.backup`

If something goes wrong:
```bash
cp data/clips.json.backup data/clips.json
git checkout data/clips.json
```

### Validation
- Ensures exactly 1 canonical per species
- Prevents save if validation fails
- Shows clear error message

### Git Integration
Every save creates a commit:
```
Review: 3 canonical updates, 5 clips rejected, 2 quality changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## File Deletion

**⚠️ WARNING:** Rejected clips are PERMANENTLY DELETED!

When you click "Reject" and then "Save Changes":
1. Audio file deleted: `data/clips/SPECIES_ID.wav`
2. Spectrogram deleted: `data/spectrograms/SPECIES_ID.png`
3. Entry removed from `clips.json`
4. **No undo** - files are gone forever

Only reject clips you're CERTAIN you don't want!

## Technical Details

### Server
- Python 3.11+ required
- Runs on `http://localhost:8888`
- Embedded HTML/CSS/JS (no external dependencies)
- Range request support for audio playback

### File Serving
- Audio: `data/clips/*.wav` with Accept-Ranges header
- Spectrograms: `data/spectrograms/*.png`
- Direct file serving from project root

### API Endpoints
- `GET /` - Review UI (HTML)
- `GET /api/clips` - Load clips.json
- `POST /api/save` - Save changes
- `GET /data/*` - Serve static files

## Troubleshooting

### Port 8888 Already in Use
```bash
# Find process using port
lsof -i :8888

# Kill old process
kill <PID>

# Restart review tool
python scripts/review_clips.py
```

### Audio Won't Play
- Check browser console for errors
- Verify file exists: `ls data/clips/SPECIES_ID.wav`
- Try different browser (Chrome/Firefox work best)

### Spectrograms Not Showing
- Check file exists: `ls data/spectrograms/SPECIES_ID.png`
- Run spectrogram generation: `python scripts/spectrogram_gen.py`
- Fallback: Tool works without spectrograms (audio still plays)

### Save Failed
- Check `data/clips.json.backup` was created
- Review error message (usually validation failure)
- Ensure git is in clean state: `git status`
