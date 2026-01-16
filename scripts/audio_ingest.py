#!/usr/bin/env python3
"""
Audio Ingestion Pipeline for ChipNotes!

Downloads bird audio from Xeno-canto, preprocesses to:
- Mono audio
- 0.5-3.0 second duration (trimmed to loudest section)
- -16 LUFS loudness normalization

XENO-CANTO API SETUP (required):
    1. Create account at https://xeno-canto.org
    2. Verify your email
    3. Get API key from https://xeno-canto.org/account
    4. Set environment variable:
       export XENO_CANTO_API_KEY='your-api-key-here'
    5. For persistence, add to ~/.zshrc or ~/.bashrc

Usage:
    # Test API connection first
    python audio_ingest.py --test-api

    # Download clips for default species
    python audio_ingest.py --output data/clips --max-per-species 3

    # Download clips for specific species
    python audio_ingest.py --output data/clips --species "Northern Cardinal" "Blue Jay"

    # Generate synthetic demo clips (no API needed)
    python audio_ingest.py --output data/clips --demo
"""

import argparse
import json
import os
import sys
import tempfile
import urllib.request
import urllib.parse
from pathlib import Path

try:
    import numpy as np
    import soundfile as sf
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install numpy soundfile")
    sys.exit(1)

try:
    import pyloudnorm as pyln
except ImportError:
    print("ERROR: pyloudnorm not installed. Run: pip install pyloudnorm")
    sys.exit(1)


# Target loudness in LUFS
TARGET_LUFS = -16.0
LUFS_TOLERANCE = 1.0

# Duration constraints in seconds
MIN_DURATION = 0.5
MAX_DURATION = 3.0

# Sample rate for output
OUTPUT_SAMPLE_RATE = 44100

# Default species for southeastern US birds with their characteristics
DEFAULT_SPECIES = [
    "Northern Cardinal",
    "Carolina Wren",
    "Blue Jay",
    "American Crow",
    "Tufted Titmouse",
]

# Species characteristics for demo audio generation (frequency range in Hz)
SPECIES_CHARACTERISTICS = {
    # Original 5 starter species
    "Northern Cardinal": {"code": "NOCA", "freq_base": 2800, "freq_range": 1500, "voc_type": "song"},
    "Carolina Wren": {"code": "CARW", "freq_base": 3200, "freq_range": 1200, "voc_type": "song"},
    "Blue Jay": {"code": "BLJA", "freq_base": 2200, "freq_range": 800, "voc_type": "call"},
    "American Crow": {"code": "AMCR", "freq_base": 800, "freq_range": 400, "voc_type": "call"},
    "Tufted Titmouse": {"code": "TUTI", "freq_base": 3500, "freq_range": 1000, "voc_type": "song"},
    # Expanded pack species (22 additional)
    "Belted Kingfisher": {"code": "BEKI", "freq_base": 2000, "freq_range": 1000, "voc_type": "call"},
    "Red-shouldered Hawk": {"code": "RSHA", "freq_base": 1500, "freq_range": 800, "voc_type": "call"},
    "American Goldfinch": {"code": "AMGO", "freq_base": 4000, "freq_range": 1500, "voc_type": "song"},
    "Carolina Chickadee": {"code": "CACH", "freq_base": 3800, "freq_range": 1200, "voc_type": "song"},
    "Pine Warbler": {"code": "PIWA", "freq_base": 3500, "freq_range": 800, "voc_type": "song", "query": 'gen:"Setophaga" sp:"pinus"'},
    "White-throated Sparrow": {"code": "WTSP", "freq_base": 3200, "freq_range": 1000, "voc_type": "song"},
    "House Finch": {"code": "HOFI", "freq_base": 3500, "freq_range": 1500, "voc_type": "song"},
    "Eastern Bluebird": {"code": "EABL", "freq_base": 3000, "freq_range": 1200, "voc_type": "song"},
    "American Robin": {"code": "AMRO", "freq_base": 2500, "freq_range": 1200, "voc_type": "song"},
    "Hermit Thrush": {"code": "HETH", "freq_base": 2800, "freq_range": 1500, "voc_type": "song"},
    "Brown-headed Nuthatch": {"code": "BHNU", "freq_base": 3500, "freq_range": 800, "voc_type": "call"},
    "Brown Creeper": {"code": "BRCR", "freq_base": 6000, "freq_range": 2000, "voc_type": "song"},
    "White-breasted Nuthatch": {"code": "WBNU", "freq_base": 2500, "freq_range": 800, "voc_type": "call"},
    "Yellow-bellied Sapsucker": {"code": "YBSA", "freq_base": 2000, "freq_range": 600, "voc_type": "call"},
    "Red-bellied Woodpecker": {"code": "RBWO", "freq_base": 2200, "freq_range": 800, "voc_type": "call"},
    "Downy Woodpecker": {"code": "DOWO", "freq_base": 4000, "freq_range": 1000, "voc_type": "call"},
    "Hairy Woodpecker": {"code": "HAWO", "freq_base": 3500, "freq_range": 1000, "voc_type": "call"},
    "Northern Flicker": {"code": "NOFL", "freq_base": 2500, "freq_range": 1000, "voc_type": "call"},
    "Pileated Woodpecker": {"code": "PIWO", "freq_base": 1800, "freq_range": 800, "voc_type": "call"},
    "Brown Thrasher": {"code": "BRTH", "freq_base": 2800, "freq_range": 1500, "voc_type": "song"},
    "Gray Catbird": {"code": "GRCA", "freq_base": 3000, "freq_range": 2000, "voc_type": "song"},
    "Mourning Dove": {"code": "MODO", "freq_base": 500, "freq_range": 300, "voc_type": "song"},
    # New sparrows pack
    "Song Sparrow": {"code": "SOSP", "freq_base": 3200, "freq_range": 1500, "voc_type": "song"},
    "Chipping Sparrow": {"code": "CHSP", "freq_base": 4500, "freq_range": 500, "voc_type": "song"},
    "Swamp Sparrow": {"code": "SWSP", "freq_base": 3000, "freq_range": 800, "voc_type": "song"},
    "Savannah Sparrow": {"code": "SASP", "freq_base": 4000, "freq_range": 1200, "voc_type": "song"},
    "Field Sparrow": {"code": "FISP", "freq_base": 3500, "freq_range": 1500, "voc_type": "song"},
    "Lincoln's Sparrow": {"code": "LISP", "freq_base": 3300, "freq_range": 1200, "voc_type": "song"},
    # Additional woodpecker
    "Red-headed Woodpecker": {"code": "RHWO", "freq_base": 2000, "freq_range": 800, "voc_type": "call"},
    # Spring Warblers pack (33 species)
    "Blue-winged Warbler": {"code": "BWWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Golden-winged Warbler": {"code": "GWWA", "freq_base": 5000, "freq_range": 1500, "voc_type": "song"},
    "Tennessee Warbler": {"code": "TEWA", "freq_base": 6000, "freq_range": 2000, "voc_type": "song"},
    "Orange-crowned Warbler": {"code": "OCWA", "freq_base": 5500, "freq_range": 1500, "voc_type": "song"},
    "Nashville Warbler": {"code": "NAWA", "freq_base": 5000, "freq_range": 1800, "voc_type": "song"},
    "Northern Parula": {"code": "NOPA", "freq_base": 5500, "freq_range": 2000, "voc_type": "song"},
    "Magnolia Warbler": {"code": "MAWA", "freq_base": 5000, "freq_range": 1500, "voc_type": "song"},
    "Cape May Warbler": {"code": "CMWA", "freq_base": 7000, "freq_range": 1500, "voc_type": "song"},
    "Black-throated Blue Warbler": {"code": "BTBW", "freq_base": 4500, "freq_range": 1200, "voc_type": "song"},
    "Yellow-rumped Warbler": {"code": "YRWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Blackburnian Warbler": {"code": "BLBW", "freq_base": 6500, "freq_range": 2000, "voc_type": "song"},
    "Blackpoll Warbler": {"code": "BLPW", "freq_base": 8000, "freq_range": 1500, "voc_type": "song"},
    "Black-throated Green Warbler": {"code": "BTNW", "freq_base": 5000, "freq_range": 1500, "voc_type": "song"},
    "Chestnut-sided Warbler": {"code": "CSWA", "freq_base": 5000, "freq_range": 1800, "voc_type": "song"},
    "Bay-breasted Warbler": {"code": "BBWA", "freq_base": 6000, "freq_range": 1500, "voc_type": "song"},
    "Prairie Warbler": {"code": "PRAW", "freq_base": 5500, "freq_range": 1500, "voc_type": "song"},
    "Palm Warbler": {"code": "PAWA", "freq_base": 5000, "freq_range": 1200, "voc_type": "song"},
    "Yellow-throated Warbler": {"code": "YTWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Prothonotary Warbler": {"code": "PROW", "freq_base": 4000, "freq_range": 1200, "voc_type": "song"},
    "Common Yellowthroat": {"code": "COYE", "freq_base": 4000, "freq_range": 1500, "voc_type": "song"},
    "Canada Warbler": {"code": "CAWA", "freq_base": 5000, "freq_range": 1800, "voc_type": "song"},
    "Wilson's Warbler": {"code": "WIWA", "freq_base": 5500, "freq_range": 1500, "voc_type": "song"},
    "American Redstart": {"code": "AMRE", "freq_base": 6000, "freq_range": 2000, "voc_type": "song"},
    "Ovenbird": {"code": "OVEN", "freq_base": 4000, "freq_range": 1500, "voc_type": "song"},
    "Northern Waterthrush": {"code": "NOWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Louisiana Waterthrush": {"code": "LOWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Black-and-white Warbler": {"code": "BAWW", "freq_base": 6500, "freq_range": 1500, "voc_type": "song"},
    "Connecticut Warbler": {"code": "CONW", "freq_base": 4000, "freq_range": 1200, "voc_type": "song"},
    "Mourning Warbler": {"code": "MOWA", "freq_base": 4500, "freq_range": 1500, "voc_type": "song"},
    "Kentucky Warbler": {"code": "KEWA", "freq_base": 4000, "freq_range": 1500, "voc_type": "song"},
    "Hooded Warbler": {"code": "HOWA", "freq_base": 4500, "freq_range": 1800, "voc_type": "song"},
    "Swainson's Warbler": {"code": "SWWA", "freq_base": 3500, "freq_range": 1500, "voc_type": "song"},
    "Yellow Warbler": {"code": "YEWA", "freq_base": 5000, "freq_range": 1500, "voc_type": "song"},
}


def get_api_key() -> str:
    """Get Xeno-canto API key from environment."""
    key = os.environ.get('XENO_CANTO_API_KEY', '')
    if not key:
        print("ERROR: XENO_CANTO_API_KEY environment variable not set.")
        print("  Set it with: export XENO_CANTO_API_KEY='your-api-key'")
        print("  Or use --demo mode for synthetic clips.")
    return key


def fetch_xeno_canto_recordings(species_name: str, max_results: int = 5) -> list:
    """
    Fetch recording metadata from Xeno-canto API v3.

    API v3 REQUIREMENTS (as of 2025):
    - Requires API key: get from https://xeno-canto.org/account
    - Set via: export XENO_CANTO_API_KEY='your-key'
    - Queries MUST use tags (en:, q:, cnt:, etc.) - plain text searches return 0 results
    - Tag format: en:"Species Name" (quotes required for multi-word values)
    - Multiple tags joined with + in URL

    See: https://xeno-canto.org/explore/api
    """
    api_key = get_api_key()
    if not api_key:
        return []

    # API v3 requires tag-based queries. Plain text like "cardinal" returns nothing.
    # Format: en:"English Name" - filter quality client-side for flexibility
    # Note: cnt:"United States" filter often returns 0 results, so we filter client-side
    query = urllib.parse.quote(f'en:"{species_name}"')
    url = f"https://xeno-canto.org/api/3/recordings?query={query}&key={api_key}&per_page=100"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SoundField-Birds/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())

        # Check for API errors
        if 'error' in data:
            print(f"  API Error: {data.get('error')} - {data.get('message')}")
            return []

        recordings = data.get('recordings', [])

        # Filter for US/Canada recordings, quality A/B, and reasonable length
        good_recordings = []
        for rec in recordings:
            # Prefer US/Canada recordings for North American focus
            if rec.get('cnt') not in ['United States', 'Canada']:
                continue
            if rec.get('q') not in ['A', 'B']:
                continue
            try:
                length_parts = rec.get('length', '0:00').split(':')
                if len(length_parts) == 2:
                    minutes, seconds = int(length_parts[0]), int(length_parts[1])
                    total_seconds = minutes * 60 + seconds
                    if 3 <= total_seconds <= 90:  # Will be trimmed to 3s
                        good_recordings.append(rec)
            except (ValueError, IndexError):
                continue

        return good_recordings[:max_results]

    except Exception as e:
        print(f"  Warning: Could not fetch from Xeno-canto for {species_name}: {e}")
        return []


def download_audio(url: str, output_path: str) -> bool:
    """Download audio file from URL."""
    try:
        # Ensure HTTPS
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('http://'):
            url = url.replace('http://', 'https://')

        req = urllib.request.Request(url, headers={'User-Agent': 'SoundField-Birds/1.0'})
        with urllib.request.urlopen(req, timeout=60) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"  Warning: Download failed: {e}")
        return False


def convert_to_mono(audio: np.ndarray) -> np.ndarray:
    """Convert stereo audio to mono."""
    if len(audio.shape) > 1 and audio.shape[1] > 1:
        return np.mean(audio, axis=1)
    return audio.flatten()


def trim_audio(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Trim audio to MIN_DURATION - MAX_DURATION seconds."""
    min_samples = int(MIN_DURATION * sample_rate)
    max_samples = int(MAX_DURATION * sample_rate)

    if len(audio) < min_samples:
        # Pad with silence if too short
        padding = min_samples - len(audio)
        audio = np.pad(audio, (0, padding), mode='constant', constant_values=0)
    elif len(audio) > max_samples:
        # Find the loudest section and trim around it
        window_size = max_samples
        if len(audio) > window_size:
            # Calculate RMS energy in sliding windows
            step = sample_rate // 10  # 100ms steps
            best_start = 0
            best_energy = 0

            for start in range(0, len(audio) - window_size, step):
                window = audio[start:start + window_size]
                energy = np.sqrt(np.mean(window ** 2))
                if energy > best_energy:
                    best_energy = energy
                    best_start = start

            audio = audio[best_start:best_start + max_samples]
        else:
            audio = audio[:max_samples]

    return audio


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


def process_audio_file(input_path: str, output_path: str) -> dict:
    """Process a single audio file through the pipeline."""
    try:
        # Load audio
        audio, sample_rate = sf.read(input_path)

        # Convert to mono
        audio = convert_to_mono(audio)

        # Resample if needed
        if sample_rate != OUTPUT_SAMPLE_RATE:
            # Simple resampling (for production, use librosa or scipy)
            duration = len(audio) / sample_rate
            new_length = int(duration * OUTPUT_SAMPLE_RATE)
            indices = np.linspace(0, len(audio) - 1, new_length)
            audio = np.interp(indices, np.arange(len(audio)), audio)
            sample_rate = OUTPUT_SAMPLE_RATE

        # Trim to valid duration
        audio = trim_audio(audio, sample_rate)

        # Normalize loudness
        audio = normalize_loudness(audio, sample_rate)

        # Calculate final duration
        duration_ms = int(len(audio) / sample_rate * 1000)

        # Save processed audio
        sf.write(output_path, audio, sample_rate, subtype='PCM_16')

        # Verify loudness
        meter = pyln.Meter(sample_rate)
        final_loudness = meter.integrated_loudness(audio)

        return {
            'success': True,
            'duration_ms': duration_ms,
            'loudness_lufs': round(final_loudness, 1),
            'sample_rate': sample_rate
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def generate_bird_like_audio(species_name: str, duration_sec: float = 1.5) -> np.ndarray:
    """Generate synthetic bird-like audio for demo/testing purposes."""
    chars = SPECIES_CHARACTERISTICS.get(species_name, {
        "code": "DEMO",
        "freq_base": 2500,
        "freq_range": 1000,
        "voc_type": "song"
    })

    t = np.linspace(0, duration_sec, int(OUTPUT_SAMPLE_RATE * duration_sec))

    # Create a bird-like chirp with frequency modulation
    freq_base = chars["freq_base"]
    freq_range = chars["freq_range"]

    # Multiple chirp components
    audio = np.zeros_like(t)

    # Number of chirps depends on duration
    num_chirps = int(duration_sec * 3) + 1

    for i in range(num_chirps):
        chirp_start = i * (duration_sec / num_chirps)
        chirp_duration = 0.15 + np.random.random() * 0.2
        chirp_end = chirp_start + chirp_duration

        # Create mask for this chirp
        mask = (t >= chirp_start) & (t < min(chirp_end, duration_sec))

        if np.any(mask):
            local_t = t[mask] - chirp_start

            # Frequency sweep (up or down)
            if np.random.random() > 0.5:
                freq = freq_base + freq_range * (local_t / chirp_duration)
            else:
                freq = freq_base + freq_range * (1 - local_t / chirp_duration)

            # Add some frequency wobble
            freq = freq + 50 * np.sin(2 * np.pi * 30 * local_t)

            # Generate chirp with amplitude envelope
            envelope = np.sin(np.pi * local_t / chirp_duration)  # Smooth attack/decay
            chirp = envelope * np.sin(2 * np.pi * freq * local_t)

            # Add harmonic
            chirp += 0.3 * envelope * np.sin(2 * np.pi * 2 * freq * local_t)

            audio[mask] += chirp

    # Normalize to reasonable level
    if np.max(np.abs(audio)) > 0:
        audio = audio / np.max(np.abs(audio)) * 0.8

    return audio


def generate_demo_clips(species_list: list, output_dir: str) -> list:
    """Generate demo audio clips for testing."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    processed_files = []

    for species_name in species_list:
        print(f"Generating demo clip for: {species_name}")

        chars = SPECIES_CHARACTERISTICS.get(species_name, {
            "code": species_name.replace(' ', '')[:4].upper(),
            "freq_base": 2500,
            "freq_range": 1000,
            "voc_type": "song"
        })

        species_code = chars["code"]

        # Generate random duration between MIN and MAX
        duration = MIN_DURATION + np.random.random() * (MAX_DURATION - MIN_DURATION)

        # Generate bird-like audio
        audio = generate_bird_like_audio(species_name, duration)

        # Normalize loudness
        audio = normalize_loudness(audio, OUTPUT_SAMPLE_RATE)

        # Calculate duration
        duration_ms = int(len(audio) / OUTPUT_SAMPLE_RATE * 1000)

        # Generate unique ID
        rec_id = f"DEMO{np.random.randint(10000, 99999)}"
        output_file = output_path / f"{species_code}_{rec_id}.wav"

        # Save audio
        sf.write(str(output_file), audio, OUTPUT_SAMPLE_RATE, subtype='PCM_16')

        # Verify loudness
        meter = pyln.Meter(OUTPUT_SAMPLE_RATE)
        final_loudness = meter.integrated_loudness(audio)

        print(f"  OK: {output_file.name} ({duration_ms}ms, {round(final_loudness, 1)} LUFS)")

        processed_files.append({
            'file_path': str(output_file),
            'species_name': species_name,
            'species_code': species_code,
            'source': 'demo',
            'source_id': rec_id,
            'vocalization_type': chars["voc_type"],
            'duration_ms': duration_ms,
            'loudness_lufs': round(final_loudness, 1),
            'quality': 'A'
        })

    return processed_files


def ingest_from_xeno_canto(species_list: list, output_dir: str, max_per_species: int = 1) -> list:
    """Ingest audio from Xeno-canto for given species."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    processed_files = []

    for species_name in species_list:
        print(f"Fetching recordings for: {species_name}")
        recordings = fetch_xeno_canto_recordings(species_name, max_per_species)

        if not recordings:
            print(f"  No suitable recordings found")
            continue

        for rec in recordings:
            rec_id = rec.get('id', 'unknown')
            file_url = rec.get('file')

            if not file_url:
                continue

            print(f"  Processing XC{rec_id}...")

            # Download to temp file
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                tmp_path = tmp.name

            if not download_audio(file_url, tmp_path):
                os.unlink(tmp_path)
                continue

            # Generate output filename using standard 4-letter codes
            chars = SPECIES_CHARACTERISTICS.get(species_name, {})
            species_code = chars.get('code', species_name.replace(' ', '')[:4].upper())
            output_file = output_path / f"{species_code}_{rec_id}.wav"

            # Process audio
            result = process_audio_file(tmp_path, str(output_file))
            os.unlink(tmp_path)

            if result['success']:
                print(f"    OK: {output_file.name} ({result['duration_ms']}ms, {result['loudness_lufs']} LUFS)")
                processed_files.append({
                    'file_path': str(output_file),
                    'species_name': species_name,
                    'species_code': species_code,
                    'source': 'xenocanto',
                    'source_id': f"XC{rec_id}",
                    'recordist': rec.get('rec'),
                    'vocalization_type': rec.get('type', 'song').split(',')[0].strip().lower(),
                    'duration_ms': result['duration_ms'],
                    'loudness_lufs': result['loudness_lufs'],
                    'quality': rec.get('q', 'B')
                })
            else:
                print(f"    FAILED: {result.get('error', 'Unknown error')}")

    return processed_files


def test_api_connection() -> bool:
    """Test Xeno-canto API connection and return True if working."""
    api_key = get_api_key()
    if not api_key:
        return False

    print("Testing Xeno-canto API v3 connection...")
    print(f"  API key: {api_key[:8]}...{api_key[-4:]}")

    # Test with a known species
    test_species = "Northern Cardinal"
    query = urllib.parse.quote(f'en:"{test_species}" q:A')
    url = f"https://xeno-canto.org/api/3/recordings?query={query}&key={api_key}&per_page=5"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'SoundField-Birds/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())

        if 'error' in data:
            print(f"  ERROR: {data.get('error')} - {data.get('message')}")
            print("\n  Troubleshooting:")
            print("  - Verify your API key at https://xeno-canto.org/account")
            print("  - Make sure your email is verified")
            print("  - Try regenerating your API key")
            return False

        num_recordings = data.get('numRecordings', 0)
        print(f"  SUCCESS! Found {num_recordings} recordings for '{test_species}'")

        # Show a sample
        recs = data.get('recordings', [])[:3]
        if recs:
            print("\n  Sample recordings:")
            for r in recs:
                print(f"    XC{r['id']}: {r.get('type', '?')} ({r.get('length', '?')}) - {r.get('cnt', '?')}")

        return True

    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Audio ingestion pipeline for ChipNotes!')
    parser.add_argument('--output', help='Output directory for processed audio')
    parser.add_argument('--species', nargs='+', help='Species names to fetch')
    parser.add_argument('--max-per-species', type=int, default=1, help='Max recordings per species')
    parser.add_argument('--manifest', help='Output manifest JSON file')
    parser.add_argument('--demo', action='store_true', help='Generate demo clips instead of downloading')
    parser.add_argument('--test-api', action='store_true', help='Test API connection and exit')

    args = parser.parse_args()

    # Handle --test-api
    if args.test_api:
        success = test_api_connection()
        return 0 if success else 1

    # Require --output for actual ingestion
    if not args.output:
        parser.error("--output is required (or use --test-api to verify API connection)")

    species_list = args.species if args.species else DEFAULT_SPECIES

    print(f"=== Audio Ingestion Pipeline ===")
    print(f"Target LUFS: {TARGET_LUFS}")
    print(f"Duration range: {MIN_DURATION}-{MAX_DURATION}s")
    print(f"Species: {len(species_list)}")
    if args.demo:
        print(f"Mode: DEMO (generating synthetic clips)")
    print()

    if args.demo:
        processed = generate_demo_clips(species_list, args.output)
    else:
        processed = ingest_from_xeno_canto(species_list, args.output, args.max_per_species)

    print()
    print(f"=== Summary ===")
    print(f"Successfully processed: {len(processed)} files")

    if args.manifest:
        with open(args.manifest, 'w') as f:
            json.dump(processed, f, indent=2)
        print(f"Manifest written to: {args.manifest}")

    # Write internal manifest for audio_tagger.py
    manifest_path = Path(args.output) / '.ingest_manifest.json'
    with open(manifest_path, 'w') as f:
        json.dump(processed, f, indent=2)

    return 0 if len(processed) > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
