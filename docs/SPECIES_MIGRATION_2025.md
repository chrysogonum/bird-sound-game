# Species Code Migration to 2025 AOS/IBP Taxonomy

**Date:** January 2026
**Version:** v3.37+
**Status:** ✅ Complete

## Summary

Completed comprehensive migration of bird species codes from older iBird/BNA taxonomy to the official 2025 AOS/IBP taxonomy (IBP-AOS-list25.csv). This migration brings ChipNotes into full compliance with the current ornithological standards.

## Audit Results

### Initial Findings

Running `make audit-species-data` revealed **24 errors** and **27 warnings**:

#### Code Mismatches (Outdated Codes)
| Old Code | New Code | Species | Reason |
|----------|----------|---------|---------|
| AMGO | AGOL | American Goldfinch | Code standardization |
| CEWA | CEDW | Cedar Waxwing | Code standardization |
| SASP | SAVS | Savannah Sparrow | Code standardization |
| WESJ | CASJ | California Scrub-Jay | Taxonomic split (2016) |
| EWPE | EAWP | Eastern Wood-Pewee | Code standardization |

#### Name Mismatches
| Code | Old Name | New Name | Reason |
|------|----------|----------|---------|
| YRWA | Myrtle Warbler | Yellow-rumped Warbler | Subspecies → Species name |
| CASJ | Western Scrub-Jay | California Scrub-Jay | Taxonomic split |

### Taxonomic Background

**Western Scrub-Jay Split (2016):**
The former "Western Scrub-Jay" (WESJ) was split into three species by the AOS:
- **California Scrub-Jay** (CASJ) - *Aphelocoma californica*
- **Woodhouse's Scrub-Jay** (WOSJ) - *Aphelocoma woodhouseii*
- **Florida Scrub-Jay** (FLSJ) - *Aphelocoma coerulescens* (already recognized)

ChipNotes' Western US clips were determined to be California Scrub-Jay based on geographic origin.

## Migration Actions

### Files Updated

**1. clips.json**
- Updated 27 clip entries
- Changed species codes: 22 clips
- Changed common names: 5 clips (YRWA subspecies, CASJ split)

**2. Audio Files (.wav)**
- Renamed 22 audio clip files
- Updated naming convention: `OLD_ID.wav` → `NEW_ID.wav`

**3. Spectrogram Files (.png)**
- Renamed 22 spectrogram files
- Maintained 1:1 correspondence with audio files

**4. Icon Files (.png)**
- Renamed 5 icon files
- Updated: AGOL.png, CEDW.png, SAVS.png, CASJ.png, EAWP.png

### Tools Created

**1. scripts/audit_species_data.py**
- Comprehensive validation against IBP-AOS-list25.csv
- Checks: species codes, common names, scientific names
- Scans: clips.json, packs/*.json, audio files, icons, spectrograms
- Run via: `make audit-species-data`

**2. scripts/migrate_species_codes.py**
- Automated migration tool for future taxonomy updates
- Handles: code changes, name changes, file renames
- Safe operation: creates backups before modifying

**3. scripts/generate_species_data.py** (Previously created)
- Generates species.json and taxonomic_order.json from CSV
- Run via: `make generate-species-data`

## Verification

### Post-Migration Audit

```bash
make audit-species-data
```

**Result:** ✅ ALL CHECKS PASSED
- 2,353 species validated in species.json
- 86 species in active use across 415 clips
- 100% consistency with IBP-AOS-list25.csv
- All files, codes, and names match single source of truth

### Testing Checklist

- [x] Audio clips load and play correctly with new codes
- [x] Spectrograms display for all migrated species
- [x] Icons appear in game UI for migrated species
- [x] Pack definitions reference correct codes
- [x] Taxonomic sort feature works correctly
- [x] Scientific names display correctly in taxonomic mode
- [x] No broken references in game UI

## Impact on Users

**No user-visible impact.** This is a backend data migration that:
- ✅ Maintains all existing functionality
- ✅ Preserves user progress and stats
- ✅ Keeps all audio and visual content
- ✅ Updates only internal codes and metadata

**User benefits:**
- Correct scientific names now displayed
- Proper taxonomic ordering
- Compliance with current ornithological standards
- Future-proof for AOS checklist updates

## Single Source of Truth

**IBP-AOS-list25.csv** is now the canonical source for:
- 4-letter bird codes (SPEC column)
- Common English names (COMMONNAME column)
- Scientific names (SCINAME column)
- Taxonomic order (row order = phylogenetic tree)

**Generated files:**
- `data/species.json` - Full species list
- `data/taxonomic_order.json` - Code-to-order lookup

**Regenerate after CSV updates:**
```bash
make generate-species-data
make audit-species-data
```

## Future Taxonomy Updates

When the AOS releases new checklists (typically annually):

1. Update `docs/IBP-AOS-list25.csv` with new data
2. Run `make generate-species-data` to regenerate JSON files
3. Run `make audit-species-data` to identify discrepancies
4. Use/modify `scripts/migrate_species_codes.py` for code changes
5. Test game thoroughly
6. Commit with detailed migration notes

## References

- **AOS Checklist:** https://www.americanornithology.org/checklist
- **eBird Taxonomy:** https://ebird.org/science/use-ebird-data/the-ebird-taxonomy
- **IBP Alpha Codes:** https://www.birdpop.org/pages/birdSpeciesCodes.php

---

**Migration completed:** January 20, 2026
**Commits:** 670028c, 5ead396
**Version:** v3.37+
