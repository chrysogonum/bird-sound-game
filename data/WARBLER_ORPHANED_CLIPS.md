# Orphaned Warbler Clips - For Future Audit

**Date:** January 15, 2026  
**Status:** Untracked audio files on disk (not in clips.json)

## Summary

189 warbler audio clips exist in `data/clips/` but are NOT tracked in `clips.json`.  
These appear to be Xeno-Canto downloads from January 11 that were processed but never imported.

## Current State

- **Location:** `data/clips/*.wav`
- **Source:** Xeno-Canto (IDs in filenames)
- **Status:** Orphaned (not in clips.json, not in game)
- **Total:** 189 files across 30 warbler species

## Inventory by Species

| Species | Tracked | Orphaned | Total Downloaded |
|---------|---------|----------|------------------|
| AMRE    | 4       | 6        | 10               |
| BAWW    | 7       | 3        | 10               |
| BBWA    | 3       | 7        | 10               |
| BLBW    | 3       | 7        | 10               |
| BLPW    | 3       | 7        | 10               |
| BTBW    | 4       | 6        | 10               |
| BTNW    | 7       | 3        | 10               |
| BWWA    | 4       | 6        | 10               |
| CAWA    | 4       | 6        | 10               |
| CMWA    | 2       | 8        | 10               |
| CONW    | 3       | 7        | 10               |
| COYE    | 3       | 7        | 10               |
| CSWA    | 3       | 7        | 10               |
| GWWA    | 3       | 7        | 10               |
| KEWA    | 5       | 5        | 10               |
| LOWA    | 4       | 6        | 10               |
| MAWA    | 4       | 6        | 10               |
| MOWA    | 3       | 7        | 10               |
| NAWA    | 4       | 6        | 10               |
| NOPA    | 3       | 7        | 10               |
| NOWA    | 3       | 7        | 10               |
| OCWA    | 3       | 7        | 10               |
| OVEN    | 3       | 7        | 10               |
| PAWA    | 4       | 6        | 10               |
| PRAW    | 4       | 6        | 10               |
| PROW    | 4       | 6        | 10               |
| SWWA    | 3       | 7        | 10               |
| TEWA    | 4       | 6        | 10               |
| WIWA    | 3       | 7        | 10               |
| YTWA    | 4       | 6        | 10               |
| **Total** | **111** | **189** | **300** |

## For Future Warbler Audit

When conducting the warbler pack overhaul with Cornell clips:

1. **These orphaned clips are available** in `data/clips/`
2. **Find them:** `ls data/clips/BLBW_*.wav` shows all BLBW files (tracked + orphaned)
3. **Import them:** Run `scripts/audio_tagger.py` to add metadata to clips.json
4. **Review in tool:** `python scripts/review_clips.py --filter <warbler-codes>`
5. **Compare with Cornell:** Download Cornell clips and decide which to keep

## How to Import Later

```bash
# Import orphaned clips into clips.json
python scripts/audio_tagger.py --input data/clips --output data/clips.json

# Then review in the review tool
python scripts/review_clips.py --filter BLBW,COYE,OVEN,AMRE,NOPA,PROW
```

## Notes

- All files are ~258KB, mono WAV, normalized
- Source IDs match Xeno-Canto recording IDs (e.g., BLBW_1014269 = XC1014269)
- Original curator kept ~37% (111/300), likely the best quality
- Remaining 63% (189/300) may be lower quality but could contain gems
