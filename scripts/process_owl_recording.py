#!/usr/bin/env python3
"""
Process owl recording: find hoots, extract separate 3-second clips.
"""

import numpy as np
from scipy.io import wavfile
from scipy import signal
from scipy.ndimage import uniform_filter1d
import os
import subprocess
import hashlib


def find_hoots(audio, sr, min_freq=200, max_freq=800,
               min_duration=0.3, min_gap=0.2, energy_threshold_percentile=85):
    """
    Find owl hoots by detecting energy in the low frequency range.
    Returns list of (start_sample, end_sample) tuples.
    """
    # Bandpass filter to isolate owl hoot frequencies
    nyquist = sr / 2
    low = min_freq / nyquist
    high = max_freq / nyquist
    b, a = signal.butter(4, [low, high], btype='band')
    filtered = signal.filtfilt(b, a, audio)

    # Compute envelope (smoothed absolute value)
    envelope = np.abs(filtered)
    window_size = int(0.05 * sr)  # 50ms window
    envelope = uniform_filter1d(envelope, window_size)

    # Find threshold
    threshold = np.percentile(envelope, energy_threshold_percentile)

    # Find regions above threshold
    above_threshold = envelope > threshold

    # Find transitions
    diff = np.diff(above_threshold.astype(int))
    starts = np.where(diff == 1)[0]
    ends = np.where(diff == -1)[0]

    # Handle edge cases
    if len(starts) == 0 or len(ends) == 0:
        return []

    if ends[0] < starts[0]:
        ends = ends[1:]
    if len(starts) > len(ends):
        starts = starts[:len(ends)]

    # Filter by duration
    min_samples = int(min_duration * sr)
    hoots = []
    for start, end in zip(starts, ends):
        duration = end - start
        if duration >= min_samples:
            # Add some padding
            pad = int(0.1 * sr)
            hoots.append((max(0, start - pad), min(len(audio), end + pad)))

    # Merge hoots that are very close together (within min_gap)
    min_gap_samples = int(min_gap * sr)
    merged = []
    for start, end in hoots:
        if merged and start - merged[-1][1] < min_gap_samples:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    return merged


def spectral_noise_reduction(audio, sr, noise_reduce_factor=0.7):
    """
    Simple spectral noise reduction using spectral gating.
    """
    # Use STFT
    nperseg = 2048
    f, t, Zxx = signal.stft(audio, sr, nperseg=nperseg)

    # Estimate noise floor from quietest portions
    magnitude = np.abs(Zxx)
    phase = np.angle(Zxx)

    # Use bottom 20% of frames as noise estimate
    frame_energy = np.sum(magnitude, axis=0)
    noise_frames = frame_energy < np.percentile(frame_energy, 20)

    if np.any(noise_frames):
        noise_profile = np.mean(magnitude[:, noise_frames], axis=1, keepdims=True)
    else:
        noise_profile = np.percentile(magnitude, 10, axis=1, keepdims=True)

    # Spectral subtraction with soft gating
    magnitude_cleaned = np.maximum(magnitude - noise_reduce_factor * noise_profile, 0)

    # Reconstruct
    Zxx_cleaned = magnitude_cleaned * np.exp(1j * phase)
    _, audio_cleaned = signal.istft(Zxx_cleaned, sr, nperseg=nperseg)

    # Match length
    if len(audio_cleaned) > len(audio):
        audio_cleaned = audio_cleaned[:len(audio)]
    elif len(audio_cleaned) < len(audio):
        audio_cleaned = np.pad(audio_cleaned, (0, len(audio) - len(audio_cleaned)))

    return audio_cleaned


def extract_clip(audio, sr, center_sample, target_duration=3.0):
    """
    Extract a clip centered on a sample position.
    """
    target_samples = int(target_duration * sr)
    half = target_samples // 2

    start = center_sample - half
    end = start + target_samples

    # Adjust if we go past boundaries
    if start < 0:
        start = 0
        end = target_samples
    if end > len(audio):
        end = len(audio)
        start = max(0, end - target_samples)

    clip = audio[start:end]

    # Pad if needed
    if len(clip) < target_samples:
        clip = np.pad(clip, (0, target_samples - len(clip)))

    return clip


def normalize_and_fade(audio, sr):
    """
    Normalize to reasonable level and apply fade in/out.
    """
    # Normalize to -16 LUFS approximately (target peak around -3dB)
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio * (0.7 / peak)

    # Apply fade in/out
    fade_samples = int(0.05 * sr)
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out

    return audio


def generate_clip_id():
    """Generate a short random ID."""
    return hashlib.md5(os.urandom(16)).hexdigest()[:8]


def process_recording(input_path, output_dir, base_name, target_duration=3.0):
    """
    Process a recording and extract separate clips for each hoot/section.
    """
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(input_path)}")
    print(f"{'='*60}")

    # Convert to WAV first if needed
    temp_wav = os.path.join(output_dir, f"{base_name}_temp.wav")

    if input_path.endswith('.m4a'):
        print("Converting to WAV...")
        subprocess.run([
            'ffmpeg', '-y', '-i', input_path,
            '-ar', '44100', temp_wav
        ], capture_output=True)
        wav_path = temp_wav
    else:
        wav_path = input_path

    # Load audio
    sr, audio = wavfile.read(wav_path)

    # Convert to float
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0
    elif audio.dtype == np.int32:
        audio = audio.astype(np.float32) / 2147483648.0

    # Convert to mono if stereo
    if len(audio.shape) > 1:
        audio = audio.mean(axis=1)

    duration = len(audio) / sr
    print(f"Duration: {duration:.1f}s at {sr} Hz")

    # Find hoots
    print("Finding owl sounds...")
    hoots = find_hoots(audio, sr)

    if not hoots:
        print("No hoots found with default threshold, trying lower...")
        hoots = find_hoots(audio, sr, energy_threshold_percentile=75)

    if not hoots:
        print("Still no hoots found, trying even lower...")
        hoots = find_hoots(audio, sr, energy_threshold_percentile=65)

    print(f"Found {len(hoots)} sound segments:")
    for i, (start, end) in enumerate(hoots):
        print(f"  Segment {i+1}: {start/sr:.2f}s - {end/sr:.2f}s ({(end-start)/sr:.2f}s)")

    # Apply noise reduction to full audio first
    print("Applying noise reduction...")
    audio_cleaned = spectral_noise_reduction(audio, sr)

    # Extract clips
    clips_saved = []

    if not hoots:
        # No hoots found - just take the middle 3 seconds
        print("No segments found - extracting middle section")
        center = len(audio_cleaned) // 2
        clip = extract_clip(audio_cleaned, sr, center, target_duration)
        clip = normalize_and_fade(clip, sr)

        clip_id = generate_clip_id()
        output_path = os.path.join(output_dir, f"BADO_{clip_id}.wav")
        clip_int = (clip * 32767).astype(np.int16)
        wavfile.write(output_path, sr, clip_int)
        clips_saved.append(output_path)
        print(f"  Saved: {os.path.basename(output_path)}")

    else:
        # Extract a clip for each significant hoot
        for i, (start, end) in enumerate(hoots):
            hoot_duration = (end - start) / sr

            # For short hoots, just center on them
            if hoot_duration <= target_duration:
                center = (start + end) // 2
                clip = extract_clip(audio_cleaned, sr, center, target_duration)
                clip = normalize_and_fade(clip, sr)

                clip_id = generate_clip_id()
                output_path = os.path.join(output_dir, f"BADO_{clip_id}.wav")
                clip_int = (clip * 32767).astype(np.int16)
                wavfile.write(output_path, sr, clip_int)
                clips_saved.append(output_path)
                print(f"  Saved: {os.path.basename(output_path)} (from segment {i+1})")

            else:
                # For longer hoots, extract multiple clips
                num_clips = int(np.ceil(hoot_duration / target_duration))
                step = (end - start) // num_clips

                for j in range(num_clips):
                    center = start + step * j + step // 2
                    clip = extract_clip(audio_cleaned, sr, center, target_duration)
                    clip = normalize_and_fade(clip, sr)

                    clip_id = generate_clip_id()
                    output_path = os.path.join(output_dir, f"BADO_{clip_id}.wav")
                    clip_int = (clip * 32767).astype(np.int16)
                    wavfile.write(output_path, sr, clip_int)
                    clips_saved.append(output_path)
                    print(f"  Saved: {os.path.basename(output_path)} (from segment {i+1}, part {j+1})")

    # Clean up temp file
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    print(f"Total clips from this recording: {len(clips_saved)}")
    return clips_saved


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, 'data', 'clips')

    # Files to process
    input_files = [
        "/Users/peterrepetti/Downloads/BADO-3.m4a",
        "/Users/peterrepetti/Downloads/BADO-2.m4a",
        "/Users/peterrepetti/Downloads/BADO-1.m4a",
        "/Users/peterrepetti/Downloads/BADO monkeys.m4a",
        "/Users/peterrepetti/Downloads/BADO.m4a",
    ]

    all_clips = []
    for input_path in input_files:
        if os.path.exists(input_path):
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            base_name = base_name.replace(' ', '_')
            clips = process_recording(input_path, output_dir, base_name)
            all_clips.extend(clips)
        else:
            print(f"File not found: {input_path}")

    print(f"\n{'='*60}")
    print(f"COMPLETE! Generated {len(all_clips)} clips total")
    print(f"{'='*60}")
    for clip in all_clips:
        print(f"  {os.path.basename(clip)}")


if __name__ == '__main__':
    main()
