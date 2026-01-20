#!/usr/bin/env python3
"""
Migrate outdated species codes to match IBP-AOS-list25.csv (2025 taxonomy)

Code migrations:
- AMGO → AGOL (American Goldfinch)
- CEWA → CEDW (Cedar Waxwing)
- SASP → SAVS (Savannah Sparrow)
- WESJ → CASJ (California Scrub-Jay - Western Scrub-Jay was split)
- EWPE → EAWP (Eastern Wood-Pewee)

Name fix:
- YRWA: "Myrtle Warbler" → "Yellow-rumped Warbler"

This updates:
- clips.json
- Audio file names
- Spectrogram file names
- Icon file names
- Pack definitions
"""

import json
import shutil
from pathlib import Path
from typing import Dict

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CLIPS_JSON = PROJECT_ROOT / "data" / "clips.json"
CLIPS_DIR = PROJECT_ROOT / "data" / "clips"
SPECTROGRAMS_DIR = PROJECT_ROOT / "data" / "spectrograms"
ICONS_DIR = PROJECT_ROOT / "data" / "icons"
PACKS_DIR = PROJECT_ROOT / "data" / "packs"

# Code migrations
CODE_MIGRATIONS = {
    'AMGO': 'AGOL',  # American Goldfinch
    'CEWA': 'CEDW',  # Cedar Waxwing
    'SASP': 'SAVS',  # Savannah Sparrow
    'WESJ': 'CASJ',  # California Scrub-Jay (was Western Scrub-Jay)
    'EWPE': 'EAWP',  # Eastern Wood-Pewee
}

# Name fixes
NAME_FIXES = {
    'YRWA': 'Yellow-rumped Warbler',  # Was "Myrtle Warbler"
    'CASJ': 'California Scrub-Jay',   # Was "Western Scrub-Jay" (taxonomic split)
}


def migrate_clips_json():
    """Update clips.json with new codes and names"""
    print(f"\n📝 Migrating clips.json...")

    with open(CLIPS_JSON, 'r', encoding='utf-8') as f:
        clips = json.load(f)

    changes_made = 0
    for clip in clips:
        old_code = clip.get('species_code', '')

        # Migrate code
        if old_code in CODE_MIGRATIONS:
            new_code = CODE_MIGRATIONS[old_code]
            print(f"   {clip['clip_id']}: {old_code} → {new_code}")
            clip['species_code'] = new_code

            # Update clip_id if it starts with old code
            if clip['clip_id'].startswith(old_code):
                clip['clip_id'] = clip['clip_id'].replace(old_code, new_code, 1)

            # Update file_path if it contains old code
            if old_code in clip['file_path']:
                clip['file_path'] = clip['file_path'].replace(old_code, new_code)

            changes_made += 1

    # Fix names (do this in a second pass after all codes are migrated)
    for clip in clips:
        current_code = clip.get('species_code', '')
        if current_code in NAME_FIXES:
            old_name = clip.get('common_name', '')
            new_name = NAME_FIXES[current_code]
            if old_name != new_name:
                print(f"   {clip['clip_id']}: '{old_name}' → '{new_name}'")
                clip['common_name'] = new_name
                changes_made += 1

    # Backup original
    backup_path = CLIPS_JSON.with_suffix('.json.backup')
    shutil.copy(CLIPS_JSON, backup_path)
    print(f"   ✓ Backed up to {backup_path.name}")

    # Write updated clips.json
    with open(CLIPS_JSON, 'w', encoding='utf-8') as f:
        json.dump(clips, f, indent=2, ensure_ascii=False)

    print(f"   ✓ Updated {changes_made} clips")


def migrate_files(directory: Path, extension: str, file_type: str):
    """Rename files with old codes to new codes"""
    print(f"\n📂 Migrating {file_type} files...")

    if not directory.exists():
        print(f"   ⚠ Directory not found: {directory}")
        return

    files = list(directory.glob(f"*{extension}"))
    renamed = 0

    for file_path in files:
        # Check if filename starts with any old code
        for old_code, new_code in CODE_MIGRATIONS.items():
            if file_path.name.startswith(old_code):
                new_name = file_path.name.replace(old_code, new_code, 1)
                new_path = file_path.parent / new_name

                print(f"   {file_path.name} → {new_name}")
                file_path.rename(new_path)
                renamed += 1
                break

    print(f"   ✓ Renamed {renamed} {file_type} files")


def migrate_packs():
    """Update pack definitions with new codes"""
    print(f"\n📦 Migrating pack definitions...")

    if not PACKS_DIR.exists():
        print(f"   ⚠ Directory not found: {PACKS_DIR}")
        return

    pack_files = list(PACKS_DIR.glob("*.json"))
    if not pack_files:
        pack_files = []  # No packs to migrate

    changes_made = 0
    for pack_file in pack_files:
        if pack_file.name.endswith('.bak'):
            continue

        with open(pack_file, 'r', encoding='utf-8') as f:
            pack_data = json.load(f)

        species_pool = pack_data.get('species_pool', [])
        updated_pool = []
        pack_changed = False

        for code in species_pool:
            if code in CODE_MIGRATIONS:
                new_code = CODE_MIGRATIONS[code]
                print(f"   {pack_file.name}: {code} → {new_code}")
                updated_pool.append(new_code)
                pack_changed = True
                changes_made += 1
            else:
                updated_pool.append(code)

        if pack_changed:
            # Backup original
            backup_path = pack_file.with_suffix('.json.bak')
            shutil.copy(pack_file, backup_path)

            # Update pack
            pack_data['species_pool'] = updated_pool
            with open(pack_file, 'w', encoding='utf-8') as f:
                json.dump(pack_data, f, indent=2, ensure_ascii=False)

    print(f"   ✓ Updated {changes_made} codes across {len(pack_files)} packs")


def main():
    print("=" * 70)
    print("ChipNotes Species Code Migration")
    print("=" * 70)
    print("\nMigrating to 2025 AOS/IBP taxonomy codes...")
    print("\nCode migrations:")
    for old, new in CODE_MIGRATIONS.items():
        print(f"  • {old} → {new}")

    print("\nName fixes:")
    for code, name in NAME_FIXES.items():
        print(f"  • {code}: → '{name}'")

    # Run migrations
    migrate_clips_json()
    migrate_files(CLIPS_DIR, ".wav", "audio")
    migrate_files(SPECTROGRAMS_DIR, ".png", "spectrogram")
    migrate_files(ICONS_DIR, ".png", "icon")
    migrate_packs()

    print("\n" + "=" * 70)
    print("✅ MIGRATION COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Run: make generate-species-data")
    print("  2. Run: python3 scripts/audit_species_data.py")
    print("  3. Test the game to ensure all species work correctly")
    print("  4. Commit changes with migration message")


if __name__ == '__main__':
    main()
