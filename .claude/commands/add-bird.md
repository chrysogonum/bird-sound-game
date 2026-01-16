# Add Bird Species to ChipNotes

Add one or more bird species to ChipNotes with all required assets, metadata, and pack integration.

## BEFORE YOU START - Gather Information

Ask the user for:
1. **Species codes** (e.g., STJA, WESJ) - 4-letter alpha codes
2. **Common names** (e.g., Steller's Jay, Western Scrub-Jay)
3. **Pack name** to add them to (e.g., "western_birds", "sparrows")
4. **Audio source location** - where are the .wav files?
   - Are they already in data/clips/?
   - Are they in a separate directory that needs copying?
   - What naming convention do they use?

## Audio Requirements Checklist

CRITICAL: All audio files MUST meet these specs (see CLAUDE.md):
- ✓ Mono (not stereo)
- ✓ Duration: 0.5-3.0 seconds
- ✓ Normalized to -16 LUFS
- ✓ Format: .wav
- ✗ NO pitch shifting or speed changes allowed

If audio files don't meet specs, STOP and ask user to preprocess them first.

## Step-by-Step Workflow

### 1. Verify/Copy Audio Files
- Check if files are in `data/clips/`
- Naming convention: `{CODE}_{source}_{id}.wav` (e.g., `STJA_cornell_123456.wav`)
- If copying from elsewhere, use `cp` to move to data/clips/
- Count files for each species to verify completeness

### 2. Update clips.json Metadata
Run the audio tagging script:
```bash
# This updates data/clips.json with metadata for all clips
python3 scripts/audio_tagger.py
```
- Verify clips.json was updated (check file modification time)
- Spot check that new species codes appear in clips.json

### 2.5. Mark Canonical Clips (CRITICAL!)
**NEW SPECIES NEED CANONICAL CLIPS FOR LEVEL 1 TO WORK!**

Run this script to ensure all species have canonical clips marked:
```bash
python3 << 'EOF'
import json
import os

# Load clips
with open('data/clips.json', 'r') as f:
    clips = json.load(f)

# Group by species
from collections import defaultdict
by_species = defaultdict(list)
for clip in clips:
    species = clip.get('species_code')
    if species:
        by_species[species].append(clip)

# For each species without a canonical clip, mark the first valid one
changes = []
for species, species_clips in by_species.items():
    canonical = [c for c in species_clips if c.get('canonical') and not c.get('rejected')]
    if not canonical:
        # Find first valid clip with existing file
        for clip in species_clips:
            file_path = f"src/ui-app/public/{clip.get('file_path', '')}"
            if os.path.exists(file_path) and not clip.get('rejected'):
                clip['canonical'] = True
                changes.append(f"{species}: Set {clip['clip_id']} as canonical")
                break

if changes:
    with open('data/clips.json', 'w') as f:
        json.dump(clips, f, indent=2)
    print(f"✓ Set canonical clips for {len(changes)} species:")
    for change in changes:
        print(f"  {change}")
else:
    print("✓ All species already have canonical clips")
EOF
```

**Verify:**
- Check that output shows canonical clips were set for new species
- If you see "All species already have canonical clips", that's good!

### 3. Generate Spectrograms
```bash
make spectrogram-gen
# OR directly:
python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms --clips-json data/clips.json
```
- This creates PNG spectrograms in `data/spectrograms/`
- Verify spectrograms were created for all new clips
- Check a few spectrograms visually to ensure they look correct

### 4. Generate & Verify Species Icons
**CRITICAL CHECKPOINT** - Icon workflow integration

This step connects to `data/icons/PROMPTS.md` which maintains design prompts for all species.

**4a. Generate Design Prompts**

For EACH new species, add to `data/icons/PROMPTS.md`:
- Use base template:
  ```
  Stylized icon of a {COMMON NAME}, simple flat design, circular frame,
  {KEY VISUAL FEATURES}, white background, game asset style,
  clean vector look, centered composition, no text
  ```
- Add to appropriate section (Backyard Birds, Warblers, etc.)
- Commit prompt updates to PROMPTS.md

**4b. Create Icons (Manual)**

User generates icons using prompts:
- **Tool:** ChatGPT/DALL-E 3 (recommended), Midjourney, or Leonardo.ai
- **Size:** 512x512px minimum
- **Format:** PNG with transparent or white background
- **Naming:** `data/icons/{CODE}.png`

**4c. Placeholder Icons (Optional)**

If icons aren't ready yet, create simple placeholder:
```bash
# Create a solid color placeholder (requires ImageMagick)
for code in {CODE1} {CODE2}; do
  convert -size 512x512 xc:#4A90E2 -fill white -pointsize 72 \
    -gravity center -annotate +0+0 "$code" \
    data/icons/${code}.png
done
```

Or proceed with missing icons - the game will show species code as fallback.

**4d. Verify Icons**
```bash
# List all icons for new species
for code in {CODE1} {CODE2} {CODE3}; do
  ls data/icons/$code.png 2>/dev/null && echo "✓ $code" || echo "✗ MISSING: $code"
done
```

**Decision Point:**
- **Icons ready?** → Proceed to Step 5
- **Using placeholders?** → Document which icons need replacement
- **Skipping icons?** → Game will work but show code instead of illustration

List ALL icons that need creation/replacement BEFORE proceeding.

### 5. Update or Create Pack Definition

Navigate to `data/packs/{pack_name}.json`

If creating NEW pack:
- Copy template from existing pack (e.g., sparrows.json)
- Update name, description, species list
- Set appropriate difficulty modifiers

If updating EXISTING pack:
- Add new species codes to the `species` array
- Maintain alphabetical order (optional but nice)
- Update species count in pack metadata if present

### 6. Validate Everything
```bash
make validate-schemas  # Validates clips.json and pack JSONs
```
If validation fails, STOP and fix errors before proceeding.

### 7. Test Locally
```bash
make dev
```
- Navigate to the pack in the UI
- Verify all new species appear
- Check icons display correctly
- Play a few audio clips to verify they work
- Check spectrograms display correctly

### 8. Git Workflow - DON'T SKIP ANYTHING

**Check what's untracked** (this catches missing icons!):
```bash
git status --short | grep "^??"
```

**Stage files systematically**:
```bash
# Audio files
git add data/clips/{CODE}_*.wav

# Spectrograms (may be hundreds of files)
git add data/spectrograms/{CODE}_*.png

# Icons - CHECK EACH ONE EXISTS!
git add data/icons/{CODE}.png

# Metadata
git add data/clips.json

# Pack definition
git add data/packs/{pack_name}.json
```

**Verify staging**:
```bash
git status
```
Look for:
- Audio clips: data/clips/
- Spectrograms: data/spectrograms/
- Icons: data/icons/
- Metadata: clips.json, pack JSON

**Verify icon count matches species count!**

### 9. Commit with Descriptive Message

Format:
```
Add {X} new species to {Pack Name} pack

Species added:
- {Species Code}: {Common Name}
- {Species Code}: {Common Name}
...

Content:
- {N} audio clips (Cornell Lab/Xeno-canto/other)
- {N} spectrograms
- {N} species icons
- Updated pack definition and metadata

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 10. Deploy
```bash
git push && npm run deploy
```

If deployment fails with ENOSPC (disk full):
```bash
# Clean up build artifacts
rm -rf dist/ bird-sound-game/
df -h  # Check available space
npm run deploy  # Retry
```

## Common Pitfalls to Avoid

1. **Missing canonical clips** - CRITICAL! Run the canonical clip script (Step 2.5) or Level 1 will break
2. **Missing audio files referenced in clips.json** - Verify files exist before running audio_tagger.py
3. **Untracked icon files** - Always check `git status` for ?? files
4. **Missing spectrograms** - Run spectrogram_gen.py and verify output
5. **Icon count ≠ species count** - Verify all icons exist before committing
6. **Disk space** - Clean dist/ and bird-sound-game/ if deployment fails
7. **Schema validation** - Run `make validate-schemas` before committing

## Success Criteria

- [ ] All audio files in data/clips/
- [ ] All spectrograms generated in data/spectrograms/
- [ ] All icons exist in data/icons/
- [ ] clips.json updated with metadata
- [ ] **CRITICAL: All new species have canonical clips marked** (Step 2.5)
- [ ] No missing file references in clips.json (all file_path entries exist on disk)
- [ ] Pack JSON updated with new species
- [ ] Schema validation passes
- [ ] Local testing successful (especially Level 1 with new species)
- [ ] All files tracked in git (no ?? in git status for new species)
- [ ] Committed with descriptive message
- [ ] Pushed to GitHub
- [ ] Deployed to GitHub Pages successfully

## Output Format

When complete, report:
```
✓ Added {N} species to {Pack Name}:
  - {CODE}: {Common Name} ({N} clips)
  - {CODE}: {Common Name} ({N} clips)
  ...

✓ Generated {N} spectrograms
✓ All {N} icons verified
✓ Schema validation passed
✓ Deployed successfully

Live at: https://{username}.github.io/bird-sound-game/
```
