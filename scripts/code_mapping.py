#!/usr/bin/env python3
"""
Mapping between game's 4-letter codes and 2025 AOS codes.
Some species have code changes or splits in recent taxonomy.
"""

# Maps game code → AOS 2025 code
CODE_MAPPING = {
    'SASP': 'SAVS',  # Savannah Sparrow
    'CEWA': 'CERW',  # Cerulean Warbler
    'AMGO': 'AGOL',  # American Goldfinch
    'WESJ': 'CASJ',  # Western Scrub-Jay → California Scrub-Jay (taxonomic split)
}

# Note: BTNW and BTBW are BOTH in the game and both use correct AOS codes:
# - BTNW = Black-throated Green Warbler (Setophaga virens)
# - BTBW = Black-throated Blue Warbler (Setophaga caerulescens)
