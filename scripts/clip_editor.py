#!/usr/bin/env python3
"""
Clip Editor Tool for ChipNotes!

A flexible tool for extracting, editing, and managing audio clips.

Use cases:
1. Add a new bird: --xc 123456 --species RWBL
2. Add more clips to existing bird: --species EAME
3. Fix a specific clip: --clip EAME_906697
4. Browse and curate: --species EAME

Usage:
    # Add new bird from XC recording
    python scripts/clip_editor.py --xc 123456 --species RWBL

    # Browse/edit existing species
    python scripts/clip_editor.py --species EAME

    # Fix a specific clip
    python scripts/clip_editor.py --clip EAME_906697

    # Load a local source file
    python scripts/clip_editor.py --source ~/Downloads/recording.mp3 --species RWBL
"""

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote

PORT = 8889
PROJECT_ROOT = Path(__file__).parent.parent

# Audio processing imports
try:
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln
except ImportError:
    print("ERROR: Required packages not installed.")
    print("Run: pip install numpy soundfile pyloudnorm")
    exit(1)

# Processing constants
TARGET_LUFS = -16.0
OUTPUT_SAMPLE_RATE = 44100
MIN_DURATION = 0.5
MAX_DURATION = 3.0


class ClipEditorHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for clip editor server"""

    # Initial state (can be None)
    initial_source_path = None
    initial_clip = None
    species_code = None
    xc_id = None

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/':
            self.send_html()
        elif path == '/api/init':
            self.send_init_state()
        elif path == '/api/clips':
            self.send_clips_for_species()
        elif path == '/api/clip-info':
            clip_id = query.get('id', [None])[0]
            self.send_clip_info(clip_id)
        elif path == '/api/waveform':
            source = query.get('source', [None])[0]
            self.send_waveform(source)
        elif path == '/api/load-xc':
            xc_id = query.get('id', [None])[0]
            self.load_xc_recording(xc_id)
        elif path.startswith('/audio/'):
            self.serve_audio(path[7:])
        elif path.startswith('/data/'):
            self.serve_file(path[1:])
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/extract':
            self.handle_extract()
        else:
            self.send_error(404)

    def send_html(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(generate_html().encode())

    def send_init_state(self):
        """Send initial state based on how tool was launched"""
        state = {
            'species_code': self.species_code,
            'initial_source': str(self.initial_source_path) if self.initial_source_path else None,
            'initial_clip': self.initial_clip,
            'xc_id': self.xc_id,
        }

        # Get species info if available
        if self.species_code:
            species_data = load_species_data()
            if self.species_code.upper() in species_data:
                sp = species_data[self.species_code.upper()]
                state['species_info'] = {
                    'common_name': sp.get('common_name'),
                    'scientific_name': sp.get('scientific_name'),
                }

        self.send_json(state)

    def send_clips_for_species(self):
        """Send all clips for the current species"""
        clips = get_clips_for_species(self.species_code)
        self.send_json(clips)

    def send_clip_info(self, clip_id):
        """Send detailed info for a specific clip, including source availability"""
        if not clip_id:
            self.send_error(400, "Missing clip ID")
            return

        clip_data = get_clip_by_id(clip_id)
        if not clip_data:
            self.send_error(404, "Clip not found")
            return

        # Check if source is available
        source_info = find_source_for_clip(clip_data)

        result = {
            'clip': clip_data,
            'source': source_info,
        }

        self.send_json(result)

    def send_waveform(self, source):
        """Generate and send waveform data for a source"""
        if not source:
            self.send_error(400, "Missing source")
            return

        source_path = Path(source)
        if not source_path.exists():
            # Try as relative to project
            source_path = PROJECT_ROOT / source
        if not source_path.exists():
            self.send_error(404, f"Source not found: {source}")
            return

        try:
            audio, sr = sf.read(str(source_path))
            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=1)

            # Downsample for visualization
            target_points = 1500
            if len(audio) > target_points:
                chunk_size = len(audio) // target_points
                chunks = len(audio) // chunk_size
                audio_trimmed = audio[:chunks * chunk_size]
                reshaped = audio_trimmed.reshape(chunks, chunk_size)
                mins = reshaped.min(axis=1).tolist()
                maxs = reshaped.max(axis=1).tolist()
            else:
                mins = audio.tolist()
                maxs = audio.tolist()

            data = {
                'sample_rate': sr,
                'duration': len(audio) / sr,
                'mins': mins,
                'maxs': maxs,
                'source_path': str(source_path),
            }

            self.send_json(data)
        except Exception as e:
            self.send_error(500, str(e))

    def load_xc_recording(self, xc_id):
        """Download and return info for an XC recording"""
        if not xc_id:
            self.send_error(400, "Missing XC ID")
            return

        try:
            source_path = download_xc_recording(xc_id, Path('/tmp/clip-edit'))

            # Get duration
            info = sf.info(str(source_path))

            result = {
                'success': True,
                'source_path': str(source_path),
                'xc_id': xc_id,
                'duration': info.duration,
            }
            self.send_json(result)
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)})

    def serve_audio(self, source_path):
        """Serve an audio file"""
        # URL decode the path
        source_path = unquote(source_path)

        # Handle different path formats
        if source_path.startswith('/'):
            file_path = Path(source_path)
        else:
            file_path = Path(source_path)
            if not file_path.exists():
                file_path = PROJECT_ROOT / source_path

        if not file_path.exists():
            self.send_error(404, f"Audio not found: {source_path}")
            return

        self.send_response(200)
        suffix = file_path.suffix.lower()
        if suffix == '.mp3':
            self.send_header('Content-type', 'audio/mpeg')
        else:
            self.send_header('Content-type', 'audio/wav')

        file_size = file_path.stat().st_size
        self.send_header('Content-Length', str(file_size))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()

        with open(file_path, 'rb') as f:
            self.wfile.write(f.read())

    def serve_file(self, relative_path):
        """Serve files from data directory"""
        file_path = PROJECT_ROOT / relative_path
        if not file_path.exists():
            self.send_error(404)
            return

        self.send_response(200)
        if file_path.suffix == '.wav':
            self.send_header('Content-type', 'audio/wav')
        elif file_path.suffix == '.png':
            self.send_header('Content-type', 'image/png')
        elif file_path.suffix == '.json':
            self.send_header('Content-type', 'application/json')

        self.send_header('Content-Length', str(file_path.stat().st_size))
        self.end_headers()

        with open(file_path, 'rb') as f:
            self.wfile.write(f.read())

    def handle_extract(self):
        """Extract a clip segment"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode())

        try:
            result = extract_clip(
                source_path=Path(params['source_path']),
                start_time=params['start_time'],
                duration=params['duration'],
                species_code=params['species_code'],
                xc_id=params.get('xc_id'),
                vocalization_type=params.get('vocalization_type', 'song'),
                recordist=params.get('recordist', 'Unknown'),
                replace_clip_id=params.get('replace_clip_id'),
            )

            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def get_clips_for_species(species_code):
    """Get all clips for a species"""
    if not species_code:
        return []

    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    if not clips_json_path.exists():
        return []

    with open(clips_json_path, 'r') as f:
        all_clips = json.load(f)

    return [c for c in all_clips if c.get('species_code', '').upper() == species_code.upper()]


def get_clip_by_id(clip_id):
    """Get a clip by ID, file path, or source ID"""
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    if not clips_json_path.exists():
        return None

    with open(clips_json_path, 'r') as f:
        clips = json.load(f)

    for c in clips:
        if c['clip_id'] == clip_id:
            return c
        if clip_id in c.get('file_path', ''):
            return c
        if clip_id in c.get('source_id', ''):
            return c

    return None


def find_source_for_clip(clip_data):
    """Find source recording info for a clip"""
    source_id = clip_data.get('source_id', '')
    xc_match = re.match(r'XC(\d+)', source_id)

    result = {
        'type': None,
        'path': None,
        'xc_id': None,
        'available': False,
        'can_download': False,
    }

    if xc_match:
        xc_id = xc_match.group(1)
        result['xc_id'] = xc_id
        result['type'] = 'xc'
        result['can_download'] = True

        # Check if already downloaded
        for ext in ['.mp3', '.wav']:
            for pattern in [f'XC{xc_id}_full{ext}', f'XC{xc_id}*{ext}', f'*{xc_id}*{ext}']:
                matches = list(Path('/tmp/clip-edit').glob(pattern))
                if matches:
                    result['path'] = str(matches[0])
                    result['available'] = True
                    # Get duration
                    try:
                        info = sf.info(str(matches[0]))
                        result['duration'] = info.duration
                    except:
                        pass
                    return result

    elif clip_data.get('source') == 'doc':
        result['type'] = 'doc'
        source_file = clip_data.get('source_file')
        if source_file:
            source_path = PROJECT_ROOT / "data" / "raw-nz" / source_file
            if source_path.exists():
                result['path'] = str(source_path)
                result['available'] = True

    # Fall back to clip itself
    if not result['available']:
        clip_path = PROJECT_ROOT / clip_data.get('file_path', '')
        if clip_path.exists():
            result['type'] = 'clip'
            result['path'] = str(clip_path)
            result['available'] = True
            try:
                info = sf.info(str(clip_path))
                result['duration'] = info.duration
            except:
                pass

    return result


def extract_clip(source_path: Path, start_time: float, duration: float,
                 species_code: str, xc_id: str = None,
                 vocalization_type: str = 'song', recordist: str = 'Unknown',
                 replace_clip_id: str = None) -> dict:
    """Extract a clip segment from source recording."""

    # Validate inputs
    if duration < MIN_DURATION or duration > MAX_DURATION:
        raise ValueError(f"Duration must be {MIN_DURATION}-{MAX_DURATION}s, got {duration}")

    # Load audio
    audio, sr = sf.read(str(source_path))

    # Convert to mono
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    # Extract segment
    start_sample = int(start_time * sr)
    end_sample = int((start_time + duration) * sr)

    if start_sample < 0 or end_sample > len(audio):
        raise ValueError(f"Selection out of bounds: {start_time}-{start_time+duration}s")

    segment = audio[start_sample:end_sample]

    # Resample if needed
    if sr != OUTPUT_SAMPLE_RATE:
        duration_sec = len(segment) / sr
        new_length = int(duration_sec * OUTPUT_SAMPLE_RATE)
        indices = np.linspace(0, len(segment) - 1, new_length)
        segment = np.interp(indices, np.arange(len(segment)), segment)
        sr = OUTPUT_SAMPLE_RATE

    # Normalize loudness
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(segment)
    if not np.isinf(loudness) and not np.isnan(loudness):
        segment = pyln.normalize.loudness(segment, loudness, TARGET_LUFS)
        segment = np.clip(segment, -1.0, 1.0)

    # Load existing clips
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    existing_clips = []
    if clips_json_path.exists():
        with open(clips_json_path, 'r') as f:
            existing_clips = json.load(f)

    # Get existing clip data if replacing
    existing_clip_data = None
    if replace_clip_id:
        for c in existing_clips:
            if c['clip_id'] == replace_clip_id:
                existing_clip_data = c
                break

    # Determine clip ID
    if replace_clip_id:
        clip_id = replace_clip_id
    elif xc_id:
        # XC naming: {SPECIES}_{XCID}_{N}
        prefix = f"{species_code.upper()}_{xc_id}_"
        existing_nums = []
        for c in existing_clips:
            if c['clip_id'].startswith(prefix):
                try:
                    num = int(c['clip_id'][len(prefix):])
                    existing_nums.append(num)
                except ValueError:
                    pass
        next_num = max(existing_nums, default=0) + 1
        clip_id = f"{prefix}{next_num}"
    else:
        # Generic naming
        prefix = f"{species_code.upper()}_clip_"
        existing_nums = []
        for c in existing_clips:
            if c['clip_id'].startswith(prefix):
                try:
                    num = int(c['clip_id'][len(prefix):])
                    existing_nums.append(num)
                except ValueError:
                    pass
        next_num = max(existing_nums, default=0) + 1
        clip_id = f"{prefix}{next_num}"

    # Output paths
    output_filename = f"{clip_id}.wav"
    output_path = PROJECT_ROOT / "data" / "clips" / output_filename
    spectrogram_path = PROJECT_ROOT / "data" / "spectrograms" / f"{clip_id}.png"

    # Backup if replacing
    if replace_clip_id:
        backup_dir = PROJECT_ROOT / "data" / "backups" / datetime.now().strftime("%Y%m%d")
        backup_dir.mkdir(parents=True, exist_ok=True)

        old_clip_path = PROJECT_ROOT / "data" / "clips" / f"{replace_clip_id}.wav"
        old_spec_path = PROJECT_ROOT / "data" / "spectrograms" / f"{replace_clip_id}.png"

        if old_clip_path.exists():
            shutil.copy(old_clip_path, backup_dir / f"{replace_clip_id}.wav")
        if old_spec_path.exists():
            shutil.copy(old_spec_path, backup_dir / f"{replace_clip_id}.png")

    # Save audio
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), segment, sr, subtype='PCM_16')

    # Generate spectrogram
    spectrogram_path.parent.mkdir(parents=True, exist_ok=True)
    generate_spectrogram(segment, sr, str(spectrogram_path))

    # Measure final loudness
    final_loudness = meter.integrated_loudness(segment)
    duration_ms = int(len(segment) / sr * 1000)

    # Build clip metadata
    if replace_clip_id and existing_clip_data:
        # Update existing entry
        clip_data = existing_clip_data.copy()
        clip_data['duration_ms'] = duration_ms
        clip_data['loudness_lufs'] = round(final_loudness, 1)
        clip_data['vocalization_type'] = vocalization_type
        clip_data['file_path'] = f"data/clips/{output_filename}"
        clip_data['spectrogram_path'] = f"data/spectrograms/{clip_id}.png"
    else:
        # New clip - look up common_name from species.json
        species_data = load_species_data()
        species_info = species_data.get(species_code.upper(), {})
        common_name = species_info.get('common_name', species_code.upper())

        clip_data = {
            'clip_id': clip_id,
            'species_code': species_code.upper(),
            'common_name': common_name,
            'vocalization_type': vocalization_type,
            'duration_ms': duration_ms,
            'quality_score': 5,
            'loudness_lufs': round(final_loudness, 1),
            'source': 'xenocanto' if xc_id else 'unknown',
            'source_id': f"XC{xc_id}" if xc_id else None,
            'source_url': f"https://xeno-canto.org/{xc_id}" if xc_id else None,
            'recordist': recordist,
            'file_path': f"data/clips/{output_filename}",
            'spectrogram_path': f"data/spectrograms/{clip_id}.png",
            'canonical': False,
            'rejected': False,
        }

    # Update clips.json
    if replace_clip_id:
        for i, c in enumerate(existing_clips):
            if c['clip_id'] == replace_clip_id:
                existing_clips[i] = clip_data
                break
    else:
        existing_clips.append(clip_data)

    with open(clips_json_path, 'w') as f:
        json.dump(existing_clips, f, indent=2)

    return {
        'success': True,
        'clip_id': clip_id,
        'file_path': f"data/clips/{output_filename}",
        'spectrogram_path': f"data/spectrograms/{clip_id}.png",
        'duration_ms': duration_ms,
        'loudness_lufs': round(final_loudness, 1),
        'replaced': replace_clip_id is not None
    }


def generate_spectrogram(audio: np.ndarray, sr: int, output_path: str):
    """Generate a spectrogram image matching the game's style"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import librosa
        import librosa.display

        n_fft = 1024
        hop_length = 256
        fmin = 500
        fmax = 10000

        S = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_fft=n_fft, hop_length=hop_length,
            fmin=fmin, fmax=fmax, n_mels=128
        )
        S_db = librosa.power_to_db(S, ref=np.max)

        vmin = np.percentile(S_db, 5)
        vmax = np.percentile(S_db, 95)

        fig, ax = plt.subplots(figsize=(4, 2), dpi=100)
        librosa.display.specshow(
            S_db, sr=sr, hop_length=hop_length,
            fmin=fmin, fmax=fmax, ax=ax, cmap='magma',
            vmin=vmin, vmax=vmax
        )
        ax.axis('off')
        plt.tight_layout(pad=0)
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0,
                    facecolor='black', edgecolor='none', dpi=100)
        plt.close()

    except ImportError:
        try:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            from scipy import signal

            nperseg = min(256, len(audio) // 4)
            f, t, Sxx = signal.spectrogram(audio, sr, nperseg=nperseg, noverlap=nperseg//2)
            Sxx_db = 10 * np.log10(Sxx + 1e-10)

            fig, ax = plt.subplots(figsize=(4, 2), dpi=100)
            ax.pcolormesh(t, f, Sxx_db, shading='gouraud', cmap='magma')
            ax.set_ylim(500, 10000)
            ax.axis('off')
            plt.tight_layout(pad=0)
            plt.savefig(output_path, bbox_inches='tight', pad_inches=0,
                        facecolor='black', edgecolor='none')
            plt.close()
        except Exception as e:
            print(f"Warning: Could not generate spectrogram: {e}")


def load_species_data():
    """Load species data from species.json"""
    species_path = PROJECT_ROOT / "data" / "species.json"
    if species_path.exists():
        with open(species_path, 'r') as f:
            species_list = json.load(f)
            return {s['species_code']: s for s in species_list}
    return {}


def download_xc_recording(xc_id: str, output_dir: Path) -> Path:
    """Download a recording from Xeno-Canto"""
    import urllib.request

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"XC{xc_id}_full.mp3"

    if output_path.exists():
        print(f"Source already downloaded: {output_path}")
        return output_path

    url = f"https://xeno-canto.org/{xc_id}/download"
    print(f"Downloading XC{xc_id}...")

    try:
        urllib.request.urlretrieve(url, str(output_path))
        print(f"Downloaded to: {output_path}")
        return output_path
    except Exception as e:
        raise ValueError(f"Failed to download XC{xc_id}: {e}")


def generate_html() -> str:
    """Generate the clip editor UI"""
    return '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Clip Editor - ChipNotes!</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 { color: #fff; border-bottom: 2px solid #4db6ac; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #4db6ac; margin-top: 0; font-size: 16px; margin-bottom: 15px; }

        .container { max-width: 1200px; margin: 0 auto; }
        .two-column { display: flex; gap: 20px; }
        .left-panel { flex: 1; min-width: 0; }
        .right-panel { width: 350px; flex-shrink: 0; }

        /* Species header */
        .species-header {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .species-name { font-size: 24px; font-weight: bold; color: #4db6ac; }
        .species-scientific { font-style: italic; color: #999; margin-top: 4px; }

        /* Add source button */
        .add-source-area {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .add-source-area input {
            width: 120px;
            padding: 8px;
            background: #3a3a3a;
            border: 1px solid #555;
            border-radius: 4px;
            color: #e0e0e0;
        }

        /* Editor area */
        .editor-area {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .editor-placeholder {
            text-align: center;
            padding: 60px 20px;
            color: #666;
            font-size: 16px;
        }
        .editor-placeholder .hint { font-size: 14px; margin-top: 10px; }

        /* Waveform */
        #waveform {
            width: 100%;
            height: 150px;
            background: #1a1a1a;
            border-radius: 4px;
            position: relative;
            cursor: crosshair;
            margin-bottom: 15px;
        }
        #waveformCanvas { width: 100%; height: 100%; }
        .selection-overlay {
            position: absolute;
            top: 0;
            height: 100%;
            background: rgba(77, 182, 172, 0.3);
            border-left: 2px solid #4db6ac;
            border-right: 2px solid #4db6ac;
            pointer-events: none;
        }
        .playhead {
            position: absolute;
            top: 0;
            height: 100%;
            width: 2px;
            background: #ff6b6b;
            pointer-events: none;
        }

        /* Loaded source info */
        .source-info {
            background: #1a1a1a;
            border-radius: 4px;
            padding: 10px 15px;
            margin-bottom: 15px;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .source-info .label { color: #999; }
        .source-info .value { color: #4db6ac; font-weight: 600; }
        .source-info a { color: #4db6ac; }

        /* Controls */
        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
        }
        button {
            padding: 8px 16px;
            background: #4db6ac;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        }
        button:hover { background: #5dc6bc; }
        button:disabled { background: #444; cursor: not-allowed; color: #888; }
        .btn-play { background: #4a7a4a; }
        .btn-play:hover { background: #5a8a5a; }
        .btn-extract { background: #7a4a4a; }
        .btn-extract:hover { background: #8a5a5a; }
        .btn-small { padding: 5px 10px; font-size: 11px; }

        input[type="range"] { flex: 1; max-width: 150px; }
        select, input[type="text"] {
            padding: 8px 12px;
            background: #3a3a3a;
            color: #e0e0e0;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 13px;
        }
        label { font-size: 13px; color: #999; }

        .time-display {
            font-family: monospace;
            font-size: 14px;
            color: #4db6ac;
        }

        /* Extract options */
        .extract-options {
            background: #252525;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
        }
        .extract-row {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
        }
        .extract-row:last-child { margin-bottom: 0; }
        .extract-row label { min-width: 80px; }

        /* Clips list */
        .clips-panel {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            max-height: calc(100vh - 150px);
            overflow-y: auto;
        }
        .clip-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: #333;
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .clip-item:hover { background: #3a3a3a; }
        .clip-item.active { background: #3a4a4a; border: 1px solid #4db6ac; }
        .clip-item.loading { opacity: 0.6; }
        .clip-item img {
            width: 80px;
            height: 40px;
            border-radius: 4px;
            object-fit: cover;
        }
        .clip-item .info { flex: 1; min-width: 0; }
        .clip-item .clip-id {
            font-weight: 600;
            color: #4db6ac;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .clip-item .clip-meta {
            font-size: 11px;
            color: #999;
            margin-top: 2px;
        }
        .clip-item .badges { display: flex; gap: 4px; margin-top: 4px; }
        .badge {
            font-size: 9px;
            padding: 2px 5px;
            border-radius: 3px;
            background: #444;
            color: #aaa;
        }
        .badge.canonical { background: #4a6a4a; color: #8c8; }
        .badge.rejected { background: #6a4a4a; color: #c88; }

        .no-clips {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }

        /* Status messages */
        .status {
            padding: 10px 15px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 13px;
        }
        .status.success { background: #2a3a2a; border: 1px solid #4a7a4a; color: #8c8; }
        .status.error { background: #3a2a2a; border: 1px solid #7a4a4a; color: #c88; }
        .status.info { background: #2a3a3a; border: 1px solid #4a6a7a; color: #8bc; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Clip Editor</h1>

        <div class="species-header">
            <div>
                <div class="species-name" id="speciesName">Loading...</div>
                <div class="species-scientific" id="speciesScientific"></div>
            </div>
            <div class="add-source-area">
                <input type="text" id="xcIdInput" placeholder="XC ID (e.g., 906697)">
                <button onclick="loadXCRecording()">Load XC Recording</button>
            </div>
        </div>

        <div class="two-column">
            <div class="left-panel">
                <div class="editor-area" id="editorArea">
                    <div class="editor-placeholder" id="editorPlaceholder">
                        <div>No source loaded</div>
                        <div class="hint">Click a clip on the right to edit it, or load a new XC recording above</div>
                    </div>
                    <div id="editorContent" style="display: none;">
                        <div class="source-info" id="sourceInfo"></div>
                        <div id="waveform">
                            <canvas id="waveformCanvas"></canvas>
                            <div class="selection-overlay" id="selection" style="display:none;"></div>
                            <div class="playhead" id="playhead" style="display:none;"></div>
                        </div>
                        <div class="controls">
                            <button class="btn-play" onclick="playFull()">Play Full</button>
                            <button class="btn-play" onclick="playSelection()">Play Selection</button>
                            <button onclick="stopAudio()">Stop</button>
                            <span class="time-display" id="timeDisplay">0:00 - 0:00</span>
                        </div>
                        <div class="controls" style="margin-top: 10px;">
                            <label>Start: <strong id="startTimeDisplay">0.00s</strong></label>
                            <label>Duration:</label>
                            <input type="range" id="durationSlider" min="0.5" max="3.0" step="0.05" value="2.0"
                                   onchange="updateDuration()" oninput="updateDuration()">
                            <span id="durationDisplay">2.00s</span>
                        </div>

                        <div class="extract-options">
                            <div class="extract-row">
                                <label>Type:</label>
                                <select id="vocType">
                                    <option value="song">Song</option>
                                    <option value="call">Call</option>
                                    <option value="alarm call">Alarm Call</option>
                                    <option value="flight call">Flight Call</option>
                                    <option value="drum">Drum</option>
                                </select>
                                <label style="margin-left: 15px;">Recordist:</label>
                                <input type="text" id="recordist" style="flex: 1;" placeholder="Recordist name">
                            </div>
                            <div class="extract-row">
                                <button class="btn-extract" onclick="extractNew()">Extract New Clip</button>
                                <button class="btn-extract" onclick="replaceClip()" id="btnReplace" disabled>Replace Selected Clip</button>
                            </div>
                        </div>

                        <div id="statusArea"></div>
                    </div>
                </div>
            </div>

            <div class="right-panel">
                <div class="clips-panel">
                    <h2>Existing Clips for this Species</h2>
                    <div id="clipsList">
                        <div class="no-clips">Loading...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let state = {
            speciesCode: null,
            clips: [],
            selectedClip: null,
            loadedSource: null,
            waveformData: null,
            startTime: 0,
            duration: 2.0,
        };

        let audio = null;
        let isPlaying = false;
        let animationFrame = null;

        // Initialize
        fetch('/api/init')
            .then(r => r.json())
            .then(data => {
                state.speciesCode = data.species_code;

                // Update header
                document.getElementById('speciesName').textContent =
                    data.species_code + (data.species_info ? ' - ' + data.species_info.common_name : '');
                if (data.species_info) {
                    document.getElementById('speciesScientific').textContent = data.species_info.scientific_name || '';
                }

                // Load clips list
                loadClipsList();

                // If initial source provided, load it
                if (data.initial_source) {
                    loadSource(data.initial_source, data.xc_id, data.initial_clip);
                }
            });

        function loadClipsList() {
            fetch('/api/clips')
                .then(r => r.json())
                .then(clips => {
                    state.clips = clips;
                    renderClipsList();
                });
        }

        function renderClipsList() {
            const container = document.getElementById('clipsList');

            if (state.clips.length === 0) {
                container.innerHTML = '<div class="no-clips">No clips yet for this species</div>';
                return;
            }

            container.innerHTML = state.clips.map(c => `
                <div class="clip-item ${state.selectedClip?.clip_id === c.clip_id ? 'active' : ''}"
                     onclick="selectClip('${c.clip_id}')" id="clip-${c.clip_id}">
                    <img src="/${c.spectrogram_path}" onerror="this.style.background='#222'">
                    <div class="info">
                        <div class="clip-id">${c.clip_id}</div>
                        <div class="clip-meta">
                            ${c.vocalization_type || '?'} · ${(c.duration_ms/1000).toFixed(1)}s · ${c.recordist || 'Unknown'}
                        </div>
                        <div class="badges">
                            ${c.canonical ? '<span class="badge canonical">canonical</span>' : ''}
                            ${c.rejected ? '<span class="badge rejected">rejected</span>' : ''}
                            ${c.source_id ? '<span class="badge">' + c.source_id + '</span>' : ''}
                        </div>
                    </div>
                    <button class="btn-small btn-play" onclick="event.stopPropagation(); playClipAudio('${c.file_path}')">▶</button>
                </div>
            `).join('');
        }

        function selectClip(clipId) {
            // Mark as loading
            const item = document.getElementById('clip-' + clipId);
            if (item) item.classList.add('loading');

            fetch('/api/clip-info?id=' + encodeURIComponent(clipId))
                .then(r => r.json())
                .then(data => {
                    state.selectedClip = data.clip;

                    // Update UI
                    renderClipsList();
                    document.getElementById('btnReplace').disabled = false;

                    // Pre-fill metadata
                    document.getElementById('vocType').value = data.clip.vocalization_type || 'song';
                    document.getElementById('recordist').value = data.clip.recordist || '';

                    // Load source
                    if (data.source.available) {
                        loadSource(data.source.path, data.source.xc_id, data.clip);
                    } else if (data.source.can_download && data.source.xc_id) {
                        // Need to download
                        showStatus('Downloading XC' + data.source.xc_id + '...', 'info');
                        fetch('/api/load-xc?id=' + data.source.xc_id)
                            .then(r => r.json())
                            .then(result => {
                                if (result.success) {
                                    loadSource(result.source_path, result.xc_id, data.clip);
                                } else {
                                    showStatus('Failed to download: ' + result.error, 'error');
                                    // Fall back to clip itself
                                    loadSource(data.clip.file_path, null, data.clip);
                                }
                            });
                    } else {
                        // Use clip itself
                        loadSource(data.clip.file_path, null, data.clip);
                    }
                });
        }

        function loadXCRecording() {
            const xcId = document.getElementById('xcIdInput').value.trim();
            if (!xcId) {
                alert('Please enter an XC ID');
                return;
            }

            showStatus('Downloading XC' + xcId + '...', 'info');

            fetch('/api/load-xc?id=' + xcId)
                .then(r => r.json())
                .then(result => {
                    if (result.success) {
                        state.selectedClip = null;
                        document.getElementById('btnReplace').disabled = true;
                        renderClipsList();
                        loadSource(result.source_path, result.xc_id, null);
                        showStatus('Loaded XC' + xcId + ' (' + result.duration.toFixed(1) + 's)', 'success');
                    } else {
                        showStatus('Failed: ' + result.error, 'error');
                    }
                });
        }

        function loadSource(sourcePath, xcId, clipData) {
            state.loadedSource = { path: sourcePath, xc_id: xcId };

            // Show editor
            document.getElementById('editorPlaceholder').style.display = 'none';
            document.getElementById('editorContent').style.display = 'block';

            // Update source info
            const sourceInfo = document.getElementById('sourceInfo');
            if (xcId) {
                sourceInfo.innerHTML = `
                    <span><span class="label">Source:</span> <a href="https://xeno-canto.org/${xcId}" target="_blank">XC${xcId}</a></span>
                    <span class="value" id="sourceDuration">Loading...</span>
                `;
            } else {
                sourceInfo.innerHTML = `
                    <span><span class="label">Source:</span> <span class="value">${sourcePath.split('/').pop()}</span></span>
                    <span class="value" id="sourceDuration">Loading...</span>
                `;
            }

            // Load waveform
            fetch('/api/waveform?source=' + encodeURIComponent(sourcePath))
                .then(r => r.json())
                .then(data => {
                    state.waveformData = data;
                    document.getElementById('sourceDuration').textContent = formatTime(data.duration);
                    drawWaveform();
                    updateSelectionUI();
                });
        }

        function drawWaveform() {
            if (!state.waveformData) return;

            const canvas = document.getElementById('waveformCanvas');
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();

            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

            const width = rect.width;
            const height = rect.height;
            const midY = height / 2;

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#4db6ac';
            ctx.lineWidth = 1;

            const mins = state.waveformData.mins;
            const maxs = state.waveformData.maxs;
            const step = width / mins.length;

            ctx.beginPath();
            for (let i = 0; i < mins.length; i++) {
                const x = i * step;
                const minY = midY + (mins[i] * midY * 0.9);
                const maxY = midY + (maxs[i] * midY * 0.9);
                ctx.moveTo(x, minY);
                ctx.lineTo(x, maxY);
            }
            ctx.stroke();

            // Time markers
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            const totalDuration = state.waveformData.duration;
            const interval = totalDuration > 30 ? 10 : (totalDuration > 10 ? 5 : 1);
            for (let t = 0; t <= totalDuration; t += interval) {
                const x = (t / totalDuration) * width;
                ctx.fillRect(x, 0, 1, 5);
                ctx.fillText(t + 's', x + 2, 12);
            }
        }

        // Waveform click
        document.getElementById('waveform').addEventListener('click', function(e) {
            if (!state.waveformData) return;

            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;

            state.startTime = ratio * state.waveformData.duration;

            if (state.startTime + state.duration > state.waveformData.duration) {
                state.startTime = state.waveformData.duration - state.duration;
            }
            if (state.startTime < 0) state.startTime = 0;

            updateSelectionUI();
        });

        function updateDuration() {
            state.duration = parseFloat(document.getElementById('durationSlider').value);
            document.getElementById('durationDisplay').textContent = state.duration.toFixed(2) + 's';

            if (state.waveformData && state.startTime + state.duration > state.waveformData.duration) {
                state.startTime = Math.max(0, state.waveformData.duration - state.duration);
            }

            updateSelectionUI();
        }

        function updateSelectionUI() {
            const selection = document.getElementById('selection');

            if (!state.waveformData) {
                selection.style.display = 'none';
                return;
            }

            const totalDuration = state.waveformData.duration;
            const startPercent = (state.startTime / totalDuration) * 100;
            const widthPercent = (state.duration / totalDuration) * 100;

            selection.style.display = 'block';
            selection.style.left = startPercent + '%';
            selection.style.width = widthPercent + '%';

            document.getElementById('startTimeDisplay').textContent = state.startTime.toFixed(2) + 's';
            document.getElementById('timeDisplay').textContent =
                formatTime(state.startTime) + ' - ' + formatTime(state.startTime + state.duration) +
                ' / ' + formatTime(totalDuration);
        }

        function playFull() {
            if (!state.loadedSource) return;
            stopAudio();
            audio = new Audio('/audio/' + encodeURIComponent(state.loadedSource.path));
            audio.play();
            isPlaying = true;
            updatePlayhead();
            audio.onended = () => { isPlaying = false; };
        }

        function playSelection() {
            if (!state.loadedSource) return;
            stopAudio();
            audio = new Audio('/audio/' + encodeURIComponent(state.loadedSource.path));
            audio.currentTime = state.startTime;
            audio.play();
            isPlaying = true;
            updatePlayhead();

            const checkEnd = () => {
                if (audio && audio.currentTime >= state.startTime + state.duration) {
                    stopAudio();
                } else if (isPlaying) {
                    requestAnimationFrame(checkEnd);
                }
            };
            requestAnimationFrame(checkEnd);
        }

        function playClipAudio(path) {
            stopAudio();
            audio = new Audio('/audio/' + encodeURIComponent(path));
            audio.play();
        }

        function stopAudio() {
            if (audio) {
                audio.pause();
                audio = null;
            }
            isPlaying = false;
            document.getElementById('playhead').style.display = 'none';
            if (animationFrame) cancelAnimationFrame(animationFrame);
        }

        function updatePlayhead() {
            if (!isPlaying || !audio || !state.waveformData) return;

            const playhead = document.getElementById('playhead');
            const percent = (audio.currentTime / state.waveformData.duration) * 100;
            playhead.style.display = 'block';
            playhead.style.left = percent + '%';

            animationFrame = requestAnimationFrame(updatePlayhead);
        }

        function extractNew() {
            if (!state.loadedSource) {
                alert('No source loaded');
                return;
            }

            const params = {
                source_path: state.loadedSource.path,
                start_time: state.startTime,
                duration: state.duration,
                species_code: state.speciesCode,
                xc_id: state.loadedSource.xc_id,
                vocalization_type: document.getElementById('vocType').value,
                recordist: document.getElementById('recordist').value || 'Unknown',
            };

            showStatus('Extracting...', 'info');

            fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            })
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    showStatus('Created: ' + result.clip_id + ' (' + result.duration_ms + 'ms)', 'success');
                    loadClipsList();
                } else {
                    showStatus('Error: ' + result.error, 'error');
                }
            });
        }

        function replaceClip() {
            if (!state.loadedSource || !state.selectedClip) {
                alert('No clip selected');
                return;
            }

            if (!confirm('Replace ' + state.selectedClip.clip_id + '?\\n\\nThe old clip will be backed up.')) {
                return;
            }

            const params = {
                source_path: state.loadedSource.path,
                start_time: state.startTime,
                duration: state.duration,
                species_code: state.speciesCode,
                xc_id: state.loadedSource.xc_id,
                vocalization_type: document.getElementById('vocType').value,
                recordist: document.getElementById('recordist').value || 'Unknown',
                replace_clip_id: state.selectedClip.clip_id,
            };

            showStatus('Replacing...', 'info');

            fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            })
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    showStatus('Replaced: ' + result.clip_id + ' (' + result.duration_ms + 'ms)', 'success');
                    loadClipsList();
                } else {
                    showStatus('Error: ' + result.error, 'error');
                }
            });
        }

        function showStatus(message, type) {
            const area = document.getElementById('statusArea');
            area.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
            if (type === 'success' || type === 'info') {
                setTimeout(() => { area.innerHTML = ''; }, 5000);
            }
        }

        function formatTime(seconds) {
            if (!seconds && seconds !== 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        window.addEventListener('resize', () => {
            if (state.waveformData) drawWaveform();
            updateSelectionUI();
        });
    </script>
</body>
</html>'''


def main():
    parser = argparse.ArgumentParser(description='Clip Editor for ChipNotes!')
    parser.add_argument('--clip', help='Load a specific clip for editing (by ID or filename)')
    parser.add_argument('--species', help='Species code to work with')
    parser.add_argument('--source', help='Source recording file to load')
    parser.add_argument('--xc', help='Xeno-Canto ID to download and load')
    parser.add_argument('--port', type=int, default=PORT, help='Server port')

    args = parser.parse_args()

    # Determine species and initial state
    species_code = args.species
    initial_source_path = None
    initial_clip = None
    xc_id = args.xc

    if args.clip:
        # Load specific clip
        clip_data = get_clip_by_id(args.clip)
        if not clip_data:
            print(f"ERROR: Clip not found: {args.clip}")
            return 1

        species_code = clip_data.get('species_code', '').upper()
        initial_clip = clip_data

        # Find source
        source_info = find_source_for_clip(clip_data)
        if source_info['available']:
            initial_source_path = Path(source_info['path'])
        elif source_info['can_download'] and source_info['xc_id']:
            xc_id = source_info['xc_id']
            initial_source_path = download_xc_recording(xc_id, Path('/tmp/clip-edit'))

        if source_info['xc_id']:
            xc_id = source_info['xc_id']

    elif args.xc:
        # Download and load XC recording
        if not species_code:
            print("ERROR: --species required when using --xc")
            return 1
        initial_source_path = download_xc_recording(args.xc, Path('/tmp/clip-edit'))

    elif args.source:
        # Load local source
        if not species_code:
            print("ERROR: --species required when using --source")
            return 1
        initial_source_path = Path(args.source)
        if not initial_source_path.exists():
            print(f"ERROR: Source not found: {args.source}")
            return 1

        # Try to extract XC ID from filename
        xc_match = re.search(r'XC?(\d{5,})', initial_source_path.name, re.IGNORECASE)
        if xc_match:
            xc_id = xc_match.group(1)

    elif not species_code:
        print("ERROR: Must specify --clip, --species, --source, or --xc")
        parser.print_help()
        return 1

    # Set handler state
    ClipEditorHandler.species_code = species_code.upper() if species_code else None
    ClipEditorHandler.initial_source_path = initial_source_path
    ClipEditorHandler.initial_clip = initial_clip
    ClipEditorHandler.xc_id = xc_id

    # Start server
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", args.port), ClipEditorHandler) as httpd:
        print("=" * 60)
        print("Clip Editor - ChipNotes!")
        print("=" * 60)
        print(f"Species: {species_code}")
        if initial_source_path:
            print(f"Source: {initial_source_path}")
        if xc_id:
            print(f"XC ID: {xc_id}")
        if initial_clip:
            print(f"Editing: {initial_clip['clip_id']}")
        print(f"\nServer: http://localhost:{args.port}")
        print("\nPress Ctrl+C to stop.")
        print("=" * 60)

        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://localhost:{args.port}')

        threading.Thread(target=open_browser, daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

    return 0


if __name__ == '__main__':
    exit(main())
