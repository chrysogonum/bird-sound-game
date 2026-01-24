#!/usr/bin/env python3
"""Verify the taxonomic order for ALL species in the game."""

import json
import csv
from pathlib import Path

tax_file = Path(__file__).parent.parent / "data" / "taxonomic_order.json"
csv_file = Path(__file__).parent.parent / "docs" / "IBP-AOS-list25.csv"

# Load taxonomy positions
with open(tax_file) as f:
    tax = json.load(f)

# Load scientific names from CSV
sci_names = {}
with open(csv_file) as f:
    reader = csv.DictReader(f)
    for row in reader:
        code = row['SPEC'].strip()
        if code:
            sci_names[code] = row['SCINAME'].strip()

# Code mapping
CODE_MAPPING = {
    'SASP': 'SAVS',
    'CEWA': 'CERW',
    'AMGO': 'AGOL',
    'BTNW': 'BTBW',
    'WESJ': 'CASJ',
}

# Sort all species by taxonomic position
sorted_species = sorted(tax.items(), key=lambda x: x[1])

print("All 86 species in ChipNotes sorted by 2025 AOS taxonomic order:")
print("="*80)

for code, pos in sorted_species:
    aos_code = CODE_MAPPING.get(code, code)
    sci_name = sci_names.get(aos_code, 'Unknown')
    genus = sci_name.split()[0] if sci_name else '?'
    print(f"{pos:4d}  {code:5s}  {genus:20s}  {sci_name}")

print("\n" + "="*80)
print("Key taxonomic groups:")
print("="*80)

# Group by major families
groups = {
    'Doves': ['MODO'],
    'Hawks & Owls': ['RTHA', 'RSHA', 'SSHA', 'COHA', 'BAOW'],
    'Hummingbirds': ['RTHU'],
    'Woodpeckers': ['PIWO', 'RHWO', 'RBWO', 'DOWO', 'HAWO', 'NOFL'],
    'Flycatchers': ['EATO'],
    'Jays & Crows': ['WESJ', 'BLJA', 'STJA', 'AMCR', 'FICR', 'BRCR'],
    'Chickadees & Titmice': ['BCCH', 'CACH', 'TUTI'],
    'Nuthatches': ['BHNU', 'WBNU'],
    'Wrens': ['CARW', 'CONW'],
    'Kinglets': ['GCKI', 'RCKI'],
    'Gnatcatchers': ['EVGR'],
    'Thrushes': ['BRTH', 'HETH', 'AMRO', 'EABL'],
    'Catbirds': ['GRCA'],
    'Mockingbirds': ['NOMO'],
    'Warblers': ['OVEN', 'WEWA', 'LOWA', 'NOWA', 'GWWA', 'BWWA', 'BAWW',
                 'PROW', 'SWWA', 'TEWA', 'OCWA', 'NAWA', 'KEWA', 'COYE',
                 'AMRE', 'NOPA', 'MAWA', 'BBWA', 'BLBW', 'CSWA', 'BLPW',
                 'BTNW', 'PRAW', 'PIWA', 'YTWA', 'PAWA', 'YRWA', 'CEWA',
                 'MOWA', 'WIWA', 'CAWA'],
    'Cardinals & Buntings': ['RWBL'],
    'Blackbirds': ['COGR', 'EATO'],
    'Sparrows': ['BEKI', 'YBSA', 'SASP', 'CHSP', 'FISP', 'LISP', 'SOSP',
                 'SWSP', 'WTSP', 'WCSP'],
    'Tanagers': ['NOPA'],
    'Cardinals': ['NOCA'],
    'Finches': ['HOFI', 'PISI', 'AMGO', 'CAFI'],
}

for group_name, codes in groups.items():
    valid_codes = [c for c in codes if c in tax]
    if valid_codes:
        positions = sorted([(c, tax[c]) for c in valid_codes], key=lambda x: x[1])
        min_pos = positions[0][1]
        max_pos = positions[-1][1]
        print(f"\n{group_name:25s} ({len(valid_codes):2d} species)  Range: {min_pos:4d}-{max_pos:4d}")
        for code, pos in positions:
            print(f"  {pos:4d}  {code}")
