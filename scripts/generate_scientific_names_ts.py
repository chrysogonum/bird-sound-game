#!/usr/bin/env python3
"""
Generate scientificNames.ts from species.json.
This ensures the UI uses the correct 2025 AOS scientific names.
"""

import json
from pathlib import Path

project_root = Path(__file__).parent.parent
species_json = project_root / "data" / "species.json"
output_ts = project_root / "src" / "ui-app" / "data" / "scientificNames.ts"

# Load species data
with open(species_json) as f:
    species = json.load(f)

# Sort by species code for readable output
species.sort(key=lambda x: x['species_code'])

# Generate TypeScript file
ts_content = """/**
 * Scientific names for bird species
 * Source: 2025 AOS (66th Supplement) via IBP-AOS-list25.csv
 * Generated from data/species.json
 * DO NOT EDIT MANUALLY - regenerate with scripts/generate_scientific_names_ts.py
 */

export const SCIENTIFIC_NAMES: Record<string, string> = {
"""

for sp in species:
    code = sp['species_code']
    sci_name = sp['scientific_name']
    ts_content += f"  {code}: '{sci_name}',\n"

ts_content += "};\n"

# Write file
with open(output_ts, 'w') as f:
    f.write(ts_content)

print(f"Generated {output_ts}")
print(f"Total species: {len(species)}")
print("\nSample entries:")
for sp in species[:5]:
    print(f"  {sp['species_code']}: {sp['scientific_name']}")

# Show corrections for the warblers that were wrong
print("\nCorrected warbler entries:")
warbler_codes = ['WEWA', 'TEWA', 'PROW', 'PRAW', 'BTNW', 'BTBW', 'BBWA', 'BLBW']
for code in warbler_codes:
    sp = next((s for s in species if s['species_code'] == code), None)
    if sp:
        print(f"  {code}: {sp['scientific_name']}")
