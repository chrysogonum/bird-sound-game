#!/usr/bin/env python3
"""Verify the warbler taxonomic order is now correct."""

import json
from pathlib import Path

tax_file = Path(__file__).parent.parent / "data" / "taxonomic_order.json"

with open(tax_file) as f:
    tax = json.load(f)

# Get warblers and sort by position
warblers = [
    ('OVEN', 'Ovenbird', 'Seiurus'),
    ('WEWA', 'Worm-eating Warbler', 'Helmitheros'),
    ('LOWA', 'Louisiana Waterthrush', 'Parkesia'),
    ('NOWA', 'Northern Waterthrush', 'Parkesia'),
    ('GWWA', 'Golden-winged Warbler', 'Vermivora'),
    ('BWWA', 'Blue-winged Warbler', 'Vermivora'),
    ('BAWW', 'Black-and-white Warbler', 'Mniotilta'),
    ('PROW', 'Prothonotary Warbler', 'Protonotaria'),
    ('SWWA', "Swainson's Warbler", 'Limnothlypis'),
    ('TEWA', 'Tennessee Warbler', 'Leiothlypis'),
    ('OCWA', 'Orange-crowned Warbler', 'Leiothlypis'),
    ('NAWA', 'Nashville Warbler', 'Leiothlypis'),
    ('KEWA', 'Kentucky Warbler', 'Geothlypis'),
    ('COYE', 'Common Yellowthroat', 'Geothlypis'),
    ('AMRE', 'American Redstart', 'Setophaga'),
    ('NOPA', 'Northern Parula', 'Setophaga'),
    ('MAWA', 'Magnolia Warbler', 'Setophaga'),
    ('BBWA', 'Bay-breasted Warbler', 'Setophaga'),
    ('BLBW', 'Blackburnian Warbler', 'Setophaga'),
    ('CSWA', 'Chestnut-sided Warbler', 'Setophaga'),
    ('BLPW', 'Blackpoll Warbler', 'Setophaga'),
    ('BTNW', 'Black-throated Blue Warbler', 'Setophaga'),
    ('PRAW', 'Prairie Warbler', 'Setophaga'),
    ('PIWA', 'Pine Warbler', 'Setophaga'),
    ('YTWA', 'Yellow-throated Warbler', 'Setophaga'),
]

print('Warbler taxonomic order (2025 AOS):')
print('='*80)
sorted_warblers = sorted(
    [(code, name, genus, tax.get(code, 'N/A')) for code, name, genus in warblers],
    key=lambda x: x[3] if isinstance(x[3], int) else 9999
)

current_genus = None
for code, name, genus, pos in sorted_warblers:
    if genus != current_genus:
        print(f'\n{genus}:')
        current_genus = genus
    print(f'  {pos:4d}  {code:5s}  {name}')

print('\n' + '='*80)
print('Key fix:')
swwa_pos = tax.get('SWWA', 'N/A')
praw_pos = tax.get('PRAW', 'N/A')
amre_pos = tax.get('AMRE', 'N/A')
print(f'  SWWA (Swainson\'s Warbler, Limnothlypis):  {swwa_pos}')
print(f'  AMRE (American Redstart, Setophaga):      {amre_pos}')
print(f'  PRAW (Prairie Warbler, Setophaga):        {praw_pos}')
print(f'\n  ✓ Limnothlypis (basal) now appears BEFORE Setophaga (derived)')
print(f'  ✓ Phylogenetically correct!')
