# Add-Birds Process Checkpoint - January 16, 2026

## Current Status: ⏸️ PAUSED - Waiting for Cornell Response

---

## What We Accomplished

### 1. Enhanced /add-bird Workflow ✅
- **Updated:** `.claude/commands/add-bird.md`
- **Changes:**
  - Integrated icon generation into Step 4
  - Connected to `data/icons/PROMPTS.md` for design prompts
  - Added placeholder icon workflow
  - Documented manual icon generation process

### 2. Design Prompts Created ✅
- **File:** `data/icons/PROMPTS.md`
- **Added:** 18 new species prompts (lines 261-338)
- **Species:** Expanded Eastern US Birds Pack
  - Flycatchers & Pewees: GCFL, EAPH, EWPE, ACFL
  - Vireos: WEVI, REVI
  - Wrens & Gnatcatchers: NHWR, BGGN
  - Thrushes: SWTH, VEER
  - Tanagers: SUTA, SCTA
  - Finches & Grosbeaks: PUFI, RBGR
  - Juncos: DEJU
  - Blackbirds & Cowbirds: BHCO
  - Starlings & Swifts: EUST, CHSW

### 3. Cornell Audio Analysis ✅
- **Downloaded:** 18 CSV files from Macaulay Library (North Carolina recordings)
- **Analyzed:** Metadata structure and quality metrics
- **Selected:** 180 ML catalog numbers (10 per species)
- **Selection Criteria:**
  - Quality Score: `rating × √(num_ratings + 1)`
  - Minimum threshold: Rating ≥ 3.0 OR ≥ 2 raters
  - Vocalization diversity prioritized
  - Average rating: 4.32/5.00

### 4. Cornell Access Request Submitted ✅
- **Primary Request:** Bulk download of 180 recordings
- **Secondary Request:** API access for future educational projects
- **Files Created:**
  - `docs/cornell_access_request.md` (full detailed request)
  - `docs/cornell_ticket_text.txt` (helpdesk ticket text)
  - `~/Downloads/cornell_selected_recordings.csv` (180 ML numbers)
  - `~/Downloads/cornell_selection_summary.txt` (methodology)
- **Status:** Ready to submit via https://support.ebird.org/en/support/tickets/new

---

## Pending Steps (When Cornell Responds)

### If Cornell Approves:

**Step 1: Download Audio Files**
- Use provided access method (bulk download or API)
- Save to temporary directory for processing

**Step 2: Process Audio**
```bash
python3 scripts/cornell_ingest.py --input <cornell_downloads> --output data/clips
```
- Converts to mono WAV
- Normalizes to -16 LUFS
- Trims to 0.5-3.0 seconds
- Outputs to `data/clips/`

**Step 3: Update clips.json**
⚠️ **DEPRECATED - Use merge_candidates.py instead!**
```bash
# OLD (DANGEROUS - overwrites clips.json):
# python3 scripts/audio_tagger.py

# NEW (SAFE - appends to clips.json):
python3 scripts/merge_candidates.py data/candidates_{CODE}
```
- Safely adds metadata for new clips
- Preserves all existing curated metadata (canonical flags, recordists, etc.)

**Step 4: Generate Spectrograms**
```bash
python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms
```
- Creates PNG spectrograms for all new clips

**Step 5: Create/Verify Icons**
- Check which icons exist: `ls data/icons/{CODE}.png`
- For missing icons:
  - Copy prompts from `data/icons/PROMPTS.md` (lines 320-337)
  - Generate using DALL-E 3 / ChatGPT
  - Save as `data/icons/{CODE}.png`
- Or proceed with placeholders/missing icons

**Step 6: Create/Update Pack**
- Create `data/packs/expanded_eastern_us.json` OR
- Update existing pack with new species codes
- Set appropriate difficulty modifiers

**Step 7: Validate**
```bash
make validate-schemas
```

**Step 8: Test Locally**
```bash
make dev
```
- Navigate to pack in UI
- Verify all species appear
- Check icons, audio, spectrograms

**Step 9: Git Commit**
```bash
git add data/clips/*.wav data/spectrograms/*.png data/icons/*.png data/clips.json data/packs/*.json
git commit -m "Add 18 Expanded Eastern US species from Cornell Macaulay Library"
git push
```

**Step 10: Deploy**
```bash
npm run deploy
```

---

## If Cornell Denies or Delays:

### Alternative: Use Xeno-Canto
- You have `XENO_CANTO_API_KEY` already configured
- Can download these 18 species immediately
- Swap to Cornell later if approved

**Quick Start:**
```bash
# Download from Xeno-Canto for these species
# Process using same workflow above
```

---

## Files Ready for Cornell Submission

**Location:** `~/Downloads/`
1. `cornell_selected_recordings.csv` - 180 ML catalog numbers
2. `cornell_selection_summary.txt` - Selection methodology

**Helpdesk Ticket:**
- URL: https://support.ebird.org/en/support/tickets/new
- Topic: "The Macaulay Library (Media Requests)"
- Text: `docs/cornell_ticket_text.txt`

---

## Current Project State

**Commits:**
- `adf9cf8` - Condense Cornell ticket text
- `06cd5d9` - Fix: Accurate project timeline in Cornell request
- `2851ffb` - Add Cornell Macaulay Library access request documentation
- `1690768` - Fix: Update House Wren to Northern House Wren (NHWR)
- `a577dc2` - Enhance /add-bird workflow with icon generation integration

**Uncommitted Changes:** None (clean working directory)

**Branch:** main

**Dev Servers Running:**
- Local: http://localhost:3000/bird-sound-game/
- Network: http://192.168.1.205:3000/bird-sound-game/

---

## When Resuming:

1. **Check Cornell response** - Look for email or helpdesk ticket update
2. **Read this checkpoint** - Refresh context on where we left off
3. **Choose path:**
   - Cornell approved → Follow "Pending Steps" above
   - Cornell denied/delayed → Consider Xeno-Canto alternative
   - Still waiting → Work on other tasks (metadata review, icon generation, etc.)

---

## Related Documentation

- `/add-bird` workflow: `.claude/commands/add-bird.md`
- Icon prompts: `data/icons/PROMPTS.md`
- Cornell request: `docs/cornell_access_request.md`
- Selection results: `~/Downloads/cornell_selected_recordings.csv`

---

*Checkpoint created: January 16, 2026, 11:00 PM*
*Next session: Resume when Cornell responds or after decision on alternative approach*
