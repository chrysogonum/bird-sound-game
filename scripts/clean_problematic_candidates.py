#!/usr/bin/env python3
"""
Clean problematic (BY-NC-ND) candidate recordings.

For species that haven't been extracted yet, this script:
1. Checks license status of all candidate recordings
2. Deletes files with BY-NC-ND licenses
3. Updates manifests to remove deleted recordings
4. Generates a list of species needing replacement downloads
"""

import json
import os
import urllib.request
from pathlib import Path
import time

PROJECT_ROOT = Path(__file__).parent.parent

def get_xc_license(xc_id: str, api_key: str) -> str:
    """Query Xeno-canto API for license."""
    try:
        numeric_id = xc_id.replace('XC', '').replace('xc', '')
        api_url = f"https://xeno-canto.org/api/3/recordings?query=nr:{numeric_id}"
        if api_key:
            api_url += f"&key={api_key}"

        req = urllib.request.Request(api_url, headers={'User-Agent': 'ChipNotes/1.0'})

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get('recordings'):
                return data['recordings'][0].get('lic', '')
    except Exception as e:
        print(f"  ⚠️  Failed to fetch {xc_id}: {e}")

    return ''

def get_species_with_no_extractions():
    """Get list of species codes that have candidates but no extracted clips."""
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"

    # Get all species with extracted clips
    extracted_species = set()
    if clips_json_path.exists():
        with open(clips_json_path, 'r') as f:
            clips = json.load(f)
            extracted_species = {c['species_code'] for c in clips}

    # Get all species with candidates
    candidate_dirs = list((PROJECT_ROOT / "data").glob("candidates_*"))
    candidate_species = {d.name.replace("candidates_", "") for d in candidate_dirs}

    # Species with candidates but no extractions
    not_extracted = candidate_species - extracted_species

    return not_extracted

def clean_candidates(dry_run=True):
    """Clean problematic candidates and update manifests."""

    api_key = os.environ.get('XENO_CANTO_API_KEY', '')

    # Get species that haven't been extracted yet
    not_extracted = get_species_with_no_extractions()

    print(f"Found {len(not_extracted)} species with candidates but no extracted clips\n")

    if not not_extracted:
        print("✅ All species with candidates have been extracted from!")
        return

    total_deleted = 0
    total_kept = 0
    species_needing_downloads = []

    for species_code in sorted(not_extracted):
        candidate_dir = PROJECT_ROOT / "data" / f"candidates_{species_code}"
        manifest_path = candidate_dir / ".ingest_manifest.json"

        if not manifest_path.exists():
            continue

        print(f"🔍 Checking {species_code.upper()}...")

        with open(manifest_path, 'r') as f:
            manifest = json.load(f)

        cleaned_manifest = []
        deleted_count = 0

        for rec in manifest:
            source_id = rec.get('source_id', '')

            if not source_id.startswith('XC'):
                cleaned_manifest.append(rec)
                continue

            # Check license
            license_type = get_xc_license(source_id, api_key)
            time.sleep(0.1)  # Rate limiting

            if 'nd' in license_type.lower():
                # Problematic license
                file_path = Path(rec.get('file_path', ''))

                print(f"   ❌ {source_id} - {license_type} - DELETING")

                if not dry_run and file_path.exists():
                    file_path.unlink()
                    print(f"      Deleted: {file_path.name}")

                deleted_count += 1
                total_deleted += 1
            else:
                # Safe license
                print(f"   ✅ {source_id} - {license_type} - keeping")
                cleaned_manifest.append(rec)
                total_kept += 1

        # Update manifest
        if deleted_count > 0:
            species_needing_downloads.append({
                'code': species_code,
                'deleted': deleted_count,
                'remaining': len(cleaned_manifest)
            })

            if not dry_run:
                with open(manifest_path, 'w') as f:
                    json.dump(cleaned_manifest, f, indent=2)
                print(f"   ✓ Updated manifest: {len(cleaned_manifest)} recordings remaining")

        print()

    # Summary
    print("="*80)
    print("📊 SUMMARY")
    print("="*80)
    print(f"\nTotal problematic recordings: {total_deleted}")
    print(f"Total safe recordings kept: {total_kept}")
    print(f"Species needing new downloads: {len(species_needing_downloads)}")

    if species_needing_downloads:
        print("\n" + "="*80)
        print("📝 SPECIES NEEDING REPLACEMENT DOWNLOADS")
        print("="*80)

        for sp in species_needing_downloads:
            print(f"\n{sp['code'].upper()}: {sp['deleted']} deleted, {sp['remaining']} remaining")
            print(f"   Need to download {max(0, 10 - sp['remaining'])} more compatible recordings")

        print("\n" + "="*80)
        print("🔧 NEXT STEPS")
        print("="*80)
        print("\nFor each species above, use clip_editor.py to download replacements:")
        print("1. Search for recordings with BY-SA or BY-NC-SA licenses")
        print("2. Avoid BY-NC-ND licenses")
        print("3. Target 8-10 high-quality recordings per species\n")

        for sp in species_needing_downloads:
            # Get species name from manifest
            candidate_dir = PROJECT_ROOT / "data" / f"candidates_{sp['code']}"
            manifest_path = candidate_dir / ".ingest_manifest.json"
            species_name = sp['code']

            if manifest_path.exists():
                with open(manifest_path, 'r') as f:
                    manifest = json.load(f)
                    if manifest:
                        species_name = manifest[0].get('species_name', sp['code'])

            print(f'python3 scripts/clip_editor.py --search "{species_name}" --region eu')

    if dry_run:
        print("\n" + "="*80)
        print("🔒 DRY RUN MODE - No files were actually deleted")
        print("="*80)
        print("\nRe-run with --delete flag to actually delete files:")
        print("python3 scripts/clean_problematic_candidates.py --delete")

if __name__ == '__main__':
    import sys

    dry_run = '--delete' not in sys.argv

    if dry_run:
        print("🔍 DRY RUN MODE - Will show what would be deleted (no actual changes)\n")
    else:
        print("⚠️  DELETE MODE - Will actually delete problematic files\n")
        response = input("Are you sure you want to delete problematic candidates? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            exit(0)
        print()

    clean_candidates(dry_run=dry_run)
