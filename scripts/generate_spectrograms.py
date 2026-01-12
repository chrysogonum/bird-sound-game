#!/usr/bin/env python3
"""
Generate spectrogram images from audio clips for the bird sound game.
Uses scipy and matplotlib (no librosa dependency).
"""

import os
import json
import numpy as np
from scipy.io import wavfile
from scipy import signal
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend


def generate_spectrogram(wav_path: str, output_path: str,
                         width_px: int = 200, height_px: int = 100):
    """
    Generate a spectrogram image from a WAV file.

    Args:
        wav_path: Path to input WAV file
        output_path: Path for output PNG image
        width_px: Output image width in pixels
        height_px: Output image height in pixels
    """
    # Read audio file
    sample_rate, audio = wavfile.read(wav_path)

    # Convert to mono if stereo
    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)

    # Normalize
    audio = audio.astype(np.float32)
    if audio.max() > 0:
        audio = audio / np.abs(audio).max()

    # Compute spectrogram
    # Use parameters that work well for bird songs (higher frequencies)
    nperseg = min(1024, len(audio) // 8)
    noverlap = nperseg // 2

    frequencies, times, Sxx = signal.spectrogram(
        audio,
        fs=sample_rate,
        nperseg=nperseg,
        noverlap=noverlap,
        scaling='density'
    )

    # Focus on bird song frequency range (500 Hz - 10 kHz)
    freq_mask = (frequencies >= 500) & (frequencies <= 10000)
    frequencies = frequencies[freq_mask]
    Sxx = Sxx[freq_mask, :]

    # Convert to dB scale
    Sxx_db = 10 * np.log10(Sxx + 1e-10)

    # Normalize for display
    Sxx_db = (Sxx_db - Sxx_db.min()) / (Sxx_db.max() - Sxx_db.min() + 1e-10)

    # Create figure with transparent background
    dpi = 100
    fig_width = width_px / dpi
    fig_height = height_px / dpi

    fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=dpi)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    # Use a colormap that looks good on dark backgrounds
    # Reverse so low values are dark/transparent
    ax.imshow(
        Sxx_db,
        aspect='auto',
        origin='lower',
        cmap='inferno',
        vmin=0.1,  # Cut off very low values
        vmax=1.0
    )

    # Remove axes
    ax.set_xticks([])
    ax.set_yticks([])
    ax.axis('off')

    # Save with tight layout and transparency
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.savefig(output_path, transparent=True, bbox_inches='tight', pad_inches=0, dpi=dpi)
    plt.close()

    print(f"  Generated: {output_path}")


def main():
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    clips_json = os.path.join(base_dir, 'data', 'clips.json')
    clips_dir = os.path.join(base_dir, 'data', 'clips')
    output_dir = os.path.join(base_dir, 'data', 'spectrograms')

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Load clips metadata
    with open(clips_json, 'r') as f:
        clips = json.load(f)

    # All species (starter, expanded, sparrows, woodpeckers, warblers)
    expanded_species = [
        'NOCA', 'CARW', 'BLJA', 'AMCR', 'TUTI',  # Starter pack
        'BEKI', 'RSHA', 'AMGO', 'CACH', 'PIWA',
        'WTSP', 'HOFI', 'EABL', 'AMRO', 'HETH',
        'BHNU', 'BRCR', 'WBNU', 'YBSA', 'RBWO',
        'DOWO', 'HAWO', 'NOFL', 'PIWO', 'BRTH',
        'GRCA', 'MODO',
        # New additions
        'NOMO', 'GCKI', 'RCKI',
        'COHA', 'SSHA', 'RTHA', 'RTHU', 'BADO',
        'COGR', 'FICR', 'CEWA',
        # Sparrows pack
        'SOSP', 'CHSP', 'SWSP', 'SASP', 'FISP', 'LISP',
        # Additional woodpecker
        'RHWO',
        # Spring Warblers pack
        'AMRE', 'BAWW', 'BBWA', 'BLBW', 'BLPW', 'BTBW', 'BTNW', 'BWWA',
        'CAWA', 'CMWA', 'CONW', 'COYE', 'CSWA', 'GWWA', 'KEWA', 'LOWA',
        'MAWA', 'MOWA', 'NAWA', 'NOPA', 'NOWA', 'OCWA', 'OVEN', 'PAWA',
        'PIWA', 'PRAW', 'PROW', 'SWWA', 'TEWA', 'WEWA', 'WIWA', 'YRWA', 'YTWA',
    ]

    print(f"Generating spectrograms for expanded pack species...")
    print(f"Output directory: {output_dir}")

    generated = 0
    skipped_existing = 0
    for clip in clips:
        species = clip['species_code']
        if species not in expanded_species:
            continue
        if clip.get('rejected', False):
            continue

        # Get the clip filename
        file_path = clip['file_path']
        clip_filename = os.path.basename(file_path)
        clip_id = clip['clip_id']

        # Input path
        wav_path = os.path.join(base_dir, file_path)
        if not os.path.exists(wav_path):
            print(f"  Warning: File not found: {wav_path}")
            continue

        # Output path - use same base name as wav file for easy mapping
        wav_basename = os.path.splitext(clip_filename)[0]
        output_filename = f"{wav_basename}.png"
        output_path = os.path.join(output_dir, output_filename)

        # Skip if already exists
        if os.path.exists(output_path):
            skipped_existing += 1
            continue

        try:
            generate_spectrogram(wav_path, output_path)
            generated += 1
        except Exception as e:
            print(f"  Error processing {clip_filename}: {e}")

    print(f"\nDone! Generated {generated} new spectrograms (skipped {skipped_existing} existing).")
    print(f"Files saved to: {output_dir}")


if __name__ == '__main__':
    main()
