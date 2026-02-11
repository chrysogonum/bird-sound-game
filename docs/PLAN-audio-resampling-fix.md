# Plan: Fix Audio Resampling Artifacts

*Created: February 11, 2026 — Feature branch: `feature/audio-resampling-fix`*

## Problem

Many clips in ChipNotes sound squeaky, fake, or electronic — especially noticeable on species like Red-eyed Vireo (REVI) and Black-and-white Warbler (BAWW). The root cause is **`np.interp()` linear interpolation** used for resampling 48kHz source recordings down to 44.1kHz in the early processing tools.

Linear interpolation doesn't account for audio frequency content, causing spectral aliasing that manifests as metallic/electronic artifacts. This was fixed on February 10, 2026 when `clip_studio.py` switched to `librosa.resample()`, but all clips processed before that date are potentially affected.

## Scope

| Category | Count | Notes |
|----------|-------|-------|
| Total clips in game | 1,164 | |
| Processed with old tool (hash IDs) | 642 | `np.interp` resampling |
| Processed with clip_editor.py (numeric IDs, pre-fix) | ~21 | Also `np.interp` (line 464) |
| Processed with clip_studio.py (post-fix) | ~501 | `librosa.resample` — clean |
| **Total potentially affected** | **~663** | Hash IDs + early numeric IDs |
| Canonical clips affected | **~143** | Highest priority (used in Level 1) |

### Not All Affected Clips Are Degraded

From a sample of 20 hash-ID XC clips:
- **~65% of XC sources are 48kHz** → resampling was applied → **artifacts present**
- **~35% of XC sources are 44.1kHz** → no resampling needed → **no artifacts**

**Estimated actually degraded clips: ~430 of 663** (65% of potentially affected)
**Estimated degraded canonical clips: ~93 of 143**

### Sources by Type
- Xeno-canto (hash IDs): 928 clips → **primary target**
- DOC (NZ): 154 clips → different pipeline, needs separate check
- Macaulay: 50 clips → needs check
- User recordings: 11 clips → likely unaffected

## Identification Strategy

We cannot tell from clip metadata alone whether a clip was degraded. The key factors are:

1. **Clip ID format**: Hash IDs (e.g., `BAWW_a7c36fd6`) = old tool. Numeric IDs (e.g., `ACFL_1025810`) = newer tool.
2. **Source sample rate**: Only clips from 48kHz sources were resampled. We can query the XC API (`smp` field) to check each source.
3. **Perceptual check**: Not all resampled clips sound equally bad — some vocalizations mask the artifacts better than others.

### Proposed Detection Script: `scripts/find_degraded_clips.py`

```
For each hash-ID XC clip:
  1. Query XC API for source_id → get sample rate (smp field)
  2. If smp != 44100 → mark as "needs reprocessing"
  3. Flag canonical clips separately (highest priority)
Output: degraded_clips.json with species, clip_id, source_id, source_rate, is_canonical
```

## Reprocessing Strategy

### Option A: Re-extract from XC sources via Clip Studio (Recommended)

Use the existing Clip Studio workflow to re-download and re-extract each clip:
1. Load the species in Clip Studio
2. Click the XC source chip to load the original recording
3. Set the same start time / duration (we'd need to store or recover these)
4. Extract — clip_studio.py now uses `librosa.resample()`

**Problem**: We don't store the original start time or duration in clips.json, so we can't automate re-extraction at the exact same segment.

### Option B: Batch Re-resample Existing WAV Files (Faster)

Since the clips are already 44.1kHz mono WAVs, but were resampled badly:
1. Re-download the original XC recording (full file)
2. Find the segment that matches our existing clip (via cross-correlation)
3. Re-extract that segment with `librosa.resample()`
4. Overwrite the existing WAV file

**Advantage**: Fully automatable, preserves exact clip selection.
**Risk**: Cross-correlation matching may not be perfect for all clips.

### Option C: Direct Re-resample (Simplest but Less Ideal)

The existing WAV files are already 44.1kHz — the damage is baked in. We can't "un-resample" them. We need the original source audio to reprocess correctly. This option is NOT viable.

### Recommended Approach: Hybrid

1. **Build detection script** to identify all degraded clips and their source sample rates
2. **Priority 1 — Canonical clips (~93)**: Manually re-extract in Clip Studio (best quality control for signature sounds)
3. **Priority 2 — Remaining clips (~340)**: Build batch script using Option B (automated cross-correlation matching)
4. **Validation**: Generate before/after spectrograms to visually confirm improvement

## Implementation Steps

### Phase 1: Detection (scripting)
1. Create `scripts/find_degraded_clips.py`
   - Query XC API for source sample rate of all hash-ID clips
   - Generate `data/degraded_clips.json` report
   - Sort by: canonical first, then by species
2. Also check DOC and Macaulay clips for sample rate issues

### Phase 2: Canonical Clip Repair (~93 clips, manual)
1. Work through degraded canonical clips in Clip Studio
2. Re-download XC source, re-extract same vocalization
3. Clip Studio handles `librosa.resample()` automatically
4. Mark repaired clips (add `reprocessed: true` to clips.json?)

### Phase 3: Bulk Clip Repair (~340 clips, automated)
1. Create `scripts/batch_reprocess.py`
   - Downloads original XC recording
   - Uses cross-correlation to find matching segment
   - Re-extracts with `librosa.resample()`
   - Generates new spectrogram
   - Overwrites existing clip + spectrogram
2. Manual review of batch results (spot-check spectrograms)

### Phase 4: Cleanup
1. Fix `clip_editor.py` line 464: replace `np.interp` with `librosa.resample`
2. Add `processing_version` or `resampled_with` field to clips.json schema
3. Verify canonical count preserved after all changes

## Files to Create
- `scripts/find_degraded_clips.py` — detection script
- `scripts/batch_reprocess.py` — automated reprocessing
- `data/degraded_clips.json` — report output (gitignored)

## Files to Modify
- `scripts/clip_editor.py` — fix np.interp at line 464
- `data/clips.json` — updated after reprocessing
- `data/clips/*.wav` — reprocessed audio files
- `data/spectrograms/*.png` — regenerated spectrograms

## Verification
1. Before/after spectrogram comparison for repaired clips
2. Listening test on REVI, BAWW, and other known-degraded species
3. `python3 -c "import json; print(sum(1 for c in json.load(open('data/clips.json')) if c.get('canonical')))"` — canonical count must not change
4. Full game playthrough on repaired species

## Risk Mitigation
- **Canonical flags**: CRITICAL — must be preserved through all reprocessing (see CLAUDE.md)
- **Git safety**: Commit clips.json before and after each batch of changes
- **Rollback**: Keep git history of all clip changes; original WAVs can be re-downloaded from XC
- **Rate limiting**: XC API has rate limits — batch downloads need throttling (~1 req/sec)
