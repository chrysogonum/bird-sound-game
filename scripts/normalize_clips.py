#!/usr/bin/env python3
"""
Normalize clips.json to ensure schema compliance.

This script fixes common data inconsistencies:
- Copies species_name -> common_name (cornell clips)
- Ensures all required fields are present
- Validates field types and constraints

Run this BEFORE schema validation to auto-fix common issues.

Usage:
    python normalize_clips.py data/clips.json [--dry-run]
"""

import json
import sys
from typing import Any, Dict, List

# Required fields per schema
REQUIRED_FIELDS = [
    'clip_id',
    'species_code',
    'common_name',
    'vocalization_type',
    'duration_ms',
    'quality_score',
    'source',
    'source_id',
    'file_path'
]

# Legacy field mappings
LEGACY_MAPPINGS = {
    'species_name': 'common_name',
    'xeno_canto_id': 'source_id',
    'quality_rating': 'quality_score'
}


def normalize_clip(clip: Dict[str, Any], index: int) -> tuple[Dict[str, Any], List[str]]:
    """
    Normalize a single clip.

    Returns: (normalized_clip, list_of_changes)
    """
    changes = []

    # Apply legacy field mappings
    for old_field, new_field in LEGACY_MAPPINGS.items():
        if old_field in clip and new_field not in clip:
            clip[new_field] = clip[old_field]
            changes.append(f"Copied {old_field} → {new_field}: '{clip[new_field]}'")

    # Convert quality rating letter to score
    if 'quality_score' not in clip and 'quality' in clip:
        quality_letter = clip.get('quality')
        score_map = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1}
        if quality_letter in score_map:
            clip['quality_score'] = score_map[quality_letter]
            changes.append(f"Converted quality '{quality_letter}' → quality_score {clip['quality_score']}")

    # Generate clip_id if missing
    if 'clip_id' not in clip:
        # Try to derive from file_path
        if 'file_path' in clip:
            from pathlib import Path
            filename = Path(clip['file_path']).stem
            clip['clip_id'] = filename
            changes.append(f"Generated clip_id from file_path: '{filename}'")
        else:
            clip['clip_id'] = f"clip_{index}"
            changes.append(f"Generated fallback clip_id: 'clip_{index}'")

    # Ensure source_id exists
    if 'source_id' not in clip:
        # Derive from clip_id or source
        clip['source_id'] = clip.get('clip_id', f"{clip.get('source', 'unknown')}_{index}")
        changes.append(f"Generated source_id: '{clip['source_id']}'")

    # Normalize vocalization_type to valid schema values
    if 'vocalization_type' in clip:
        voc_type = clip['vocalization_type']
        # Valid types from schema
        valid_types = ["song", "call", "flight call", "alarm call", "chip", "drum", "wing sound", "rattle", "trill", "other"]

        # If already valid, keep it
        if voc_type in valid_types:
            pass  # No change needed
        else:
            # Try to map common variations
            voc_lower = voc_type.lower()
            if 'song' in voc_lower:
                normalized_type = 'song'
            elif 'flight' in voc_lower or 'flight-call' in voc_lower:
                normalized_type = 'flight call'
            elif 'alarm' in voc_lower:
                normalized_type = 'alarm call'
            elif 'chip' in voc_lower or 'chipping' in voc_lower:
                normalized_type = 'chip'
            elif 'drum' in voc_lower or 'drumming' in voc_lower:
                normalized_type = 'drum'
            elif 'wing' in voc_lower:
                normalized_type = 'wing sound'
            elif 'rattle' in voc_lower or 'rattling' in voc_lower:
                normalized_type = 'rattle'
            elif 'trill' in voc_lower:
                normalized_type = 'trill'
            elif 'call' in voc_lower:
                normalized_type = 'call'
            else:
                normalized_type = 'other'

            changes.append(f"Normalized vocalization_type '{voc_type}' → '{normalized_type}'")
            clip['vocalization_type'] = normalized_type

    # Set defaults for boolean fields
    if 'canonical' not in clip:
        clip['canonical'] = False

    if 'rejected' not in clip:
        clip['rejected'] = False

    return clip, changes


def normalize_clips(clips_path: str, dry_run: bool = False) -> None:
    """Normalize all clips in clips.json."""

    # Load clips
    with open(clips_path, 'r', encoding='utf-8') as f:
        clips = json.load(f)

    total_changes = 0
    clips_modified = 0

    # Process each clip
    for i, clip in enumerate(clips):
        normalized, changes = normalize_clip(clip, i)

        if changes:
            clips_modified += 1
            total_changes += len(changes)
            print(f"\n[Clip {i}] {clip.get('clip_id', 'unknown')}")
            for change in changes:
                print(f"  ✓ {change}")

    # Check for still-missing required fields
    print(f"\n{'=' * 60}")
    print("Checking for missing required fields...")
    missing_count = 0

    for i, clip in enumerate(clips):
        missing = [f for f in REQUIRED_FIELDS if f not in clip]
        if missing:
            missing_count += 1
            print(f"\n❌ [Clip {i}] {clip.get('clip_id', 'unknown')}")
            print(f"   Missing: {', '.join(missing)}")
            print(f"   Data: {json.dumps(clip, indent=4)}")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"📊 Summary:")
    print(f"   Total clips: {len(clips)}")
    print(f"   Clips modified: {clips_modified}")
    print(f"   Total changes: {total_changes}")
    print(f"   Clips still missing required fields: {missing_count}")

    # Save if not dry run
    if not dry_run and total_changes > 0:
        with open(clips_path, 'w', encoding='utf-8') as f:
            json.dump(clips, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Saved normalized clips to {clips_path}")
    elif dry_run:
        print(f"\n⚠️  DRY RUN - No changes saved")
    else:
        print(f"\n✓ No changes needed")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python normalize_clips.py <clips.json> [--dry-run]")
        sys.exit(1)

    clips_path = sys.argv[1]
    dry_run = '--dry-run' in sys.argv

    normalize_clips(clips_path, dry_run)
