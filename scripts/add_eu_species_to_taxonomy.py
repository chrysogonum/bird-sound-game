#!/usr/bin/env python3
"""
Add European bird species to the taxonomy source of truth CSV.

Uses official eBird/Clements v2025 species codes.
This script ONLY adds new EU species - it does NOT modify any existing entries.

Of the 41 species in the European Warblers & Skulkers pack, 17 are already in the
AOS CSV as rare vagrants (they have 4-letter codes like SEWA, EURO, etc.).
This script adds the remaining 24 species that use eBird global codes.
"""

import csv
from pathlib import Path

# EU species NOT already in the AOS CSV (24 species)
# Format: ebird_code -> (common_name, scientific_name)
# Codes verified against eBird/Clements v2025 taxonomy
EU_SPECIES_TAXONOMY = {
    # Acrocephalus warblers (reed warblers)
    "eurwar1": ("Common Reed Warbler", "Acrocephalus scirpaceus"),
    "marwar3": ("Marsh Warbler", "Acrocephalus palustris"),
    "grrwar1": ("Great Reed Warbler", "Acrocephalus arundinaceus"),

    # Locustella warblers (grasshopper warblers)
    "cogwar1": ("Common Grasshopper Warbler", "Locustella naevia"),
    "savwar1": ("Savi's Warbler", "Locustella luscinioides"),

    # Phylloscopus warblers (leaf warblers)
    "webwar1": ("Western Bonelli's Warbler", "Phylloscopus bonelli"),

    # Sylvia/Curruca warblers
    "garwar1": ("Garden Warbler", "Sylvia borin"),
    "grewhi1": ("Common Whitethroat", "Curruca communis"),
    "barwar1": ("Barred Warbler", "Curruca nisoria"),
    "darwar1": ("Dartford Warbler", "Curruca undata"),

    # Nightingales
    "comnig1": ("Common Nightingale", "Luscinia megarhynchos"),
    "thrnig1": ("Thrush Nightingale", "Luscinia luscinia"),

    # Cetti's warbler
    "cetwar1": ("Cetti's Warbler", "Cettia cetti"),

    # Flycatchers
    "eupfly1": ("European Pied Flycatcher", "Ficedula hypoleuca"),
    "colfly1": ("Collared Flycatcher", "Ficedula albicollis"),

    # Treecreepers
    "eurtre1": ("Eurasian Treecreeper", "Certhia familiaris"),
    "shttre1": ("Short-toed Treecreeper", "Certhia brachydactyla"),

    # Kinglets
    "goldcr1": ("Goldcrest", "Regulus regulus"),
    "firecr1": ("Common Firecrest", "Regulus ignicapilla"),

    # Larks
    "woolar1": ("Woodlark", "Lullula arborea"),

    # Accentors
    "dunnoc1": ("Dunnock", "Prunella modularis"),

    # Wrens
    "winwre4": ("Eurasian Wren", "Troglodytes troglodytes"),

    # Corvids
    "eurjay1": ("Eurasian Jay", "Garrulus glandarius"),

    # Woodpeckers
    "blawoo1": ("Black Woodpecker", "Dryocopus martius"),
}


def main():
    csv_path = Path(__file__).parent.parent / "docs" / "IBP-AOS-list25.csv"

    if not csv_path.exists():
        print(f"ERROR: CSV file not found at {csv_path}")
        return 1

    # Read existing CSV
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    header = rows[0]
    existing_rows = rows[1:]

    # Find column indices
    spec_idx = header.index('SPEC')
    name_idx = header.index('COMMONNAME')
    sci_idx = header.index('SCINAME')

    # Check which codes already exist
    existing_codes = {row[spec_idx].lower() for row in existing_rows if len(row) > spec_idx}

    # Add EU species that don't exist
    new_rows = []
    skipped = []
    for code, (common_name, scientific_name) in EU_SPECIES_TAXONOMY.items():
        if code.lower() not in existing_codes:
            # Create new row with same structure
            # SP,B4,SPEC,CONF,B1,COMMONNAME,B2,SCINAME,SPEC6,CONF6
            new_row = ['', '', code, '', '', common_name, '', scientific_name, '', '']
            new_rows.append(new_row)
            print(f"  Adding: {code} - {common_name} ({scientific_name})")
        else:
            skipped.append(code)

    if skipped:
        print(f"\nSkipped {len(skipped)} codes that already exist: {', '.join(skipped)}")

    if not new_rows:
        print("\nNo new species to add.")
        return 0

    # Append new rows to CSV (do NOT modify existing rows)
    all_rows = [header] + existing_rows + new_rows

    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(all_rows)

    print(f"\nAdded {len(new_rows)} EU species to {csv_path}")
    print("\nNext steps:")
    print("  1. Run 'python3 scripts/generate_species_data.py' to regenerate species.json")
    print("  2. Verify with 'make validate-schemas'")

    return 0


if __name__ == "__main__":
    exit(main())
