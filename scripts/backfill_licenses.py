#!/usr/bin/env python3
"""
Backfill license information for existing Xeno-canto clips in clips.json.

This script queries the Xeno-canto API to fetch actual license information
for each clip and updates clips.json with the license field.
"""

import os
import json
import re
import urllib.request
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

def get_xc_license(xc_id: str, api_key: str) -> str:
    """Fetch license for a Xeno-canto recording."""
    try:
        url = f"https://xeno-canto.org/api/3/recordings?query=nr:{xc_id}&key={api_key}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        if data.get('recordings'):
            return data['recordings'][0].get('lic', 'unknown')
        return 'unknown'
    except Exception as e:
        print(f"  ERROR fetching XC{xc_id}: {e}")
        return 'error'


def main():
    # Check API key
    api_key = os.environ.get('XENO_CANTO_API_KEY', '')
    if not api_key:
        print("ERROR: XENO_CANTO_API_KEY not set")
        print("Run: source ~/.zshrc")
        return 1

    # Load clips.json
    clips_path = PROJECT_ROOT / 'data' / 'clips.json'
    print(f"Loading {clips_path}...")
    with open(clips_path, 'r') as f:
        clips = json.load(f)

    print(f"Total clips: {len(clips)}")

    # Find XC clips without license info
    xc_clips = []
    for clip in clips:
        if clip.get('source') == 'xenocanto' and clip.get('source_id'):
            # Extract XC number
            match = re.search(r'XC(\d+)', clip['source_id'])
            if match:
                xc_id = match.group(1)
                # Check if license already exists
                if not clip.get('license'):
                    xc_clips.append({
                        'clip': clip,
                        'xc_id': xc_id,
                        'species': clip.get('species_code'),
                        'clip_id': clip.get('clip_id')
                    })

    print(f"XC clips without license: {len(xc_clips)}")

    if not xc_clips:
        print("All XC clips already have license info!")
        return 0

    # Confirm before proceeding
    response = input(f"\nFetch licenses for {len(xc_clips)} clips from XC API? (y/n): ")
    if response.lower() != 'y':
        print("Aborted.")
        return 0

    # Create backup
    backup_path = PROJECT_ROOT / 'data' / 'clips.json.backup'
    print(f"\nCreating backup at {backup_path}...")
    with open(backup_path, 'w') as f:
        json.dump(clips, f, indent=2)

    # Fetch licenses
    print(f"\nFetching licenses from XC API...")
    license_counts = {}
    nd_clips = []  # Track No-Derivatives clips

    for i, item in enumerate(xc_clips):
        print(f"[{i+1}/{len(xc_clips)}] XC{item['xc_id']} ({item['species']})...", end=' ')

        license = get_xc_license(item['xc_id'], api_key)
        item['clip']['license'] = license
        license_counts[license] = license_counts.get(license, 0) + 1

        # Flag No-Derivatives licenses
        if 'nd' in license.lower():
            nd_clips.append({
                'clip_id': item['clip_id'],
                'species': item['species'],
                'xc_id': item['xc_id'],
                'license': license
            })
            print(f"⚠️  {license} (NO DERIVATIVES)")
        else:
            print(f"✓ {license}")

        # Rate limit: 100ms between requests
        time.sleep(0.1)

        # Progress update every 50 clips
        if (i + 1) % 50 == 0:
            print(f"\n--- Progress: {i+1}/{len(xc_clips)} ---")

    # Save updated clips.json
    print(f"\nSaving updated clips.json...")
    with open(clips_path, 'w') as f:
        json.dump(clips, f, indent=2)

    # Print summary
    print("\n" + "="*60)
    print("BACKFILL COMPLETE")
    print("="*60)
    print(f"\nLicense Distribution:")
    for lic, count in sorted(license_counts.items(), key=lambda x: -x[1]):
        print(f"  {lic}: {count}")

    # Warn about No-Derivatives clips
    if nd_clips:
        print(f"\n⚠️  WARNING: {len(nd_clips)} clips are BY-NC-ND (No Derivatives)")
        print("These clips do not allow modifications (trimming, normalization).")
        print("\nAffected clips:")
        for clip in nd_clips:
            print(f"  - {clip['clip_id']} ({clip['species']}) - XC{clip['xc_id']} - {clip['license']}")
        print("\nOptions:")
        print("  1. Replace with BY-NC-SA alternatives")
        print("  2. Contact recordists for permission")
        print("  3. Remove these clips")
        print("\nSee docs/Xeno-canto_Licensing.md for details")

    print(f"\nBackup saved at: {backup_path}")
    print(f"Updated: {clips_path}")

    return 0


if __name__ == '__main__':
    exit(main())
