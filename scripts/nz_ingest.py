#!/usr/bin/env python3
"""
NZ DOC Audio Ingestion Pipeline for ChipNotes!

Downloads and processes bird audio from NZ Department of Conservation.
Source: https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/

License: Crown Copyright - FREE to use commercially with attribution
Attribution: "Department of Conservation (NZ)"

Species codes: Uses official eBird 6-character codes from eBird/Clements v2025.
Display: First 4 characters of code shown on icons.

Usage:
    # Download and process all NZ birds (to main clips directory)
    python nz_ingest.py --output data/clips

    # Process specific species only
    python nz_ingest.py --output data/clips --species tui1 nezbel1 morepo2

    # Dry run (show what would be downloaded)
    python nz_ingest.py --output data/clips --dry-run

Note: Output should go to data/clips/ (not a separate NZ directory) so clips
are integrated with the main collection. Run spectrogram_gen.py separately
to generate spectrograms, then merge results into data/clips.json.
"""

import argparse
import hashlib
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln
except ImportError:
    print("ERROR: Required packages not installed.")
    print("Run: pip install numpy soundfile pyloudnorm")
    sys.exit(1)

# Target loudness in LUFS
TARGET_LUFS = -16.0

# Duration constraints in seconds
MIN_DURATION = 0.5
MAX_DURATION = 3.0

# Sample rate for output
OUTPUT_SAMPLE_RATE = 44100

# DOC base URL
DOC_BASE_URL = "https://www.doc.govt.nz"

# Complete NZ bird species catalog from DOC
# Uses official eBird 6-character codes from eBird/Clements v2025 taxonomy
# Format: ebird_code -> {common_name, maori_name (optional), files: [{url, voc_type}]}
NZ_SPECIES = {
    "auitea1": {
        "common_name": "Auckland Islands Teal",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/auckland-island-teal-song.mp3", "voc_type": "call"}
        ]
    },
    "ausbit1": {
        "common_name": "Australasian Bittern",
        "maori_name": "Matuku-hūrepo",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/australasian-bittern.mp3", "voc_type": "call"}
        ]
    },
    "grcgre1": {
        "common_name": "Australasian Crested Grebe",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/southern-crested-grebe-song.mp3", "voc_type": "call"}
        ]
    },
    "nezbel1": {
        "common_name": "Bellbird",
        "maori_name": "Korimako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-06.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-04.mp3", "voc_type": "call"}
        ]
    },
    "blasti1": {
        "common_name": "Black Stilt",
        "maori_name": "Kakī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/black-stilt.mp3", "voc_type": "call"}
        ]
    },
    "bluduc1": {
        "common_name": "Blue Duck",
        "maori_name": "Whio",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/blue-duck.mp3", "voc_type": "call"}
        ]
    },
    "chaoys1": {
        "common_name": "Chatham Islands Oystercatcher",
        "maori_name": "Tōrea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-oystercatcher-song.mp3", "voc_type": "call"}
        ]
    },
    "nezpig3": {
        "common_name": "Chatham Islands Pigeon",
        "maori_name": "Parea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-pigeon.mp3", "voc_type": "call"}
        ]
    },
    # Note: Chatham Island Tui is subspecies of tui1, using tui1 for all Tui
    # Note: Chatham Island Fantail is subspecies of nezfan1, using nezfan1 for all Fantails
    "nezfan1": {
        "common_name": "New Zealand Fantail",
        "maori_name": "Pīwakawaka",
        "files": [
            # North Island Fantail recordings
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-02.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-10.mp3", "voc_type": "call"},
            # South Island Fantail recording
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-fantail.mp3", "voc_type": "song"},
            # Chatham Island Fantail recording
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-fantail.mp3", "voc_type": "song"}
        ]
    },
    "gryger1": {
        "common_name": "Grey Warbler",
        "maori_name": "Riroriro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/grey-warbler-song.mp3", "voc_type": "song"}
        ]
    },
    "hutshe1": {
        "common_name": "Hutton's Shearwater",
        "maori_name": "Tītī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/huttons-shearwater.mp3", "voc_type": "call"}
        ]
    },
    "nezkak1": {
        "common_name": "New Zealand Kākā",
        "maori_name": "Kākā",
        "files": [
            # North Island Kaka recording
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-kaka.mp3", "voc_type": "call"},
            # South Island Kaka recording
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-kaka.mp3", "voc_type": "call"}
        ]
    },
    "kakapo2": {
        "common_name": "Kākāpō",
        "maori_name": "Kākāpō",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-18.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-bill-ching-1.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-20.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-26.mp3", "voc_type": "song"}
        ]
    },
    "kea1": {
        "common_name": "Kea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kea-song.mp3", "voc_type": "call"}
        ]
    },
    "nibkiw1": {
        "common_name": "North Island Brown Kiwi",
        "maori_name": "Kiwi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/male-ni-brown-kiwi.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/female-ni-brown-kiwi.mp3", "voc_type": "call"}
        ]
    },
    "kokako3": {
        "common_name": "Kōkako",
        "maori_name": "Kōkako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song-12.mp3", "voc_type": "song"}
        ]
    },
    "morepo2": {
        "common_name": "Morepork",
        "maori_name": "Ruru",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/morepork-song.mp3", "voc_type": "call"}
        ]
    },
    "rebdot1": {
        "common_name": "New Zealand Dotterel",
        "maori_name": "Tūturiwhatu",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-dotterel-song.mp3", "voc_type": "call"}
        ]
    },
    "nezpig2": {
        "common_name": "Kererū",
        "maori_name": "Kererū",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-pigeon-song.mp3", "voc_type": "call"}
        ]
    },
    "nezfal1": {
        "common_name": "New Zealand Falcon",
        "maori_name": "Kārearea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-12.mp3", "voc_type": "call"}
        ]
    },
    "refpar4": {
        "common_name": "Red-crowned Parakeet",
        "maori_name": "Kākāriki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-4.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-8.mp3", "voc_type": "call"}
        ]
    },
    "malpar2": {
        "common_name": "Orange-fronted Parakeet",
        "maori_name": "Kākāriki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/orange-fronted-parakeet-song.mp3", "voc_type": "call"}
        ]
    },
    "nezrob3": {
        "common_name": "South Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-robin-song-48.mp3", "voc_type": "song"}
        ]
    },
    "nezrob2": {
        "common_name": "North Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-robin-song.mp3", "voc_type": "song"}
        ]
    },
    "parshe1": {
        "common_name": "Paradise Shelduck",
        "maori_name": "Pūtangitangi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/paradise-duck-song.mp3", "voc_type": "call"}
        ]
    },
    "soiwre1": {
        "common_name": "Rock Wren",
        "maori_name": "Pīwauwau",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-contact-call.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-chicks-begging.mp3", "voc_type": "call"}
        ]
    },
    "saddle2": {
        "common_name": "North Island Saddleback",
        "maori_name": "Tīeke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "saddle3": {
        "common_name": "South Island Saddleback",
        "maori_name": "Tīeke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "silver3": {
        "common_name": "Silvereye",
        "maori_name": "Tauhou",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/silvereye-song-22sy.mp3", "voc_type": "song"}
        ]
    },
    "stitch1": {
        "common_name": "Hihi",
        "maori_name": "Stitchbird",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/stitchbird-song.mp3", "voc_type": "song"}
        ]
    },
    "takahe3": {
        "common_name": "Takahē",
        "maori_name": "Takahē",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-12.mp3", "voc_type": "call"}
        ]
    },
    # Tomtit is single species with subspecies - using tomtit1 for all
    "tomtit1": {
        "common_name": "Tomtit",
        "maori_name": "Miromiro",
        "files": [
            # North Island Tomtit
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-tomtit-song-18ni.mp3", "voc_type": "song"},
            # South Island Tomtit
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-tomtit-song-24yb.mp3", "voc_type": "song"},
            # Chatham Island Tomtit
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tomtit-song-32ci.mp3", "voc_type": "song"}
        ]
    },
    "tui1": {
        "common_name": "Tūī",
        "maori_name": "Tūī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-42.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-50.mp3", "voc_type": "song"},
            # Chatham Island Tui (subspecies)
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tui.mp3", "voc_type": "song"}
        ]
    },
    # Weka is single species with subspecies - using weka1 for all
    "weka1": {
        "common_name": "Weka",
        "maori_name": "Weka",
        "files": [
            # Buff Weka
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/buff-weka-song.mp3", "voc_type": "call"},
            # North Island Weka
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-weka-song.mp3", "voc_type": "call"},
            # Western Weka
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/western-weka-song.mp3", "voc_type": "call"}
        ]
    },
    "wespet1": {
        "common_name": "Westland Petrel",
        "maori_name": "Tāiko",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/westland-black-petrel-song.mp3", "voc_type": "call"}
        ]
    },
    "greegr": {
        "common_name": "White Heron",
        "maori_name": "Kōtuku",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/white-heron-song.mp3", "voc_type": "call"}
        ]
    },
    "whiteh1": {
        "common_name": "Whitehead",
        "maori_name": "Pōpokotea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-song-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-territorial-call-male-60.mp3", "voc_type": "call"}
        ]
    },
    "yeepen1": {
        "common_name": "Yellow-eyed Penguin",
        "maori_name": "Hoiho",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/yellow-eyed-penguin.mp3", "voc_type": "call"}
        ]
    },
    "yellow3": {
        "common_name": "Yellowhead",
        "maori_name": "Mohua",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/yellowhead-song.mp3", "voc_type": "song"}
        ]
    },
}


def download_file(url: str, output_path: str) -> bool:
    """Download a file from URL."""
    try:
        full_url = DOC_BASE_URL + url if url.startswith('/') else url
        req = urllib.request.Request(full_url, headers={'User-Agent': 'ChipNotes-NZ/1.0'})
        with urllib.request.urlopen(req, timeout=60) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"    Download failed: {e}")
        return False


def convert_to_mono(audio: np.ndarray) -> np.ndarray:
    """Convert stereo audio to mono."""
    if len(audio.shape) > 1 and audio.shape[1] > 1:
        return np.mean(audio, axis=1)
    return audio.flatten()


def extract_clips(audio: np.ndarray, sample_rate: int, target_duration: float = 2.5) -> list:
    """
    Extract multiple clips from long audio by finding loudest segments.
    Returns list of audio arrays.
    """
    target_samples = int(target_duration * sample_rate)
    clips = []

    if len(audio) <= target_samples:
        return [audio]

    # Calculate how many clips we can extract
    window_size = target_samples
    step_size = sample_rate // 2  # 0.5 second steps

    # Find loudest segments
    segments = []
    for start in range(0, len(audio) - window_size, step_size):
        window = audio[start:start + window_size]
        energy = np.sqrt(np.mean(window ** 2))
        segments.append({'start': start, 'energy': energy})

    if not segments:
        return [audio[:target_samples]]

    # Sort by energy and take top segments
    segments.sort(key=lambda x: x['energy'], reverse=True)

    # Extract non-overlapping clips (up to 3 per file)
    max_clips = min(3, len(segments))
    selected = []

    for seg in segments:
        overlaps = False
        for sel in selected:
            if abs(seg['start'] - sel['start']) < window_size:
                overlaps = True
                break
        if not overlaps:
            selected.append(seg)
            if len(selected) >= max_clips:
                break

    for seg in selected:
        clip = audio[seg['start']:seg['start'] + target_samples]
        if len(clip) >= int(MIN_DURATION * sample_rate):
            clips.append(clip)

    return clips if clips else [audio[:target_samples]]


def normalize_loudness(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Normalize audio to target LUFS."""
    meter = pyln.Meter(sample_rate)
    loudness = meter.integrated_loudness(audio)

    if np.isinf(loudness) or np.isnan(loudness):
        return audio

    normalized = pyln.normalize.loudness(audio, loudness, TARGET_LUFS)
    normalized = np.clip(normalized, -1.0, 1.0)
    return normalized


def process_audio_file(input_path: str, output_path: str, extract_multiple: bool = True) -> list:
    """
    Process a single audio file through the pipeline.
    Returns list of output file info dicts.
    """
    try:
        audio, sample_rate = sf.read(input_path)
        audio = convert_to_mono(audio)

        # Resample if needed
        if sample_rate != OUTPUT_SAMPLE_RATE:
            duration = len(audio) / sample_rate
            new_length = int(duration * OUTPUT_SAMPLE_RATE)
            indices = np.linspace(0, len(audio) - 1, new_length)
            audio = np.interp(indices, np.arange(len(audio)), audio)
            sample_rate = OUTPUT_SAMPLE_RATE

        # Extract clips from longer audio
        if extract_multiple:
            clips = extract_clips(audio, sample_rate)
        else:
            clips = [audio[:int(MAX_DURATION * sample_rate)]]

        results = []
        for idx, clip in enumerate(clips):
            # Normalize
            clip = normalize_loudness(clip, sample_rate)

            # Generate output path
            base = Path(output_path).stem
            ext = Path(output_path).suffix
            if len(clips) > 1:
                out_path = str(Path(output_path).parent / f"{base}_{idx+1}{ext}")
            else:
                out_path = output_path

            # Save
            sf.write(out_path, clip, sample_rate)

            results.append({
                'path': out_path,
                'duration_ms': int(len(clip) / sample_rate * 1000)
            })

        return results

    except Exception as e:
        print(f"    Processing failed: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description='Download and process NZ DOC bird audio')
    parser.add_argument('--output', '-o', required=True, help='Output directory for clips')
    parser.add_argument('--species', '-s', nargs='*', help='Specific species codes to process')
    parser.add_argument('--dry-run', '-n', action='store_true', help='Show what would be downloaded')
    args = parser.parse_args()

    output_dir = Path(args.output)
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    # Filter species if specified
    species_to_process = NZ_SPECIES
    if args.species:
        species_to_process = {k: v for k, v in NZ_SPECIES.items() if k in args.species}
        if not species_to_process:
            print(f"ERROR: No matching species found. Available: {', '.join(NZ_SPECIES.keys())}")
            return 1

    print(f"Processing {len(species_to_process)} NZ bird species...")
    print(f"Output directory: {output_dir}")
    if args.dry_run:
        print("(DRY RUN - no files will be downloaded)")
    print()

    total_clips = 0
    all_metadata = []

    for species_code, info in species_to_process.items():
        common_name = info['common_name']
        maori_name = info.get('maori_name')
        files = info['files']

        print(f"{species_code}: {common_name}" + (f" / {maori_name}" if maori_name else ""))

        for file_info in files:
            url = file_info['url']
            voc_type = file_info['voc_type']
            filename = Path(url).stem

            if args.dry_run:
                print(f"  Would download: {url}")
                continue

            # Download to temp file
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                tmp_path = tmp.name

            print(f"  Downloading {filename}...")
            if not download_file(url, tmp_path):
                continue

            # Process audio
            output_base = output_dir / f"{species_code}_doc_{filename}.wav"
            results = process_audio_file(tmp_path, str(output_base))

            # Clean up temp file
            os.unlink(tmp_path)

            for result in results:
                clip_path = Path(result['path'])
                clip_id = clip_path.stem

                metadata = {
                    'clip_id': clip_id,
                    'species_code': species_code,
                    'common_name': common_name,
                    'vocalization_type': voc_type,
                    'duration_ms': result['duration_ms'],
                    'quality_score': 4,  # DOC recordings are high quality
                    'source': 'doc',
                    'recordist': 'DOC NZ (Crown Copyright)',
                    'source_id': filename,
                    'file_path': f"data/clips/{clip_path.name}",
                    'spectrogram_path': f"data/spectrograms/{clip_id}.png",
                    'canonical': False,
                    'rejected': False
                }

                if maori_name:
                    metadata['maori_name'] = maori_name

                all_metadata.append(metadata)
                total_clips += 1
                print(f"    Created: {clip_path.name} ({result['duration_ms']}ms)")

        print()

    if not args.dry_run and all_metadata:
        # Save metadata
        manifest_path = output_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(all_metadata, f, indent=2)
        print(f"Saved manifest to {manifest_path}")

    print(f"\nTotal: {total_clips} clips from {len(species_to_process)} species")
    print("\nNext steps:")
    print("  1. Run spectrogram_gen.py to generate spectrograms")
    print("  2. Review clips using clip_selector.py or review_clips.py")
    print("  3. Merge approved clips into data/clips.json")


if __name__ == '__main__':
    main()
