#!/usr/bin/env python3
"""Fix corrupted common names in clips.json by restoring from species.json"""

import json
import sys

def main():
    # Load species.json to get correct common names
    with open('data/species.json', 'r') as f:
        species_data = json.load(f)

    # Build species_code → common_name mapping
    species_map = {}
    for sp in species_data:
        species_map[sp['species_code']] = sp['common_name']

    print(f"Loaded {len(species_map)} species from species.json")

    # Load clips.json
    with open('data/clips.json', 'r') as f:
        clips = json.load(f)

    print(f"Loaded {len(clips)} clips from clips.json")

    # Fix corrupted common names
    fixed_count = 0
    for clip in clips:
        species_code = clip['species_code']
        current_name = clip['common_name']

        # Check if it's corrupted (starts with "Unknown")
        if current_name.startswith('Unknown'):
            if species_code in species_map:
                correct_name = species_map[species_code]
                clip['common_name'] = correct_name
                fixed_count += 1
                print(f"Fixed {species_code}: '{current_name}' → '{correct_name}'")
            else:
                print(f"WARNING: No species data found for {species_code}", file=sys.stderr)

    # Write back to clips.json
    with open('data/clips.json', 'w') as f:
        json.dump(clips, f, indent=2)

    print(f"\nFixed {fixed_count} clips in clips.json")

if __name__ == '__main__':
    main()
