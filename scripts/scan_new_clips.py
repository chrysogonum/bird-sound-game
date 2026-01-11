#!/usr/bin/env python3
"""
Scan clips folder and generate manifest of new clips not yet in clips.json.
Run this after downloading clips to prepare for review.

Usage:
    python scripts/scan_new_clips.py
"""

import json
import os
import re
from pathlib import Path

# Species data for warblers
WARBLER_SPECIES = {
    'BWWA': 'Blue-winged Warbler',
    'GWWA': 'Golden-winged Warbler',
    'TEWA': 'Tennessee Warbler',
    'OCWA': 'Orange-crowned Warbler',
    'NAWA': 'Nashville Warbler',
    'NOPA': 'Northern Parula',
    'MAWA': 'Magnolia Warbler',
    'CMWA': 'Cape May Warbler',
    'BTBW': 'Black-throated Blue Warbler',
    'YRWA': 'Yellow-rumped Warbler',
    'BLBW': 'Blackburnian Warbler',
    'BLPW': 'Blackpoll Warbler',
    'BTNW': 'Black-throated Green Warbler',
    'CSWA': 'Chestnut-sided Warbler',
    'BBWA': 'Bay-breasted Warbler',
    'PRAW': 'Prairie Warbler',
    'PAWA': 'Palm Warbler',
    'PIWA': 'Pine Warbler',
    'YTWA': 'Yellow-throated Warbler',
    'PROW': 'Prothonotary Warbler',
    'COYE': 'Common Yellowthroat',
    'CAWA': 'Canada Warbler',
    'WIWA': "Wilson's Warbler",
    'AMRE': 'American Redstart',
    'OVEN': 'Ovenbird',
    'NOWA': 'Northern Waterthrush',
    'LOWA': 'Louisiana Waterthrush',
    'BAWW': 'Black-and-white Warbler',
    'CONW': 'Connecticut Warbler',
    'MOWA': 'Mourning Warbler',
    'KEWA': 'Kentucky Warbler',
    'HOWA': 'Hooded Warbler',
    'SWWA': "Swainson's Warbler",
    'YEWA': 'Yellow Warbler',
}

# All species (combine with existing)
ALL_SPECIES = {
    'NOCA': 'Northern Cardinal',
    'CAWR': 'Carolina Wren',
    'BLJA': 'Blue Jay',
    'AMCR': 'American Crow',
    'TUTI': 'Tufted Titmouse',
    'AMRO': 'American Robin',
    'AMGO': 'American Goldfinch',
    'MODO': 'Mourning Dove',
    'HOFI': 'House Finch',
    'WBNU': 'White-breasted Nuthatch',
    'BHNU': 'Brown-headed Nuthatch',
    'EABL': 'Eastern Bluebird',
    'GRCA': 'Gray Catbird',
    'CACH': 'Carolina Chickadee',
    'BRCR': 'Brown Creeper',
    'BRTH': 'Brown Thrasher',
    'HETH': 'Hermit Thrush',
    'RSHA': 'Red-shouldered Hawk',
    'BEKI': 'Belted Kingfisher',
    'DOWO': 'Downy Woodpecker',
    'HAWO': 'Hairy Woodpecker',
    'RBWO': 'Red-bellied Woodpecker',
    'PIWO': 'Pileated Woodpecker',
    'YBSA': 'Yellow-bellied Sapsucker',
    'NOFL': 'Northern Flicker',
    'RHWO': 'Red-headed Woodpecker',
    'SOSP': 'Song Sparrow',
    'WTSP': 'White-throated Sparrow',
    'CHSP': 'Chipping Sparrow',
    'SWSP': 'Swamp Sparrow',
    'FISP': 'Field Sparrow',
    'SASP': 'Savannah Sparrow',
    'LISP': "Lincoln's Sparrow",
    **WARBLER_SPECIES
}


def main():
    clips_dir = Path('data/clips')
    clips_json = Path('data/clips.json')
    output_file = Path('data/new_clips.json')

    # Load existing clips.json
    existing_ids = set()
    if clips_json.exists():
        with open(clips_json) as f:
            clips = json.load(f)
            existing_ids = {c['clip_id'] for c in clips}
        print(f"Loaded {len(existing_ids)} existing clips from clips.json")
    else:
        print("No clips.json found, treating all clips as new")

    # Scan clips folder
    new_clips = []
    pattern = re.compile(r'^([A-Z]{4})_(\d+)\.wav$')

    for wav_file in sorted(clips_dir.glob('*.wav')):
        match = pattern.match(wav_file.name)
        if not match:
            continue

        species_code = match.group(1)
        xc_id = match.group(2)
        clip_id = f"{species_code}_{xc_id}"

        # Skip if already in clips.json
        if clip_id in existing_ids:
            continue

        # Skip if species not recognized
        if species_code not in ALL_SPECIES:
            print(f"  Warning: Unknown species code {species_code} in {wav_file.name}")
            continue

        new_clips.append({
            'clip_id': clip_id,
            'species_code': species_code,
            'common_name': ALL_SPECIES[species_code],
            'file_path': f"clips/{wav_file.name}",
            'vocalization_type': 'song',
            'duration_ms': 3000,  # Standard trimmed length
            'source': 'xeno-canto',
            'source_id': f"XC{xc_id}",
            'canonical': False,
            'rejected': False,
        })

    # Group by species for summary
    by_species = {}
    for clip in new_clips:
        code = clip['species_code']
        if code not in by_species:
            by_species[code] = []
        by_species[code].append(clip)

    # Write output
    with open(output_file, 'w') as f:
        json.dump(new_clips, f, indent=2)

    # Print summary
    print(f"\n=== Found {len(new_clips)} new clips across {len(by_species)} species ===\n")
    for code in sorted(by_species.keys()):
        clips_list = by_species[code]
        name = ALL_SPECIES.get(code, code)
        print(f"  {code}: {len(clips_list):2d} clips - {name}")

    print(f"\nManifest written to: {output_file}")
    print(f"Open data/review-warblers.html in browser to review")


if __name__ == '__main__':
    main()
