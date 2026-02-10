#!/usr/bin/env python3
"""
Clip Editor Tool for ChipNotes!

A flexible tool for searching, extracting, editing, and managing audio clips.
This is the ONE tool for all XC audio work — search, download, extract, curate.

Use cases:
1. Search for recordings: --search "Eurasian Blackbird" --region eu
2. Add a new bird: --xc 123456 --species RWBL
3. Add more clips to existing bird: --species EAME
4. Fix a specific clip: --clip EAME_906697
5. Browse and curate: --species EAME

Usage:
    # Search XC for top recordings of a species
    python scripts/clip_editor.py --search "Northern Cardinal" --region na

    # Add new bird from XC recording (downloads full recording, shows waveform)
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

# Region country mappings for XC search filtering
REGION_COUNTRIES = {
    'na': ['United States', 'Canada'],
    'eu': [
        'Austria', 'Belgium', 'Czech Republic', 'Czechia', 'Denmark', 'Estonia',
        'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
        'Latvia', 'Lithuania', 'Luxembourg', 'Netherlands', 'Norway', 'Poland',
        'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
        'Switzerland', 'United Kingdom',
    ],
}


def search_xc_recordings(species_name: str, max_results: int = 10,
                          vocalization_type: str = None, region: str = 'any') -> list:
    """
    Search Xeno-canto for top recordings of a species.

    Returns list of recording dicts with id, recordist, type, length, quality, country.
    Does NOT download or extract anything.
    """
    import urllib.request
    import urllib.parse

    api_key = os.environ.get('XENO_CANTO_API_KEY', '')
    if not api_key:
        print("ERROR: XENO_CANTO_API_KEY not set. Get key from https://xeno-canto.org/account")
        return []

    query = urllib.parse.quote(f'en:"{species_name}"')
    url = f"https://xeno-canto.org/api/3/recordings?query={query}&key={api_key}&per_page=100"

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'ChipNotes/1.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())

        if 'error' in data:
            print(f"API Error: {data.get('error')} - {data.get('message')}")
            return []

        recordings = data.get('recordings', [])
        allowed_countries = REGION_COUNTRIES.get(region)

        good = []
        for rec in recordings:
            if allowed_countries and rec.get('cnt') not in allowed_countries:
                continue
            if rec.get('q') not in ['A', 'B']:
                continue
            # Filter out BY-NC-ND (No Derivatives) licenses
            license = rec.get('lic', '').lower()
            if 'nd' in license:
                continue
            try:
                parts = rec.get('length', '0:00').split(':')
                if len(parts) == 2:
                    total_sec = int(parts[0]) * 60 + int(parts[1])
                    if 3 <= total_sec <= 90:
                        good.append(rec)
            except (ValueError, IndexError):
                continue

        if vocalization_type:
            vt = vocalization_type.lower()
            good = [r for r in good if vt in r.get('type', '').lower()]

        return good[:max_results]

    except Exception as e:
        print(f"Error searching XC: {e}")
        return []


class ClipEditorHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for clip editor server"""

    # Initial state (can be None)
    initial_source_path = None
    initial_clip = None
    species_code = None
    xc_id = None
    # Batch mode: candidate directories to show in species list
    candidate_dirs = None

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
        elif path == '/api/species-list':
            self.send_species_list()
        elif path == '/api/candidates':
            species = query.get('species', [None])[0]
            self.send_candidates(species)
        elif path == '/api/clips':
            species = query.get('species', [self.species_code])[0]
            self.send_clips_for_species(species)
        elif path == '/api/clip-info':
            clip_id = query.get('id', [None])[0]
            self.send_clip_info(clip_id)
        elif path == '/api/waveform':
            source = query.get('source', [None])[0]
            self.send_waveform(source)
        elif path == '/api/load-xc':
            xc_id = query.get('id', [None])[0]
            self.load_xc_recording(xc_id)
        elif path == '/api/packs':
            self.send_packs()
        elif path == '/api/clips-by-pack':
            pack_id = query.get('pack', [None])[0]
            self.send_clips_by_pack(pack_id)
        elif path == '/api/pack-species':
            pack_id = query.get('pack', [None])[0]
            self.send_pack_species(pack_id)
        elif path.startswith('/audio/'):
            self.serve_audio(path[7:])
        elif path.startswith('/data/'):
            self.serve_file(path[1:])
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/extract':
            self.handle_extract()
        elif self.path == '/api/update-clip':
            self.handle_update_clip()
        elif self.path == '/api/delete-clip':
            self.handle_delete_clip()
        elif self.path == '/api/save-changes':
            self.handle_save_changes()
        else:
            self.send_error(404)

    def send_html(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        if self.candidate_dirs:
            self.wfile.write(generate_batch_html().encode())
        else:
            self.wfile.write(generate_html().encode())

    def send_init_state(self):
        """Send initial state based on how tool was launched"""
        state = {
            'species_code': self.species_code,
            'initial_source': str(self.initial_source_path) if self.initial_source_path else None,
            'initial_clip': self.initial_clip,
            'xc_id': self.xc_id,
            'batch_mode': self.candidate_dirs is not None,
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

    def send_species_list(self):
        """Send list of species with candidate folders and clip counts"""
        species_data = load_species_data()
        clips_json_path = PROJECT_ROOT / "data" / "clips.json"
        all_clips = []
        if clips_json_path.exists():
            with open(clips_json_path, 'r') as f:
                all_clips = json.load(f)

        # Count extracted clips per species
        clip_counts = {}
        for c in all_clips:
            code = c.get('species_code', '')
            clip_counts[code] = clip_counts.get(code, 0) + 1

        result = []
        dirs = self.candidate_dirs or []
        for d in dirs:
            code = d.name.replace('candidates_', '')
            # Load manifest to count available recordings
            manifest_path = d / '.ingest_manifest.json'
            if not manifest_path.exists():
                manifest_path = d / 'manifest.json'
            candidate_count = 0
            if manifest_path.exists():
                with open(manifest_path) as f:
                    candidate_count = len(json.load(f))

            sp_info = species_data.get(code.upper(), species_data.get(code, {}))
            extracted = clip_counts.get(code, clip_counts.get(code.upper(), 0))
            result.append({
                'code': code,
                'common_name': sp_info.get('common_name', code),
                'scientific_name': sp_info.get('scientific_name', ''),
                'candidate_count': candidate_count,
                'extracted_count': extracted,
            })

        # Sort: species with 0 extracted first, then by name
        result.sort(key=lambda x: (x['extracted_count'] > 0, x['common_name']))
        self.send_json(result)

    def send_candidates(self, species_code):
        """Send candidate XC recordings from manifest for a species"""
        if not species_code:
            self.send_json([])
            return

        # Try both cases for folder name
        candidates_dir = PROJECT_ROOT / "data" / f"candidates_{species_code}"
        if not candidates_dir.exists():
            candidates_dir = PROJECT_ROOT / "data" / f"candidates_{species_code.upper()}"
        if not candidates_dir.exists():
            self.send_json([])
            return

        manifest_path = candidates_dir / '.ingest_manifest.json'
        if not manifest_path.exists():
            manifest_path = candidates_dir / 'manifest.json'
        if not manifest_path.exists():
            self.send_json([])
            return

        with open(manifest_path) as f:
            manifest = json.load(f)

        result = []
        for m in manifest:
            xc_id = m.get('source_id', '').replace('XC', '')
            result.append({
                'xc_id': xc_id,
                'vocalization_type': m.get('vocalization_type', 'unknown'),
                'recordist': m.get('recordist', 'Unknown'),
                'quality': m.get('quality', '?'),
            })

        self.send_json(result)

    def send_clips_for_species(self, species_code=None):
        """Send all clips for a species"""
        code = species_code or self.species_code
        clips = get_clips_for_species(code)
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
        """Download and return info for an XC recording, including metadata from XC API"""
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

            # Query XC API for metadata (recordist, vocalization type)
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
                        result['license'] = rec.get('lic', '')
                        # Map XC type field to our vocalization types
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
                        result['common_name'] = rec.get('en', '')
            except Exception as e:
                print(f"Warning: Could not fetch XC metadata for {xc_id}: {e}")

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
                license=params.get('license'),
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

    def send_packs(self):
        """Send list of all packs grouped by region"""
        try:
            packs = load_packs()
            self.send_json(packs)
        except Exception as e:
            self.send_json({'error': str(e)})

    def send_clips_by_pack(self, pack_id):
        """Send clips filtered by pack species"""
        try:
            if not pack_id or pack_id == 'all':
                # Return all clips
                clips = load_all_clips()
            else:
                # Load pack and filter clips by species list
                species_codes = get_pack_species(pack_id)  # Returns uppercase codes
                clips = load_all_clips()
                # Case-insensitive comparison (NZ birds use lowercase, NA birds use uppercase)
                species_codes_upper = [s.upper() for s in species_codes]
                clips = [c for c in clips if c.get('species_code', '').upper() in species_codes_upper]

            self.send_json(clips)
        except Exception as e:
            self.send_json({'error': str(e)})

    def send_pack_species(self, pack_id):
        """Send all species codes for a pack"""
        try:
            if not pack_id or pack_id == 'all':
                # Return all species from species.json
                species_path = Path('data/species.json')
                if species_path.exists():
                    species_data = json.loads(species_path.read_text())
                    species_codes = [s['species_code'] for s in species_data]
                else:
                    species_codes = []
            else:
                # Get species codes from pack definition
                species_codes = get_pack_species(pack_id)

            self.send_json({'species_codes': species_codes})
        except Exception as e:
            self.send_json({'error': str(e)})

    def handle_update_clip(self):
        """Update single clip metadata (canonical, quality, vocalization_type, recordist)"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode())

        try:
            clip_id = params.get('clip_id')
            updates = params.get('updates', {})

            result = update_clip_metadata(clip_id, updates)
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    def handle_delete_clip(self):
        """Mark clip for deletion (sets rejected flag)"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode())

        try:
            clip_id = params.get('clip_id')
            result = mark_clip_rejected(clip_id)
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    def handle_save_changes(self):
        """Save all pending changes, delete rejected files, and git commit"""
        try:
            result = save_all_changes()
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})


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
                 license: str = None, replace_clip_id: str = None) -> dict:
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

    # Resample if needed (use proper anti-aliasing filter)
    if sr != OUTPUT_SAMPLE_RATE:
        try:
            import librosa
            segment = librosa.resample(segment, orig_sr=sr, target_sr=OUTPUT_SAMPLE_RATE)
        except ImportError:
            from scipy.signal import resample
            new_length = int(len(segment) * OUTPUT_SAMPLE_RATE / sr)
            segment = resample(segment, new_length)
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
            'license': license,
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


# =============================================================================
# Curation Features (ported from review_clips.py)
# =============================================================================

def load_packs():
    """Load all pack JSONs, return dict grouped by region"""
    packs_dir = PROJECT_ROOT / "data" / "packs"
    if not packs_dir.exists():
        return {}

    packs = {'na': [], 'nz': [], 'eu': [], 'other': []}

    for pack_file in packs_dir.glob('*.json'):
        try:
            with open(pack_file, 'r') as f:
                pack_data = json.load(f)
                region = pack_data.get('region', 'other')
                packs[region].append({
                    'pack_id': pack_data.get('pack_id'),
                    'display_name': pack_data.get('display_name'),
                    'species_count': len(pack_data.get('species', [])),
                })
        except Exception as e:
            print(f"Warning: Could not load pack {pack_file}: {e}")

    return packs


def get_pack_species(pack_id: str) -> list:
    """Return species codes from a pack definition"""
    pack_path = PROJECT_ROOT / "data" / "packs" / f"{pack_id}.json"
    if not pack_path.exists():
        return []

    with open(pack_path, 'r') as f:
        pack_data = json.load(f)
        return [s.upper() for s in pack_data.get('species', [])]


def load_all_clips():
    """Load all clips from clips.json"""
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    if not clips_json_path.exists():
        return []

    with open(clips_json_path, 'r') as f:
        return json.load(f)


def update_clip_metadata(clip_id: str, updates: dict) -> dict:
    """Update single clip metadata (canonical, quality, vocalization_type, recordist)"""
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    if not clips_json_path.exists():
        return {'success': False, 'error': 'clips.json not found'}

    with open(clips_json_path, 'r') as f:
        clips = json.load(f)

    # Find and update clip
    clip_found = False
    for clip in clips:
        if clip['clip_id'] == clip_id:
            clip_found = True

            # Update allowed fields
            if 'canonical' in updates:
                clip['canonical'] = updates['canonical']
            if 'quality_score' in updates:
                clip['quality_score'] = updates['quality_score']
            if 'vocalization_type' in updates:
                clip['vocalization_type'] = updates['vocalization_type']
            if 'recordist' in updates:
                clip['recordist'] = updates['recordist']
            if 'rejected' in updates:
                clip['rejected'] = updates['rejected']
            break

    if not clip_found:
        return {'success': False, 'error': f'Clip {clip_id} not found'}

    # Save clips.json
    with open(clips_json_path, 'w') as f:
        json.dump(clips, f, indent=2)

    return {'success': True, 'clip_id': clip_id}


def mark_clip_rejected(clip_id: str) -> dict:
    """Mark clip for deletion (sets rejected flag)"""
    return update_clip_metadata(clip_id, {'rejected': True})


def save_all_changes() -> dict:
    """
    Save all pending changes to clips.json:
    - Validate canonical uniqueness (1 per species)
    - Log rejected XC IDs
    - Delete rejected files (WAV + PNG)
    - Git commit with descriptive message
    """
    import subprocess

    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    rejected_xc_ids_path = PROJECT_ROOT / "data" / "rejected_xc_ids.json"
    backup_path = clips_json_path.with_suffix('.json.backup')

    # 1. Backup clips.json
    shutil.copy(clips_json_path, backup_path)
    print(f"✅ Backup created: {backup_path}")

    # 2. Load current clips
    with open(clips_json_path, 'r') as f:
        clips = json.load(f)

    # 3. Validate canonical uniqueness (exactly 1 per species)
    species_canonicals = {}
    for clip in clips:
        if clip.get('canonical') and not clip.get('rejected'):
            species = clip['species_code']
            if species in species_canonicals:
                return {
                    'success': False,
                    'error': f"Multiple canonicals for {species}: {species_canonicals[species]} and {clip['clip_id']}"
                }
            species_canonicals[species] = clip['clip_id']

    # 4. Track changes for git commit message
    stats = {
        'canonical_count': len(species_canonicals),
        'rejections': sum(1 for c in clips if c.get('rejected')),
        'files_deleted': []
    }

    # 5. Log rejected XC IDs
    rejected_clips_to_log = {}
    for clip in clips:
        if clip.get('rejected') and clip.get('source_id'):
            species = clip['species_code']
            xc_match = re.match(r'XC(\d+)', clip.get('source_id', ''))
            if xc_match:
                xc_id = xc_match.group(1)
                if species not in rejected_clips_to_log:
                    rejected_clips_to_log[species] = []
                rejected_clips_to_log[species].append(xc_id)

    if rejected_clips_to_log:
        # Load existing rejection log
        if rejected_xc_ids_path.exists():
            with open(rejected_xc_ids_path, 'r') as f:
                rejection_log = json.load(f)
        else:
            rejection_log = {}

        # Merge new rejections
        for species, xc_ids in rejected_clips_to_log.items():
            if species not in rejection_log:
                rejection_log[species] = []
            rejection_log[species].extend(xc_ids)
            rejection_log[species] = sorted(list(set(rejection_log[species])))

        # Save updated log
        with open(rejected_xc_ids_path, 'w') as f:
            json.dump(rejection_log, f, indent=2, sort_keys=True)
        print(f"📝 Logged {sum(len(v) for v in rejected_clips_to_log.values())} rejected XC IDs")

    # 6. Delete rejected files from disk
    deleted_count = 0
    for clip in clips:
        if clip.get('rejected'):
            for file_path in [clip.get('file_path'), clip.get('spectrogram_path')]:
                if file_path:
                    full_path = PROJECT_ROOT / file_path
                    if full_path.exists():
                        full_path.unlink()
                        deleted_count += 1
                        stats['files_deleted'].append(file_path)
                        print(f"🗑️  Deleted: {file_path}")

    # 7. Remove rejected clips from array
    clips = [c for c in clips if not c.get('rejected', False)]
    stats['clips_remaining'] = len(clips)

    # 8. Save updated clips.json
    with open(clips_json_path, 'w') as f:
        json.dump(clips, f, indent=2)
    print(f"💾 Saved {len(clips)} clips to {clips_json_path}")

    # 9. Git commit
    commit_msg = generate_commit_message(stats)
    try:
        os.chdir(PROJECT_ROOT)
        subprocess.run(['git', 'add', 'data/clips.json'], check=True)
        if stats['files_deleted']:
            for file_path in stats['files_deleted']:
                subprocess.run(['git', 'add', file_path], check=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        print(f"✅ Git commit: {commit_msg}")
        stats['git_committed'] = True
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Git commit failed: {e}")
        stats['git_committed'] = False

    return {
        'success': True,
        'stats': stats,
    }


def generate_commit_message(stats: dict) -> str:
    """Generate descriptive git commit message"""
    parts = []

    if stats.get('rejections', 0) > 0:
        parts.append(f"{stats['rejections']} clips rejected")

    if stats.get('canonical_count', 0) > 0:
        parts.append(f"{stats['canonical_count']} canonical clips")

    if not parts:
        parts.append("Clip metadata updated")

    msg = "Review: " + ", ".join(parts)
    msg += f"\n\n🤖 Generated with Clip Studio\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

    return msg


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
                        // Store license in state for later use
                        state.currentLicense = result.license || null;
                        // Auto-fill metadata from XC API
                        if (result.recordist) {
                            document.getElementById('recordist').value = result.recordist;
                        }
                        if (result.vocalization_type) {
                            document.getElementById('vocType').value = result.vocalization_type;
                        }
                        let statusMsg = 'Loaded XC' + xcId + ' (' + result.duration.toFixed(1) + 's)';
                        if (result.recordist) statusMsg += ' — ' + result.recordist;
                        // Warn about problematic licenses
                        if (result.license && result.license.toLowerCase().includes('nd')) {
                            statusMsg += ' ⚠️ NO DERIVATIVES LICENSE';
                            showStatus(statusMsg, 'error');
                        } else {
                            showStatus(statusMsg, 'success');
                        }
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
                license: state.currentLicense || null,
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
                license: state.currentLicense || null,
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


def generate_batch_html() -> str:
    """Generate the unified Clip Studio UI with 3-panel layout and full curation features"""
    return '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clip Studio - ChipNotes Audio Curation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #1a1a1a;
            --bg-secondary: #222222;
            --bg-tertiary: #2a2a2a;
            --bg-elevated: #2e2e2e;
            --bg-hover: #333333;
            --accent: #4db6ac;
            --accent-hover: #5dc6bc;
            --accent-dim: rgba(77, 182, 172, 0.1);
            --accent-glow: rgba(77, 182, 172, 0.3);
            --text-primary: #e0e0e0;
            --text-secondary: #999999;
            --text-tertiary: #666666;
            --border: #333333;
            --border-subtle: #282828;
            --success: #66aa66;
            --warning: #ff9900;
            --error: #cc6666;
            --canonical: #ffd700;
            --font-body: 'Inter', -apple-system, sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
            --space-xs: 4px;
            --space-sm: 8px;
            --space-md: 16px;
            --space-lg: 24px;
            --transition-fast: 150ms ease;
            --transition-base: 250ms ease;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: var(--font-body);
            background: var(--bg-primary);
            color: var(--text-primary);
            overflow: hidden;
            height: 100vh;
        }

        /* Header */
        .studio-header {
            height: 56px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 var(--space-lg);
            z-index: 100;
        }

        .header-title h1 {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .header-stats {
            display: flex;
            gap: var(--space-lg);
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
        }

        .stat-value { color: var(--accent); font-weight: 600; }

        /* Layout */
        .studio-layout {
            display: flex;
            height: calc(100vh - 56px);
            overflow: hidden;
        }

        /* Left Panel */
        .left-panel {
            width: 280px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-section {
            padding: var(--space-md);
            border-bottom: 1px solid var(--border-subtle);
        }

        /* Species List Container - CRITICAL FOR SCROLLING */
        .species-list-container {
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .section-header {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-tertiary);
            margin-bottom: var(--space-sm);
        }

                /* Pack Filter Tree - NO RADIO BUTTONS */
        .pack-group {
            margin-bottom: 4px;
        }

        .pack-toggle {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: 10px var(--space-sm);
            cursor: pointer;
            border-radius: 4px;
            transition: all var(--transition-fast);
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
        }
        
        .pack-toggle:hover {
            background: var(--bg-hover);
        }

        .pack-toggle.active {
            background: var(--accent-dim);
            color: var(--accent);
        }

        .expand-icon {
            font-size: 10px;
            color: var(--text-secondary);
            transition: transform var(--transition-fast);
            display: inline-block;
            width: 12px;
        }

        .pack-label {
            flex: 1;
        }

        .pack-count {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-tertiary);
            padding: 2px 6px;
            background: var(--bg-primary);
            border-radius: 3px;
        }

        .pack-list {
            display: none;
            margin-left: 20px;
            margin-top: 4px;
        }

        .pack-list.expanded { display: flex; flex-direction: column; gap: var(--space-xs); }

        .pack-item {
            padding: 6px var(--space-sm);
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
            color: var(--text-secondary);
            transition: all var(--transition-fast);
        }

        .pack-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        .pack-item.active { background: var(--accent-dim); color: var(--accent); font-weight: 500; }

        /* Species List */
        .species-list {
            flex: 1;
            overflow-y: scroll;
            overflow-x: hidden;
            padding: var(--space-sm);
            height: 100%;
        }

        .species-list::-webkit-scrollbar {
            width: 8px;
        }

        .species-list::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }

        .species-list::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        .species-list::-webkit-scrollbar-thumb:hover {
            background: var(--accent);
        }

        /* Search Box */
        .search-box {
            padding: var(--space-sm);
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-subtle);
        }

        .search-box {
            position: relative;
            width: 100%;
        }

        .search-input {
            width: 100%;
            padding: 8px 32px 8px 12px;  /* Extra padding on right for X button */
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-dim);
        }

        .search-input::placeholder {
            color: var(--text-tertiary);
        }

        .search-clear {
            position: absolute;
            right: 4px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--text-tertiary);
            font-size: 18px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 3px;
            opacity: 0;
            pointer-events: none;
            transition: all var(--transition-fast);
        }

        .search-clear.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .search-clear:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
        }

        .species-item.hidden {
            display: none;
        }
        .species-item {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-sm);
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: var(--space-xs);
            border: 1px solid transparent;
            transition: all var(--transition-fast);
        }

        .species-item:hover { background: var(--bg-tertiary); border-color: var(--border); }
        .species-item.active { background: var(--accent-dim); border-color: var(--accent); }

        .species-checkbox {
            width: 16px;
            height: 16px;
            border: 2px solid var(--border);
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .species-item.complete .species-checkbox {
            background: var(--success);
            border-color: var(--success);
        }

        .species-item.complete .species-checkbox::after {
            content: '✓';
            color: var(--bg-primary);
            font-size: 11px;
        }

        .species-info { flex: 1; min-width: 0; }
        .species-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .species-code { font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); }
        .species-progress { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
        .species-progress .extracted { color: var(--accent); font-weight: 600; }

        /* Center Panel */
        .center-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .species-header {
            padding: var(--space-lg);
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }

        .species-header h2 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
        .species-header .scientific { font-size: 14px; font-style: italic; color: var(--text-secondary); }

        /* Sources Bar */
        .sources-bar {
            padding: var(--space-md) var(--space-lg);
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border);
            overflow-x: auto;
        }

        .source-chips { display: flex; gap: var(--space-sm); }

        .source-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            transition: all var(--transition-fast);
            white-space: nowrap;
        }

        .source-chip:hover { border-color: var(--accent); background: var(--bg-elevated); }
        .source-chip.active { background: var(--accent); border-color: var(--accent); color: var(--bg-primary); font-weight: 600; }

        .source-badge {
            padding: 2px 6px;
            background: var(--bg-primary);
            border-radius: 2px;
            font-size: 9px;
            text-transform: uppercase;
        }

        /* Waveform Editor */
        .waveform-editor {
            flex: 1;
            padding: var(--space-lg);
            overflow-y: auto;
        }

        .waveform-container {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: var(--space-lg);
            margin-bottom: var(--space-lg);
        }

        .waveform-canvas {
            width: 100%;
            height: 180px;
            background: var(--bg-primary);
            border-radius: 4px;
            cursor: crosshair;
            position: relative;
            overflow: hidden;
        }

        .selection-overlay {
            position: absolute;
            top: 0;
            height: 100%;
            background: var(--accent-glow);
            border-left: 2px solid var(--accent);
            border-right: 2px solid var(--accent);
            pointer-events: none;
        }

        .playback-controls {
            display: flex;
            gap: var(--space-sm);
            margin-top: var(--space-md);
        }

        .btn {
            padding: 10px 20px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all var(--transition-fast);
        }

        .btn:hover { background: var(--bg-hover); border-color: var(--accent); }
        .btn:active { transform: translateY(1px); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-primary {
            background: var(--accent);
            border-color: var(--accent);
            color: var(--bg-primary);
            font-weight: 600;
        }

        .btn-primary:hover { background: var(--accent-hover); }

        /* Extract Controls */
        .extract-controls {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: var(--space-lg);
        }

        .controls-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-md);
            margin-bottom: var(--space-md);
        }

        .control-group { display: flex; flex-direction: column; gap: 6px; }

        .control-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-tertiary);
        }

        .control-input {
            padding: 10px 12px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-primary);
            font-family: var(--font-mono);
            font-size: 13px;
        }

        .control-input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-dim);
        }

        /* Right Panel */
        .right-panel {
            width: 360px;
            background: var(--bg-secondary);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .clips-header {
            padding: var(--space-md) var(--space-lg);
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .clips-header h2 {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .btn-save-all {
            padding: 8px 16px;
            background: var(--accent);
            border: none;
            border-radius: 4px;
            color: var(--bg-primary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition-fast);
        }

        .btn-save-all:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }

        .btn-save-all:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        /* Clips List */
        .clips-list {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-md);
        }

        .clip-card {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: var(--space-md);
            margin-bottom: var(--space-md);
            transition: all var(--transition-base);
        }

        .clip-card:hover {
            border-color: var(--accent);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .clip-card.canonical {
            border-color: var(--canonical);
            background: linear-gradient(135deg, var(--bg-primary) 0%, rgba(255, 215, 0, 0.03) 100%);
        }

        .clip-card.modified {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-dim);
        }

        .clip-card.rejected {
            opacity: 0.4;
            border-color: var(--error);
        }

        .clip-spectrogram {
            width: 100%;
            height: 90px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            margin-bottom: var(--space-sm);
            overflow: hidden;
            position: relative;
        }

        .clip-spectrogram img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .canonical-badge {
            position: absolute;
            top: 6px;
            right: 6px;
            padding: 4px 8px;
            background: var(--canonical);
            color: var(--bg-primary);
            font-family: var(--font-mono);
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            border-radius: 3px;
        }

        .clip-metadata {
            display: grid;
            gap: var(--space-sm);
            margin-bottom: var(--space-sm);
        }

        .metadata-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
        }

        .metadata-label {
            color: var(--text-tertiary);
            text-transform: uppercase;
            font-weight: 600;
        }

        .metadata-value {
            color: var(--text-primary);
            font-family: var(--font-mono);
        }

        .voc-type-select {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 4px 8px;
            font-family: var(--font-mono);
            font-size: 12px;
            cursor: pointer;
            width: 100%;
        }

        .voc-type-select:hover {
            border-color: var(--accent);
        }

        .voc-type-select:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(77, 182, 172, 0.1);
        }

        .quality-stars {
            display: flex;
            gap: 2px;
        }

        .star {
            color: var(--text-tertiary);
            cursor: pointer;
            font-size: 14px;
        }

        .star.active { color: var(--warning); }

        .clip-actions {
            display: flex;
            gap: var(--space-xs);
            margin-top: var(--space-sm);
        }

        .btn-icon {
            flex: 1;
            padding: 8px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-secondary);
            font-size: 16px;
            cursor: pointer;
            transition: all var(--transition-fast);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .btn-icon:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
            border-color: var(--accent);
        }

        .btn-icon.canonical-btn.active {
            background: var(--canonical);
            color: var(--bg-primary);
            border-color: var(--canonical);
        }

        .btn-icon.play-btn.playing {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .btn-icon.delete-btn:hover {
            background: var(--error);
            color: white;
            border-color: var(--error);
        }

        .btn-icon.play-btn:hover {
            background: var(--accent);
            color: var(--bg-primary);
            border-color: var(--accent);
        }

        .empty-state {
            padding: var(--space-xl);
            text-align: center;
            color: var(--text-tertiary);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: var(--space-md);
            opacity: 0.3;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .clip-card { animation: fadeIn var(--transition-base) ease-out; }
    </style>
</head>
<body>
    <header class="studio-header">
        <div class="header-title">
            <h1>Clip Studio</h1>
        </div>
        <div class="header-stats">
            <div class="stat-item">
                <span>Clips:</span>
                <span class="stat-value" id="stat-clips">0</span>
            </div>
            <div class="stat-item">
                <span>Canonical:</span>
                <span class="stat-value" id="stat-canonical">0</span>
            </div>
            <div class="stat-item">
                <span>Species:</span>
                <span class="stat-value" id="stat-species">0</span>
            </div>
        </div>
    </header>

    <div class="studio-layout">
        <!-- Left Panel -->
        <aside class="left-panel">
            <div class="panel-section">
                <div class="section-header">Pack Filter</div>
                <div class="pack-filter" id="pack-filter">
                    <!-- Populated by JavaScript -->
                </div>
            </div>

            <!-- Search Box -->
            <div class="search-box">
                <div class="search-box">
                    <input type="text" class="search-input" id="species-search" placeholder="🔍 Search species..." oninput="filterSpecies()">
                    <button class="search-clear" id="search-clear" onclick="clearSearch()" title="Clear search">✕</button>
                </div>
            </div>

            <div class="species-list-container">
                <div class="species-list" id="species-list">
                    <div class="empty-state">
                        <div class="empty-state-icon">🐦</div>
                        <div>Loading species...</div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Center Panel -->
        <main class="center-panel">
            <div class="species-header" id="species-header">
                <h2 id="species-name">Select a species</h2>
                <div class="scientific" id="species-scientific"></div>
            </div>

            <div class="sources-bar" id="sources-bar">
                <div class="source-chips" id="source-chips">
                    <div class="empty-state" style="padding: 0;">No source recordings</div>
                </div>
            </div>

            <div class="waveform-editor">
                <div class="waveform-container">
                    <div class="waveform-canvas" id="waveform-canvas">
                        <canvas id="waveform" width="800" height="180"></canvas>
                        <div class="selection-overlay" id="selection-overlay" style="display: none;"></div>
                    </div>

                    <div class="playback-controls">
                        <button class="btn" id="btn-play-full" disabled>▶ Play Full</button>
                        <button class="btn" id="btn-play-selection" disabled>▶ Play Selection</button>
                        <button class="btn" id="btn-stop" disabled>⏹ Stop</button>
                    </div>
                </div>

                <div class="extract-controls">
                    <div class="controls-grid">
                        <div class="control-group">
                            <label class="control-label">Start Time</label>
                            <input type="text" class="control-input" id="input-start" value="0.0s" readonly>
                        </div>
                        <div class="control-group">
                            <label class="control-label">Duration (seconds)</label>
                            <div class="duration-input-group">
                                <button class="duration-btn" onclick="adjustDuration(-0.1)">−</button>
                                <input type="number" class="control-input" id="input-duration" value="2.0" min="0.5" max="3.0" step="0.1" style="text-align: center;">
                                <button class="duration-btn" onclick="adjustDuration(0.1)">+</button>
                            </div>
                        </div>
                        <div class="control-group">
                            <label class="control-label">Vocalization Type</label>
                            <select class="control-input" id="input-voc-type">
                                <option value="song">song</option>
                                <option value="call">call</option>
                                <option value="flight call">flight call</option>
                                <option value="alarm call">alarm call</option>
                                <option value="chip">chip</option>
                                <option value="drum">drum</option>
                                <option value="dawn song">dawn song</option>
                                <option value="duet">duet</option>
                                <option value="begging call">begging call</option>
                                <option value="contact call">contact call</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="control-label">Recordist</label>
                            <input type="text" class="control-input" id="input-recordist" value="Unknown">
                        </div>
                    </div>

                    <button class="btn btn-primary" id="btn-extract" style="width: 100%;" disabled>
                        🎯 Extract Clip
                    </button>
                </div>
            </div>
        </main>

        <!-- Right Panel -->
        <aside class="right-panel">
            <div class="clips-header">
                <h2 id="clips-count">Extracted (0)</h2>
                <button class="btn-save-all" id="btn-save-all" disabled>💾 Save All</button>
            </div>

            <div class="clips-list" id="clips-list">
                <div class="empty-state">
                    <div class="empty-state-icon">🎵</div>
                    <div>No clips extracted yet</div>
                </div>
            </div>
        </aside>
    </div>

    <script>
        // Global state
        const state = {
            selectedPack: null,
            selectedSpecies: null,
            packs: {},
            species: [],
            clips: [],
            candidates: [],
            waveformData: null,
            currentSource: null,
            currentAudio: null,
            playingClipId: null,  // Track which clip is currently playing
            selection: { start: 0, duration: 2.0 },
            pendingChanges: { modified: {}, deleted: [] }
        };

        // Initialize
        async function init() {
            await loadPacks();
            await loadSpeciesList();
            updateStats();
            setupEventListeners();
        }

        // Load packs
        async function loadPacks() {
            const response = await fetch('/api/packs');
            state.packs = await response.json();
            renderPackFilter();
        }

        // Render pack filter
        function renderPackFilter() {
            const container = document.getElementById('pack-filter');
            let html = '';

            // All Birds (always visible, acts as reset)
            html += `
                <div class="pack-group">
                    <div class="pack-toggle ${!state.selectedPack ? 'active' : ''}" onclick="selectPack(null)">
                        <span class="pack-label">All Birds</span>
                        <span class="pack-count">All</span>
                    </div>
                </div>
            `;

            // EU Packs
            if (state.packs.eu && state.packs.eu.length > 0) {
                html += `
                    <div class="pack-group">
                        <div class="pack-toggle expandable" onclick="togglePackList('eu')">
                            <span class="expand-icon">▶</span>
                            <span class="pack-label">European Packs</span>
                            <span class="pack-count">${state.packs.eu.length}</span>
                        </div>
                        <div class="pack-list" id="pack-list-eu">
                            ${state.packs.eu.map(p => `
                                <div class="pack-item ${state.selectedPack === p.pack_id ? 'active' : ''}" data-pack-id="${p.pack_id}">
                                    ${p.display_name}
                                    <span class="pack-species-count">${p.species_count} species</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // NZ Packs
            if (state.packs.nz && state.packs.nz.length > 0) {
                html += `
                    <div class="pack-group">
                        <div class="pack-toggle expandable" onclick="togglePackList('nz')">
                            <span class="expand-icon">▶</span>
                            <span class="pack-label">New Zealand Packs</span>
                            <span class="pack-count">${state.packs.nz.length}</span>
                        </div>
                        <div class="pack-list" id="pack-list-nz">
                            ${state.packs.nz.map(p => `
                                <div class="pack-item ${state.selectedPack === p.pack_id ? 'active' : ''}" data-pack-id="${p.pack_id}">
                                    ${p.display_name}
                                    <span class="pack-species-count">${p.species_count} species</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // NA Packs  
            if (state.packs.na && state.packs.na.length > 0) {
                html += `
                    <div class="pack-group">
                        <div class="pack-toggle expandable" onclick="togglePackList('na')">
                            <span class="expand-icon">▶</span>
                            <span class="pack-label">North American Packs</span>
                            <span class="pack-count">${state.packs.na.length}</span>
                        </div>
                        <div class="pack-list" id="pack-list-na">
                            ${state.packs.na.map(p => `
                                <div class="pack-item ${state.selectedPack === p.pack_id ? 'active' : ''}" data-pack-id="${p.pack_id}">
                                    ${p.display_name}
                                    <span class="pack-species-count">${p.species_count} species</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;
            
            // Add click handlers to pack items using event delegation
            setTimeout(() => {
                document.querySelectorAll('.pack-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const packId = item.getAttribute('data-pack-id');
                        console.log('Pack item clicked:', packId);
                        
                        state.selectedPack = packId;
                        
                        // Update active states
                        document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.pack-toggle').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        
                        // Reload species list
                        await loadSpeciesList();
                    });
                });
            }, 100);
        }

        // Toggle pack list expansion
        function togglePackList(region) {
            event.stopPropagation();
            const list = document.getElementById(`pack-list-${region}`);
            const toggle = event.currentTarget;
            const icon = toggle.querySelector('.expand-icon');
            
            if (list) {
                const isExpanded = list.classList.contains('expanded');
                list.classList.toggle('expanded');
                
                // Rotate arrow
                if (icon) {
                    icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
                }
            }
        }


        // Select pack and expand its list
        async function selectPackAndExpand(packId, region) {
            event.stopPropagation();
            console.log('selectPackAndExpand called with:', packId, region);
            state.selectedPack = packId;
            
            // Update active states
            document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
            event.target.classList.add('active');
            
            // Reload species list
            await loadSpeciesList();
        }

        // Select pack
        async function selectPack(packId) {
            state.selectedPack = packId;
            document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
            if (packId) {
                event.target.classList.add('active');
            }
            await loadSpeciesList();
        }

        // Load species list - shows ALL species from pack definition
        async function loadSpeciesList() {
            console.log('loadSpeciesList - selectedPack:', state.selectedPack);

            if (state.selectedPack) {
                // Get ALL species codes for this pack (from pack definition)
                console.log('Loading pack:', state.selectedPack);
                const packSpeciesResponse = await fetch(`/api/pack-species?pack=${state.selectedPack}`);
                const packSpeciesData = await packSpeciesResponse.json();
                const packSpeciesCodes = packSpeciesData.species_codes || [];
                console.log('Pack species codes:', packSpeciesCodes.length);

                // Get clips for this pack
                const packClipsResponse = await fetch(`/api/clips-by-pack?pack=${state.selectedPack}`);
                const packClips = await packClipsResponse.json();

                // Build clip counts by species
                const clipCounts = {};
                packClips.forEach(clip => {
                    const code = clip.species_code.toUpperCase();
                    clipCounts[code] = (clipCounts[code] || 0) + 1;
                });

                // Load species.json for common/scientific names
                const speciesResponse = await fetch('/data/species.json');
                const allSpeciesData = await speciesResponse.json();
                const speciesLookup = {};
                allSpeciesData.forEach(sp => {
                    speciesLookup[sp.species_code.toUpperCase()] = sp;
                });

                // Get candidates info
                const candidatesResponse = await fetch('/api/species-list');
                const candidatesData = await candidatesResponse.json();
                const candidatesLookup = {};
                candidatesData.forEach(candidate => {
                    candidatesLookup[candidate.code.toUpperCase()] = candidate;
                });

                // Build species list for ALL species in pack
                const speciesInPack = packSpeciesCodes.map(code => {
                    const upperCode = code.toUpperCase();
                    const speciesInfo = speciesLookup[upperCode];
                    const candidateInfo = candidatesLookup[upperCode];

                    return {
                        code: upperCode,
                        common_name: speciesInfo?.common_name || candidateInfo?.common_name || upperCode,
                        scientific_name: speciesInfo?.scientific_name || candidateInfo?.scientific_name || '',
                        extracted_count: clipCounts[upperCode] || 0,
                        candidate_count: candidateInfo?.candidate_count || 0
                    };
                });

                state.species = speciesInPack;
                console.log('Pack species count:', state.species.length);
            } else {
                // "All Birds" - show ALL species from clips.json
                console.log('Loading all birds from clips.json');

                // Get ALL clips
                const allClipsResponse = await fetch('/api/clips-by-pack?pack=all');
                const allClips = await allClipsResponse.json();

                // Build clip counts by species
                const clipCounts = {};
                allClips.forEach(clip => {
                    const code = clip.species_code.toUpperCase();
                    clipCounts[code] = (clipCounts[code] || 0) + 1;
                });

                // Get unique species codes from clips
                const uniqueSpeciesCodes = Object.keys(clipCounts);

                // Load species.json for common/scientific names
                const speciesResponse = await fetch('/data/species.json');
                const allSpeciesData = await speciesResponse.json();
                const speciesLookup = {};
                allSpeciesData.forEach(sp => {
                    speciesLookup[sp.species_code.toUpperCase()] = sp;
                });

                // Get candidates info
                const candidatesResponse = await fetch('/api/species-list');
                const candidatesData = await candidatesResponse.json();
                const candidatesLookup = {};
                candidatesData.forEach(candidate => {
                    candidatesLookup[candidate.code.toUpperCase()] = candidate;
                });

                // Build species list for ALL species with clips
                state.species = uniqueSpeciesCodes.map(code => {
                    const speciesInfo = speciesLookup[code];
                    const candidateInfo = candidatesLookup[code];

                    return {
                        code: code,
                        common_name: speciesInfo?.common_name || candidateInfo?.common_name || code,
                        scientific_name: speciesInfo?.scientific_name || candidateInfo?.scientific_name || '',
                        extracted_count: clipCounts[code] || 0,
                        candidate_count: candidateInfo?.candidate_count || 0
                    };
                });

                console.log('All species count:', state.species.length);
            }

            renderSpeciesList();
        }

        // Render species list
        function renderSpeciesList() {
            const container = document.getElementById('species-list');

            if (state.species.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <div>No species found</div>
                    </div>
                `;
                return;
            }

            const html = state.species.map(sp => {
                const hasClips = sp.extracted_count > 0;
                return `
                    <div class="species-item ${hasClips ? 'complete' : ''} ${state.selectedSpecies === sp.code ? 'active' : ''}"
                         onclick="selectSpecies('${sp.code}')">
                        <div class="species-checkbox" title="✓ = Has extracted clips"></div>
                        <div class="species-info">
                            <div class="species-name">${sp.common_name}</div>
                            <div class="species-code">${sp.code}</div>
                        </div>
                        <div class="species-progress">
                            <span class="extracted">${sp.extracted_count}</span>/${sp.candidate_count}
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = html;
            
            // Add click handlers to pack items using event delegation
            setTimeout(() => {
                document.querySelectorAll('.pack-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const packId = item.getAttribute('data-pack-id');
                        console.log('Pack item clicked:', packId);
                        
                        state.selectedPack = packId;
                        
                        // Update active states
                        document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        
                        // Reload species list
                        await loadSpeciesList();
                    });
                });
            }, 100);
        }

        // Select species
        async function selectSpecies(code) {
            state.selectedSpecies = code;
            renderSpeciesList();

            // Re-apply search filter if there's an active search
            const searchInput = document.getElementById('species-search');
            if (searchInput && searchInput.value) {
                filterSpecies();
            }

            const species = state.species.find(s => s.code === code);
            if (species) {
                document.getElementById('species-name').textContent = species.common_name;
                document.getElementById('species-scientific').textContent = species.scientific_name || '';
            }

            await loadCandidates(code);
            await loadClips(code);
        }

        // Load candidate recordings
        async function loadCandidates(code) {
            const response = await fetch(`/api/candidates?species=${code}`);
            state.candidates = await response.json();
            renderCandidates();
        }

        // Render candidates (source chips)
        function renderCandidates() {
            const container = document.getElementById('source-chips');

            if (state.candidates.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 0;">No source recordings</div>';
                return;
            }

            const html = state.candidates.map((c, idx) => `
                <button class="source-chip" onclick="loadSource('${c.xc_id}', '${c.vocalization_type}', '${c.recordist}')">
                    XC${c.xc_id}
                    <span class="source-badge">${c.vocalization_type}</span>
                </button>
            `).join('');

            container.innerHTML = html;
            
            // Add click handlers to pack items using event delegation
            setTimeout(() => {
                document.querySelectorAll('.pack-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const packId = item.getAttribute('data-pack-id');
                        console.log('Pack item clicked:', packId);
                        
                        state.selectedPack = packId;
                        
                        // Update active states
                        document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        
                        // Reload species list
                        await loadSpeciesList();
                    });
                });
            }, 100);
        }

        // Load source recording
        async function loadSource(xcId, vocType, recordist) {
            // Update UI
            document.querySelectorAll('.source-chip').forEach(el => el.classList.remove('active'));
            event.target.classList.add('active');

            // Set metadata defaults
            document.getElementById('input-voc-type').value = vocType || 'song';
            document.getElementById('input-recordist').value = recordist || 'Unknown';

            // Load XC recording
            const response = await fetch(`/api/load-xc?id=${xcId}`);
            const data = await response.json();

            if (data.success) {
                state.currentSource = data.source_path;
                state.currentXcId = xcId;
                state.currentLicense = data.license || null;

                // Warn about problematic licenses
                if (data.license && data.license.toLowerCase().includes('nd')) {
                    alert('⚠️ WARNING: This recording has a NO DERIVATIVES license (' + data.license + ').\n\nChipNotes modifies audio (trim, normalize), which creates derivatives.\nThis license does NOT allow that. Please select a different recording.');
                    return;
                }

                await loadWaveform(data.source_path);
            } else {
                alert('Failed to load recording: ' + data.error);
            }
        }

        // Load waveform
        async function loadWaveform(sourcePath) {
            const response = await fetch(`/api/waveform?source=${encodeURIComponent(sourcePath)}`);
            state.waveformData = await response.json();
            renderWaveform();

            // Enable playback controls
            document.getElementById('btn-play-full').disabled = false;
            document.getElementById('btn-play-selection').disabled = false;
            document.getElementById('btn-stop').disabled = false;
            document.getElementById('btn-extract').disabled = false;
        }

        // Render waveform
        function renderWaveform() {
            if (!state.waveformData) return;

            const canvas = document.getElementById('waveform');
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            // Clear
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);

            // Draw waveform
            const data = state.waveformData.mins;
            const dataMax = state.waveformData.maxs;
            const barWidth = width / data.length;

            ctx.fillStyle = '#4db6ac';
            for (let i = 0; i < data.length; i++) {
                const min = (data[i] + 1) / 2;
                const max = (dataMax[i] + 1) / 2;
                const barHeight = (max - min) * height;
                const y = height / 2 - barHeight / 2;

                ctx.fillRect(i * barWidth, y, barWidth - 1, barHeight);
            }
        }

        // Setup canvas interaction
        document.getElementById('waveform-canvas').addEventListener('click', function(e) {
            if (!state.waveformData) return;

            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const time = percent * state.waveformData.duration;

            state.selection.start = Math.max(0, time);
            updateSelection();
        });

        // Update selection overlay
        function updateSelection() {
            const overlay = document.getElementById('selection-overlay');
            const duration = state.waveformData.duration;

            const startPercent = (state.selection.start / duration) * 100;
            const endPercent = ((state.selection.start + state.selection.duration) / duration) * 100;

            overlay.style.display = 'block';
            overlay.style.left = startPercent + '%';
            overlay.style.width = (endPercent - startPercent) + '%';

            document.getElementById('input-start').value = state.selection.start.toFixed(2) + 's';
            document.getElementById('input-duration').value = state.selection.duration.toFixed(2) + 's';
        }

        // Extract clip
        document.getElementById('btn-extract').addEventListener('click', async function() {
            if (!state.currentSource || !state.selectedSpecies) return;

            const params = {
                source_path: state.currentSource,
                start_time: state.selection.start,
                duration: state.selection.duration,
                species_code: state.selectedSpecies,
                xc_id: state.currentXcId,
                vocalization_type: document.getElementById('input-voc-type').value,
                recordist: document.getElementById('input-recordist').value,
                license: state.currentLicense || null
            };

            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            const result = await response.json();

            if (result.success) {
                await loadClips(state.selectedSpecies);
                await loadSpeciesList();
                alert('✅ Clip extracted: ' + result.clip_id);
            } else {
                alert('❌ Extraction failed: ' + result.error);
            }
        });

        // Load clips for species
        async function loadClips(code) {
            const response = await fetch(`/api/clips?species=${code}`);
            state.clips = await response.json();
            renderClips();
        }

        // Render clips
        function renderClips() {
            const container = document.getElementById('clips-list');
            const countEl = document.getElementById('clips-count');

            countEl.textContent = `Extracted (${state.clips.length})`;

            if (state.clips.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🎵</div>
                        <div>No clips extracted yet</div>
                    </div>
                `;
                return;
            }

            const html = state.clips.map(clip => {
                const isModified = state.pendingChanges.modified[clip.clip_id];
                const isRejected = state.pendingChanges.deleted.includes(clip.clip_id) || clip.rejected;
                const isCanonical = clip.canonical;
                const hasNDLicense = clip.license && clip.license.toLowerCase().includes('nd');
                const licenseStyle = hasNDLicense ? 'color: #ff6b6b; font-weight: bold;' : '';
                const licenseWarning = hasNDLicense ? ' ⚠️' : '';

                return `
                    <div class="clip-card ${isCanonical ? 'canonical' : ''} ${isModified ? 'modified' : ''} ${isRejected ? 'rejected' : ''}"
                         data-clip-id="${clip.clip_id}">
                        <div class="clip-spectrogram">
                            ${isCanonical ? '<div class="canonical-badge">⭐ CANONICAL</div>' : ''}
                            <img src="/${clip.spectrogram_path}" alt="Spectrogram">
                        </div>

                        <div class="clip-metadata">
                            <div class="metadata-row">
                                <span class="metadata-label">Clip ID</span>
                                <span class="metadata-value">${clip.clip_id}</span>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">Duration</span>
                                <span class="metadata-value">${(clip.duration_ms / 1000).toFixed(1)}s</span>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">Type</span>
                                <select class="voc-type-select" onchange="setVocalizationType('${clip.clip_id}', this.value)">
                                    <option value="song" ${clip.vocalization_type === 'song' ? 'selected' : ''}>song</option>
                                    <option value="call" ${clip.vocalization_type === 'call' ? 'selected' : ''}>call</option>
                                    <option value="flight call" ${clip.vocalization_type === 'flight call' ? 'selected' : ''}>flight call</option>
                                    <option value="alarm call" ${clip.vocalization_type === 'alarm call' ? 'selected' : ''}>alarm call</option>
                                    <option value="chip" ${clip.vocalization_type === 'chip' ? 'selected' : ''}>chip</option>
                                    <option value="drum" ${clip.vocalization_type === 'drum' ? 'selected' : ''}>drum</option>
                                    <option value="dawn song" ${clip.vocalization_type === 'dawn song' ? 'selected' : ''}>dawn song</option>
                                    <option value="duet" ${clip.vocalization_type === 'duet' ? 'selected' : ''}>duet</option>
                                    <option value="begging call" ${clip.vocalization_type === 'begging call' ? 'selected' : ''}>begging call</option>
                                    <option value="contact call" ${clip.vocalization_type === 'contact call' ? 'selected' : ''}>contact call</option>
                                </select>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">Quality</span>
                                <div class="quality-stars">
                                    ${[1,2,3,4,5].map(n => `
                                        <span class="star ${n <= clip.quality_score ? 'active' : ''}"
                                              onclick="setQuality('${clip.clip_id}', ${n})">★</span>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">Recordist</span>
                                <span class="metadata-value" style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${clip.recordist || 'Unknown'}">${clip.recordist || 'Unknown'}</span>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">Source</span>
                                <span class="metadata-value">${clip.source_id || clip.source || 'N/A'}</span>
                            </div>
                            <div class="metadata-row">
                                <span class="metadata-label">License</span>
                                <span class="metadata-value" style="font-size: 11px; ${licenseStyle}">${clip.license || 'Unknown'}${licenseWarning}</span>
                            </div>
                        </div>

                        <div class="clip-actions">
                            <button class="btn-icon canonical-btn ${isCanonical ? 'active' : ''}"
                                    onclick="toggleCanonical('${clip.clip_id}')"
                                    title="Mark as canonical">
                                ⭐
                            </button>
                            <button class="btn-icon play-btn ${state.playingClipId === clip.clip_id ? 'playing' : ''}"
                                    onclick="togglePlayClip('${clip.clip_id}', '${clip.file_path}')"
                                    title="${state.playingClipId === clip.clip_id ? 'Pause' : 'Play clip'}">
                                ${state.playingClipId === clip.clip_id ? '⏸' : '▶'}
                            </button>
                            <button class="btn-icon delete-btn"
                                    onclick="deleteClip('${clip.clip_id}')"
                                    title="Delete clip">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = html;
            
            // Add click handlers to pack items using event delegation
            setTimeout(() => {
                document.querySelectorAll('.pack-item').forEach(item => {
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const packId = item.getAttribute('data-pack-id');
                        console.log('Pack item clicked:', packId);
                        
                        state.selectedPack = packId;
                        
                        // Update active states
                        document.querySelectorAll('.pack-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');
                        
                        // Reload species list
                        await loadSpeciesList();
                    });
                });
            }, 100);
        }

        // Toggle canonical
        function toggleCanonical(clipId) {
            const clip = state.clips.find(c => c.clip_id === clipId);
            if (!clip) return;

            const newCanonical = !clip.canonical;

            // If setting canonical, remove from all others
            if (newCanonical) {
                state.clips.forEach(c => {
                    if (c.species_code === clip.species_code && c.clip_id !== clipId) {
                        c.canonical = false;
                        trackChange(c.clip_id, { canonical: false });
                    }
                });
            }

            clip.canonical = newCanonical;
            trackChange(clipId, { canonical: newCanonical });
            renderClips();
        }

        // Set quality
        function setQuality(clipId, quality) {
            const clip = state.clips.find(c => c.clip_id === clipId);
            if (!clip) return;

            clip.quality_score = quality;
            trackChange(clipId, { quality_score: quality });
            renderClips();
        }

        // Delete clip
        function deleteClip(clipId) {
            if (!confirm('Delete this clip? This will remove the WAV and PNG files.')) return;

            const clip = state.clips.find(c => c.clip_id === clipId);
            if (clip) {
                clip.rejected = true;
                state.pendingChanges.deleted.push(clipId);
                trackChange(clipId, { rejected: true });
                renderClips();
            }
        }

        // Track pending changes
        function trackChange(clipId, updates) {
            if (!state.pendingChanges.modified[clipId]) {
                state.pendingChanges.modified[clipId] = {};
            }
            Object.assign(state.pendingChanges.modified[clipId], updates);
            updateSaveButton();
        }

        // Update save button state
        function updateSaveButton() {
            const hasChanges = Object.keys(state.pendingChanges.modified).length > 0 ||
                               state.pendingChanges.deleted.length > 0;
            document.getElementById('btn-save-all').disabled = !hasChanges;
        }

        // Save all changes
        document.getElementById('btn-save-all').addEventListener('click', async function() {
            if (!confirm('Save all changes? This will commit to git.')) return;

            // Apply all pending changes
            for (const [clipId, updates] of Object.entries(state.pendingChanges.modified)) {
                await fetch('/api/update-clip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clip_id: clipId, updates })
                });
            }

            // Save changes (git commit, file deletion, validation)
            const response = await fetch('/api/save-changes', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                alert(`✅ Saved!\n\nCanonical: ${result.stats.canonical_count}\nRejections: ${result.stats.rejections}\nGit committed: ${result.stats.git_committed}`);

                // Reset pending changes
                state.pendingChanges = { modified: {}, deleted: [] };

                // Reload
                await loadClips(state.selectedSpecies);
                await loadSpeciesList();
                updateStats();
            } else {
                alert('❌ Save failed: ' + result.error);
            }
        });

        // Play clip
        // Toggle play/pause for a clip
        function togglePlayClip(clipId, filePath) {
            // If this clip is already playing, pause it
            if (state.playingClipId === clipId && state.currentAudio && !state.currentAudio.paused) {
                state.currentAudio.pause();
                state.playingClipId = null;
                renderClips();
                return;
            }

            // Stop any currently playing audio
            if (state.currentAudio) {
                state.currentAudio.pause();
            }

            // Play this clip
            state.currentAudio = new Audio('/' + filePath);
            state.playingClipId = clipId;

            // Clear playing state when audio ends
            state.currentAudio.onended = () => {
                state.playingClipId = null;
                renderClips();
            };

            state.currentAudio.play();
            renderClips();
        }

        // Set vocalization type
        function setVocalizationType(clipId, vocType) {
            const clip = state.clips.find(c => c.clip_id === clipId);
            if (!clip) return;

            clip.vocalization_type = vocType;
            trackChange(clipId, { vocalization_type: vocType });
            renderClips();
        }

        // Update stats
        function updateStats() {
            const totalClips = state.clips.length;
            const canonicalCount = state.clips.filter(c => c.canonical).length;
            const speciesCount = state.species.length;

            document.getElementById('stat-clips').textContent = totalClips;
            document.getElementById('stat-canonical').textContent = canonicalCount;
            document.getElementById('stat-species').textContent = speciesCount;
        }

        // Event listeners
        function setupEventListeners() {
            // Playback controls
            document.getElementById('btn-play-full').addEventListener('click', function() {
                if (state.currentAudio) state.currentAudio.pause();
                state.currentAudio = new Audio('/audio/' + state.currentSource);
                state.currentAudio.play();
            });

            document.getElementById('btn-stop').addEventListener('click', function() {
                if (state.currentAudio) {
                    state.currentAudio.pause();
                    state.currentAudio.currentTime = 0;
                }
            });
        }



        // Adjust duration with +/- buttons
        function adjustDuration(delta) {
            const input = document.getElementById('input-duration');
            let newValue = parseFloat(input.value) + delta;
            newValue = Math.max(0.5, Math.min(3.0, newValue)); // Clamp between 0.5 and 3.0
            newValue = Math.round(newValue * 10) / 10; // Round to 1 decimal place
            input.value = newValue.toFixed(1);
            state.selection.duration = newValue;
            updateSelection();
        }

        // Filter species list by search
        function filterSpecies() {
            const searchInput = document.getElementById('species-search');
            const clearButton = document.getElementById('search-clear');
            const search = searchInput.value.toLowerCase();
            const items = document.querySelectorAll('.species-item');

            // Show/hide clear button
            if (search) {
                clearButton.classList.add('visible');
            } else {
                clearButton.classList.remove('visible');
            }

            items.forEach(item => {
                const name = item.querySelector('.species-name').textContent.toLowerCase();
                const code = item.querySelector('.species-code').textContent.toLowerCase();

                if (name.includes(search) || code.includes(search)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        }

        function clearSearch() {
            const searchInput = document.getElementById('species-search');
            const clearButton = document.getElementById('search-clear');

            searchInput.value = '';
            clearButton.classList.remove('visible');
            filterSpecies();  // Re-run filter to show all species
            searchInput.focus();  // Keep focus in search box
        }

        // Initialize on load
        init();
    </script>
</body>
</html>
'''
def main():
    parser = argparse.ArgumentParser(description='Clip Editor for ChipNotes!')
    parser.add_argument('--clip', help='Load a specific clip for editing (by ID or filename)')
    parser.add_argument('--species', help='Species code to work with')
    parser.add_argument('--source', help='Source recording file to load')
    parser.add_argument('--xc', help='Xeno-Canto ID to download and load')
    parser.add_argument('--batch', nargs='*', help='Batch mode: pass candidate directories (or none for all)')
    parser.add_argument('--search', help='Search XC for a species by common name (prints top recordings)')
    parser.add_argument('--region', default='any', choices=['na', 'eu', 'any'],
                        help='Region filter for --search (na=US/Canada, eu=Europe, any=worldwide)')
    parser.add_argument('--max-results', type=int, default=10, help='Max results for --search')
    parser.add_argument('--port', type=int, default=PORT, help='Server port')

    args = parser.parse_args()

    # Handle --search mode (print results and exit, no server)
    if args.search:
        results = search_xc_recordings(args.search, args.max_results, region=args.region)
        if not results:
            print(f"No quality A/B recordings found for '{args.search}'")
            return 1
        print(f"\nTop {len(results)} XC recordings for '{args.search}' (region={args.region}):\n")
        print(f"{'XC ID':>10}  {'Quality':>7}  {'Type':<15}  {'Length':>6}  {'Country':<15}  {'Recordist'}")
        print("-" * 85)
        for rec in results:
            xc_id = rec.get('id', '?')
            quality = rec.get('q', '?')
            vtype = rec.get('type', '?')[:15]
            length = rec.get('length', '?')
            country = rec.get('cnt', '?')[:15]
            recordist = rec.get('rec', '?')
            print(f"  {xc_id:>8}  {quality:>7}  {vtype:<15}  {length:>6}  {country:<15}  {recordist}")
        print(f"\nTo extract clips, run:")
        print(f"  python3 scripts/clip_editor.py --xc <ID> --species <CODE>")
        return 0

    # Handle --batch mode
    if args.batch is not None:
        candidate_dirs = []
        if args.batch:
            # Specific directories provided
            for d in args.batch:
                p = Path(d)
                if p.exists():
                    candidate_dirs.append(p)
                else:
                    print(f"WARNING: Directory not found: {d}")
        else:
            # No args = find all candidate directories
            data_dir = PROJECT_ROOT / "data"
            candidate_dirs = sorted(data_dir.glob("candidates_*"))

        if not candidate_dirs:
            print("ERROR: No candidate directories found")
            return 1

        ClipEditorHandler.candidate_dirs = candidate_dirs
        ClipEditorHandler.species_code = None
        ClipEditorHandler.initial_source_path = None
        ClipEditorHandler.initial_clip = None
        ClipEditorHandler.xc_id = None

        print(f"Found {len(candidate_dirs)} species with candidates")

        # Start server
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", args.port), ClipEditorHandler) as httpd:
            print("=" * 60)
            print("Clip Editor - BATCH MODE")
            print("=" * 60)
            print(f"Species: {len(candidate_dirs)}")
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

    # Single-species mode (original behavior)
    species_code = args.species
    initial_source_path = None
    initial_clip = None
    xc_id = args.xc

    if args.clip:
        clip_data = get_clip_by_id(args.clip)
        if not clip_data:
            print(f"ERROR: Clip not found: {args.clip}")
            return 1
        species_code = clip_data.get('species_code', '').upper()
        initial_clip = clip_data
        source_info = find_source_for_clip(clip_data)
        if source_info['available']:
            initial_source_path = Path(source_info['path'])
        elif source_info['can_download'] and source_info['xc_id']:
            xc_id = source_info['xc_id']
            initial_source_path = download_xc_recording(xc_id, Path('/tmp/clip-edit'))
        if source_info['xc_id']:
            xc_id = source_info['xc_id']

    elif args.xc:
        if not species_code:
            print("ERROR: --species required when using --xc")
            return 1
        initial_source_path = download_xc_recording(args.xc, Path('/tmp/clip-edit'))

    elif args.source:
        if not species_code:
            print("ERROR: --species required when using --source")
            return 1
        initial_source_path = Path(args.source)
        if not initial_source_path.exists():
            print(f"ERROR: Source not found: {args.source}")
            return 1
        xc_match = re.search(r'XC?(\d{5,})', initial_source_path.name, re.IGNORECASE)
        if xc_match:
            xc_id = xc_match.group(1)

    elif not species_code:
        print("ERROR: Must specify --clip, --species, --source, --xc, or --batch")
        parser.print_help()
        return 1

    ClipEditorHandler.species_code = species_code.upper() if species_code else None
    ClipEditorHandler.initial_source_path = initial_source_path
    ClipEditorHandler.initial_clip = initial_clip
    ClipEditorHandler.xc_id = xc_id

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
