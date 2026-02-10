#!/usr/bin/env python3
"""
Batch download Xeno-canto recordings for EU bird species.

For each species:
1. Searches XC API v3 using genus+species
2. Filters: quality A/B only, license CC BY-NC-SA or CC BY-SA only (rejects NC-ND)
3. Picks top 7 recordings (prefers mix of song + call)
4. Downloads MP3s to data/candidates_SPECIES/
5. Writes fresh .ingest_manifest.json with full metadata

Usage:
    python3 scripts/batch_download_xc.py [--species CODE] [--dry-run] [--max N]
"""

import argparse
import json
import glob
import os
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

API_BASE = 'https://xeno-canto.org/api/3/recordings'
DOWNLOAD_URL = 'https://xeno-canto.org/{id}/download'
HEADERS = {'User-Agent': 'ChipNotes/1.0'}
API_KEY = os.environ.get('XENO_CANTO_API_KEY', '')

TARGET_COUNT = 7  # recordings per species
ALLOWED_LICENSES = {'//creativecommons.org/licenses/by-nc-sa/4.0/',
                    '//creativecommons.org/licenses/by-sa/4.0/',
                    '//creativecommons.org/licenses/by-nc-sa/3.0/',
                    '//creativecommons.org/licenses/by-sa/3.0/',
                    '//creativecommons.org/licenses/by/4.0/',
                    '//creativecommons.org/licenses/by/3.0/',
                    '//creativecommons.org/publicdomain/zero/1.0/'}
BLOCKED_LICENSE_FRAGMENTS = ['nd']  # reject any license with "nd" (No Derivatives)
ALLOWED_QUALITIES = {'A', 'B'}


def load_eu_species():
    """Load all EU species codes from pack files."""
    species_data = {s['species_code']: s for s in json.load(open('data/species.json'))}
    eu_codes = set()
    for f in glob.glob('data/packs/eu_*.json'):
        pack = json.load(open(f))
        for sp in pack.get('species', []):
            code = sp['code'] if isinstance(sp, dict) else sp
            eu_codes.add(code)
    return eu_codes, species_data


def needs_download(code):
    """Check if species already has downloaded MP3s."""
    d = f'data/candidates_{code}'
    if not os.path.isdir(d):
        return True
    mp3s = glob.glob(os.path.join(d, '*.mp3'))
    return len(mp3s) == 0


def is_license_ok(lic):
    """Check if license is acceptable (not ND)."""
    if not lic:
        return False
    lic_lower = lic.lower()
    for blocked in BLOCKED_LICENSE_FRAGMENTS:
        if blocked in lic_lower:
            return False
    return True


def format_license(lic):
    """Format license string for display."""
    if not lic:
        return 'Unknown'
    if 'nc-sa' in lic.lower():
        return 'CC BY-NC-SA 4.0 \u2713'
    if 'by-sa' in lic.lower():
        return 'CC BY-SA 4.0 \u2713'
    if 'by/' in lic.lower() or lic.lower().endswith('/by'):
        return 'CC BY 4.0 \u2713'
    if 'zero' in lic.lower() or 'publicdomain' in lic.lower():
        return 'CC0 \u2713'
    return lic


def search_xc(genus, species_epithet):
    """Search XC API for recordings of a species."""
    query = f'gen:{genus}+sp:{species_epithet}'
    if API_KEY:
        query += f'&key={API_KEY}'
    url = f'{API_BASE}?query={query}'

    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f'    API error: {e}')
        return []

    recordings = data.get('recordings', [])
    return recordings


def select_recordings(recordings, target=TARGET_COUNT):
    """Filter and select best recordings: quality A/B, license-safe, mix of voc types."""
    # Filter by quality and license
    ok = []
    for r in recordings:
        q = r.get('q', '').strip()
        lic = r.get('lic', '')
        if q not in ALLOWED_QUALITIES:
            continue
        if not is_license_ok(lic):
            continue
        ok.append(r)

    if not ok:
        return []

    # Separate by vocalization type
    songs = [r for r in ok if 'song' in r.get('type', '').lower()]
    calls = [r for r in ok if 'call' in r.get('type', '').lower() and 'song' not in r.get('type', '').lower()]
    other = [r for r in ok if r not in songs and r not in calls]

    # Pick: prefer 4-5 songs, 2-3 calls, fill rest with other
    selected = []
    for s in songs[:5]:
        if len(selected) < target:
            selected.append(s)
    for c in calls[:3]:
        if len(selected) < target:
            selected.append(c)
    for o in other:
        if len(selected) < target:
            selected.append(o)
    # If still short, add more songs/calls
    for r in songs[5:] + calls[3:]:
        if len(selected) < target:
            selected.append(r)

    return selected[:target]


def download_recording(xc_id, dest_path):
    """Download an XC recording MP3."""
    url = DOWNLOAD_URL.format(id=xc_id)
    req = urllib.request.Request(url, headers=HEADERS)
    if API_KEY:
        url += f'?key={API_KEY}'
        req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
            with open(dest_path, 'wb') as f:
                f.write(data)
        return True
    except Exception as e:
        print(f'    Download failed XC{xc_id}: {e}')
        return False


def process_species(code, species_info, dry_run=False):
    """Search, select, download, and write manifest for one species."""
    sci_name = species_info.get('scientific_name', '')
    common_name = species_info.get('common_name', code)
    if not sci_name or ' ' not in sci_name:
        print(f'  SKIP {code}: no scientific name')
        return False

    parts = sci_name.split()
    genus = parts[0].lower()
    epithet = parts[1].lower()

    print(f'\n  {code} ({common_name} - {sci_name})')
    print(f'    Searching XC: gen:{genus}+sp:{epithet}')

    recordings = search_xc(genus, epithet)
    if not recordings:
        print(f'    No results from XC API')
        return False

    print(f'    Found {len(recordings)} total recordings')

    selected = select_recordings(recordings)
    if not selected:
        print(f'    No recordings pass quality/license filters!')
        return False

    # Show what we're getting
    lic_counts = {}
    type_counts = {}
    for r in selected:
        lic = format_license(r.get('lic', ''))
        lic_counts[lic] = lic_counts.get(lic, 0) + 1
        vtype = r.get('type', 'unknown')
        type_counts[vtype] = type_counts.get(vtype, 0) + 1

    print(f'    Selected {len(selected)}: {dict(type_counts)}')
    print(f'    Licenses: {dict(lic_counts)}')

    if dry_run:
        print(f'    [DRY RUN] Would download {len(selected)} recordings')
        return True

    # Create candidate directory
    cand_dir = Path(f'data/candidates_{code}')
    cand_dir.mkdir(exist_ok=True)

    # Download recordings
    manifest = []
    downloaded = 0
    for r in selected:
        xc_id = r['id']
        dest = cand_dir / f'XC{xc_id}_full.mp3'

        if dest.exists():
            print(f'    XC{xc_id} already exists, skipping download')
        else:
            print(f'    Downloading XC{xc_id}...', end=' ', flush=True)
            if download_recording(xc_id, dest):
                print('OK')
                downloaded += 1
            else:
                continue
            time.sleep(0.5)  # rate limiting

        manifest.append({
            'species_code': code,
            'species_name': common_name,
            'source': 'xenocanto',
            'source_id': f'XC{xc_id}',
            'recordist': r.get('rec', 'Unknown'),
            'vocalization_type': r.get('type', 'song'),
            'license': r.get('lic', ''),
            'quality': r.get('q', 'B'),
            'length': r.get('length', ''),
            'country': r.get('cnt', ''),
        })

    # Write manifest
    manifest_path = cand_dir / '.ingest_manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f'    Done: {downloaded} new downloads, {len(manifest)} in manifest')
    return True


def main():
    parser = argparse.ArgumentParser(description='Batch download XC recordings for EU species')
    parser.add_argument('--species', help='Process single species code')
    parser.add_argument('--dry-run', action='store_true', help='Search only, no downloads')
    parser.add_argument('--max', type=int, default=0, help='Max species to process (0=all)')
    parser.add_argument('--include-downloaded', action='store_true',
                        help='Re-process species that already have MP3s')
    args = parser.parse_args()

    eu_codes, species_data = load_eu_species()

    if args.species:
        codes = [args.species]
    else:
        codes = sorted(eu_codes)

    # Filter to ones needing downloads
    if not args.include_downloaded:
        codes = [c for c in codes if needs_download(c)]

    if args.max > 0:
        codes = codes[:args.max]

    print(f'Batch XC Download')
    print(f'  Species to process: {len(codes)}')
    print(f'  Target recordings per species: {TARGET_COUNT}')
    print(f'  Dry run: {args.dry_run}')
    print(f'  API key: {"set" if API_KEY else "NOT SET"}')

    if not API_KEY:
        print('\n  WARNING: No XENO_CANTO_API_KEY set. Requests may be rate-limited.')
        print('  Set it in ~/.zshrc: export XENO_CANTO_API_KEY=\'your-key\'')

    success = 0
    failed = 0
    for code in codes:
        sp = species_data.get(code)
        if not sp:
            print(f'\n  SKIP {code}: not in species.json')
            failed += 1
            continue
        if process_species(code, sp, dry_run=args.dry_run):
            success += 1
        else:
            failed += 1

    print(f'\n\nComplete: {success} succeeded, {failed} failed out of {len(codes)} species')


if __name__ == '__main__':
    main()
