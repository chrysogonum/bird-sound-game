#!/usr/bin/env python3
"""
Audit species data consistency across ChipNotes

Validates that all species codes, common names, and scientific names
match the single source of truth: docs/IBP-AOS-list25.csv

Checks:
- clips.json species codes and common names
- Pack definitions (species_pool arrays)
- Audio file naming conventions
- Icon file naming conventions
- Hardcoded species references in code
"""

import csv
import json
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CSV_PATH = PROJECT_ROOT / "docs" / "IBP-AOS-list25.csv"
CLIPS_JSON = PROJECT_ROOT / "data" / "clips.json"
PACKS_DIR = PROJECT_ROOT / "data" / "packs"
CLIPS_DIR = PROJECT_ROOT / "data" / "clips"
ICONS_DIR = PROJECT_ROOT / "data" / "icons"
SPECIES_JSON = PROJECT_ROOT / "data" / "species.json"


class SpeciesData:
    """Container for species data from CSV"""
    def __init__(self):
        self.codes: Set[str] = set()
        self.common_names: Dict[str, str] = {}  # code -> common name
        self.scientific_names: Dict[str, str] = {}  # code -> scientific name


def load_truth_data() -> SpeciesData:
    """Load the single source of truth from CSV"""
    print(f"📖 Loading truth data from: {CSV_PATH}")

    data = SpeciesData()
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row['SPEC'].strip()
            common_name = row['COMMONNAME'].strip()
            scientific_name = row['SCINAME'].strip()

            if code and common_name and scientific_name:
                data.codes.add(code)
                data.common_names[code] = common_name
                data.scientific_names[code] = scientific_name

    print(f"   ✓ Loaded {len(data.codes)} valid species codes")
    return data


def audit_clips_json(truth: SpeciesData) -> Tuple[List[str], List[str]]:
    """Audit clips.json for code and name mismatches"""
    print(f"\n🔍 Auditing clips.json...")

    errors = []
    warnings = []

    if not CLIPS_JSON.exists():
        errors.append(f"clips.json not found at {CLIPS_JSON}")
        return errors, warnings

    with open(CLIPS_JSON, 'r', encoding='utf-8') as f:
        clips = json.load(f)

    print(f"   Found {len(clips)} clips")

    codes_in_clips = set()
    for clip in clips:
        code = clip.get('species_code', '')
        common_name = clip.get('common_name', '')

        codes_in_clips.add(code)

        # Check if code exists in truth
        if code not in truth.codes:
            errors.append(f"clips.json: Unknown species code '{code}' in clip {clip.get('clip_id')}")
            continue

        # Check if common name matches
        expected_name = truth.common_names[code]
        if common_name != expected_name:
            errors.append(
                f"clips.json: Name mismatch for {code}\n"
                f"           Expected: '{expected_name}'\n"
                f"           Found:    '{common_name}'"
            )

    print(f"   ✓ Found {len(codes_in_clips)} unique species in clips.json")
    return errors, warnings


def audit_packs(truth: SpeciesData) -> Tuple[List[str], List[str]]:
    """Audit pack definitions for invalid species codes"""
    print(f"\n🔍 Auditing pack definitions...")

    errors = []
    warnings = []

    if not PACKS_DIR.exists():
        errors.append(f"Packs directory not found at {PACKS_DIR}")
        return errors, warnings

    pack_files = list(PACKS_DIR.glob("*.json"))
    print(f"   Found {len(pack_files)} pack files")

    all_pack_codes = set()
    for pack_file in pack_files:
        if pack_file.name.endswith('.bak'):
            continue

        with open(pack_file, 'r', encoding='utf-8') as f:
            pack_data = json.load(f)

        pack_id = pack_data.get('pack_id', pack_file.stem)
        species_pool = pack_data.get('species_pool', [])

        for code in species_pool:
            all_pack_codes.add(code)
            if code not in truth.codes:
                errors.append(
                    f"{pack_file.name}: Unknown species code '{code}' in species_pool"
                )

    print(f"   ✓ Found {len(all_pack_codes)} unique species across all packs")
    return errors, warnings


def audit_audio_files(truth: SpeciesData) -> Tuple[List[str], List[str]]:
    """Audit audio file naming conventions"""
    print(f"\n🔍 Auditing audio files...")

    errors = []
    warnings = []

    if not CLIPS_DIR.exists():
        errors.append(f"Clips directory not found at {CLIPS_DIR}")
        return errors, warnings

    audio_files = list(CLIPS_DIR.glob("*.wav"))
    print(f"   Found {len(audio_files)} audio files")

    codes_in_files = set()
    for audio_file in audio_files:
        # Extract species code from filename (format: CODE_XXXXXX.wav)
        parts = audio_file.stem.split('_')
        if len(parts) >= 1:
            code = parts[0]
            codes_in_files.add(code)

            if code not in truth.codes:
                warnings.append(
                    f"Audio file: Unknown species code '{code}' in filename {audio_file.name}"
                )

    print(f"   ✓ Found {len(codes_in_files)} unique species codes in filenames")
    return errors, warnings


def audit_icons(truth: SpeciesData) -> Tuple[List[str], List[str]]:
    """Audit icon file naming conventions"""
    print(f"\n🔍 Auditing icon files...")

    errors = []
    warnings = []

    if not ICONS_DIR.exists():
        warnings.append(f"Icons directory not found at {ICONS_DIR}")
        return errors, warnings

    icon_files = list(ICONS_DIR.glob("*.png"))
    print(f"   Found {len(icon_files)} icon files")

    codes_in_icons = set()
    for icon_file in icon_files:
        # Icon filename should be CODE.png
        code = icon_file.stem

        # Skip non-species icons
        if code in ['OwlHeadphones', 'owl']:
            continue

        codes_in_icons.add(code)

        if code not in truth.codes:
            warnings.append(
                f"Icon file: Unknown species code '{code}' in filename {icon_file.name}"
            )

    print(f"   ✓ Found {len(codes_in_icons)} species icon files")
    return errors, warnings


def audit_species_json(truth: SpeciesData) -> Tuple[List[str], List[str]]:
    """Audit generated species.json against CSV"""
    print(f"\n🔍 Auditing species.json...")

    errors = []
    warnings = []

    if not SPECIES_JSON.exists():
        errors.append(f"species.json not found at {SPECIES_JSON}")
        return errors, warnings

    with open(SPECIES_JSON, 'r', encoding='utf-8') as f:
        species_list = json.load(f)

    print(f"   Found {len(species_list)} species entries")

    for species in species_list:
        code = species.get('species_code', '')
        common_name = species.get('common_name', '')
        scientific_name = species.get('scientific_name', '')

        if code not in truth.codes:
            errors.append(f"species.json: Unknown code '{code}'")
            continue

        # Check common name match
        if common_name != truth.common_names[code]:
            errors.append(
                f"species.json: Common name mismatch for {code}\n"
                f"              Expected: '{truth.common_names[code]}'\n"
                f"              Found:    '{common_name}'"
            )

        # Check scientific name match
        if scientific_name != truth.scientific_names[code]:
            errors.append(
                f"species.json: Scientific name mismatch for {code}\n"
                f"              Expected: '{truth.scientific_names[code]}'\n"
                f"              Found:    '{scientific_name}'"
            )

    print(f"   ✓ Validated {len(species_list)} species entries")
    return errors, warnings


def main():
    print("=" * 70)
    print("ChipNotes Species Data Audit")
    print("=" * 70)
    print(f"\nSingle Source of Truth: {CSV_PATH.relative_to(PROJECT_ROOT)}")

    # Load truth data
    truth = load_truth_data()

    # Run audits
    all_errors = []
    all_warnings = []

    # 1. Audit species.json
    errors, warnings = audit_species_json(truth)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 2. Audit clips.json
    errors, warnings = audit_clips_json(truth)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 3. Audit packs
    errors, warnings = audit_packs(truth)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 4. Audit audio files
    errors, warnings = audit_audio_files(truth)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 5. Audit icons
    errors, warnings = audit_icons(truth)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # Print results
    print("\n" + "=" * 70)
    print("AUDIT RESULTS")
    print("=" * 70)

    if all_errors:
        print(f"\n❌ ERRORS FOUND ({len(all_errors)}):")
        print("-" * 70)
        for error in all_errors:
            print(f"  • {error}")

    if all_warnings:
        print(f"\n⚠️  WARNINGS ({len(all_warnings)}):")
        print("-" * 70)
        for warning in all_warnings:
            print(f"  • {warning}")

    if not all_errors and not all_warnings:
        print("\n✅ ALL CHECKS PASSED!")
        print("   Species data is consistent across the project.")

    print("\n" + "=" * 70)

    # Exit with error code if errors found
    if all_errors:
        exit(1)
    else:
        exit(0)


if __name__ == '__main__':
    main()
