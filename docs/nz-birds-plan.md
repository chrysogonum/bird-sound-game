# New Zealand Birds - Feature Plan

**Branch**: `feature/nz-birds`
**Status**: Phase 2 Complete
**Created**: January 16, 2026
**Risk Level**: Low (DOC audio confirmed compatible)

## Overview

Add New Zealand bird species to ChipNotes! using recordings from the NZ Department of Conservation (DOC). This is an **experimental feature** isolated on its own branch to protect production.

## Research Summary

### Species Count
- **Total NZ birds**: ~206 breeding species
- **Endemic**: 94 species (46%) - found nowhere else!
- **DOC audio library**: 60+ species with recordings
- **Recommended starter pack**: 10-12 common backyard species

### Audio Sources

#### Primary: DOC (Department of Conservation NZ) ⭐ RECOMMENDED
- **URL**: https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/
- **License**: Crown Copyright - FREE to use commercially with attribution
- **Quality**: Professional, curated recordings
- **Coverage**: 60+ species
- **Format**: Downloadable audio files
- **Attribution**: "Department of Conservation (NZ)"

#### Secondary: Xeno-canto
- **Coverage**: 282+ recordings from 12+ species (limited for NZ)
- **License**: Creative Commons (varies by recording)
- **Note**: DOC is better for NZ birds

### Recommended Starter Pack (10-12 species)

**Common Backyard Birds:**
1. **Tūī** - Black with white throat tuft, dual voice box
2. **Bellbird / Korimako** - Melodious, bell-like song
3. **Fantail / Pīwakawaka** - Small, distinctive fan tail
4. **Kererū** - NZ Pigeon, large, distinctive wing beats
5. **Silvereye / Tauhou** - Tiny, common in gardens
6. **Grey Warbler / Riroriro** - Sweet, high-pitched song

**Iconic Native Birds:**
7. **Kākā** - Forest parrot, loud calls
8. **Morepork / Ruru** - Native owl, distinctive "more-pork" call
9. **Kea** - Alpine parrot, playful and vocal
10. **Weka** - Flightless, ground-dwelling
11. **Pūkeko** - Wetland bird, common and noisy
12. **Kākāpō** (optional) - Critically endangered, amazing booming calls

## Implementation Plan

### Phase 1: Proof of Concept (1-2 days) ✅ COMPLETE
**Goal**: Test DOC audio with existing pipeline

- [x] Download 3-5 sample DOC recordings
- [x] Test audio format compatibility
- [x] Process through existing pipeline (or adapt cornell_ingest.py)
- [x] Generate spectrograms
- [ ] Verify playback in game
- [x] Document any format issues

**Results (Jan 23, 2026):**
- DOC provides MP3 files (stereo, 44.1kHz, 128kbps)
- Existing `audio_ingest.process_audio_file()` works perfectly
- Tested 3 species: Tūī, Bellbird/Korimako, Morepork/Ruru
- All converted to mono WAV, 3000ms, -16 LUFS
- Spectrograms generate correctly
- Test files validated pipeline (removed after Phase 2)

### Phase 2: Full NZ Collection ✅ COMPLETE
**Goal**: Download and process ALL DOC bird audio

- [x] Download all DOC recordings (57 source files)
- [x] Create `scripts/nz_ingest.py`
- [x] Process all audio files
- [x] Generate spectrograms
- [x] Create pack files
- [ ] Test in game (all 6 difficulty levels)
- [x] Validate with schema validation

**Results (Jan 23, 2026):**
- 47 species, 181 clips total
- All clips: mono WAV, 2500ms, -16 LUFS normalized
- 181 spectrograms generated
- Schema updated to support `doc` source and `maori_name` field
- 3 pack files created:
  - `nz_all_birds.json` (47 species)
  - `nz_backyard.json` (10 common species)
  - `nz_iconic.json` (10 famous endemic species)
- Data files:
  - `data/clips-nz/` - 181 WAV files
  - `data/spectrograms-nz/` - 181 PNG files
  - `data/clips-nz.json` - clip metadata

### Phase 3: Icons & Polish (variable)
**Goal**: Visual assets and UX

- [ ] Source or create 10 bird icons
  - **Options**: Commission artist, AI generation, CC-licensed photos
  - **Challenge**: Need distinctive NZ bird features (fan tails, throat tufts, etc.)
- [ ] Decide on naming: English vs Māori vs both
  - Recommendation: Both (e.g., "Tūī" or "Fantail / Pīwakawaka")
- [ ] Add pack description with NZ flavor text
- [ ] Update Help page if needed

### Phase 4: Testing & Review (3-5 days)
**Goal**: Thorough QA before merge

- [ ] Playtest all 6 levels
- [ ] Audio quality check (volume normalization, clarity)
- [ ] Spectrogram review (readable, distinctive)
- [ ] Cross-reference with eBird for accuracy
- [ ] User testing (if possible - NZ birders?)

### Phase 5: Merge Decision
**Goal**: Decide if NZ birds go to production

**Merge to `main` if:**
- ✅ All audio plays correctly
- ✅ Spectrograms are readable
- ✅ Icons look good
- ✅ No bugs introduced
- ✅ Gameplay is fun/educational

**Delete branch if:**
- ❌ Audio quality is poor
- ❌ Format issues can't be resolved
- ❌ Icon artwork is too expensive/difficult
- ❌ Doesn't meet quality bar

## Technical Challenges

### 1. Audio Format Compatibility ✅ RESOLVED
- **Risk**: DOC files might be different format than Cornell/Xeno-canto
- **Mitigation**: Test early with sample files
- **Fallback**: Convert using ffmpeg in ingestion script
- **Result**: No issues! DOC MP3s process cleanly through existing pipeline

### 2. Bird Icon Artwork
- **Risk**: Need 10+ custom icons, could be expensive/time-consuming
- **Options**:
  - Commission artist ($10-20 per icon × 10 = $100-200)
  - AI generation (Midjourney/DALL-E + manual cleanup)
  - Find CC-licensed photos and crop
  - Use simplified silhouettes initially
- **Mitigation**: Start with 3-5 most iconic species

### 3. Naming Conventions
- **Challenge**: NZ birds have both English and Māori names
- **Cultural sensitivity**: Māori names are significant, not just "fun nicknames"
- **UI implications**: Need space for longer names
- **Recommendation**: Default to Māori where standard (Tūī, Kea), bilingual where helpful

### 4. 4-Letter Alpha Codes ✅ RESOLVED
- **Challenge**: Game uses codes like NOCA, BLJA
- **Question**: Do NZ birds have standardized codes?
- **Solution**: Created custom codes for 47 species
- Examples: TUIX (Tūī), BELL (Bellbird), MORU (Morepork), NIBK (North Island Brown Kiwi)
- Full mapping in `scripts/nz_ingest.py`

## Success Criteria

This feature is successful if:
1. ✅ DOC audio integrates cleanly with existing pipeline
2. ✅ NZ birds are as fun/educational as US packs
3. ✅ No production bugs introduced
4. ✅ Icons look professional
5. ✅ Opens door for more international species (UK, Australia, etc.)

## Rollback Plan

If this doesn't work out:
```bash
git checkout main
git branch -D feature/nz-birds
# No trace left, production unaffected
```

## Future Expansion (if successful)

- **Phase 6**: Add more NZ species (expand to 30-60 from DOC library)
- **Phase 7**: Create specialized packs:
  - "NZ Forest Birds"
  - "NZ Seabirds"
  - "NZ Wetland Birds"
- **Phase 8**: Integrate with location-based pack system
- **Phase 9**: Add Australia, UK, other regions

## Resources

- DOC Bird Calls: https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/
- NZ Common Birds Guide: https://www.doc.govt.nz/get-involved/conservation-activities/identify-common-birds-in-your-local-nature-space/
- Xeno-canto NZ: https://xeno-canto.org/explore?query=cnt:new%20zealand
- eBird NZ: https://ebird.org/region/NZ

## Notes

- Keep commits small and descriptive
- Document any pipeline changes
- Test frequently
- Don't break existing US bird packs!
- Have fun - this is an experiment! 🐦🇳🇿
