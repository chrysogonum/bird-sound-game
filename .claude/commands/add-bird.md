# Add Bird Species to ChipNotes

Add one or more bird species to ChipNotes with all required assets, metadata, and pack integration.

## Two Main Use Cases

### Use Case 1: Adding New Species
Adding species that don't exist in the game yet.
- Example: "Add Steller's Jay and Western Scrub-Jay"
- Workflow: Download diverse clips (5-10 per species, mixed vocalization types)
- Icon creation required
- Pack assignment required

### Use Case 2: Auditing Existing Species
Downloading additional clips for species already in the game to improve quality or fill vocalization type gaps.
- Example: "Get 10 high-quality call sounds from White-throated Sparrow to audit that bird"
- Workflow: Download specific vocalization type, compare with existing clips, replace poor quality
- Icon already exists
- Already in packs

**This guide covers both workflows.**

## BEFORE YOU START - Gather Information

Ask the user to specify:

### 1. Species Information
Species can be provided in ANY format:
- **4-letter codes only** (e.g., "STJA, WESJ") → Claude will look up common names
- **Common names only** (e.g., "Steller's Jay, Western Scrub-Jay") → Claude will derive codes
- **Mixed format** (e.g., "STJA, Western Scrub-Jay") → Claude will normalize

**Species Code Derivation Rules:**
If user provides common names, derive 4-letter codes using this pattern:
- Split by spaces/hyphens: "Steller's Jay" → "Steller" + "Jay"
- Take first 2 letters of each part: "ST" + "JA" = "STJA"
- For single-word names: Take first 4 letters: "Cardinal" → "CARD"
- **Verify codes don't conflict** with existing species in data/clips.json

### 2. Pack Assignment
Which pack should these species go into?
- Existing pack (e.g., "western_birds", "sparrows")
- New pack (will need to create pack JSON)

### 3. Audio Source - NEW SOURCE CHECK

**CRITICAL QUESTION: Is this a new audio source?**

Check current allowed sources in schema:
```bash
grep -A5 '"source"' schemas/clip.schema.json
# Current sources: "macaulay", "xenocanto", "cornell", "demo", "user_recording"
```

**Option A: Existing Source** (no setup needed)
- ✅ Xeno-canto (`xenocanto`)
- ✅ Cornell Macaulay Library (`cornell` or `macaulay`)
- ✅ User recording (`user_recording`)

**Option B: New Source** (requires setup FIRST)

If adding recordings from a source NOT in the list above (e.g., iNaturalist, NZ Birds Online, eBird):

**Ask user:**
1. **Source name** (display name, e.g., "iNaturalist", "NZ Birds Online")
2. **Source identifier** (for schema/code, e.g., "inaturalist", "nz_birds", "ebird")
3. **Metadata availability:**
   - Does this source provide recordist names? (yes/no)
   - Does this source provide vocalization type tags? (yes/no)
   - Does this source provide quality ratings? (yes/no)
4. **Volume:**
   - Will you be downloading multiple recordings from this source regularly? (yes/no)
   - If yes: Consider building a download script (like audio_ingest.py for Xeno-canto)
   - If no: Manual import workflow is fine

**Setup Steps for New Source:**
```bash
# 1. Update schema to allow new source
# Edit schemas/clip.schema.json
# Add new source to "source" enum on line ~52

# Before:
"enum": ["macaulay", "xenocanto", "cornell", "demo", "user_recording"]

# After (example for iNaturalist):
"enum": ["macaulay", "xenocanto", "cornell", "demo", "user_recording", "inaturalist"]

# 2. Validate schema still works
make validate-schemas
# Should pass with no errors

# 3. Commit schema change
git add schemas/clip.schema.json
git commit -m "Add [SOURCE_NAME] to allowed audio sources"
git push

# 4. Document attribution requirements
# Create docs/sources/[source_name].md with:
# - Legal/license requirements
# - Attribution format
# - Download instructions (if applicable)
```

**After setup, proceed with normal workflow...**

### 4. Audio Acquisition Method
Once source is confirmed/added:
- **Already have audio files** → Where are they located?
- **Download from Xeno-canto** → Use audio_ingest.py
- **Download from Cornell** → Manual selection (waiting for API access)
- **Download from new source** → Manual or custom script

## Audio Requirements Checklist

CRITICAL: All audio files MUST meet these specs (see CLAUDE.md):
- ✓ Mono (not stereo)
- ✓ Duration: 0.5-3.0 seconds
- ✓ Normalized to -16 LUFS
- ✓ Format: .wav
- ✗ NO pitch shifting or speed changes allowed

If audio files don't meet specs, STOP and ask user to preprocess them first.

## Audio Acquisition Plans

### Plan A: Audio Already Available
If user has existing .wav files:
- Copy to `data/clips/` with naming: `{CODE}_{source}_{id}.wav`
- Verify audio meets specs (mono, 0.5-3s, -16 LUFS)
- Proceed directly to Step 2 (metadata tagging)

### Plan B: Download from Xeno-canto (Recommended)

**Step 1: Verify API Key Setup**
```bash
# Test API connection FIRST
python3 scripts/audio_ingest.py --test-api
```

**If API key not found**, Claude should:
1. Check environment variable:
   ```bash
   echo $XENO_CANTO_API_KEY
   ```
2. If empty, load from zsh config:
   ```bash
   source ~/.zshrc && echo $XENO_CANTO_API_KEY
   ```
3. If still not working, instruct user to manually add to ~/.zshrc:
   ```bash
   echo "export XENO_CANTO_API_KEY='user-api-key-here'" >> ~/.zshrc
   source ~/.zshrc
   ```

**Step 2: Download with Vocalization Type Diversity**

**Goal:** Get 5-10 high-quality clips per species with **maximum variation** in vocalization types (song, call, drum, alarm, flight call, etc.)

**Strategy:**
For each species, query Xeno-canto API to:
1. Fetch ALL available clips with quality rating A or B
2. Group by vocalization type tags (song, call, drum, alarm, etc.)
3. **Proportionally sample** from each type to get diverse representation

**Example:** If Xeno-canto has:
- 10 clips tagged "song" (quality A)
- 5 clips tagged "call" (quality A-B)
- 3 clips tagged "drum" (quality A)

**We want:** ~5-6 songs, ~3 calls, ~2 drums = **10 total clips** with full type coverage

**Download Audio:**

**For New Species (Mixed Vocalization Types):**
```bash
# Download diverse clips (songs, calls, drums, etc.)
python3 scripts/audio_ingest.py \
  --output data/clips \
  --species "Steller's Jay" "Western Scrub-Jay" \
  --max-per-species 10
```

**For Auditing Existing Species (Specific Vocalization Type):**
```bash
# Download ONLY call vocalizations for White-throated Sparrow
python3 scripts/audio_ingest.py \
  --output data/clips \
  --species "White-throated Sparrow" \
  --max-per-species 10 \
  --vocalization-type call

# Or download ONLY songs
python3 scripts/audio_ingest.py \
  --output data/clips \
  --species "Northern Cardinal" \
  --max-per-species 8 \
  --vocalization-type song
```

**Alternative: `augment_species.py` (Optimized for Existing Species)**

For species already in the game, use this script which automatically filters out previously reviewed clips:

```bash
# Augment Yellow-rumped Warbler with 10 new Quality A clips
# Automatically excludes clips already in clips.json AND rejected_xc_ids.json
python3 scripts/augment_species.py YRWA --max 10 --quality A

# Or Cedar Waxwing
python3 scripts/augment_species.py CEWA --max 8 --quality A
```

**Key differences from audio_ingest.py:**
- ✅ Automatically filters out existing clips from clips.json
- ✅ Automatically filters out rejected clips from data/rejected_xc_ids.json (no re-downloads!)
- ✅ Generates spectrograms immediately
- ✅ Adds directly to clips.json (ready for review)
- ✅ Requires species scientific name in SPECIES_SCIENTIFIC_NAMES dict

**Before using augment_species.py:**
1. Check if species is in the mapping (scripts/augment_species.py line 39):
   ```python
   SPECIES_SCIENTIFIC_NAMES = {
       'CEWA': ('Bombycilla', 'cedrorum'),
       'YRWA': ('Setophaga', 'coronata'),
       # Add more as needed
   }
   ```
2. If missing, add the scientific name mapping first
3. Run the script - it handles everything through to clips.json entry

**What happens:**
- Downloads top-quality recordings from Xeno-canto
- Filters by vocalization type if `--vocalization-type` is specified
- Preprocesses to mono, 0.5-3s duration, -16 LUFS normalization
- Names files: `{CODE}_xenocanto_{recording_id}.wav`
- Creates `.ingest_manifest.json` with metadata (vocalization type, quality, recordist)
- Ready for Step 2 (metadata tagging)

**Quality Criteria:**
- ✅ Only quality ratings **A** (excellent) or **B** (good)
- ✅ Prefer **A-rated** recordings, fall back to B if needed
- ❌ Reject C/D/E quality recordings

**Type Coverage:**
- Prioritize **song** and **call** (most common types)
- Include **drum**, **alarm**, **flight call** if available
- Sample proportionally to ensure representation of all types
- Aim for 5-10 total clips with maximum type diversity

### Plan C: Cornell Macaulay Library (Manual)
Cornell API access pending. For now:
- User must manually select and download recordings
- Copy to `data/clips/` with naming: `{CODE}_cornell_{id}.wav`
- Verify audio specs before proceeding
- See `docs/cornell_usage_guide.txt` for manual workflow

## Step-by-Step Workflow

### Step 1: Acquire Audio Files
Follow Plan A, B, or C above to get audio files into `data/clips/`

**Verify files exist:**
```bash
ls data/clips/{CODE}_*.wav
# Should show 5-10 files per species
```

### Step 2: Tag Metadata
Run the audio tagging script to create clips.json entries:
```bash
python3 scripts/audio_tagger.py --input data/clips --output data/clips.json
```

**What this does:**
- Reads `.ingest_manifest.json` (if it exists) to get metadata from Xeno-canto:
  - Vocalization type (song, call, drum, alarm, etc.)
  - Quality rating (A=5, B=4, etc.)
  - Recordist name
  - Source info
- Falls back to filename parsing if no manifest
- Creates/updates clips.json with new entries
- **Preserves original vocalization types** from source (you'll verify during review)

**Verify clips.json was updated:**
```bash
# Check that new species appear
grep -c "\"species_code\": \"STJA\"" data/clips.json
# Should show number of STJA clips
```

### Step 3: Generate Spectrograms
Generate spectrograms BEFORE review so they're visible in the review tool:

```bash
python3 scripts/spectrogram_gen.py
# OR via Make:
make spectrogram-gen
```

**What this does:**
- Reads clips.json to find all audio files
- Generates PNG spectrograms in `data/spectrograms/`
- Updates clips.json with spectrogram_path for each clip
- Uses frequency range 500-10000Hz optimized for bird vocalizations

**Verify spectrograms were created:**
```bash
ls data/spectrograms/{CODE}_*.png | wc -l
# Should match number of audio clips for that species
```

### Step 4: Review & Curate with Spectrograms

**BEFORE REVIEWING: Determine Context**

Check if species already exist in clips.json:
```bash
# Check if species already exist
for code in STJA WESJ BCCH; do
  grep -q "\"species_code\": \"$code\"" data/clips.json && \
    echo "✓ $code: EXISTING species (adding more clips)" || \
    echo "✗ $code: NEW species (first-time addition)"
done
```

#### Scenario A: NEW Species (First-Time Addition)

If adding species for the first time:

```bash
# Review ONLY the new species
python3 scripts/review_clips.py --filter STJA,WESJ,BCCH
# Opens browser to http://localhost:8888
```

**What to Look For:**

1. **Vocalization Type Diversity** - Verify you have good coverage:
   - ✅ Mix of song, call, drum, flight call, etc.
   - ✅ At least 2-3 different vocalization types per species
   - ❌ All clips are the same type → Download more variety

2. **Audio Quality** - Check spectrograms and listen:
   - ✅ Clear vocalization, minimal background noise
   - ✅ Appropriate duration (0.5-3s, already preprocessed)
   - ❌ Heavy background noise, overlapping species → Reject

3. **Set Canonical Clip** - Select the BEST clip for each species:
   - ⭐ Click "Set Canonical" on highest quality **song**
   - Canonical is used for Level 1 (introduction round)
   - Prefer Cornell > Xeno-canto if quality is equal

4. **Reject Poor Clips** - Delete any problematic clips:
   - ✗ Click "Reject" to mark for deletion
   - Common reasons: wrong species, poor quality, duplicate

**Success:** 5-10 clips per species with good type coverage and 1 canonical.

#### Scenario B: Additional Clips for Existing Species

If adding more clips to species already in the game:

```bash
# Review existing + new clips side-by-side
python3 scripts/review_clips.py --filter NOCA,BLJA,TUTI
# Shows ALL clips for these species (both existing and newly downloaded)
```

**What to Check:**

1. **Compare New vs Existing Quality**
   - Are new clips better quality than old ones?
   - Should we replace old clips with new ones?
   - Reject lower quality clips (old or new)

2. **Vocalization Type Coverage**
   - Do new clips fill gaps? (e.g., we had 5 songs, now adding 3 calls)
   - Do we now have redundant types? (e.g., 8 songs, 0 calls → reject excess songs)

3. **Re-evaluate Canonical Selection**
   - Is the current canonical still the best?
   - If new clip is higher quality, re-assign canonical
   - Only ONE canonical per species allowed

4. **Maintain Target Count**
   - Goal: 5-10 total clips per species
   - If we now have 15 clips, reject the 5 worst ones
   - Prioritize keeping diverse types over quantity

**Example Decision Tree:**
```
Northern Cardinal currently has:
- 5 existing clips: 3 songs (quality 4,3,3), 2 calls (quality 4,3)
- 3 new downloads: 2 songs (quality 5,4), 1 drum (quality 4)

Actions:
✓ KEEP: New song (Q5) → Set as NEW canonical
✓ KEEP: New song (Q4)
✓ KEEP: New drum (Q4) → Fills type gap
✓ KEEP: Existing call (Q4)
✓ KEEP: Existing song (Q4)
✗ REJECT: Old song (Q3) → Replaced by better new song
✗ REJECT: Old song (Q3) → Redundant, low quality
✗ REJECT: Old call (Q3) → Keep only best call

Result: 5 clips total with better quality + new drum type
```

#### Save Changes (Both Scenarios)

```
Click "💾 Save Changes" in the review tool
- Creates backup: data/clips.json.backup
- Validates canonical uniqueness (1 per species)
- Logs rejected Xeno-canto IDs to data/rejected_xc_ids.json (prevents re-downloads)
- Deletes rejected files permanently (audio + spectrogram)
- Updates clips.json
- Auto-commits to git with summary
```

**🔒 Rejection Tracking (Automatic)**

The review tool automatically logs rejected clips to prevent re-downloading:
- File: `data/rejected_xc_ids.json` - Tracks all rejected XC IDs by species
- When you reject a clip: XC ID logged BEFORE deletion
- Future downloads: `augment_species.py` filters out logged rejections
- No duplicate review efforts - rejected clips never re-appear

**Verify Clip Counts:**
```bash
# Check final clip count per species
for code in STJA WESJ BCCH; do
  count=$(grep -c "\"species_code\": \"$code\"" data/clips.json)
  echo "$code: $count clips"
done
# Should show 5-10 clips per species
```

**Success Criteria:**
- [ ] Each species has 5-10 total clips (after rejections)
- [ ] Mix of vocalization types (not all one type)
- [ ] Exactly 1 canonical clip per species
- [ ] All clips quality 3+ (rejected anything below)
- [ ] For existing species: No quality regression (new clips ≥ old quality)
- [ ] clips.json saved and committed via review tool

### Step 5: Generate & Verify Species Icons
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

### Step 6: Update or Create Pack Definition

Navigate to `data/packs/{pack_name}.json`

If creating NEW pack:
- Copy template from existing pack (e.g., sparrows.json)
- Update name, description, species list
- Set appropriate difficulty modifiers

If updating EXISTING pack:
- Add new species codes to the `species` array
- Maintain alphabetical order (optional but nice)
- Update species count in pack metadata if present

### Step 7: Validate Everything
```bash
make validate-schemas  # Validates clips.json and pack JSONs
```
If validation fails, STOP and fix errors before proceeding.

### Step 8: Test Locally
```bash
make dev
```
- Navigate to the pack in the UI
- Verify all new species appear
- Check icons display correctly
- Play a few audio clips to verify they work
- Check spectrograms display correctly

### Step 9: Git Workflow - DON'T SKIP ANYTHING

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

### Step 10: Commit with Descriptive Message

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

### Step 11: Deploy
```bash
# Push source changes to main branch
git push

# Deploy to GitHub Pages
cd src/ui-app && npm run deploy
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

Live at: https://chipnotes.app
```
