# New Zealand Bird Naming Conventions

This document describes the naming conventions and display logic for New Zealand birds in ChipNotes.

## Overview

NZ birds use a layered naming system that balances Māori cultural naming with practical gameplay needs:

1. **eBird species codes** - Internal identifiers (e.g., `tui1`, `nezrob2`)
2. **Display codes** - Short 4-letter codes shown during gameplay (e.g., `TUI`, `NIRO`)
3. **Tile names** - Names shown above bird icons on buttons (e.g., `Tūī`, `Toutouwai (NI)`)
4. **Common names** - Full names with Māori and English (e.g., `Toutouwai / North Island Robin`)

## File Locations

- `data/nz_display_codes.json` - Maps eBird codes to display codes and tile names
- `data/clips-nz.json` - Audio clips with common names
- `data/packs/nz_*.json` - Pack definitions using eBird codes
- `data/icons/*.png` - Bird icons named by eBird code

## Naming Principles

### 1. Māori Names Take Priority

For well-known species, the Māori name is used as the primary identifier:

| eBird Code | Tile Name | Common Name |
|------------|-----------|-------------|
| `tui1` | Tūī | Tūī |
| `morepo2` | Ruru | Ruru / Morepork |
| `nezpig2` | Kererū | Kererū / NZ Wood Pigeon |

### 2. Subspecies Use Parenthetical Qualifiers

When multiple subspecies share the same Māori name, add a parenthetical qualifier **after** the name. This ensures:
- Subspecies sort together alphabetically
- Users think "Robin (which island?)" not "Island (which bird?)"

| eBird Code | Tile Name | Species |
|------------|-----------|---------|
| `nezrob2` | Toutouwai (NI) | North Island Robin |
| `nezrob3` | Toutouwai (SI) | South Island Robin |
| `saddle2` | Tīeke (NI) | North Island Saddleback |
| `saddle3` | Tīeke (SI) | South Island Saddleback |
| `refpar4` | Kākāriki (RC) | Red-crowned Parakeet |
| `malpar2` | Kākāriki (OF) | Orange-fronted Parakeet |

### 3. Regional Subspecies Follow the Same Pattern

For Chatham Islands and Auckland Islands subspecies:

| eBird Code | Tile Name | Species |
|------------|-----------|---------|
| `chatui1` | Tūī (Ch.) | Chatham Island Tūī |
| `chatom1` | Tomtit (Ch.) | Chatham Island Tomtit |
| `chafan1` | Fantail (Ch.) | Chatham Island Fantail |
| `auitea1` | Teal (Auck.) | Auckland Island Teal |
| `grcgre1` | Grebe (Cr.) | Australasian Crested Grebe |

**Key principle:** The primary bird name comes first, qualifier in parentheses. This way "Tomtit (Ch.)" sorts under T with other tomtits, not under C for Chatham.

## Abbreviations Used

| Abbreviation | Meaning |
|--------------|---------|
| NI | North Island |
| SI | South Island |
| Ch. | Chatham Islands |
| Auck. | Auckland Islands |
| RC | Red-crowned |
| OF | Orange-fronted |
| Cr. | Crested |

## Display Code Format

Display codes are 4-letter abbreviations shown during fast-paced gameplay:

- Derived from Māori names where possible (e.g., `RURU`, `KIWI`, `WEKA`)
- Use distinguishing prefixes for subspecies (e.g., `NIRO`/`SIRO` for North/South Island Robin)
- Kept short for quick visual recognition

## Sorting Behavior

Birds are sorted **alphabetically by tile name**, not by eBird code. This means:

- All Kākāriki variants sort together under K
- All Toutouwai variants sort together under T
- Chatham Island Tūī sorts under T (as "Tūī (Ch.)"), not under C

This sorting is applied consistently across:
- PreRoundPreview (ready to play screen)
- Gameplay screen (species buttons)
- Sound library listings

## Adding New NZ Species

When adding a new NZ species:

1. Add audio clips to `data/clips-nz/` with 4-letter prefix filenames
2. Add entry to `data/clips-nz.json` with eBird code as `species_code`
3. Add entry to `data/nz_display_codes.json` mapping eBird code to display code and tile name
4. Add bird icon to `data/icons/{ebird_code}.png`
5. Add to appropriate pack(s) in `data/packs/nz_*.json`

If the species shares a Māori name with an existing species, use a parenthetical qualifier to distinguish them.

## Technical Implementation

The mapping flows through the codebase as follows:

```
Pack JSON (eBird codes)
    ↓
useGameEngine.ts loads clips-nz.json
    ↓
nz_display_codes.json lookup
    ↓
SpeciesInfo { code, displayCode, tileName }
    ↓
UI renders tileName above icons
```

The `nzDisplayCodes` lookup happens in:
- `src/ui-app/game/useGameEngine.ts` - Gameplay species buttons
- `src/ui-app/screens/PreRoundPreview.tsx` - Ready to play grid
- `src/ui-app/screens/NZPackSelect.tsx` - Sound library listings
