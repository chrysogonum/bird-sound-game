#!/usr/bin/env python3
"""
Generate species.json and taxonomic_order.json from IBP-AOS-list25.csv

This script establishes the IBP-AOS-list25.csv as the single source of truth for:
- 4-letter bird codes
- Common names
- Scientific names
- Taxonomic ordering (from AOS/eBird 2025 taxonomy)
"""

import csv
import json
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CSV_PATH = PROJECT_ROOT / "docs" / "IBP-AOS-list25.csv"
SPECIES_JSON_PATH = PROJECT_ROOT / "data" / "species.json"
TAXONOMIC_ORDER_JSON_PATH = PROJECT_ROOT / "data" / "taxonomic_order.json"


def main():
    print(f"Reading species data from: {CSV_PATH}")

    species_list = []
    taxonomic_order_map = {}

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for order_num, row in enumerate(reader, start=1):
            # Extract fields (SPEC = 4-letter code, COMMONNAME, SCINAME)
            species_code = row['SPEC'].strip()
            common_name = row['COMMONNAME'].strip()
            scientific_name = row['SCINAME'].strip()

            # Skip empty rows or rows without all required fields
            if not species_code or not common_name or not scientific_name:
                continue

            # Build species object
            species_obj = {
                "species_code": species_code,
                "common_name": common_name,
                "scientific_name": scientific_name,
                "taxonomic_order": order_num
            }

            species_list.append(species_obj)
            taxonomic_order_map[species_code] = order_num

    # Write species.json (sorted by taxonomic order)
    print(f"Writing {len(species_list)} species to: {SPECIES_JSON_PATH}")
    with open(SPECIES_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(species_list, f, indent=2, ensure_ascii=False)

    # Write taxonomic_order.json (sorted by species code for readability)
    print(f"Writing {len(taxonomic_order_map)} taxonomic mappings to: {TAXONOMIC_ORDER_JSON_PATH}")
    sorted_order_map = dict(sorted(taxonomic_order_map.items()))
    with open(TAXONOMIC_ORDER_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(sorted_order_map, f, indent=2, ensure_ascii=False)

    print("✓ Species data generation complete!")
    print(f"  - {len(species_list)} species in species.json")
    print(f"  - {len(taxonomic_order_map)} codes in taxonomic_order.json")


if __name__ == '__main__':
    main()
