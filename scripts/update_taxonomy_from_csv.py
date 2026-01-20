#!/usr/bin/env python3
"""
Update taxonomic_order.json from 2025 AOS CSV file.
This is more reliable than parsing the PDF.
"""

import csv
import json
from pathlib import Path

# Code mapping for species with different codes in game vs 2025 AOS
CODE_MAPPING = {
    'SASP': 'SAVS',  # Savannah Sparrow
    'CEWA': 'CERW',  # Cerulean Warbler
    'AMGO': 'AGOL',  # American Goldfinch
    'WESJ': 'CASJ',  # Western Scrub-Jay → California Scrub-Jay (taxonomic split)
}


def extract_taxonomy_from_csv(csv_path):
    """Extract 4-letter codes and taxonomic positions from AOS CSV."""
    taxonomy = {}

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)

        # Line number starts at 2 (line 1 is header)
        line_number = 2

        for row in reader:
            # Get 4-letter code from SPEC column
            code = row['SPEC'].strip()

            if code and len(code) == 4:
                # Use line number minus 1 as taxonomic position
                # (Line 2 = position 1, Line 3 = position 2, etc.)
                taxonomy[code] = line_number - 1

            line_number += 1

    return taxonomy


def main():
    # Paths
    project_root = Path(__file__).parent.parent
    csv_path = project_root / "docs" / "IBP-AOS-list25.csv"
    current_taxonomy_path = project_root / "data" / "taxonomic_order.json"
    output_path = project_root / "data" / "taxonomic_order.json"

    # Check CSV exists
    if not csv_path.exists():
        print(f"ERROR: CSV not found at {csv_path}")
        return

    # Load current taxonomy to get species list
    with open(current_taxonomy_path) as f:
        current_taxonomy = json.load(f)

    species_in_game = set(current_taxonomy.keys())
    print(f"Found {len(species_in_game)} species in game")

    # Extract taxonomy from CSV
    print(f"Extracting taxonomy from {csv_path}...")
    full_taxonomy = extract_taxonomy_from_csv(csv_path)
    print(f"Extracted {len(full_taxonomy)} species from CSV")

    # Build new taxonomy for game species only
    new_taxonomy = {}
    missing_species = []
    mapped_codes = {}

    for species_code in species_in_game:
        # Check if we need to map this code to a different AOS 2025 code
        aos_code = CODE_MAPPING.get(species_code, species_code)

        if aos_code != species_code:
            mapped_codes[species_code] = aos_code
            print(f"Mapping {species_code} → {aos_code}")

        if aos_code in full_taxonomy:
            new_taxonomy[species_code] = full_taxonomy[aos_code]
        else:
            missing_species.append(species_code)
            # Keep old value if not found
            new_taxonomy[species_code] = current_taxonomy[species_code]
            print(f"WARNING: {species_code} (AOS: {aos_code}) not found in CSV, keeping old position {current_taxonomy[species_code]}")

    # Sort by taxonomic position for display
    sorted_species = sorted(new_taxonomy.items(), key=lambda x: x[1])

    # Save new taxonomy
    with open(output_path, 'w') as f:
        json.dump(new_taxonomy, f, indent=2, sort_keys=True)

    print(f"\nUpdated taxonomic_order.json with {len(new_taxonomy)} species")

    # Show changes
    changes = []
    for code in species_in_game:
        old_pos = current_taxonomy[code]
        new_pos = new_taxonomy[code]
        if old_pos != new_pos:
            changes.append((code, old_pos, new_pos))

    if changes:
        print(f"\nFound {len(changes)} position changes:")
        for code, old_pos, new_pos in sorted(changes, key=lambda x: abs(x[2] - x[1]), reverse=True):
            delta = new_pos - old_pos
            sign = "+" if delta > 0 else ""
            print(f"  {code}: {old_pos} → {new_pos} ({sign}{delta})")
    else:
        print("\nNo position changes found")

    if missing_species:
        print(f"\nWARNING: {len(missing_species)} species not found in CSV:")
        print(f"  {', '.join(missing_species)}")

    # Show taxonomic order for warblers
    print("\n" + "="*80)
    print("Warbler order verification:")
    print("="*80)
    warbler_codes = ['OVEN', 'WEWA', 'LOWA', 'NOWA', 'GWWA', 'BWWA', 'BAWW',
                     'PROW', 'SWWA', 'TEWA', 'OCWA', 'NAWA', 'KEWA', 'COYE',
                     'AMRE', 'NOPA', 'MAWA', 'BBWA', 'BLBW', 'CSWA', 'BLPW',
                     'BTNW', 'PRAW', 'PIWA', 'YTWA', 'PAWA', 'YRWA', 'CEWA',
                     'BTBW', 'WIWA', 'CAWA', 'MOWA']

    warbler_positions = [(code, new_taxonomy.get(code, 'N/A'))
                         for code in warbler_codes
                         if code in new_taxonomy]
    warbler_positions.sort(key=lambda x: x[1] if isinstance(x[1], int) else 9999)

    for code, pos in warbler_positions:
        print(f"  {pos:4d}  {code}")


if __name__ == "__main__":
    main()
