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

### 3. Generate Spectrograms
```bash
make spectrogram-gen
# OR directly:
python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms --clips-json data/clips.json
```
- This creates PNG spectrograms in `data/spectrograms/`
- Verify spectrograms were created for all new clips
- Check a few spectrograms visually to ensure they look correct

### 4. Create/Verify Species Icons
**CRITICAL CHECKPOINT** - This is where we had issues tonight!

For EACH species code:
- Check if icon exists: `ls data/icons/{CODE}.png`
- If missing, user needs to create it (or we create placeholder)
- Icons should be bird illustrations, ~512x512px, transparent background

List ALL icons that need to be created BEFORE proceeding.

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

1. **Untracked icon files** - Always check `git status` for ?? files
2. **Missing spectrograms** - Run spectrogram_gen.py and verify output
3. **clips.json not updated** - Run audio_tagger.py after adding files
4. **Icon count ≠ species count** - Verify all icons exist before committing
5. **Disk space** - Clean dist/ and bird-sound-game/ if deployment fails
6. **Schema validation** - Run `make validate-schemas` before committing

## Success Criteria

- [ ] All audio files in data/clips/
- [ ] All spectrograms generated in data/spectrograms/
- [ ] All icons exist in data/icons/
- [ ] clips.json updated with metadata
- [ ] Pack JSON updated with new species
- [ ] Schema validation passes
- [ ] Local testing successful
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
