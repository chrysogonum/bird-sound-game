#!/usr/bin/env python3
"""
Augment existing species with additional clips from Xeno-canto.

Downloads new candidate clips for review, excluding clips we already have.
Processes audio (normalize, trim) and generates spectrograms.
Adds to clips.json for manual review via review_clips.py.

⚠️  REQUIRED CLIP FIELDS (must be set for all clips):
    - clip_id: Unique identifier (e.g., "CEWA_1056063")
    - duration_ms: Duration in milliseconds (calculated from audio)
    - source_id: Xeno-canto ID (e.g., "XC1056063")
    All other fields per schemas/clip.schema.json
"""

import json
import os
import sys
import subprocess
from pathlib import Path
from typing import List, Dict
import requests
import numpy as np
from scipy import signal
from scipy.io import wavfile
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).parent.parent
CLIPS_JSON = PROJECT_ROOT / 'data' / 'clips.json'
CLIPS_DIR = PROJECT_ROOT / 'data' / 'clips'
SPEC_DIR = PROJECT_ROOT / 'data' / 'spectrograms'
REJECTED_XC_IDS_PATH = PROJECT_ROOT / 'data' / 'rejected_xc_ids.json'

# Xeno-canto API
XC_API_BASE = 'https://xeno-canto.org/api/3/recordings'

# Species code to scientific name mapping (for Xeno-canto API v3)
SPECIES_SCIENTIFIC_NAMES = {
    'CEWA': ('Bombycilla', 'cedrorum'),
    'YRWA': ('Setophaga', 'coronata'),
    'OCWA': ('Leiothlypis', 'celata'),
    # Add more as needed
}


def load_existing_xc_ids(species_code: str) -> List[str]:
    """Load all existing Xeno-canto IDs for a species (active + rejected)."""
    xc_ids = []

    # Load from active clips
    with open(CLIPS_JSON) as f:
        clips = json.load(f)
    xc_ids.extend([
        c.get('xeno_canto_id')
        for c in clips
        if c.get('species_code') == species_code and c.get('xeno_canto_id')
    ])

    # Load from rejection log
    if REJECTED_XC_IDS_PATH.exists():
        with open(REJECTED_XC_IDS_PATH, 'r') as f:
            rejection_log = json.load(f)
        if species_code in rejection_log:
            xc_ids.extend(rejection_log[species_code])

    return list(set(xc_ids))  # Dedupe and return


def search_xeno_canto(species_code: str, quality: str = 'A', limit: int = 50, country: str = 'US') -> List[Dict]:
    """Search Xeno-canto for recordings."""
    # Get API key from environment (required for API v3)
    api_key = os.environ.get('XENO_CANTO_API_KEY', '')
    if not api_key:
        print("✗ XENO_CANTO_API_KEY not set in environment")
        return []

    # Get scientific name
    if species_code not in SPECIES_SCIENTIFIC_NAMES:
        print(f"✗ Species code {species_code} not in SPECIES_SCIENTIFIC_NAMES mapping")
        print(f"   Add it to the script: ('Genus', 'species')")
        return []

    genus, species = SPECIES_SCIENTIFIC_NAMES[species_code]

    # Build query - API v3 uses gen: and sp: instead of common names
    query = f'gen:{genus} sp:{species} q:{quality}'

    print(f"🔍 Searching Xeno-canto API v3: {query}")

    params = {'query': query, 'key': api_key}

    try:
        response = requests.get(XC_API_BASE, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        all_recordings = data.get('recordings', [])
        print(f"✓ Found {data.get('numRecordings', 0)} total recordings")

        # Filter by country if specified (API v3 cnt: filter doesn't work)
        if country:
            country_map = {'US': 'United States', 'CA': 'Canada'}
            country_name = country_map.get(country, country)
            recordings = [r for r in all_recordings if r.get('cnt') == country_name]
            print(f"  Filtered to {len(recordings)} from {country_name}")
        else:
            recordings = all_recordings

        return recordings[:limit]
    except Exception as e:
        print(f"✗ Xeno-canto search failed: {e}")
        return []


def generate_spectrogram(wav_path: Path, output_path: Path):
    """Generate spectrogram PNG from WAV file.

    Uses EXACT same settings as spectrogram_gen.py for consistency.
    """
    # EXACT settings from spectrogram_gen.py
    config = {
        'n_fft': 1024,
        'hop_length': 256,
        'freq_min': 500,  # Filter out low noise
        'freq_max': 10000,
        'figsize': (4, 2),
        'dpi': 100,
        'cmap': 'magma',
    }

    # Read WAV file
    sample_rate, samples = wavfile.read(wav_path)

    # Generate spectrogram with exact same settings
    frequencies, times, Sxx = signal.spectrogram(
        samples,
        fs=sample_rate,
        nperseg=config['n_fft'],
        noverlap=config['n_fft'] - config['hop_length'],
        scaling='density'
    )

    # Convert to dB scale
    Sxx_db = 10 * np.log10(Sxx + 1e-10)

    # Filter frequency range
    freq_mask = (frequencies >= config['freq_min']) & (frequencies <= config['freq_max'])
    frequencies_filtered = frequencies[freq_mask]
    Sxx_filtered = Sxx_db[freq_mask, :]

    # Normalize using percentiles (CRITICAL for consistent brightness)
    vmin = np.percentile(Sxx_filtered, 5)
    vmax = np.percentile(Sxx_filtered, 95)

    # Create figure
    fig, ax = plt.subplots(figsize=config['figsize'])

    # Plot spectrogram
    ax.pcolormesh(
        times,
        frequencies_filtered,
        Sxx_filtered,
        shading='gouraud',
        cmap=config['cmap'],
        vmin=vmin,
        vmax=vmax
    )

    # Remove axes for clean game display
    ax.axis('off')

    # Remove margins (DO NOT use plt.subplots_adjust - breaks spectrograms!)
    plt.tight_layout(pad=0)
    plt.savefig(
        output_path,
        dpi=config['dpi'],
        bbox_inches='tight',
        pad_inches=0,
        transparent=False,
        facecolor='black'
    )
    plt.close()


def download_and_process_clip(recording: Dict, species_code: str) -> Dict:
    """Download, normalize, and generate spectrogram for a clip."""
    xc_id = recording['id']
    file_url = recording['file']

    # Download paths
    temp_file = CLIPS_DIR / f'{species_code}_{xc_id}_temp.mp3'
    output_file = CLIPS_DIR / f'{species_code}_{xc_id}.wav'
    spec_file = SPEC_DIR / f'{species_code}_{xc_id}.png'

    print(f"  📥 Downloading XC{xc_id}...")

    try:
        # Download MP3
        response = requests.get(file_url, timeout=30)
        response.raise_for_status()
        with open(temp_file, 'wb') as f:
            f.write(response.content)

        # Convert to WAV, normalize to -16 LUFS, trim to 0.5-3.0s
        subprocess.run([
            'ffmpeg', '-i', str(temp_file),
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-ac', '1',  # Mono
            '-ar', '44100',
            '-t', '3.0',  # Max 3 seconds
            '-y',
            str(output_file)
        ], check=True, capture_output=True)

        # Clean up temp file
        temp_file.unlink()

        # Get duration
        result = subprocess.run([
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(output_file)
        ], capture_output=True, text=True, check=True)

        duration = float(result.stdout.strip())

        # Skip if too short
        if duration < 0.5:
            print(f"    ⚠️  Too short ({duration:.2f}s), skipping")
            output_file.unlink()
            return None

        # Generate spectrogram
        generate_spectrogram(output_file, spec_file)

        print(f"    ✓ Processed ({duration:.2f}s)")

        # Build clip metadata
        clip_id = f'{species_code}_{xc_id}'
        clip = {
            'clip_id': clip_id,                # REQUIRED: Unique identifier
            'species_code': species_code,
            'species_name': recording.get('en', 'Unknown'),
            'file_path': f'data/clips/{clip_id}.wav',
            'xeno_canto_id': xc_id,
            'vocalization_type': recording.get('type', 'unknown').lower(),
            'quality_rating': recording.get('q', 'C'),
            'canonical': False,
            'rejected': False,
            'spectrogram_path': f'data/spectrograms/{clip_id}.png',
            'common_name': recording.get('en', 'Unknown'),
            'quality_score': 4 if recording.get('q') == 'A' else 3,
            'source': 'xenocanto',
            'source_id': f'XC{xc_id}',         # Fixed: was 'sourceId'
            'duration_ms': int(duration * 1000),  # REQUIRED: Duration in milliseconds
            'recordist': recording.get('rec', 'Unknown')
        }

        return clip

    except Exception as e:
        print(f"    ✗ Failed: {e}")
        # Clean up on failure
        for f in [temp_file, output_file, spec_file]:
            if f.exists():
                f.unlink()
        return None


def augment_species(species_code: str, max_clips: int = 10, quality: str = 'A'):
    """Augment a species with new clips from Xeno-canto."""

    print(f"{'='*80}")
    print(f"🐦 Augmenting {species_code} with Xeno-canto clips")
    print(f"{'='*80}\n")

    # Load existing IDs
    existing_ids = load_existing_xc_ids(species_code)
    print(f"📋 Existing clips: {len(existing_ids)}")
    print(f"   XC IDs: {existing_ids}\n")

    # Search Xeno-canto
    recordings = search_xeno_canto(species_code, quality=quality, limit=50)

    if not recordings:
        print("✗ No recordings found")
        return

    # Filter out existing
    new_recordings = [r for r in recordings if r['id'] not in existing_ids]
    print(f"\n📊 New recordings available: {len(new_recordings)}")

    if not new_recordings:
        print("✓ No new recordings to download")
        return

    # Download up to max_clips
    to_download = new_recordings[:max_clips]
    print(f"⬇️  Downloading {len(to_download)} clips...\n")

    new_clips = []
    for i, recording in enumerate(to_download, 1):
        print(f"[{i}/{len(to_download)}] XC{recording['id']} - {recording.get('type', 'unknown')}")
        clip = download_and_process_clip(recording, species_code)
        if clip:
            new_clips.append(clip)

    if not new_clips:
        print("\n✗ No clips successfully processed")
        return

    # Add to clips.json
    print(f"\n💾 Adding {len(new_clips)} clips to clips.json...")
    with open(CLIPS_JSON) as f:
        all_clips = json.load(f)

    all_clips.extend(new_clips)

    with open(CLIPS_JSON, 'w') as f:
        json.dump(all_clips, f, indent=2)

    print(f"✓ Added {len(new_clips)} new clips")

    # Summary
    print(f"\n{'='*80}")
    print(f"✅ AUGMENTATION COMPLETE")
    print(f"{'='*80}")
    print(f"Added {len(new_clips)} clips for {species_code}")
    print(f"\nVocalization breakdown:")
    voc_types = {}
    for clip in new_clips:
        vt = clip['vocalization_type']
        voc_types[vt] = voc_types.get(vt, 0) + 1
    for vt, count in voc_types.items():
        print(f"  {vt}: {count}")

    print(f"\n🔍 Review these clips with:")
    print(f"   python3 scripts/review_clips.py --filter {species_code}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/augment_species.py SPECIES_CODE [--max N] [--quality A/B/C]")
        print("\nExample:")
        print("  python3 scripts/augment_species.py CEWA --max 10 --quality A")
        sys.exit(1)

    species_code = sys.argv[1]
    max_clips = 10
    quality = 'A'

    # Parse optional args
    for i, arg in enumerate(sys.argv[2:], 2):
        if arg == '--max' and i + 1 < len(sys.argv):
            max_clips = int(sys.argv[i + 1])
        elif arg == '--quality' and i + 1 < len(sys.argv):
            quality = sys.argv[i + 1]

    augment_species(species_code, max_clips, quality)
