# Session Recovery - Next Steps

## What We Just Did

### 1. Built Authoritative Review Tool ✅
- Created `scripts/review_clips.py` - THE ONLY review tool
- Deleted 6 old review tool versions
- Features:
  - Granular vocalization types (song, call, drum, flight call, etc.)
  - Spectrograms + audio playback
  - Atomic saves to clips.json with git commits
  - File deletion (rejected clips)
  - Enter key to apply filters
  - Sorted clips (canonical first, then by type, then quality)

### 2. Tested Successfully with BADO ✅
- Changed vocalization types → worked
- Rejected 1 clip → file deleted
- Git commit created automatically
- Changes propagated to game instantly

### 3. Found Orphaned Warbler Clips ✅
- 189 orphaned warbler files on disk (not in clips.json)
- Created `data/WARBLER_ORPHANED_CLIPS.md` manifest
- Keeping them for future warbler audit

### 4. Renamed SoundField → ChipNotes! ⏸️ TESTING NEEDED
- Updated manifest.json, service worker (v11), scripts, docs
- Preserved localStorage keys (no breaking changes)
- **READY FOR TESTING** (see checklist below)

## Next Steps (In Order)

### Step 1: Test ChipNotes! Rename
**Testing Checklist:**
1. Refresh `localhost:3000` - page loads?
2. Browser tab says "ChipNotes!"?
3. DevTools → Application → Manifest shows "ChipNotes!"?
4. Service worker updated to v11?
5. Training mode toggle persists across refresh?
6. Custom pack persists?
7. BADO changes still there (5 clips, alarm call)?

**If all pass:**
```bash
git add -A
git commit -m "Rename SoundField: Birds → ChipNotes!

Update app name across manifest, service worker, scripts, and docs.
Preserve localStorage keys for backwards compatibility.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 2: More Metadata Edits
- User wants to review more clips with the tool
- Review server: `python scripts/review_clips.py`
- Continue curating metadata (vocalization types, quality, canonicals)

### Step 3: Build add-birds Slash Command
**Design (from earlier discussion):**
```bash
/add-birds --region "New Zealand" --species "Tui,Bellbird,Kea"
```

**Workflow:**
1. Download clips from Xeno-Canto/Cornell
2. Process audio (mono, normalize, trim)
3. Generate spectrograms
4. Auto-select canonical (smart defaults)
5. **Launch review tool** for human confirmation
6. User reviews and saves changes
7. Continue with pack creation
8. Update levels.json
9. Git commit all changes

**Foundation is ready:**
- Review tool is bulletproof
- Ingestion scripts exist (cornell_ingest.py, audio_tagger.py)
- Just need to wire them together

## Current State

**Review Server:** Running on port 8888
**Dev Server:** Running on ports 3000 & 192.168.1.205:3000
**Uncommitted Changes:** SoundField → ChipNotes! rename (testing needed)

**Files Modified (Uncommitted):**
- src/ui-app/manifest.json
- src/ui-app/public/sw.js
- scripts/review_clips.py
- scripts/README_REVIEW_TOOL.md
- CLAUDE.md
- scripts/*.py (comments)
- src/**/*.ts (comments)

**Recent Commits:**
```
cb0b4d0 Review: 1 clips rejected, 3 vocalization type changes
```
