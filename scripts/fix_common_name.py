#!/usr/bin/env python3
"""
Fix missing common_name fields in clips.json.
Cornell clips use 'species_name' instead of 'common_name'.
This script copies species_name to common_name for affected clips.
"""

import json
import sys

def fix_common_names(clips_path: str) -> None:
    """Fix missing common_name fields by copying from species_name."""

    # Load clips
    with open(clips_path, 'r', encoding='utf-8') as f:
        clips = json.load(f)

    # Track changes
    fixed_count = 0
    affected_species = set()

    # Fix each clip
    for clip in clips:
        # If clip has species_name but no common_name, copy it over
        if 'species_name' in clip and 'common_name' not in clip:
            clip['common_name'] = clip['species_name']
            fixed_count += 1
            affected_species.add(clip['species_code'])
            print(f"Fixed {clip.get('clip_id', clip.get('file_path'))}: {clip['species_name']}")

    # Save updated clips
    with open(clips_path, 'w', encoding='utf-8') as f:
        json.dump(clips, f, indent=2, ensure_ascii=False)

    # Report
    print(f"\n✅ Fixed {fixed_count} clips")
    print(f"📊 Affected {len(affected_species)} species: {sorted(affected_species)}")

if __name__ == '__main__':
    clips_path = sys.argv[1] if len(sys.argv) > 1 else 'data/clips.json'
    fix_common_names(clips_path)
