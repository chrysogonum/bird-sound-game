#!/usr/bin/env python3
"""
Safely merge candidate clips from a candidates folder into clips.json.

This script:
1. Loads existing clips.json (preserves ALL existing data)
2. Loads candidate manifest.json
3. Appends new clips to clips.json (NEVER overwrites)
4. Creates backup before saving
5. Validates no data loss occurred

Usage:
    python3 scripts/merge_candidates.py data/candidates_WEVI
"""

import json
import sys
import shutil
from pathlib import Path
from typing import List, Dict, Any

def merge_candidates(candidates_dir: str) -> None:
    """Safely merge candidates into clips.json"""

    PROJECT_ROOT = Path(__file__).parent.parent
    CLIPS_JSON = PROJECT_ROOT / "data" / "clips.json"
    BACKUP_JSON = PROJECT_ROOT / "data" / "clips.json.backup"

    candidates_path = Path(candidates_dir)
    manifest_path = candidates_path / "manifest.json"

    # Validate inputs
    if not candidates_path.exists():
        print(f"❌ Error: Candidates directory not found: {candidates_dir}")
        sys.exit(1)

    if not manifest_path.exists():
        print(f"❌ Error: manifest.json not found in {candidates_dir}")
        sys.exit(1)

    # Load existing clips.json
    print(f"📖 Loading existing clips.json...")
    with open(CLIPS_JSON) as f:
        existing_clips = json.load(f)

    original_count = len(existing_clips)
    print(f"   Found {original_count} existing clips")

    # Load candidate manifest
    print(f"📖 Loading candidate manifest from {candidates_dir}...")
    with open(manifest_path) as f:
        candidates = json.load(f)

    print(f"   Found {len(candidates)} candidate clips")

    # Create backup
    print(f"💾 Creating backup at {BACKUP_JSON}...")
    shutil.copy(CLIPS_JSON, BACKUP_JSON)

    # Build new clip entries (matching the schema)
    new_clips = []
    for candidate in candidates:
        # Extract filename from candidate path
        filename = Path(candidate['file_path']).name

        # Derive species code from filename (assumes XXXX_*.wav format)
        species_code = filename.split('_')[0]

        clip_entry = {
            'clip_id': candidate.get('source_id', '').replace('XC', f'{species_code}_'),
            'species_code': species_code,
            'common_name': candidate['species_name'],
            'file_path': f"data/clips/{filename}",
            'vocalization_type': candidate.get('vocalization_type', 'song'),
            'duration_ms': candidate['duration_ms'],
            'loudness_lufs': candidate['loudness_lufs'],
            'quality_score': 5,  # Default to A rating, user can adjust in review tool
            'source': 'xenocanto',
            'source_id': candidate.get('source_id', ''),
            'recordist': candidate.get('recordist', ''),
            'canonical': False,  # User must mark canonical in review tool
            'rejected': False
        }
        new_clips.append(clip_entry)

    # CRITICAL: Append to existing clips (never replace!)
    merged_clips = existing_clips + new_clips

    # Safety check: Ensure we didn't lose any clips
    if len(merged_clips) < original_count:
        print(f"❌ FATAL ERROR: Clip count decreased from {original_count} to {len(merged_clips)}")
        print(f"   This should NEVER happen. Aborting without saving.")
        sys.exit(1)

    # Save merged clips
    print(f"💾 Saving merged clips to {CLIPS_JSON}...")
    with open(CLIPS_JSON, 'w') as f:
        json.dump(merged_clips, f, indent=2)

    added_count = len(new_clips)
    final_count = len(merged_clips)

    print(f"\n✅ Success!")
    print(f"   Before: {original_count} clips")
    print(f"   Added:  {added_count} clips")
    print(f"   After:  {final_count} clips")
    print(f"\n📝 Next steps:")
    print(f"   1. Run: python3 scripts/spectrogram_gen.py --input data/clips --output data/spectrograms")
    print(f"   2. Review clips: python3 scripts/review_clips.py --filter {species_code}")
    print(f"   3. Mark canonical clip and adjust quality/vocalization types")
    print(f"   4. Commit: git add data/clips.json data/clips/{species_code}_*.wav data/spectrograms/{species_code}_*.png")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/merge_candidates.py data/candidates_XXXX")
        sys.exit(1)

    merge_candidates(sys.argv[1])
