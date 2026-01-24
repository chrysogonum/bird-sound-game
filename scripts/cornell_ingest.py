#!/usr/bin/env python3
"""
Cornell Audio Ingestion Pipeline for ChipNotes!

Processes audio files from Cornell Lab of Ornithology collections.
Handles stereo-to-mono conversion, trimming, and normalization.

Usage:
    python cornell_ingest.py --input <cornell_dir> --output <clips_dir>
"""

import argparse
import json
import os
import re
import sys
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

# Species name to 4-letter code mapping
SPECIES_CODES = {
    "Mourning Dove": "MODO",
    "Downy Woodpecker": "DOWO",
    "Northern Flicker": "NOFL",
    "Steller's Jay": "STJA",
    "Western Scrub-Jay": "WESJ",
    "Black-capped Chickadee": "BCCH",
    "White-breasted Nuthatch": "WBNU",
    "White-crowned Sparrow": "WCSP",
    "Red-winged Blackbird": "RWBL",
    "Cassin's Finch": "CAFI",
    "House Finch": "HOFI",
    "Pine Siskin": "PISI",
    "American Goldfinch": "AMGO",
    "Evening Grosbeak": "EVGR",
}


def parse_filename(filename: str) -> dict:
    """
    Parse Cornell filename to extract species and vocalization type.

    Format: "## Species Name Type.mp3"
    Examples:
        "02 Mourning Dove Song.mp3" -> species="Mourning Dove", voc_type="song"
        "03 Downy Woodpecker Calls.mp3" -> species="Downy Woodpecker", voc_type="call"
        "04 Downy Woodpecker Drum.mp3" -> species="Downy Woodpecker", voc_type="call"
    """
    # Remove number prefix and extension
    base = Path(filename).stem
    match = re.match(r'^\d+\s+(.+)', base)

    if not match:
        return None

    text = match.group(1)

    # Find species name by matching against known species
    species_name = None
    for species in SPECIES_CODES.keys():
        if text.startswith(species):
            species_name = species
            # Extract vocalization type (everything after species name)
            voc_text = text[len(species):].strip()
            break

    if not species_name:
        return None

    # Parse vocalization type
    voc_text_lower = voc_text.lower()

    if 'song' in voc_text_lower and 'call' in voc_text_lower:
        # Mixed - prefer song as primary
        voc_type = 'song'
    elif 'song' in voc_text_lower:
        voc_type = 'song'
    elif 'call' in voc_text_lower or 'drum' in voc_text_lower:
        voc_type = 'call'
    else:
        # Default to song if unclear
        voc_type = 'song'

    return {
        'species_name': species_name,
        'species_code': SPECIES_CODES[species_name],
        'vocalization_type': voc_type,
        'original_text': voc_text
    }


def convert_to_mono(audio: np.ndarray) -> np.ndarray:
    """Convert stereo audio to mono by averaging channels."""
    if len(audio.shape) > 1 and audio.shape[1] > 1:
        return np.mean(audio, axis=1)
    return audio.flatten()


def extract_clips(audio: np.ndarray, sample_rate: int, target_duration: float = 2.0) -> list:
    """
    Extract multiple clips from long audio by finding loudest segments.

    Returns list of audio arrays, each trimmed to target_duration.
    """
    target_samples = int(target_duration * sample_rate)
    clips = []

    if len(audio) <= target_samples:
        # Audio is already short enough, return as single clip
        return [audio]

    # Calculate how many clips we can extract
    # Use sliding window to find distinct loud sections
    window_size = target_samples
    step_size = sample_rate // 2  # 0.5 second steps

    # Find loudest segments
    segments = []
    for start in range(0, len(audio) - window_size, step_size):
        window = audio[start:start + window_size]
        energy = np.sqrt(np.mean(window ** 2))
        segments.append({
            'start': start,
            'energy': energy
        })

    if not segments:
        return [audio[:target_samples]]

    # Sort by energy and take top segments
    segments.sort(key=lambda x: x['energy'], reverse=True)

    # Extract non-overlapping clips
    # Take up to 3 clips per source file
    max_clips = min(3, len(segments))
    selected = []

    for seg in segments:
        # Check if this segment overlaps with already selected ones
        overlaps = False
        for sel in selected:
            if abs(seg['start'] - sel['start']) < window_size:
                overlaps = True
                break

        if not overlaps:
            selected.append(seg)
            if len(selected) >= max_clips:
                break

    # Extract clips
    for seg in selected:
        clip = audio[seg['start']:seg['start'] + target_samples]
        if len(clip) >= int(MIN_DURATION * sample_rate):
            clips.append(clip)

    return clips if clips else [audio[:target_samples]]


def normalize_loudness(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Normalize audio to target LUFS."""
    meter = pyln.Meter(sample_rate)

    # Measure current loudness
    loudness = meter.integrated_loudness(audio)

    if np.isinf(loudness) or np.isnan(loudness):
        # Audio is silent or nearly silent
        return audio

    # Normalize to target
    normalized = pyln.normalize.loudness(audio, loudness, TARGET_LUFS)

    # Clip to prevent distortion
    normalized = np.clip(normalized, -1.0, 1.0)

    return normalized


def process_cornell_file(input_path: str, output_dir: str, file_info: dict) -> list:
    """Process a single Cornell audio file and extract multiple clips."""
    try:
        # Load audio
        audio, sample_rate = sf.read(input_path)

        # Convert to mono
        audio = convert_to_mono(audio)

        # Resample if needed
        if sample_rate != OUTPUT_SAMPLE_RATE:
            duration = len(audio) / sample_rate
            new_length = int(duration * OUTPUT_SAMPLE_RATE)
            indices = np.linspace(0, len(audio) - 1, new_length)
            audio = np.interp(indices, np.arange(len(audio)), audio)
            sample_rate = OUTPUT_SAMPLE_RATE

        # Extract multiple clips from this file
        clips = extract_clips(audio, sample_rate, target_duration=2.0)

        processed_files = []

        for idx, clip_audio in enumerate(clips):
            # Normalize loudness
            clip_audio = normalize_loudness(clip_audio, sample_rate)

            # Calculate duration
            duration_ms = int(len(clip_audio) / sample_rate * 1000)

            # Generate output filename
            # Format: CODE_cornell_NNN_X.wav where X is clip index
            source_num = Path(input_path).stem.split()[0].zfill(3)
            clip_num = idx + 1
            output_file = Path(output_dir) / f"{file_info['species_code']}_cornell_{source_num}_{clip_num}.wav"

            # Save processed audio
            sf.write(str(output_file), clip_audio, sample_rate, subtype='PCM_16')

            # Verify loudness
            meter = pyln.Meter(sample_rate)
            final_loudness = meter.integrated_loudness(clip_audio)

            processed_files.append({
                'file_path': str(output_file),
                'common_name': file_info['species_name'],  # Use common_name for schema compliance
                'species_code': file_info['species_code'],
                'vocalization_type': file_info['vocalization_type'],
                'duration_ms': duration_ms,
                'loudness_lufs': round(final_loudness, 1),
                'source': 'cornell',
                'source_id': f"cornell_{source_num}",
                'recordist': None,  # TODO: Add if Cornell provides recordist metadata
                'quality': 'A'  # Cornell recordings are high quality
            })

        return processed_files

    except Exception as e:
        print(f"  ERROR: {e}")
        return []


def ingest_cornell_audio(input_dir: str, output_dir: str, existing_clips_json: str = None) -> list:
    """
    Process all Cornell audio files.

    Args:
        input_dir: Directory containing Cornell MP3 files
        output_dir: Directory for processed WAV clips
        existing_clips_json: Path to clips.json for deduplication check
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load existing source_ids for deduplication
    existing_source_ids = set()
    if existing_clips_json and os.path.exists(existing_clips_json):
        with open(existing_clips_json, 'r') as f:
            existing_clips = json.load(f)
            existing_source_ids = {
                c.get('source_id')
                for c in existing_clips
                if c.get('source_id')
            }
        if existing_source_ids:
            print(f"Loaded {len(existing_source_ids)} existing source files for deduplication check")
            print()

    # Get all MP3 files
    mp3_files = sorted(input_path.glob('*.mp3'))

    processed_files = []
    skipped_duplicates = []

    for mp3_file in mp3_files:
        filename = mp3_file.name

        # Skip intro/compilation file
        if filename.startswith('01 '):
            print(f"Skipping: {filename} (compilation/intro)")
            continue

        # Parse filename
        file_info = parse_filename(filename)

        if not file_info:
            print(f"Skipping: {filename} (could not parse)")
            continue

        # Check for duplicate source file
        # Extract source number from filename (e.g., "11" from "11 Black-capped Chickadee.mp3")
        source_num = Path(filename).stem.split()[0].zfill(3)
        source_id = f"cornell_{source_num}"

        if source_id in existing_source_ids:
            print(f"Skipping: {filename}")
            print(f"  Reason: Already processed (source_id: {source_id})")
            print(f"  Species: {file_info['species_name']} ({file_info['species_code']})")
            skipped_duplicates.append({
                'filename': filename,
                'source_id': source_id,
                'species_code': file_info['species_code'],
                'common_name': file_info['species_name']
            })
            continue

        print(f"Processing: {filename}")
        print(f"  Species: {file_info['species_name']} ({file_info['species_code']})")
        print(f"  Type: {file_info['vocalization_type']} (from '{file_info['original_text']}')")

        # Process file
        clips = process_cornell_file(str(mp3_file), str(output_path), file_info)

        for clip in clips:
            output_name = Path(clip['file_path']).name
            print(f"    OK: {output_name} ({clip['duration_ms']}ms, {clip['loudness_lufs']} LUFS)")

        processed_files.extend(clips)

    # Report skipped duplicates
    if skipped_duplicates:
        print()
        print(f"=== Deduplication Summary ===")
        print(f"Skipped {len(skipped_duplicates)} already-processed files:")
        for item in skipped_duplicates:
            print(f"  {item['species_code']}: {item['filename']}")

    return processed_files


def main():
    parser = argparse.ArgumentParser(
        description='Process Cornell Lab of Ornithology audio files'
    )
    parser.add_argument('--input', required=True, help='Cornell audio directory')
    parser.add_argument('--output', required=True, help='Output directory for processed clips')
    parser.add_argument('--manifest', help='Output manifest JSON file')
    parser.add_argument('--clips-json', help='Path to clips.json for source file deduplication check')

    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"ERROR: Input directory does not exist: {args.input}")
        return 1

    print("=== Cornell Audio Ingestion Pipeline ===")
    print(f"Source: Cornell Lab of Ornithology")
    print(f"Target LUFS: {TARGET_LUFS}")
    print(f"Clip duration: {MIN_DURATION}-{MAX_DURATION}s")
    print()

    processed = ingest_cornell_audio(args.input, args.output, args.clips_json)

    print()
    print(f"=== Summary ===")
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
        print(f"  {code}: {info['name']:30s} - {info['count']} clips")

    if args.manifest:
        with open(args.manifest, 'w') as f:
            json.dump(processed, f, indent=2)
        print(f"\nManifest written to: {args.manifest}")

    # Write internal manifest for audio_tagger.py
    manifest_path = Path(args.output) / '.ingest_manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(processed, f, indent=2)

    return 0 if len(processed) > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
