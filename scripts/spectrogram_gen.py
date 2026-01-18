#!/usr/bin/env python3
"""
Spectrogram Generator for SoundField: Birds

Generates PNG spectrograms for all audio clips and updates clips.json
with spectrogram paths.

⚠️  CRITICAL SPECTROGRAM SETTINGS (DO NOT MODIFY):
    - Output: 400x200px (2:1 aspect ratio)
    - Frequency: 500-10000 Hz (bird vocalization range)
    - Colormap: magma (purple-red-yellow)
    - These settings MUST remain consistent across all clips!
    - Display with: height: auto, object-fit: contain (NO cropping!)

Usage:
    python spectrogram_gen.py --input <clips_dir> --output <spectrograms_dir>

Options:
    --clips-json    Path to clips.json (default: data/clips.json)
    --update-json   Update clips.json with spectrogram paths (default: True)
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import numpy as np
    import soundfile as sf
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    from scipy import signal
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Run: pip install numpy soundfile matplotlib scipy")
    sys.exit(1)


# Spectrogram parameters optimized for bird vocalizations
# ⚠️  LOCKED SETTINGS - DO NOT MODIFY - Required for visual consistency across platform
# Output: 400x200px (figsize 4x2 @ 100 DPI) - Display with height: auto, object-fit: contain
SPECTROGRAM_CONFIG = {
    'n_fft': 1024,           # FFT window size
    'hop_length': 256,       # Hop between windows
    'freq_min': 500,         # Min frequency Hz (filter out low noise) - DO NOT CHANGE
    'freq_max': 10000,       # Max frequency Hz (bird range) - DO NOT CHANGE
    'figsize': (4, 2),       # Output figure size (width, height inches) = 400x200px @ 100 DPI
    'dpi': 100,              # Output DPI - produces 400x200px images
    'cmap': 'magma',         # Colormap (purple-red-yellow) - DO NOT CHANGE
}


def load_audio(file_path: str) -> tuple:
    """Load audio file and return samples and sample rate."""
    try:
        data, sample_rate = sf.read(file_path)
        # Convert to mono if stereo
        if len(data.shape) > 1:
            data = np.mean(data, axis=1)
        return data, sample_rate
    except Exception as e:
        print(f"ERROR loading {file_path}: {e}")
        return None, None


def generate_spectrogram(audio_data: np.ndarray, sample_rate: int, output_path: str) -> bool:
    """Generate and save a spectrogram image."""
    try:
        config = SPECTROGRAM_CONFIG

        # Compute spectrogram using scipy
        frequencies, times, Sxx = signal.spectrogram(
            audio_data,
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

        # Normalize to 0-1 range for consistent display
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

        # Remove margins
        plt.tight_layout(pad=0)

        # Save
        fig.savefig(
            output_path,
            dpi=config['dpi'],
            bbox_inches='tight',
            pad_inches=0,
            transparent=False,
            facecolor='black'
        )
        plt.close(fig)

        return True

    except Exception as e:
        print(f"ERROR generating spectrogram: {e}")
        return False


def process_clips(input_dir: str, output_dir: str, clips_json: str, update_json: bool = True) -> int:
    """Process all clips and generate spectrograms."""
    input_path = Path(input_dir)
    output_path = Path(output_dir)

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    # Load clips.json if it exists
    clips_data = []
    clips_json_path = Path(clips_json)

    if clips_json_path.exists():
        with open(clips_json_path, 'r') as f:
            clips_data = json.load(f)

    # Build lookup by file_path
    clips_by_path = {clip['file_path']: clip for clip in clips_data}

    # Process all WAV files
    wav_files = list(input_path.glob('*.wav'))

    if not wav_files:
        print(f"No WAV files found in {input_dir}")
        return 0

    success_count = 0

    for wav_file in sorted(wav_files):
        filename = wav_file.stem  # filename without extension
        relative_input = f"data/clips/{wav_file.name}"

        # Output spectrogram path
        spectrogram_filename = f"{filename}.png"
        spectrogram_output = output_path / spectrogram_filename
        relative_output = f"data/spectrograms/{spectrogram_filename}"

        print(f"Processing: {wav_file.name} -> {spectrogram_filename}")

        # Load audio
        audio_data, sample_rate = load_audio(str(wav_file))

        if audio_data is None:
            print(f"  SKIP: Could not load audio")
            continue

        # Generate spectrogram
        if generate_spectrogram(audio_data, sample_rate, str(spectrogram_output)):
            print(f"  OK: Generated {spectrogram_filename}")
            success_count += 1

            # Update clips.json entry
            if relative_input in clips_by_path:
                clips_by_path[relative_input]['spectrogram_path'] = relative_output
        else:
            print(f"  FAIL: Could not generate spectrogram")

    # Update clips.json if requested
    if update_json and clips_data:
        # Rebuild list from dictionary
        updated_clips = [clips_by_path[clip['file_path']] for clip in clips_data]

        with open(clips_json_path, 'w') as f:
            json.dump(updated_clips, f, indent=2)

        print(f"\nUpdated {clips_json} with spectrogram paths")

    print(f"\nGenerated {success_count}/{len(wav_files)} spectrograms")
    return success_count


def main():
    parser = argparse.ArgumentParser(description='Generate spectrograms for audio clips')
    parser.add_argument('--input', required=True, help='Directory containing WAV clips')
    parser.add_argument('--output', required=True, help='Output directory for spectrograms')
    parser.add_argument('--clips-json', default='data/clips.json', help='Path to clips.json')
    parser.add_argument('--no-update-json', action='store_true', help='Do not update clips.json')

    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"ERROR: Input directory does not exist: {args.input}")
        return 1

    count = process_clips(
        args.input,
        args.output,
        args.clips_json,
        update_json=not args.no_update_json
    )

    return 0 if count > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
