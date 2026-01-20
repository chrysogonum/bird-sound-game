#!/usr/bin/env python3
"""
Create species.json with complete metadata from 2025 AOS CSV.
Includes: code, common name, scientific name, taxonomic order.
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

# Reverse mapping (AOS → game)
REVERSE_MAPPING = {v: k for k, v in CODE_MAPPING.items()}


def main():
    project_root = Path(__file__).parent.parent
    csv_path = project_root / "docs" / "IBP-AOS-list25.csv"
    taxonomy_path = project_root / "data" / "taxonomic_order.json"
    output_path = project_root / "data" / "species.json"

    # Load current taxonomy to get species codes in game
    with open(taxonomy_path) as f:
        taxonomy = json.load(f)

    species_in_game = set(taxonomy.keys())
    print(f"Found {len(species_in_game)} species in game")

    # Extract species data from CSV
    species_data = []

    with open(csv_path) as f:
        reader = csv.DictReader(f)

        for row in reader:
            aos_code = row['SPEC'].strip()

            # Check if this is one of our mapped codes (use game code)
            game_code = REVERSE_MAPPING.get(aos_code, aos_code)

            if game_code in species_in_game:
                common_name = row['COMMONNAME'].strip()
                scientific_name = row['SCINAME'].strip()
                taxonomic_order = taxonomy[game_code]

                # Parse genus and species from scientific name
                sci_parts = scientific_name.split()
                genus = sci_parts[0] if sci_parts else ""
                species = sci_parts[1] if len(sci_parts) > 1 else ""

                species_data.append({
                    "species_code": game_code,
                    "common_name": common_name,
                    "scientific_name": scientific_name,
                    "genus": genus,
                    "species": species,
                    "taxonomic_order": taxonomic_order,
                    "aos_code": aos_code if aos_code != game_code else None
                })

    # Sort by taxonomic order
    species_data.sort(key=lambda x: x['taxonomic_order'])

    # Save
    with open(output_path, 'w') as f:
        json.dump(species_data, f, indent=2)

    print(f"\nCreated {output_path} with {len(species_data)} species")
    print("\nSample entries:")
    for sp in species_data[:5]:
        print(f"  {sp['species_code']}: {sp['common_name']} ({sp['scientific_name']}) - order {sp['taxonomic_order']}")

    # Verify SWWA
    swwa = next((s for s in species_data if s['species_code'] == 'SWWA'), None)
    if swwa:
        print(f"\nSWWA verification:")
        print(f"  Code: {swwa['species_code']}")
        print(f"  Common: {swwa['common_name']}")
        print(f"  Scientific: {swwa['scientific_name']}")
        print(f"  Genus: {swwa['genus']}")
        print(f"  Taxonomic order: {swwa['taxonomic_order']}")


if __name__ == "__main__":
    main()
