# Species Data Documentation

## Single Source of Truth: IBP-AOS-list25.csv

**IBP-AOS-list25.csv** is the canonical source for all bird species information used throughout ChipNotes.

### CSV Structure

| Column | Description | Example |
|--------|-------------|---------|
| `SPEC` | 4-letter alpha code | `NOCA` |
| `COMMONNAME` | Common English name | `Northern Cardinal` |
| `SCINAME` | Scientific name (Latin) | `Cardinalis cardinalis` |
| `SP`, `B4`, `CONF`, etc. | Other IBP fields (not currently used) | - |

### Taxonomic Order

The row order in the CSV represents the official **AOS/eBird 2025 taxonomy**. This phylogenetic ordering groups birds by evolutionary relationships rather than alphabetically.

### Generated Files

Running `make generate-species-data` creates:

1. **data/species.json** - Full species list
   ```json
   [
     {
       "species_code": "NOCA",
       "common_name": "Northern Cardinal",
       "scientific_name": "Cardinalis cardinalis",
       "taxonomic_order": 2251
     },
     ...
   ]
   ```

2. **data/taxonomic_order.json** - Quick lookup map
   ```json
   {
     "NOCA": 2251,
     "CARW": 1678,
     ...
   }
   ```

### Usage Throughout ChipNotes

This data is used in:

- **Game UI** - PreRoundPreview.tsx, GameplayScreen.tsx (taxonomic sort toggle)
- **Audio ingestion** - scripts/audio_ingest.py (species validation)
- **Clip review tool** - data/review-clips.html (species dropdown, display names)
- **File naming** - All clip files use 4-letter codes from this list
- **Pack definitions** - data/packs/*.json (species_pool arrays)

### When to Regenerate

Run `make generate-species-data` after:

- Adding new species to the game
- Updating to a new AOS checklist (e.g., 2026 taxonomy)
- Correcting species codes or scientific names
- Any change to IBP-AOS-list25.csv

### Important Notes

- **Never manually edit** `species.json` or `taxonomic_order.json`
- The CSV contains all North American birds (~2,350 species)
- ChipNotes only uses a subset (~86 species as of v3.37)
- Taxonomic order numbers are stable unless AOS taxonomy changes

### Source

The IBP-AOS-list25.csv file is derived from the Institute for Bird Populations (IBP) and American Ornithological Society (AOS) 2025 checklist.

---

For questions or to propose taxonomy updates, see the [main project README](../README.md).
