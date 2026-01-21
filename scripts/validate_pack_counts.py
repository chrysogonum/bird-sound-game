#!/usr/bin/env python3
"""
Validate that hardcoded pack species counts in UI match pack JSON files.

This script checks:
1. PackSelect.tsx PACKS array speciesCount values
2. Help.tsx pack description text
3. Actual species counts in data/packs/*.json

Usage:
    python3 scripts/validate_pack_counts.py          # Check only
    python3 scripts/validate_pack_counts.py --fix    # Auto-fix mismatches
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, List, Tuple

PROJECT_ROOT = Path(__file__).parent.parent
PACKS_DIR = PROJECT_ROOT / "data" / "packs"
PACK_SELECT_TSX = PROJECT_ROOT / "src" / "ui-app" / "screens" / "PackSelect.tsx"
HELP_TSX = PROJECT_ROOT / "src" / "ui-app" / "screens" / "Help.tsx"

# Map pack IDs to their display names in UI
PACK_DISPLAY_NAMES = {
    'starter_birds': 'Eastern Backyard Birds',
    'expanded_backyard': 'Expanded Eastern Birds',
    'sparrows': 'Sparrows',
    'woodpeckers': 'Woodpeckers',
    'western_birds': 'Western Backyard Birds',
    'spring_warblers': 'Warbler Academy'
}

def get_pack_species_counts() -> Dict[str, int]:
    """Read actual species counts from pack JSON files."""
    counts = {}
    for pack_file in PACKS_DIR.glob("*.json"):
        with open(pack_file) as f:
            pack_data = json.load(f)
            pack_id = pack_data['pack_id']
            # Use display_species if available (for Bird Reference UI count)
            # Otherwise fall back to species array (for gameplay)
            if 'display_species' in pack_data:
                species_count = len(pack_data['display_species'])
            else:
                species_count = len(pack_data['species'])
            counts[pack_id] = species_count
    return counts

def extract_packselect_counts() -> Dict[str, int]:
    """Extract speciesCount values from PackSelect.tsx PACKS array."""
    with open(PACK_SELECT_TSX) as f:
        content = f.read()

    counts = {}
    # Find the PACKS array definition
    packs_match = re.search(r'const PACKS: Pack\[\] = \[(.*?)\];', content, re.DOTALL)
    if not packs_match:
        print("❌ Error: Could not find PACKS array in PackSelect.tsx")
        sys.exit(1)

    packs_text = packs_match.group(1)

    # Extract each pack object
    pack_pattern = r'\{\s*id:\s*[\'"](\w+)[\'"],.*?speciesCount:\s*(\d+),'
    for match in re.finditer(pack_pattern, packs_text, re.DOTALL):
        pack_id = match.group(1)
        count = int(match.group(2))
        counts[pack_id] = count

    return counts

def check_mismatches(actual: Dict[str, int], ui: Dict[str, int]) -> List[Tuple[str, int, int]]:
    """Find packs where UI count doesn't match actual count."""
    mismatches = []
    for pack_id, actual_count in actual.items():
        ui_count = ui.get(pack_id)
        if ui_count is None:
            print(f"⚠️  Warning: Pack '{pack_id}' found in JSON but not in UI")
            continue
        if ui_count != actual_count:
            mismatches.append((pack_id, actual_count, ui_count))
    return mismatches

def fix_packselect(pack_id: str, old_count: int, new_count: int) -> None:
    """Update speciesCount in PackSelect.tsx."""
    with open(PACK_SELECT_TSX) as f:
        content = f.read()

    # Find and replace the specific pack's speciesCount
    # Pattern: id: 'pack_id', ... speciesCount: NN,
    pattern = rf"(id:\s*'{pack_id}'[^}}]*speciesCount:\s*)(\d+)"

    def replace_count(match):
        if int(match.group(2)) == old_count:
            return match.group(1) + str(new_count)
        return match.group(0)

    new_content = re.sub(pattern, replace_count, content, flags=re.DOTALL)

    if new_content != content:
        with open(PACK_SELECT_TSX, 'w') as f:
            f.write(new_content)
        print(f"   ✓ Updated PackSelect.tsx: {pack_id} {old_count} → {new_count}")
    else:
        print(f"   ⚠️  Could not auto-fix PackSelect.tsx for {pack_id}")

def fix_help_description(pack_id: str, old_count: int, new_count: int) -> None:
    """Update pack description in Help.tsx if it contains species count."""
    with open(HELP_TSX) as f:
        content = f.read()

    # Get the display name for this pack
    display_name = PACK_DISPLAY_NAMES.get(pack_id)
    if not display_name:
        return

    # Look for patterns like "45 species" in the pack description
    # This is fragile but catches the main case
    pattern = rf'({display_name}.*?)({old_count})\s+species'

    matches = list(re.finditer(pattern, content, re.DOTALL | re.IGNORECASE))
    if matches:
        # Replace old count with new count
        new_content = re.sub(
            rf'({display_name}[^<]*?){old_count}(\s+species)',
            rf'\g<1>{new_count}\g<2>',
            content,
            flags=re.DOTALL | re.IGNORECASE
        )

        if new_content != content:
            with open(HELP_TSX, 'w') as f:
                f.write(new_content)
            print(f"   ✓ Updated Help.tsx: {display_name} {old_count} → {new_count} species")

def main():
    fix_mode = '--fix' in sys.argv

    print("🔍 Validating pack species counts...\n")

    # Get actual counts from pack JSON files
    actual_counts = get_pack_species_counts()
    print("📊 Actual pack species counts (from JSON files):")
    for pack_id, count in sorted(actual_counts.items()):
        display_name = PACK_DISPLAY_NAMES.get(pack_id, pack_id)
        print(f"   {display_name:30} {count} species")

    print()

    # Get UI counts from PackSelect.tsx
    ui_counts = extract_packselect_counts()
    print("📱 UI pack species counts (from PackSelect.tsx):")
    for pack_id, count in sorted(ui_counts.items()):
        display_name = PACK_DISPLAY_NAMES.get(pack_id, pack_id)
        print(f"   {display_name:30} {count} species")

    print()

    # Check for mismatches
    mismatches = check_mismatches(actual_counts, ui_counts)

    if not mismatches:
        print("✅ All pack counts match! UI is in sync with pack JSON files.\n")
        return 0

    print("❌ Found mismatches:\n")
    for pack_id, actual, ui in mismatches:
        display_name = PACK_DISPLAY_NAMES.get(pack_id, pack_id)
        print(f"   {display_name}:")
        print(f"      Pack JSON:      {actual} species")
        print(f"      PackSelect.tsx: {ui} species")
        print(f"      Difference:     {actual - ui:+d}")
        print()

    if fix_mode:
        print("🔧 Applying fixes...\n")
        for pack_id, actual, ui in mismatches:
            fix_packselect(pack_id, ui, actual)
            fix_help_description(pack_id, ui, actual)
        print("\n✅ Fixes applied! Please review the changes and commit.")
        return 0
    else:
        print("💡 Run with --fix to automatically update UI files:\n")
        print("   python3 scripts/validate_pack_counts.py --fix\n")
        return 1

if __name__ == '__main__':
    sys.exit(main())
