#!/usr/bin/env python3
"""
Audit license status of candidate recordings and identify replacements needed.

This script:
1. Reads all candidate manifests
2. Queries Xeno-canto API for license information
3. Identifies BY-NC-ND (No Derivatives) recordings
4. Generates a report of which recordings need replacement
5. Updates manifests with license information
"""

import json
import os
import urllib.request
from pathlib import Path
from collections import defaultdict
import time

PROJECT_ROOT = Path(__file__).parent.parent

def get_xc_license(xc_id: str, api_key: str) -> dict:
    """Query Xeno-canto API for recording metadata including license."""
    try:
        # Extract numeric ID from XC prefix
        numeric_id = xc_id.replace('XC', '').replace('xc', '')

        api_url = f"https://xeno-canto.org/api/3/recordings?query=nr:{numeric_id}"
        if api_key:
            api_url += f"&key={api_key}"

        req = urllib.request.Request(api_url, headers={'User-Agent': 'ChipNotes/1.0'})

        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

            if data.get('recordings'):
                rec = data['recordings'][0]
                return {
                    'license': rec.get('lic', ''),
                    'recordist': rec.get('rec', ''),
                    'quality': rec.get('q', ''),
                    'type': rec.get('type', ''),
                    'url': f"https://xeno-canto.org/{numeric_id}"
                }
    except Exception as e:
        print(f"  Warning: Failed to fetch XC{numeric_id}: {e}")

    return {}

def audit_candidates(update_manifests=False):
    """Audit all candidate recordings for license compatibility."""

    api_key = os.environ.get('XENO_CANTO_API_KEY', '')
    if not api_key:
        print("⚠️  Warning: XENO_CANTO_API_KEY not set. API requests may be rate-limited.")

    candidate_dirs = sorted((PROJECT_ROOT / "data").glob("candidates_*"))

    print(f"Found {len(candidate_dirs)} candidate directories\n")

    # Statistics
    total_recordings = 0
    recordings_checked = 0
    problematic_recordings = []
    species_summary = defaultdict(lambda: {
        'total': 0,
        'checked': 0,
        'problematic': [],
        'safe': []
    })

    for candidate_dir in candidate_dirs:
        manifest_path = candidate_dir / ".ingest_manifest.json"

        if not manifest_path.exists():
            print(f"⏭️  Skipping {candidate_dir.name} (no manifest)")
            continue

        species_code = candidate_dir.name.replace("candidates_", "")
        print(f"🔍 Checking {species_code}...")

        with open(manifest_path, 'r') as f:
            manifest = json.load(f)

        updated_manifest = []

        for rec in manifest:
            total_recordings += 1
            species_summary[species_code]['total'] += 1

            source_id = rec.get('source_id', '')

            if not source_id.startswith('XC'):
                updated_manifest.append(rec)
                continue

            # Query XC API for license
            xc_data = get_xc_license(source_id, api_key)
            recordings_checked += 1
            species_summary[species_code]['checked'] += 1

            if xc_data:
                # Update recording with license info
                rec['license'] = xc_data['license']
                rec['source_url'] = xc_data['url']

                # Check if problematic
                if 'nd' in xc_data['license'].lower():
                    problematic_recordings.append({
                        'species_code': species_code,
                        'xc_id': source_id,
                        'license': xc_data['license'],
                        'quality': xc_data.get('quality', rec.get('quality', 'Unknown')),
                        'recordist': xc_data.get('recordist', rec.get('recordist', 'Unknown')),
                        'file_path': rec.get('file_path', '')
                    })
                    species_summary[species_code]['problematic'].append(source_id)
                else:
                    species_summary[species_code]['safe'].append(source_id)

            updated_manifest.append(rec)

            # Rate limiting
            time.sleep(0.1)

        # Update manifest file if requested
        if update_manifests:
            with open(manifest_path, 'w') as f:
                json.dump(updated_manifest, f, indent=2)
            print(f"   ✓ Updated manifest with license data")

        print(f"   Total: {len(manifest)}, Checked: {recordings_checked}, Safe: {len(species_summary[species_code]['safe'])}, Problematic: {len(species_summary[species_code]['problematic'])}")

    # Print summary
    print("\n" + "="*80)
    print("📊 AUDIT SUMMARY")
    print("="*80)
    print(f"\nTotal candidate recordings: {total_recordings}")
    print(f"Successfully checked: {recordings_checked}")
    print(f"Problematic (BY-NC-ND): {len(problematic_recordings)}")
    print(f"Species affected: {sum(1 for s in species_summary.values() if s['problematic'])}")

    if problematic_recordings:
        print("\n" + "="*80)
        print("⚠️  RECORDINGS NEEDING REPLACEMENT")
        print("="*80)

        for species_code, data in sorted(species_summary.items()):
            if data['problematic']:
                print(f"\n📍 {species_code.upper()} ({len(data['problematic'])} of {data['total']} problematic):")

                # Find the problematic recordings for this species
                species_problems = [p for p in problematic_recordings if p['species_code'] == species_code]

                for prob in species_problems:
                    print(f"   ❌ {prob['xc_id']} - {prob['license']}")
                    print(f"      Quality: {prob['quality']}, Recordist: {prob['recordist']}")
                    print(f"      File: {prob['file_path']}")

                print(f"   ✅ Safe recordings: {len(data['safe'])}")

        print("\n" + "="*80)
        print("🔧 RECOMMENDED ACTIONS")
        print("="*80)
        print("\nFor each species with problematic recordings:")
        print("1. Delete the problematic WAV files from candidates folder")
        print("2. Update the .ingest_manifest.json to remove those entries")
        print("3. Use clip_editor.py --search to find replacement recordings:")
        print("   python3 scripts/clip_editor.py --search \"Species Name\" --region eu")
        print("4. Look for recordings with BY-NC-SA or BY-SA licenses")
        print("5. Download replacements using clip_editor.py batch mode")

        # Generate deletion commands
        print("\n" + "="*80)
        print("📝 DELETION COMMANDS (review before running!)")
        print("="*80)
        print("\n# Delete problematic recordings:")
        for prob in problematic_recordings:
            if prob['file_path'] and Path(prob['file_path']).exists():
                print(f"rm '{prob['file_path']}'  # {prob['xc_id']} - {prob['license']}")

    else:
        print("\n✅ No problematic licenses found! All candidate recordings are compatible.")

    return species_summary, problematic_recordings

if __name__ == '__main__':
    import sys

    update_manifests = '--update' in sys.argv

    if update_manifests:
        print("🔄 Will update manifest files with license information\n")
    else:
        print("📖 Read-only mode (use --update to write license data to manifests)\n")

    audit_candidates(update_manifests=update_manifests)
