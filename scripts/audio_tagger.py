#!/usr/bin/env python3
"""
Audio Tagger for SoundField: Birds

Generates metadata JSON for processed audio clips.

Usage:
    python audio_tagger.py --input <clips_dir> --output <clips.json>
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

try:
    import soundfile as sf
except ImportError:
    print("ERROR: soundfile not installed. Run: pip install soundfile")
    sys.exit(1)


# Species code to common name mapping
SPECIES_MAP = {
    'NOCA': 'Northern Cardinal',
    'CARW': 'Carolina Wren',
    'BLJA': 'Blue Jay',
    'AMCR': 'American Crow',
    'TUTI': 'Tufted Titmouse',
    'EABL': 'Eastern Bluebird',
    'AMRO': 'American Robin',
    'MODO': 'Mourning Dove',
    'RWBL': 'Red-winged Blackbird',
    'HOFI': 'House Finch',
    'NOFL': 'Northern Flicker',
    'DOWO': 'Downy Woodpecker',
    'HAWO': 'Hairy Woodpecker',
    'RBWO': 'Red-bellied Woodpecker',
    'PIWO': 'Pileated Woodpecker',
    'WBNU': 'White-breasted Nuthatch',
    'CACH': 'Carolina Chickadee',
    'EATO': 'Eastern Towhee',
    'CHSP': 'Chipping Sparrow',
    'SOSP': 'Song Sparrow',
    'WTSP': 'White-throated Sparrow',
    'FISP': 'Field Sparrow',
    'YRWA': 'Yellow-rumped Warbler',
    'PIWA': 'Pine Warbler',
    'NOPA': 'Northern Parula',
    'COYE': 'Common Yellowthroat',
    'OVEN': 'Ovenbird',
    'KEWA': 'Kentucky Warbler',
    'HOWA': 'Hooded Warbler',
    'WEVI': 'White-eyed Vireo',
    'NC': 'Northern Cardinal',
    'CW': 'Carolina Wren',
    'BJ': 'Blue Jay',
    'AC': 'American Crow',
    'TT': 'Tufted Titmouse',
}


def get_species_code(filename: str) -> str:
    """Extract species code from filename."""
    # Expected format: XXXX_id.wav or similar
    base = Path(filename).stem
    parts = base.split('_')
    if parts:
        code = parts[0].upper()
        # Normalize 2-letter codes to 4-letter
        if len(code) == 2:
            code_map = {'NC': 'NOCA', 'CW': 'CARW', 'BJ': 'BLJA', 'AC': 'AMCR', 'TT': 'TUTI'}
            return code_map.get(code, code + 'XX')
        return code[:4] if len(code) >= 4 else code + 'X' * (4 - len(code))
    return 'UNKN'


def get_common_name(species_code: str) -> str:
    """Get common name from species code."""
    return SPECIES_MAP.get(species_code, f"Unknown ({species_code})")


def get_audio_duration_ms(file_path: str) -> int:
    """Get audio duration in milliseconds."""
    try:
        info = sf.info(file_path)
        return int(info.duration * 1000)
    except Exception:
        return 0


def quality_score_from_string(quality: str) -> int:
    """Convert quality letter to score."""
    scores = {'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1}
    return scores.get(quality.upper(), 3)


def tag_clips(input_dir: str, output_file: str) -> list:
    """Generate metadata for all clips in directory."""
    input_path = Path(input_dir)
    clips = []

    # Check for ingest manifest
    manifest_path = input_path / '.ingest_manifest.json'
    manifest_data = {}

    if manifest_path.exists():
        with open(manifest_path, 'r') as f:
            manifest_list = json.load(f)
            for item in manifest_list:
                file_key = Path(item['file_path']).name
                manifest_data[file_key] = item

    # Process all WAV files
    wav_files = list(input_path.glob('*.wav'))

    if not wav_files:
        print(f"No WAV files found in {input_dir}")
        return []

    for wav_file in sorted(wav_files):
        filename = wav_file.name
        manifest_info = manifest_data.get(filename, {})

        # Get species code
        species_code = manifest_info.get('species_code', get_species_code(filename))
        if len(species_code) < 4:
            species_code = species_code + 'X' * (4 - len(species_code))
        species_code = species_code[:4].upper()

        # Get common name
        common_name = manifest_info.get('species_name', get_common_name(species_code))

        # Get duration
        duration_ms = manifest_info.get('duration_ms', get_audio_duration_ms(str(wav_file)))

        # Get vocalization type
        voc_type = manifest_info.get('vocalization_type', 'song')
        if voc_type not in ['song', 'call']:
            voc_type = 'song'  # Default to song

        # Get quality score
        quality = manifest_info.get('quality', 'B')
        quality_score = quality_score_from_string(quality)

        # Get source info
        source = manifest_info.get('source', 'xenocanto')
        source_id = manifest_info.get('source_id', filename.replace('.wav', ''))

        # Generate unique clip ID
        clip_id = f"{species_code}_{uuid.uuid4().hex[:8]}"

        # Relative file path
        file_path = f"data/clips/{filename}"

        clip = {
            'clip_id': clip_id,
            'species_code': species_code,
            'common_name': common_name,
            'vocalization_type': voc_type,
            'duration_ms': duration_ms,
            'quality_score': quality_score,
            'source': source,
            'source_id': source_id,
            'file_path': file_path,
            'spectrogram_path': None
        }

        clips.append(clip)
        print(f"Tagged: {filename} -> {clip_id} ({common_name}, {voc_type}, {duration_ms}ms)")

    # Write output
    with open(output_file, 'w') as f:
        json.dump(clips, f, indent=2)

    print(f"\nWrote {len(clips)} clips to {output_file}")
    return clips


def main():
    parser = argparse.ArgumentParser(description='Generate metadata for audio clips')
    parser.add_argument('--input', required=True, help='Directory containing WAV clips')
    parser.add_argument('--output', required=True, help='Output JSON file')

    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"ERROR: Input directory does not exist: {args.input}")
        return 1

    clips = tag_clips(args.input, args.output)

    return 0 if len(clips) > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
