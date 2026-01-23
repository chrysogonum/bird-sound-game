#!/usr/bin/env python3
"""
NZ DOC Audio Ingestion Pipeline for ChipNotes!

Downloads and processes bird audio from NZ Department of Conservation.
Source: https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/

License: Crown Copyright - FREE to use commercially with attribution
Attribution: "Department of Conservation (NZ)"

Usage:
    # Download and process all NZ birds
    python nz_ingest.py --output data/clips-nz

    # Process specific species only
    python nz_ingest.py --output data/clips-nz --species TUIX BELL MORU

    # Dry run (show what would be downloaded)
    python nz_ingest.py --output data/clips-nz --dry-run
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
# Format: code -> {common_name, maori_name (optional), files: [{url, voc_type}]}
NZ_SPECIES = {
    "AITE": {
        "common_name": "Auckland Island Teal",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/auckland-island-teal-song.mp3", "voc_type": "call"}
        ]
    },
    "ABIT": {
        "common_name": "Australasian Bittern",
        "maori_name": "Matuku-hurepo",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/australasian-bittern.mp3", "voc_type": "call"}
        ]
    },
    "ACGR": {
        "common_name": "Australasian Crested Grebe",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/southern-crested-grebe-song.mp3", "voc_type": "call"}
        ]
    },
    "BELL": {
        "common_name": "Bellbird",
        "maori_name": "Korimako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-06.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-04.mp3", "voc_type": "call"}
        ]
    },
    "BLST": {
        "common_name": "Black Stilt",
        "maori_name": "Kaki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/black-stilt.mp3", "voc_type": "call"}
        ]
    },
    "BLDU": {
        "common_name": "Blue Duck",
        "maori_name": "Whio",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/blue-duck.mp3", "voc_type": "call"}
        ]
    },
    "CIOY": {
        "common_name": "Chatham Island Oystercatcher",
        "maori_name": "Torea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-oystercatcher-song.mp3", "voc_type": "call"}
        ]
    },
    "CIPI": {
        "common_name": "Chatham Island Pigeon",
        "maori_name": "Parea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-pigeon.mp3", "voc_type": "call"}
        ]
    },
    "CITU": {
        "common_name": "Chatham Island Tui",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tui.mp3", "voc_type": "song"}
        ]
    },
    "CIFA": {
        "common_name": "Chatham Island Fantail",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-fantail.mp3", "voc_type": "song"}
        ]
    },
    "NIFA": {
        "common_name": "North Island Fantail",
        "maori_name": "Piwakawaka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-02.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-10.mp3", "voc_type": "call"}
        ]
    },
    "SIFA": {
        "common_name": "South Island Fantail",
        "maori_name": "Piwakawaka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-fantail.mp3", "voc_type": "song"}
        ]
    },
    "GRWA": {
        "common_name": "Grey Warbler",
        "maori_name": "Riroriro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/grey-warbler-song.mp3", "voc_type": "song"}
        ]
    },
    "HUSH": {
        "common_name": "Hutton's Shearwater",
        "maori_name": "Titi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/huttons-shearwater.mp3", "voc_type": "call"}
        ]
    },
    "NIKA": {
        "common_name": "North Island Kaka",
        "maori_name": "Kaka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-kaka.mp3", "voc_type": "call"}
        ]
    },
    "SIKA": {
        "common_name": "South Island Kaka",
        "maori_name": "Kaka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-kaka.mp3", "voc_type": "call"}
        ]
    },
    "KAKA": {
        "common_name": "Kakapo",
        "maori_name": "Kakapo",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-18.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-bill-ching-1.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-20.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-26.mp3", "voc_type": "song"}
        ]
    },
    "KEAX": {
        "common_name": "Kea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kea-song.mp3", "voc_type": "call"}
        ]
    },
    "NIBK": {
        "common_name": "North Island Brown Kiwi",
        "maori_name": "Kiwi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/male-ni-brown-kiwi.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/female-ni-brown-kiwi.mp3", "voc_type": "call"}
        ]
    },
    "KOKA": {
        "common_name": "Kokako",
        "maori_name": "Kokako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song-12.mp3", "voc_type": "song"}
        ]
    },
    "MORU": {
        "common_name": "Morepork",
        "maori_name": "Ruru",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/morepork-song.mp3", "voc_type": "call"}
        ]
    },
    "NZDO": {
        "common_name": "New Zealand Dotterel",
        "maori_name": "Tuturiwhatu",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-dotterel-song.mp3", "voc_type": "call"}
        ]
    },
    "KERE": {
        "common_name": "Kereru",
        "maori_name": "Kereru",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-pigeon-song.mp3", "voc_type": "call"}
        ]
    },
    "NZFA": {
        "common_name": "New Zealand Falcon",
        "maori_name": "Karearea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-12.mp3", "voc_type": "call"}
        ]
    },
    "RCPA": {
        "common_name": "Red-crowned Parakeet",
        "maori_name": "Kakariki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-4.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-8.mp3", "voc_type": "call"}
        ]
    },
    "OFPA": {
        "common_name": "Orange-fronted Parakeet",
        "maori_name": "Kakariki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/orange-fronted-parakeet-song.mp3", "voc_type": "call"}
        ]
    },
    "SIRO": {
        "common_name": "South Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-robin-song-48.mp3", "voc_type": "song"}
        ]
    },
    "NIRO": {
        "common_name": "North Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-robin-song.mp3", "voc_type": "song"}
        ]
    },
    "PADU": {
        "common_name": "Paradise Duck",
        "maori_name": "Putangitangi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/paradise-duck-song.mp3", "voc_type": "call"}
        ]
    },
    "ROWR": {
        "common_name": "Rock Wren",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-contact-call.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-chicks-begging.mp3", "voc_type": "call"}
        ]
    },
    "NISA": {
        "common_name": "North Island Saddleback",
        "maori_name": "Tieke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "SISA": {
        "common_name": "South Island Saddleback",
        "maori_name": "Tieke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "SILV": {
        "common_name": "Silvereye",
        "maori_name": "Tauhou",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/silvereye-song-22sy.mp3", "voc_type": "song"}
        ]
    },
    "HIHI": {
        "common_name": "Hihi",
        "maori_name": "Stitchbird",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/stitchbird-song.mp3", "voc_type": "song"}
        ]
    },
    "TAKA": {
        "common_name": "Takahe",
        "maori_name": "Takahe",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-12.mp3", "voc_type": "call"}
        ]
    },
    "CITO": {
        "common_name": "Chatham Island Tomtit",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tomtit-song-32ci.mp3", "voc_type": "song"}
        ]
    },
    "NITO": {
        "common_name": "North Island Tomtit",
        "maori_name": "Miromiro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-tomtit-song-18ni.mp3", "voc_type": "song"}
        ]
    },
    "SITO": {
        "common_name": "South Island Tomtit",
        "maori_name": "Miromiro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-tomtit-song-24yb.mp3", "voc_type": "song"}
        ]
    },
    "TUIX": {
        "common_name": "Tui",
        "maori_name": "Tui",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-42.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-50.mp3", "voc_type": "song"}
        ]
    },
    "BUWE": {
        "common_name": "Buff Weka",
        "maori_name": "Weka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/buff-weka-song.mp3", "voc_type": "call"}
        ]
    },
    "NIWE": {
        "common_name": "North Island Weka",
        "maori_name": "Weka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-weka-song.mp3", "voc_type": "call"}
        ]
    },
    "WEWE": {
        "common_name": "Western Weka",
        "maori_name": "Weka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/western-weka-song.mp3", "voc_type": "call"}
        ]
    },
    "WLPE": {
        "common_name": "Westland Petrel",
        "maori_name": "Taiko",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/westland-black-petrel-song.mp3", "voc_type": "call"}
        ]
    },
    "WHHE": {
        "common_name": "White Heron",
        "maori_name": "Kotuku",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/white-heron-song.mp3", "voc_type": "call"}
        ]
    },
    "WHIT": {
        "common_name": "Whitehead",
        "maori_name": "Popokotea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-song-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-territorial-call-male-60.mp3", "voc_type": "call"}
        ]
    },
    "YEPE": {
        "common_name": "Yellow-eyed Penguin",
        "maori_name": "Hoiho",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/yellow-eyed-penguin.mp3", "voc_type": "call"}
        ]
    },
    "MOHU": {
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

        # Extract clips
        if extract_multiple:
            clips = extract_clips(audio, sample_rate)
        else:
            # Just trim to max duration
            max_samples = int(MAX_DURATION * sample_rate)
            clips = [audio[:max_samples] if len(audio) > max_samples else audio]

        results = []
        output_base = Path(output_path).stem
        output_dir = Path(output_path).parent

        for idx, clip_audio in enumerate(clips):
            # Pad if too short
            min_samples = int(MIN_DURATION * sample_rate)
            if len(clip_audio) < min_samples:
                clip_audio = np.pad(clip_audio, (0, min_samples - len(clip_audio)))

            # Trim if too long
            max_samples = int(MAX_DURATION * sample_rate)
            if len(clip_audio) > max_samples:
                clip_audio = clip_audio[:max_samples]

            # Normalize
            clip_audio = normalize_loudness(clip_audio, sample_rate)

            # Generate output filename
            if len(clips) > 1:
                clip_output = output_dir / f"{output_base}_{idx + 1}.wav"
            else:
                clip_output = output_dir / f"{output_base}.wav"

            # Save
            sf.write(str(clip_output), clip_audio, sample_rate, subtype='PCM_16')

            # Verify
            meter = pyln.Meter(sample_rate)
            final_loudness = meter.integrated_loudness(clip_audio)
            duration_ms = int(len(clip_audio) / sample_rate * 1000)

            results.append({
                'file_path': str(clip_output),
                'duration_ms': duration_ms,
                'loudness_lufs': round(final_loudness, 1)
            })

        return results

    except Exception as e:
        print(f"    ERROR processing: {e}")
        return []


def generate_clip_id(species_code: str, url: str) -> str:
    """Generate a unique clip ID from species code and URL."""
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    return f"{species_code}_{url_hash}"


def ingest_nz_birds(output_dir: str, species_filter: list = None, dry_run: bool = False) -> list:
    """
    Download and process all NZ bird audio from DOC.

    Args:
        output_dir: Directory for processed WAV clips
        species_filter: Optional list of species codes to process
        dry_run: If True, just show what would be downloaded
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    processed_files = []
    species_to_process = species_filter if species_filter else list(NZ_SPECIES.keys())

    print(f"Species to process: {len(species_to_process)}")
    print()

    for species_code in species_to_process:
        if species_code not in NZ_SPECIES:
            print(f"WARNING: Unknown species code: {species_code}")
            continue

        species_info = NZ_SPECIES[species_code]
        common_name = species_info['common_name']
        maori_name = species_info.get('maori_name', '')
        display_name = f"{common_name} ({maori_name})" if maori_name else common_name

        print(f"Processing: {display_name} [{species_code}]")

        for file_info in species_info['files']:
            url = file_info['url']
            voc_type = file_info['voc_type']
            filename = Path(url).stem

            print(f"  File: {filename} ({voc_type})")

            if dry_run:
                print(f"    [DRY RUN] Would download: {DOC_BASE_URL}{url}")
                continue

            # Download to temp file
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                tmp_path = tmp.name

            if not download_file(url, tmp_path):
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                continue

            # Process audio
            base_output = output_path / f"{species_code}_{filename}"
            results = process_audio_file(tmp_path, str(base_output))
            os.unlink(tmp_path)

            for idx, result in enumerate(results):
                clip_id = generate_clip_id(species_code, url + str(idx))
                output_name = Path(result['file_path']).name

                print(f"    OK: {output_name} ({result['duration_ms']}ms, {result['loudness_lufs']} LUFS)")

                processed_files.append({
                    'clip_id': clip_id,
                    'species_code': species_code,
                    'common_name': common_name,
                    'maori_name': maori_name,
                    'vocalization_type': voc_type,
                    'duration_ms': result['duration_ms'],
                    'loudness_lufs': result['loudness_lufs'],
                    'source': 'doc',
                    'source_id': f"DOC_{filename}_{idx + 1}" if len(results) > 1 else f"DOC_{filename}",
                    'file_path': result['file_path'],
                    'quality_score': 4,  # DOC recordings are high quality
                    'recordist': 'DOC NZ (Crown Copyright)'
                })

        print()

    return processed_files


def main():
    parser = argparse.ArgumentParser(
        description='Download and process NZ bird audio from DOC'
    )
    parser.add_argument('--output', help='Output directory for processed clips')
    parser.add_argument('--species', nargs='+', help='Specific species codes to process')
    parser.add_argument('--manifest', help='Output manifest JSON file')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be downloaded')
    parser.add_argument('--list-species', action='store_true', help='List all available species and exit')

    args = parser.parse_args()

    if args.list_species:
        print("Available NZ bird species:")
        print()
        for code in sorted(NZ_SPECIES.keys()):
            info = NZ_SPECIES[code]
            maori = info.get('maori_name', '')
            name = f"{info['common_name']} ({maori})" if maori else info['common_name']
            files = len(info['files'])
            print(f"  {code}: {name:40s} [{files} file(s)]")
        print()
        print(f"Total: {len(NZ_SPECIES)} species")
        return 0

    if not args.output:
        parser.error("--output is required unless using --list-species")

    print("=== NZ DOC Audio Ingestion Pipeline ===")
    print(f"Source: NZ Department of Conservation")
    print(f"License: Crown Copyright (free with attribution)")
    print(f"Target LUFS: {TARGET_LUFS}")
    print(f"Clip duration: {MIN_DURATION}-{MAX_DURATION}s")
    print()

    processed = ingest_nz_birds(args.output, args.species, args.dry_run)

    if args.dry_run:
        print("=== Dry Run Complete ===")
        return 0

    print("=== Summary ===")
    print(f"Successfully processed: {len(processed)} clips")

    # Group by species
    species_counts = {}
    for clip in processed:
        code = clip['species_code']
        if code not in species_counts:
            species_counts[code] = {'name': clip['common_name'], 'count': 0}
        species_counts[code]['count'] += 1

    print(f"\nClips by species:")
    for code in sorted(species_counts.keys()):
        info = species_counts[code]
        print(f"  {code}: {info['name']:35s} - {info['count']} clip(s)")

    if args.manifest:
        with open(args.manifest, 'w') as f:
            json.dump(processed, f, indent=2)
        print(f"\nManifest written to: {args.manifest}")

    # Write internal manifest
    manifest_path = Path(args.output) / '.ingest_manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(processed, f, indent=2)

    return 0 if len(processed) > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
