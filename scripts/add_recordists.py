#!/usr/bin/env python3
"""
Fetch recordist names from Xeno-canto API and add them to clips.json
"""

import json
import re
import os
import time
import subprocess
from pathlib import Path

def get_xc_number(source_id):
    """Extract XC number from source_id, handling various formats"""
    if not source_id:
        return None

    # Try to extract number from formats like "XC316302" or "AMCR_667361"
    match = re.search(r'(\d+)', source_id)
    if match:
        return match.group(1)
    return None

def fetch_recordist(xc_number):
    """Fetch recordist name from Xeno-canto API"""
    try:
        # Use zsh to source environment and get API key
        cmd = f'source ~/.zshrc && curl -s "https://xeno-canto.org/api/3/recordings?query=nr:{xc_number}&key=${{XENO_CANTO_API_KEY}}"'
        result = subprocess.run(
            ['zsh', '-c', cmd],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"  ⚠️  Error fetching XC{xc_number}: {result.stderr}")
            return None

        data = json.loads(result.stdout)

        if data.get('numRecordings') == '0':
            print(f"  ⚠️  No recording found for XC{xc_number}")
            return None

        recordings = data.get('recordings', [])
        if recordings:
            recordist = recordings[0].get('rec')
            print(f"  ✓ XC{xc_number}: {recordist}")
            return recordist

        return None

    except subprocess.TimeoutExpired:
        print(f"  ⚠️  Timeout fetching XC{xc_number}")
        return None
    except json.JSONDecodeError:
        print(f"  ⚠️  Invalid JSON for XC{xc_number}")
        return None
    except Exception as e:
        print(f"  ⚠️  Error fetching XC{xc_number}: {e}")
        return None

def main():
    clips_path = Path(__file__).parent.parent / 'data' / 'clips.json'

    print("Loading clips.json...")
    with open(clips_path, 'r') as f:
        clips = json.load(f)

    # Find all xenocanto clips that need recordist info
    xc_clips = [c for c in clips if c.get('source') == 'xenocanto']
    print(f"\nFound {len(xc_clips)} Xeno-canto clips")

    # Build a map of XC numbers to recordists (to avoid duplicate API calls)
    xc_to_recordist = {}
    clips_to_update = []

    for clip in xc_clips:
        # Skip if already has recordist
        if clip.get('recordist'):
            continue

        xc_number = get_xc_number(clip.get('source_id'))
        if xc_number and xc_number not in xc_to_recordist:
            clips_to_update.append((clip, xc_number))
            xc_to_recordist[xc_number] = None  # Placeholder

    print(f"Need to fetch recordist info for {len(set(xc_number for _, xc_number in clips_to_update))} unique recordings")

    # Fetch recordists
    print("\nFetching recordist names from Xeno-canto API...")
    unique_xc_numbers = sorted(set(xc_number for _, xc_number in clips_to_update))

    for i, xc_number in enumerate(unique_xc_numbers, 1):
        print(f"[{i}/{len(unique_xc_numbers)}]", end=" ")
        recordist = fetch_recordist(xc_number)
        xc_to_recordist[xc_number] = recordist

        # Be respectful to the API - small delay between requests
        if i < len(unique_xc_numbers):
            time.sleep(0.5)

    # Update clips with recordist info
    print("\nUpdating clips with recordist information...")
    updated_count = 0
    for clip, xc_number in clips_to_update:
        recordist = xc_to_recordist.get(xc_number)
        if recordist:
            clip['recordist'] = recordist
            updated_count += 1

    # Write back to clips.json
    print(f"\nWriting {updated_count} updates to clips.json...")
    with open(clips_path, 'w') as f:
        json.dump(clips, f, indent=2)

    print(f"✓ Done! Updated {updated_count} clips with recordist information")

    # Summary
    missing = [xc for xc, rec in xc_to_recordist.items() if rec is None]
    if missing:
        print(f"\n⚠️  Could not fetch recordist for {len(missing)} recordings:")
        for xc in missing[:10]:
            print(f"  XC{xc}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

if __name__ == '__main__':
    main()
