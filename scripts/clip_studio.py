#!/usr/bin/env python3
"""
🎨 Clip Studio - Unified Audio Clip Workflow Tool for ChipNotes!

The ONE tool for the complete clip curation workflow:
  1. Search & Download from Xeno-Canto
  2. Extract clips with waveform editor
  3. Review & curate metadata
  4. Mark canonical clips (1 per species)
  5. Delete rejected clips
  6. Git integration with automatic commits

Usage:
    # Batch mode (recommended)
    python3 scripts/clip_studio.py --batch

    # Single species mode
    python3 scripts/clip_studio.py --species WOWA

    # With pack filter
    python3 scripts/clip_studio.py --batch --pack eu_warblers
"""

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote
from typing import Dict, List, Optional

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

# Vocalization types
VOCALIZATION_TYPES = [
    "song", "call", "flight call", "alarm call", "chip",
    "drum", "wing sound", "rattle", "trill", "duet",
    "juvenile", "other"
]


class ClipStudioHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for unified clip studio"""

    # Class-level state
    filter_pack = None  # Optional pack filter

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
        elif path == '/api/packs':
            self.send_packs()
        elif path == '/api/species':
            self.send_species_list()
        elif path == '/api/clips':
            species_code = query.get('species', [None])[0]
            self.send_clips(species_code)
        elif path == '/api/candidates':
            species_code = query.get('species', [None])[0]
            self.send_candidates(species_code)
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
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        if self.path == '/api/extract':
            self.handle_extract(post_data)
        elif self.path == '/api/update-clip':
            self.handle_update_clip(post_data)
        elif self.path == '/api/delete-clip':
            self.handle_delete_clip(post_data)
        elif self.path == '/api/save-changes':
            self.handle_save_changes(post_data)
        else:
            self.send_error(404)

    def send_html(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(generate_batch_html().encode())

    def send_init_state(self):
        """Send initial state (packs, species counts)"""
        state = {
            'filter_pack': self.filter_pack,
        }
        self.send_json(state)

    def send_packs(self):
        """Send all pack definitions grouped by region"""
        packs_dir = PROJECT_ROOT / 'data' / 'packs'
        packs_by_region = {'na': [], 'nz': [], 'eu': []}

        if packs_dir.exists():
            for pack_file in packs_dir.glob('*.json'):
                with open(pack_file, 'r') as f:
                    pack = json.load(f)
                    region = pack.get('region', 'na')
                    packs_by_region.setdefault(region, []).append({
                        'id': pack.get('pack_id'),
                        'name': pack.get('pack_name'),
                        'region': region,
                        'species_count': len(pack.get('species', []))
                    })

        self.send_json(packs_by_region)

    def send_species_list(self):
        """Send species list with clip counts (filtered by pack if set)"""
        # Load all clips
        clips_json = PROJECT_ROOT / 'data' / 'clips.json'
        if clips_json.exists():
            with open(clips_json, 'r') as f:
                all_clips = json.load(f)
        else:
            all_clips = []

        # Count clips per species
        clip_counts = {}
        for clip in all_clips:
            if not clip.get('rejected', False):
                code = clip['species_code']
                clip_counts[code] = clip_counts.get(code, 0) + 1

        # Load species data
        species_json = PROJECT_ROOT / 'data' / 'species.json'
        if species_json.exists():
            with open(species_json, 'r') as f:
                all_species = json.load(f)
        else:
            all_species = []

        # Filter by pack if set
        pack_species = None
        if self.filter_pack:
            pack_file = PROJECT_ROOT / 'data' / 'packs' / f'{self.filter_pack}.json'
            if pack_file.exists():
                with open(pack_file, 'r') as f:
                    pack_data = json.load(f)
                    pack_species = set(pack_data.get('species', []))

        # Build response
        result = []
        for sp in all_species:
            code = sp['species_code']
            if pack_species and code not in pack_species:
                continue

            # Count candidates
            candidate_count = 0
            candidate_dirs = list((PROJECT_ROOT / 'data').glob('candidates_*'))
            for cdir in candidate_dirs:
                manifest = cdir / '.ingest_manifest.json'
                if manifest.exists():
                    with open(manifest, 'r') as f:
                        manifest_data = json.load(f)
                        for item in manifest_data:
                            if item.get('species_code') == code:
                                candidate_count += 1

            result.append({
                'species_code': code,
                'common_name': sp.get('common_name'),
                'scientific_name': sp.get('scientific_name'),
                'clip_count': clip_counts.get(code, 0),
                'candidate_count': candidate_count
            })

        # Sort: species with 0 clips first, then by species code
        result.sort(key=lambda x: (x['clip_count'], x['species_code']))

        self.send_json(result)

    def send_clips(self, species_code):
        """Send all clips for a species"""
        if not species_code:
            self.send_json([])
            return

        clips_json = PROJECT_ROOT / 'data' / 'clips.json'
        if not clips_json.exists():
            self.send_json([])
            return

        with open(clips_json, 'r') as f:
            all_clips = json.load(f)

        species_clips = [c for c in all_clips
                        if c['species_code'] == species_code.upper()
                        and not c.get('rejected', False)]

        self.send_json(species_clips)

    def send_candidates(self, species_code):
        """Send candidate sources for a species"""
        if not species_code:
            self.send_json([])
            return

        candidates = []
        candidate_dirs = list((PROJECT_ROOT / 'data').glob('candidates_*'))

        for cdir in candidate_dirs:
            manifest = cdir / '.ingest_manifest.json'
            if not manifest.exists():
                continue

            with open(manifest, 'r') as f:
                manifest_data = json.load(f)
                for item in manifest_data:
                    if item.get('species_code') == species_code.upper():
                        # Find the audio file
                        xc_id = item.get('xc_id')
                        audio_file = None
                        for ext in ['.mp3', '.wav']:
                            pattern = f'XC{xc_id}*{ext}'
                            matches = list(cdir.glob(pattern))
                            if matches:
                                audio_file = str(matches[0])
                                break

                        if audio_file:
                            candidates.append({
                                'xc_id': xc_id,
                                'path': audio_file,
                                'recordist': item.get('recordist', 'Unknown'),
                                'vocalization_type': item.get('type', 'song'),
                                'license': item.get('license', 'unknown')
                            })

        self.send_json(candidates)

    def send_waveform(self, source):
        """Generate waveform data for a source file"""
        if not source:
            self.send_error(400, "Missing source")
            return

        source_path = Path(source)
        if not source_path.exists():
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

            self.send_json({
                'sample_rate': sr,
                'duration': len(audio) / sr,
                'mins': mins,
                'maxs': maxs,
                'source_path': str(source_path)
            })
        except Exception as e:
            self.send_error(500, str(e))

    def load_xc_recording(self, xc_id):
        """Download XC recording and return metadata"""
        if not xc_id:
            self.send_error(400, "Missing XC ID")
            return

        try:
            source_path = download_xc_recording(xc_id, Path('/tmp/clip-studio'))
            info = sf.info(str(source_path))

            result = {
                'success': True,
                'source_path': str(source_path),
                'xc_id': xc_id,
                'duration': info.duration
            }

            # Fetch metadata from XC API
            try:
                import urllib.request
                api_key = os.environ.get('XENO_CANTO_API_KEY', '')
                api_url = f"https://xeno-canto.org/api/3/recordings?query=nr:{xc_id}&key={api_key}"
                req = urllib.request.Request(api_url, headers={'User-Agent': 'ChipNotes/1.0'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    api_data = json.loads(resp.read().decode())
                    if api_data.get('recordings'):
                        rec = api_data['recordings'][0]
                        result['recordist'] = rec.get('rec', '')
                        xc_type = rec.get('type', '').lower()
                        if 'song' in xc_type:
                            result['vocalization_type'] = 'song'
                        elif 'alarm' in xc_type:
                            result['vocalization_type'] = 'alarm call'
                        elif 'flight' in xc_type:
                            result['vocalization_type'] = 'flight call'
                        elif 'call' in xc_type:
                            result['vocalization_type'] = 'call'
                        elif 'drum' in xc_type:
                            result['vocalization_type'] = 'drum'
                        else:
                            result['vocalization_type'] = 'song'
            except Exception as e:
                print(f"Warning: Could not fetch XC metadata: {e}")

            self.send_json(result)
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)})

    def serve_audio(self, source_path):
        """Serve audio file"""
        source_path = unquote(source_path)

        if source_path.startswith('/'):
            file_path = Path(source_path)
        else:
            file_path = Path(source_path)
            if not file_path.exists():
                file_path = PROJECT_ROOT / source_path

        if not file_path.exists():
            self.send_error(404)
            return

        self.send_response(200)
        suffix = file_path.suffix.lower()
        if suffix == '.mp3':
            self.send_header('Content-type', 'audio/mpeg')
        else:
            self.send_header('Content-type', 'audio/wav')

        self.send_header('Content-Length', str(file_path.stat().st_size))
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

    def handle_extract(self, post_data):
        """Extract a new clip"""
        params = json.loads(post_data.decode())

        try:
            result = extract_clip(
                source_path=Path(params['source_path']),
                start_time=params['start_time'],
                duration=params['duration'],
                species_code=params['species_code'],
                xc_id=params.get('xc_id'),
                vocalization_type=params.get('vocalization_type', 'song'),
                recordist=params.get('recordist', 'Unknown')
            )
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    def handle_update_clip(self, post_data):
        """Update clip metadata in memory"""
        params = json.loads(post_data.decode())
        clip_id = params.get('clip_id')
        updates = params.get('updates', {})

        # Load clips
        clips_json = PROJECT_ROOT / 'data' / 'clips.json'
        with open(clips_json, 'r') as f:
            clips = json.load(f)

        # Find and update clip
        for clip in clips:
            if clip['clip_id'] == clip_id:
                for key, value in updates.items():
                    clip[key] = value
                break

        # Save immediately (no batching for simplicity)
        with open(clips_json, 'w') as f:
            json.dump(clips, f, indent=2)

        self.send_json({'success': True})

    def handle_delete_clip(self, post_data):
        """Mark clip for deletion"""
        params = json.loads(post_data.decode())
        clip_id = params.get('clip_id')

        # Load clips
        clips_json = PROJECT_ROOT / 'data' / 'clips.json'
        with open(clips_json, 'r') as f:
            clips = json.load(f)

        # Mark as rejected
        for clip in clips:
            if clip['clip_id'] == clip_id:
                clip['rejected'] = True
                clip['canonical'] = False
                break

        # Save
        with open(clips_json, 'w') as f:
            json.dump(clips, f, indent=2)

        self.send_json({'success': True})

    def handle_save_changes(self, post_data):
        """Save all changes with git commit"""
        params = json.loads(post_data.decode())

        try:
            result = save_changes(params)
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


def extract_clip(source_path: Path, start_time: float, duration: float,
                 species_code: str, xc_id: str = None,
                 vocalization_type: str = 'song', recordist: str = 'Unknown') -> dict:
    """Extract a clip segment from source recording"""

    if duration < MIN_DURATION or duration > MAX_DURATION:
        raise ValueError(f"Duration must be {MIN_DURATION}-{MAX_DURATION}s")

    # Load audio
    audio, sr = sf.read(str(source_path))
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    # Extract segment
    start_sample = int(start_time * sr)
    end_sample = int((start_time + duration) * sr)

    if start_sample < 0 or end_sample > len(audio):
        raise ValueError(f"Selection out of bounds")

    segment = audio[start_sample:end_sample]

    # Resample using librosa for quality
    if sr != OUTPUT_SAMPLE_RATE:
        try:
            import librosa
            segment = librosa.resample(segment, orig_sr=sr, target_sr=OUTPUT_SAMPLE_RATE)
            sr = OUTPUT_SAMPLE_RATE
        except ImportError:
            # Fallback to simple resampling
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

    # Load clips.json
    clips_json = PROJECT_ROOT / 'data' / 'clips.json'
    if clips_json.exists():
        with open(clips_json, 'r') as f:
            clips = json.load(f)
    else:
        clips = []

    # Generate clip ID
    if xc_id:
        prefix = f"{species_code.upper()}_{xc_id}_"
        existing_nums = [int(c['clip_id'][len(prefix):])
                        for c in clips
                        if c['clip_id'].startswith(prefix)
                        and c['clip_id'][len(prefix):].isdigit()]
        next_num = max(existing_nums, default=0) + 1
        clip_id = f"{prefix}{next_num}"
    else:
        prefix = f"{species_code.upper()}_clip_"
        existing_nums = [int(c['clip_id'][len(prefix):])
                        for c in clips
                        if c['clip_id'].startswith(prefix)
                        and c['clip_id'][len(prefix):].isdigit()]
        next_num = max(existing_nums, default=0) + 1
        clip_id = f"{prefix}{next_num}"

    # Save audio
    output_filename = f"{clip_id}.wav"
    output_path = PROJECT_ROOT / 'data' / 'clips' / output_filename
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), segment, sr, subtype='PCM_16')

    # Generate spectrogram
    spectrogram_path = PROJECT_ROOT / 'data' / 'spectrograms' / f"{clip_id}.png"
    spectrogram_path.parent.mkdir(parents=True, exist_ok=True)
    generate_spectrogram(segment, sr, str(spectrogram_path))

    # Measure final loudness
    final_loudness = meter.integrated_loudness(segment)
    duration_ms = int(len(segment) / sr * 1000)

    # Load species data
    species_json = PROJECT_ROOT / 'data' / 'species.json'
    if species_json.exists():
        with open(species_json, 'r') as f:
            species_data = {s['species_code']: s for s in json.load(f)}
    else:
        species_data = {}

    common_name = species_data.get(species_code.upper(), {}).get('common_name', species_code.upper())

    # Create clip metadata
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
        'rejected': False
    }

    clips.append(clip_data)

    # Save clips.json
    with open(clips_json, 'w') as f:
        json.dump(clips, f, indent=2)

    return {
        'success': True,
        'clip_id': clip_id,
        'file_path': f"data/clips/{output_filename}",
        'spectrogram_path': f"data/spectrograms/{clip_id}.png",
        'duration_ms': duration_ms
    }


def generate_spectrogram(audio: np.ndarray, sr: int, output_path: str):
    """Generate spectrogram matching game style"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import librosa
        import librosa.display

        S = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_fft=1024, hop_length=256,
            fmin=500, fmax=10000, n_mels=128
        )
        S_db = librosa.power_to_db(S, ref=np.max)

        vmin = np.percentile(S_db, 5)
        vmax = np.percentile(S_db, 95)

        fig, ax = plt.subplots(figsize=(4, 2), dpi=100)
        librosa.display.specshow(
            S_db, sr=sr, hop_length=256,
            fmin=500, fmax=10000, ax=ax, cmap='magma',
            vmin=vmin, vmax=vmax
        )
        ax.axis('off')
        plt.tight_layout(pad=0)
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0,
                   facecolor='black', edgecolor='none', dpi=100)
        plt.close()
    except Exception as e:
        print(f"Warning: Could not generate spectrogram: {e}")


def download_xc_recording(xc_id: str, output_dir: Path) -> Path:
    """Download XC recording"""
    import urllib.request

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"XC{xc_id}_full.mp3"

    if output_path.exists():
        return output_path

    url = f"https://xeno-canto.org/{xc_id}/download"
    print(f"Downloading XC{xc_id}...")

    try:
        urllib.request.urlretrieve(url, str(output_path))
        print(f"Downloaded: {output_path}")
        return output_path
    except Exception as e:
        raise ValueError(f"Failed to download XC{xc_id}: {e}")


def save_changes(params: dict) -> dict:
    """Save changes and create git commit"""
    clips_json = PROJECT_ROOT / 'data' / 'clips.json'

    # Backup
    backup_path = clips_json.with_suffix('.json.backup')
    shutil.copy(clips_json, backup_path)

    # Load clips
    with open(clips_json, 'r') as f:
        clips = json.load(f)

    # Track stats
    stats = {
        'canonical_changes': 0,
        'rejections': 0,
        'quality_changes': 0,
        'files_deleted': 0
    }

    # Process rejections
    rejected_clips = [c for c in clips if c.get('rejected', False)]
    stats['rejections'] = len(rejected_clips)

    # Delete files
    for clip in rejected_clips:
        for path_key in ['file_path', 'spectrogram_path']:
            path = clip.get(path_key)
            if path:
                full_path = PROJECT_ROOT / path
                if full_path.exists():
                    full_path.unlink()
                    stats['files_deleted'] += 1

    # Remove rejected clips
    clips = [c for c in clips if not c.get('rejected', False)]

    # Validate canonical uniqueness
    species_canonicals = {}
    for clip in clips:
        if clip.get('canonical'):
            species = clip['species_code']
            if species in species_canonicals:
                raise ValueError(
                    f"Multiple canonicals for {species}: "
                    f"{species_canonicals[species]} and {clip['clip_id']}"
                )
            species_canonicals[species] = clip['clip_id']

    stats['canonical_changes'] = len(species_canonicals)

    # Save
    with open(clips_json, 'w') as f:
        json.dump(clips, f, indent=2)

    # Git commit
    commit_msg = f"Clip Studio: {stats['rejections']} clips rejected, {stats['files_deleted']} files deleted"
    try:
        os.chdir(PROJECT_ROOT)
        subprocess.run(['git', 'add', 'data/clips.json'], check=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        stats['git_committed'] = True
    except subprocess.CalledProcessError:
        stats['git_committed'] = False

    return {
        'success': True,
        'stats': stats,
        'clips_remaining': len(clips)
    }


def generate_batch_html() -> str:
    """Generate unified Clip Studio HTML"""
    return '''<\!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Clip Studio</title>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0d0d0d;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #222;
            --bg-elevated: #2a2a2a;
            --teal: #4db6ac;
            --teal-dark: #3d9b91;
            --teal-hover: #5dc6bc;
            --gold: #ffd700;
            --text-primary: #e0e0e0;
            --text-secondary: #999;
            --text-dim: #666;
            --border: #333;
            --border-subtle: #292929;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            overflow: hidden;
            font-size: 13px;
        }

        /* Top Header Bar */
        .top-bar {
            height: 60px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 30px;
        }

        .studio-title {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.02em;
        }

        .stats {
            display: flex;
            gap: 30px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-secondary);
        }

        .stat-value {
            color: var(--teal);
            margin-left: 8px;
            font-weight: 600;
        }

        /* Main Layout */
        .studio {
            display: flex;
            height: calc(100vh - 60px);
        }

        /* Left Panel */
        .left-panel {
            width: 320px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .panel-section-header {
            padding: 20px 20px 12px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-dim);
            font-weight: 600;
        }

        /* Pack Filter */
        .pack-groups {
            padding: 0 12px;
        }

        .pack-group {
            margin-bottom: 4px;
        }

        .pack-group-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.15s;
            user-select: none;
        }

        .pack-group-header:hover {
            background: var(--bg-tertiary);
        }

        .pack-arrow {
            width: 12px;
            font-size: 10px;
            color: var(--text-secondary);
            transition: transform 0.2s;
        }

        .pack-group.expanded .pack-arrow {
            transform: rotate(90deg);
        }

        .pack-group-name {
            flex: 1;
            font-weight: 500;
        }

        .pack-count {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
        }

        .pack-items {
            display: none;
            padding-left: 24px;
        }

        .pack-group.expanded .pack-items {
            display: block;
        }

        .pack-item {
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 2px;
            transition: all 0.15s;
            border-left: 2px solid transparent;
        }

        .pack-item:hover {
            background: var(--bg-tertiary);
        }

        .pack-item.active {
            background: rgba(77, 182, 172, 0.15);
            border-left-color: var(--teal);
            color: var(--teal);
        }

        .pack-item.all-birds {
            font-weight: 500;
            margin-bottom: 12px;
        }

        /* Search Box */
        .search-box {
            padding: 12px 20px 20px;
        }

        .search-input {
            width: 100%;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;
            font-family: inherit;
            transition: all 0.2s;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--teal);
            background: var(--bg-elevated);
        }

        .search-input::placeholder {
            color: var(--text-dim);
        }

        /* Species List */
        .species-list {
            flex: 1;
            overflow-y: auto;
            padding: 0 12px 20px;
        }

        .species-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            margin-bottom: 6px;
            cursor: pointer;
            transition: all 0.15s;
        }

        .species-item:hover {
            background: var(--bg-elevated);
            border-color: var(--border);
        }

        .species-item.active {
            background: rgba(77, 182, 172, 0.12);
            border-color: var(--teal);
        }

        .species-checkbox {
            width: 14px;
            height: 14px;
            border: 1px solid var(--border);
            border-radius: 2px;
            flex-shrink: 0;
        }

        .species-item.active .species-checkbox {
            background: var(--teal);
            border-color: var(--teal);
        }

        .species-info {
            flex: 1;
            min-width: 0;
        }

        .species-code {
            font-family: 'IBM Plex Mono', monospace;
            font-weight: 600;
            font-size: 12px;
        }

        .species-name {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .species-counts {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
            flex-shrink: 0;
        }

        /* Center Panel */
        .center-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary);
        }

        .species-header {
            padding: 30px 40px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-secondary);
        }

        .species-header h2 {
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }

        .species-scientific {
            font-style: italic;
            color: var(--text-secondary);
            font-size: 14px;
        }

        .sources-message {
            padding: 40px;
            text-align: center;
            color: var(--text-dim);
            font-size: 14px;
        }

        .waveform-area {
            flex: 1;
            overflow-y: auto;
            padding: 30px 40px;
        }

        .waveform-container {
            max-width: 900px;
        }

        #waveform {
            width: 100%;
            height: 180px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            position: relative;
            cursor: crosshair;
            margin-bottom: 20px;
        }

        #waveformCanvas {
            width: 100%;
            height: 100%;
            border-radius: 6px;
        }

        .selection-overlay {
            position: absolute;
            top: 0;
            height: 100%;
            background: rgba(77, 182, 172, 0.25);
            border-left: 2px solid var(--teal);
            border-right: 2px solid var(--teal);
            pointer-events: none;
        }

        /* Playback Controls */
        .playback-controls {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
        }

        .btn {
            padding: 10px 20px;
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            font-family: inherit;
            transition: all 0.15s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background: var(--bg-tertiary);
            border-color: var(--teal);
        }

        .btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .btn-primary {
            background: var(--teal);
            border-color: var(--teal);
            color: #000;
            font-weight: 600;
        }

        .btn-primary:hover {
            background: var(--teal-hover);
            border-color: var(--teal-hover);
        }

        .time-display {
            font-family: 'IBM Plex Mono', monospace;
            color: var(--text-secondary);
            font-size: 12px;
            margin-left: auto;
        }

        /* Extract Form */
        .extract-form {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 24px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 20px;
        }

        .form-field {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-dim);
            font-weight: 600;
        }

        .form-value {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 14px;
            color: var(--teal);
            font-weight: 500;
        }

        .form-input,
        .form-select {
            width: 100%;
            padding: 10px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;
            font-family: inherit;
            transition: all 0.2s;
        }

        .form-input:focus,
        .form-select:focus {
            outline: none;
            border-color: var(--teal);
            background: var(--bg-elevated);
        }

        .duration-controls {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .duration-btn {
            padding: 8px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 600;
            transition: all 0.15s;
        }

        .duration-btn:hover {
            background: var(--bg-elevated);
            border-color: var(--teal);
        }

        .duration-display {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 16px;
            min-width: 50px;
            text-align: center;
        }

        /* Right Panel */
        .right-panel {
            width: 380px;
            background: var(--bg-secondary);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .clips-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .clips-title {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .btn-save-all {
            padding: 8px 16px;
            background: var(--teal);
            color: #000;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            font-family: inherit;
            transition: all 0.15s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-save-all:hover {
            background: var(--teal-hover);
        }

        .clips-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        /* Clip Cards */
        .clip-card {
            background: var(--bg-tertiary);
            border: 2px solid var(--border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 12px;
            transition: all 0.2s;
        }

        .clip-card:hover {
            border-color: var(--teal);
        }

        .clip-card.canonical {
            border-color: var(--gold);
            position: relative;
        }

        .canonical-badge {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 4px 10px;
            background: var(--gold);
            color: #000;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border-radius: 3px;
        }

        .clip-spectrogram {
            width: 100%;
            height: auto;
            border-radius: 4px;
            margin-bottom: 12px;
            background: var(--bg-primary);
        }

        .clip-metadata {
            margin-bottom: 12px;
        }

        .clip-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 12px;
        }

        .clip-label {
            color: var(--text-dim);
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.08em;
            font-weight: 600;
        }

        .clip-value {
            font-family: 'IBM Plex Mono', monospace;
            color: var(--text-primary);
        }

        .quality-stars {
            display: flex;
            gap: 2px;
        }

        .star {
            color: var(--text-dim);
            font-size: 14px;
        }

        .star.filled {
            color: var(--gold);
        }

        /* Clip Actions */
        .clip-actions {
            display: flex;
            gap: 8px;
        }

        .clip-action-btn {
            flex: 1;
            padding: 10px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .clip-action-btn:hover {
            border-color: var(--teal);
            transform: translateY(-1px);
        }

        .clip-action-btn.star-btn:hover {
            border-color: var(--gold);
        }

        .clip-action-btn.delete-btn:hover {
            border-color: #ff4444;
        }

        /* Scrollbars */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--bg-primary);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--border-subtle);
        }
    </style>
</head>
<body>
    <!-- Top Bar -->
    <div class="top-bar">
        <div class="studio-title">Clip Studio</div>
        <div class="stats">
            <div>CLIPS: <span class="stat-value" id="totalClips">0</span></div>
            <div>CANONICAL: <span class="stat-value" id="totalCanonical">0</span></div>
            <div>SPECIES: <span class="stat-value" id="totalSpecies">0</span></div>
        </div>
    </div>

    <div class="studio">
        <!-- Left Panel -->
        <div class="left-panel">
            <div class="panel-section-header">PACK FILTER</div>
            
            <div class="pack-groups" id="packGroups">
                <!-- Pack groups will be rendered here -->
            </div>

            <div class="panel-section-header" style="margin-top: 20px;">SPECIES</div>
            
            <div class="search-box">
                <input type="text" class="search-input" id="searchInput" placeholder="Search species...">
            </div>

            <div class="species-list" id="speciesList">
                <!-- Species will be rendered here -->
            </div>
        </div>

        <!-- Center Panel -->
        <div class="center-panel">
            <div class="species-header">
                <h2 id="speciesTitle">Select a species</h2>
                <div class="species-scientific" id="speciesScientific"></div>
            </div>

            <div class="sources-message" id="sourcesMessage">
                No source recordings
            </div>

            <div class="waveform-area" id="waveformArea" style="display: none;">
                <div class="waveform-container">
                    <div id="waveform">
                        <canvas id="waveformCanvas"></canvas>
                        <div class="selection-overlay" id="selection" style="display:none;"></div>
                    </div>

                    <div class="playback-controls">
                        <button class="btn" onclick="playFull()">▶ Play Full</button>
                        <button class="btn" onclick="playSelection()">▶ Play Selection</button>
                        <button class="btn" onclick="stopAudio()">■ Stop</button>
                        <div class="time-display" id="timeDisplay">0:00 - 0:00</div>
                    </div>

                    <div class="extract-form">
                        <div class="form-grid">
                            <div class="form-field">
                                <label class="form-label">Start Time</label>
                                <div class="form-value" id="startTimeDisplay">0.0s</div>
                            </div>
                            <div class="form-field">
                                <label class="form-label">Duration (Seconds)</label>
                                <div class="duration-controls">
                                    <button class="duration-btn" onclick="adjustDuration(-0.1)">−</button>
                                    <div class="duration-display" id="durationDisplay">2.0</div>
                                    <button class="duration-btn" onclick="adjustDuration(0.1)">+</button>
                                </div>
                            </div>
                            <div class="form-field">
                                <label class="form-label">Vocalization Type</label>
                                <select class="form-select" id="vocType">''' + ''.join(f'<option value="{vt}">{vt}</option>' for vt in VOCALIZATION_TYPES) + '''</select>
                            </div>
                            <div class="form-field">
                                <label class="form-label">Recordist</label>
                                <input type="text" class="form-input" id="recordist" placeholder="Unknown">
                            </div>
                        </div>
                        <button class="btn btn-primary" style="width: 100%;" onclick="extractClip()">
                            🎯 Extract Clip
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Panel -->
        <div class="right-panel">
            <div class="clips-header">
                <div class="clips-title" id="clipsTitle">EXTRACTED (0)</div>
                <button class="btn-save-all" onclick="saveAllChanges()">💾 Save All</button>
            </div>
            <div class="clips-list" id="clipsList">
                <div style="padding: 60px 30px; text-align: center; color: var(--text-dim);">
                    Select a species to view clips
                </div>
            </div>
        </div>
    </div>

    <script>
        // State management
        const state = {
            packs: {},
            species: [],
            selectedSpecies: null,
            selectedSource: null,
            waveformData: null,
            startTime: 0,
            duration: 2.0,
            clips: [],
            expandedGroups: new Set()
        };

        let audio = null;

        // Initialize
        Promise.all([
            fetch('/api/packs').then(r => r.json()),
            fetch('/api/species').then(r => r.json())
        ]).then(([packs, species]) => {
            state.packs = packs;
            state.species = species;
            renderPackGroups();
            renderSpeciesList();
            updateStats();
        });

        function renderPackGroups() {
            const container = document.getElementById('packGroups');
            container.innerHTML = '';

            // All Birds option
            const allBirds = document.createElement('div');
            allBirds.className = 'pack-item all-birds active';
            allBirds.textContent = 'All Birds';
            allBirds.dataset.count = 'All';
            allBirds.onclick = () => selectPack(null);
            container.appendChild(allBirds);

            // Regional groups
            const regions = {
                'eu': 'European Packs',
                'nz': 'New Zealand Packs',
                'na': 'North American Packs'
            };

            for (const [region, label] of Object.entries(regions)) {
                const packs = state.packs[region] || [];
                if (packs.length === 0) continue;

                const group = document.createElement('div');
                group.className = 'pack-group';
                
                const header = document.createElement('div');
                header.className = 'pack-group-header';
                header.innerHTML = `
                    <span class="pack-arrow">▶</span>
                    <span class="pack-group-name">${label}</span>
                    <span class="pack-count">${packs.length}</span>
                `;
                header.onclick = () => toggleGroup(region);
                
                const items = document.createElement('div');
                items.className = 'pack-items';
                
                packs.forEach(pack => {
                    const item = document.createElement('div');
                    item.className = 'pack-item';
                    item.innerHTML = `${pack.name} <span style="color: var(--text-dim); font-size: 11px;">${pack.species_count}</span>`;
                    item.onclick = () => selectPack(pack.id);
                    items.appendChild(item);
                });
                
                group.appendChild(header);
                group.appendChild(items);
                container.appendChild(group);
            }
        }

        function toggleGroup(region) {
            const groups = document.querySelectorAll('.pack-group');
            groups.forEach(g => {
                const header = g.querySelector('.pack-group-header .pack-group-name');
                if (header.textContent.toLowerCase().includes(region)) {
                    g.classList.toggle('expanded');
                }
            });
        }

        function selectPack(packId) {
            document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
            event.target.classList.add('active');
            
            fetch('/api/species' + (packId ? '?pack=' + packId : ''))
                .then(r => r.json())
                .then(species => {
                    state.species = species;
                    renderSpeciesList();
                    updateStats();
                });
        }

        function renderSpeciesList() {
            const container = document.getElementById('speciesList');
            const search = document.getElementById('searchInput').value.toLowerCase();
            
            const filtered = state.species.filter(sp => 
                sp.species_code.toLowerCase().includes(search) ||
                (sp.common_name && sp.common_name.toLowerCase().includes(search))
            );
            
            container.innerHTML = filtered.map(sp => `
                <div class="species-item ${state.selectedSpecies?.species_code === sp.species_code ? 'active' : ''}"
                     onclick='selectSpecies(${JSON.stringify(sp)})'>
                    <div class="species-checkbox"></div>
                    <div class="species-info">
                        <div class="species-code">${sp.species_code}</div>
                        <div class="species-name">${sp.common_name || ''}</div>
                    </div>
                    <div class="species-counts">${sp.clip_count}/${sp.candidate_count}</div>
                </div>
            `).join('');
        }

        function selectSpecies(species) {
            state.selectedSpecies = species;
            renderSpeciesList();
            
            document.getElementById('speciesTitle').textContent = 
                `${species.common_name || species.species_code}`;
            document.getElementById('speciesScientific').textContent = 
                species.scientific_name || '';
            
            Promise.all([
                fetch(`/api/clips?species=${species.species_code}`).then(r => r.json()),
                fetch(`/api/candidates?species=${species.species_code}`).then(r => r.json())
            ]).then(([clips, candidates]) => {
                state.clips = clips;
                renderClips();
                
                if (candidates.length > 0) {
                    loadSource(candidates[0]);
                } else {
                    document.getElementById('sourcesMessage').style.display = 'block';
                    document.getElementById('waveformArea').style.display = 'none';
                }
            });
        }

        function loadSource(candidate) {
            document.getElementById('sourcesMessage').style.display = 'none';
            document.getElementById('waveformArea').style.display = 'block';
            
            document.getElementById('recordist').value = candidate.recordist || '';
            document.getElementById('vocType').value = candidate.vocalization_type || 'song';
            
            fetch('/api/waveform?source=' + encodeURIComponent(candidate.path))
                .then(r => r.json())
                .then(data => {
                    state.waveformData = data;
                    state.selectedSource = {
                        path: candidate.path,
                        xc_id: candidate.xc_id
                    };
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
            ctx.lineWidth = 1.5;

            const mins = state.waveformData.mins;
            const maxs = state.waveformData.maxs;
            const step = width / mins.length;

            ctx.beginPath();
            for (let i = 0; i < mins.length; i++) {
                const x = i * step;
                const minY = midY + (mins[i] * midY * 0.85);
                const maxY = midY + (maxs[i] * midY * 0.85);
                ctx.moveTo(x, minY);
                ctx.lineTo(x, maxY);
            }
            ctx.stroke();
        }

        document.getElementById('waveform').addEventListener('click', function(e) {
            if (!state.waveformData) return;

            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;

            state.startTime = ratio * state.waveformData.duration;

            if (state.startTime + state.duration > state.waveformData.duration) {
                state.startTime = Math.max(0, state.waveformData.duration - state.duration);
            }

            updateSelectionUI();
        });

        function adjustDuration(delta) {
            state.duration = Math.max(0.5, Math.min(3.0, state.duration + delta));
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

            document.getElementById('startTimeDisplay').textContent = state.startTime.toFixed(1) + 's';
            document.getElementById('durationDisplay').textContent = state.duration.toFixed(1);
            document.getElementById('timeDisplay').textContent =
                formatTime(state.startTime) + ' - ' + formatTime(state.startTime + state.duration);
        }

        function playFull() {
            if (!state.selectedSource) return;
            stopAudio();
            audio = new Audio('/audio/' + encodeURIComponent(state.selectedSource.path));
            audio.play();
        }

        function playSelection() {
            if (!state.selectedSource) return;
            stopAudio();
            audio = new Audio('/audio/' + encodeURIComponent(state.selectedSource.path));
            audio.currentTime = state.startTime;
            audio.play();

            const checkEnd = () => {
                if (audio && audio.currentTime >= state.startTime + state.duration) {
                    stopAudio();
                } else if (audio) {
                    requestAnimationFrame(checkEnd);
                }
            };
            requestAnimationFrame(checkEnd);
        }

        function stopAudio() {
            if (audio) {
                audio.pause();
                audio = null;
            }
        }

        function extractClip() {
            if (!state.selectedSource || !state.selectedSpecies) return;

            const params = {
                source_path: state.selectedSource.path,
                start_time: state.startTime,
                duration: state.duration,
                species_code: state.selectedSpecies.species_code,
                xc_id: state.selectedSource.xc_id,
                vocalization_type: document.getElementById('vocType').value,
                recordist: document.getElementById('recordist').value || 'Unknown'
            };

            fetch('/api/extract', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(params)
            })
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    fetch(`/api/clips?species=${state.selectedSpecies.species_code}`)
                        .then(r => r.json())
                        .then(clips => {
                            state.clips = clips;
                            renderClips();
                            updateStats();
                        });
                }
            });
        }

        function renderClips() {
            const container = document.getElementById('clipsList');
            document.getElementById('clipsTitle').textContent = `EXTRACTED (${state.clips.length})`;

            if (state.clips.length === 0) {
                container.innerHTML = '<div style="padding: 60px 30px; text-align: center; color: var(--text-dim);">No clips extracted yet</div>';
                return;
            }

            container.innerHTML = state.clips.map(clip => `
                <div class="clip-card ${clip.canonical ? 'canonical' : ''}">
                    ${clip.canonical ? '<div class="canonical-badge">CANONICAL</div>' : ''}
                    <img src="/${clip.spectrogram_path}" class="clip-spectrogram" onerror="this.style.display='none'">
                    <div class="clip-metadata">
                        <div class="clip-row">
                            <span class="clip-label">Clip ID</span>
                            <span class="clip-value">${clip.clip_id}</span>
                        </div>
                        <div class="clip-row">
                            <span class="clip-label">Duration</span>
                            <span class="clip-value">${(clip.duration_ms/1000).toFixed(1)}s</span>
                        </div>
                        <div class="clip-row">
                            <span class="clip-label">Type</span>
                            <span class="clip-value">${clip.vocalization_type || 'song'}</span>
                        </div>
                        <div class="clip-row">
                            <span class="clip-label">Quality</span>
                            <div class="quality-stars">
                                ${[1,2,3,4,5].map(i => `<span class="star ${i <= (clip.quality_score || 5) ? 'filled' : ''}">★</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="clip-actions">
                        <button class="clip-action-btn star-btn" onclick="toggleCanonical('${clip.clip_id}')" title="Mark canonical">⭐</button>
                        <button class="clip-action-btn" onclick="playClipAudio('${clip.file_path}')" title="Play">▶</button>
                        <button class="clip-action-btn delete-btn" onclick="deleteClip('${clip.clip_id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('');
        }

        function playClipAudio(path) {
            stopAudio();
            audio = new Audio('/' + path);
            audio.play();
        }

        function toggleCanonical(clipId) {
            state.clips.forEach(clip => {
                if (clip.clip_id !== clipId) {
                    updateClip(clip.clip_id, 'canonical', false);
                }
            });

            const clip = state.clips.find(c => c.clip_id === clipId);
            const newValue = !clip.canonical;
            updateClip(clipId, 'canonical', newValue);

            setTimeout(() => {
                fetch(`/api/clips?species=${state.selectedSpecies.species_code}`)
                    .then(r => r.json())
                    .then(clips => {
                        state.clips = clips;
                        renderClips();
                        updateStats();
                    });
            }, 100);
        }

        function updateClip(clipId, field, value) {
            fetch('/api/update-clip', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    clip_id: clipId,
                    updates: {[field]: value}
                })
            });
        }

        function deleteClip(clipId) {
            if (!confirm('Delete this clip permanently?')) return;

            fetch('/api/delete-clip', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({clip_id: clipId})
            })
            .then(() => {
                fetch(`/api/clips?species=${state.selectedSpecies.species_code}`)
                    .then(r => r.json())
                    .then(clips => {
                        state.clips = clips;
                        renderClips();
                        updateStats();
                    });
            });
        }

        function saveAllChanges() {
            if (!confirm('Save all changes and commit to git?')) return;

            fetch('/api/save-changes', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({})
            })
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    alert(`Saved! ${result.stats.rejections} clips deleted`);
                    updateStats();
                }
            });
        }

        function updateStats() {
            fetch('/api/species')
                .then(r => r.json())
                .then(species => {
                    const totalClips = species.reduce((sum, sp) => sum + sp.clip_count, 0);
                    document.getElementById('totalClips').textContent = totalClips;
                    document.getElementById('totalSpecies').textContent = species.length;
                    
                    // Count canonicals
                    fetch('/api/clips?species=all')
                        .then(r => r.json())
                        .then(allClips => {
                            const canonicals = allClips.filter(c => c.canonical).length;
                            document.getElementById('totalCanonical').textContent = canonicals;
                        })
                        .catch(() => {
                            // Fallback if all clips endpoint doesn't exist
                            document.getElementById('totalCanonical').textContent = '?';
                        });
                });
        }

        function formatTime(seconds) {
            if (!seconds && seconds !== 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', () => {
            renderSpeciesList();
        });

        window.addEventListener('resize', () => {
            if (state.waveformData) {
                drawWaveform();
                updateSelectionUI();
            }
        });
    </script>
</body>
</html>
'''


def main():
    parser = argparse.ArgumentParser(description='Clip Studio - Unified Audio Workflow')
    parser.add_argument('--batch', action='store_true', help='Launch batch mode UI')
    parser.add_argument('--species', help='Single species mode')
    parser.add_argument('--pack', help='Filter by pack ID')
    parser.add_argument('--port', type=int, default=PORT, help='Server port')

    args = parser.parse_args()

    if args.pack:
        ClipStudioHandler.filter_pack = args.pack

    # Start server
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", args.port), ClipStudioHandler) as httpd:
        print("=" * 60)
        print("🎨 Clip Studio - ChipNotes!")
        print("=" * 60)
        if args.pack:
            print(f"Pack Filter: {args.pack}")
        print(f"\nServer: http://localhost:{args.port}")
        print("\nFeatures:")
        print("  ✅ Search & download from Xeno-Canto")
        print("  ✅ Extract clips with waveform editor")
        print("  ✅ Review & curate metadata")
        print("  ✅ Mark canonical clips (1 per species)")
        print("  ✅ Delete rejected clips")
        print("  ✅ Git integration with automatic commits")
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
