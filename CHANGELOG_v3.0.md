# SoundField: Birds - Version 3.0 Release Notes

## 🎉 Major New Feature: Western Birds Pack

### Overview
Version 3.0 introduces a comprehensive **Western Birds** pack featuring 14 species common to western North America, from the Pacific coast to the Rocky Mountains. This pack includes 77 brand-new audio clips from the **Cornell Lab of Ornithology**, adding both new species and enhanced vocalization variety to existing species.

---

## New Content

### Western Birds Pack
**Pack ID:** `western_birds`
**Display Name:** Western Birds
**Total Species:** 14
**Total Clips:** 137 (77 new Cornell clips + 60 existing Xeno-Canto clips)

#### New Western-Specific Species (8 species):
1. **Steller's Jay (STJA)** - 6 calls
2. **Western Scrub-Jay (WESJ)** - 3 calls
3. **Black-capped Chickadee (BCCH)** - 6 clips (3 songs + 3 calls)
4. **White-crowned Sparrow (WCSP)** - 9 clips (6 songs + 3 calls)
5. **Cassin's Finch (CAFI)** - 6 clips (3 songs + 3 calls)
6. **Pine Siskin (PISI)** - 3 songs
7. **Evening Grosbeak (EVGR)** - 3 calls
8. **Red-winged Blackbird (RWBL)** - 6 clips (3 songs + 3 calls)

#### Enhanced Existing Species (6 species):
These species now have **Cornell clips that add vocalization variety** (especially calls and drums):
- **Mourning Dove (MODO)** - +3 Cornell songs
- **Downy Woodpecker (DOWO)** - +6 Cornell clips (3 calls + 3 drums) 🎯
- **Northern Flicker (NOFL)** - +8 Cornell clips (5 calls + 3 drums) 🎯
- **White-breasted Nuthatch (WBNU)** - +9 Cornell clips (3 songs + 6 calls) 🎯
- **House Finch (HOFI)** - +6 Cornell clips (3 songs + 3 calls) 🎯
- **American Goldfinch (AMGO)** - +3 Cornell songs

🎯 = High-value additions that significantly improve species variety (woodpecker drums, nuthatch calls, etc.)

---

## Technical Changes

### Audio Source Attribution
- **New Source Added:** Cornell Lab of Ornithology
- All Cornell clips are properly attributed in metadata
- Cornell clips are high quality (Quality Score: 5/5, equivalent to 'A' rating)

### Processing Pipeline
- **New Script:** `scripts/cornell_ingest.py`
  - Handles stereo-to-mono conversion
  - Extracts multiple clips from longer recordings
  - Preserves vocalization type from filename (Song/Call/Drum)
  - Normalizes to -16 LUFS
  - Trims to 0.5-3.0 second clips

### Schema Updates
- **Clip Schema (`schemas/clip.schema.json`)**:
  - Added `cornell` to accepted sources
  - Added `user_recording` to accepted sources
  - Added optional fields: `canonical`, `rejected`, `quality_rating`, `species_name`, `xeno_canto_id`

### Data Updates
- **Total Clips:** 686 (609 existing + 77 Cornell)
- **Total Spectrograms:** 686 (all clips now have spectrograms)
- **Species Codes:** Added 7 new Western species codes to `audio_tagger.py`

---

## File Changes

### New Files
- `scripts/cornell_ingest.py` - Cornell audio processing pipeline
- `data/packs/western_birds.json` - Western Birds pack definition
- `data/clips/*_cornell_*.wav` - 77 new audio clips (2000ms each)
- `data/spectrograms/*_cornell_*.png` - 77 new spectrograms
- `CHANGELOG_v3.0.md` - This file

### Modified Files
- `data/clips.json` - Added 77 Cornell clips, fixed missing required fields
- `schemas/clip.schema.json` - Added Cornell source, legacy fields
- `scripts/audio_tagger.py` - Added Western species codes
- All existing clips - Added missing `quality_score`, `source`, `source_id` fields

---

## Species Distribution Summary

### Western Birds Pack Clip Breakdown
```
Code  Species                          Songs  Calls  Cornell  Xeno-Canto
----------------------------------------------------------------------------------
AMGO  American Goldfinch                13      0       3         10
BCCH  Black-capped Chickadee             3      3       6          0
CAFI  Cassin's Finch                     3      3       6          0
DOWO  Downy Woodpecker                  10      6       6         10
EVGR  Evening Grosbeak                   0      3       3          0
HOFI  House Finch                       13      3       6         10
MODO  Mourning Dove                     13      0       3         10
NOFL  Northern Flicker                  10      8       8         10
PISI  Pine Siskin                        3      0       3          0
RWBL  Red-winged Blackbird               3      3       6          0
STJA  Steller's Jay                      0      6       6          0
WBNU  White-breasted Nuthatch           13      6       9         10
WCSP  White-crowned Sparrow              6      3       9          0
WESJ  Western Scrub-Jay                  0      3       3          0
----------------------------------------------------------------------------------
TOTAL                                   90     47      77         60
```

---

## Quality Improvements

### Vocalization Diversity
The Cornell clips significantly improve vocalization diversity for woodpeckers and nuthatches:
- **Woodpecker Drums:** Added authentic drumming patterns for DOWO and NOFL
- **Nuthatch Calls:** Added distinctive nasal calls for WBNU
- **Mixed Vocalizations:** Better representation of both songs and calls for finches

### Audio Quality
- All Cornell clips: -16 LUFS normalized, mono, 2000ms duration
- All clips validated against schema
- All clips have matching spectrograms

---

## Testing Notes

### Validation Status
✅ All JSON schemas validated successfully
✅ clips.json passes schema validation
✅ levels.json passes schema validation
✅ All 7 pack definitions pass schema validation
✅ All 77 Cornell spectrograms generated

### Local Testing
Ready for `make dev` testing to verify:
- Western Birds pack appears in pack selector
- All 14 species load correctly
- Audio playback works for Cornell clips
- Spectrograms display correctly
- Pack difficulty settings are appropriate

---

## Migration Notes

### Backward Compatibility
- ✅ All existing packs remain unchanged
- ✅ Existing clips.json structure preserved (only additions)
- ✅ No breaking changes to game logic

### Data Integrity
- Fixed 508 clips missing `quality_score` field
- Fixed 324 clips with inconsistent source naming (`xeno-canto` → `xenocanto`)
- Fixed 184 clips missing `duration_ms` field
- Normalized all source values to schema-compliant formats

---

## Credits

**Audio Sources:**
- Cornell Lab of Ornithology (77 clips)
- Xeno-Canto (existing clips)

**Pack Development:**
- Western Birds species selection and curation
- Audio processing and normalization
- Spectrogram generation
- Schema updates and validation

---

## Next Steps

1. ✅ All schemas validated
2. ✅ All clips processed and merged
3. ✅ All spectrograms generated
4. ⏳ Local testing with `make dev`
5. ⏳ Production build and deployment

---

**Version:** 3.0
**Release Date:** 2026-01-14
**Total Clips:** 686
**Total Species:** 80+
**Total Packs:** 7
