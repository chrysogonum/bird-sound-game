#!/usr/bin/env python3
"""
Clip Studio - Unified Audio Clip Workflow Tool for ChipNotes!

The ONE tool for the complete clip curation workflow:
  1. Browse species by pack with filtering
  2. Search & Download from Xeno-Canto
  3. Extract clips with waveform editor
  4. Review & curate metadata (batched edits)
  5. Mark canonical clips (1 per species, enforced)
  6. Delete rejected clips
  7. Git integration with automatic commits

Usage:
    # Batch mode (recommended)
    python3 scripts/clip_studio.py --batch

    # With pack filter
    python3 scripts/clip_studio.py --batch --pack eu_warblers

    # Custom port
    python3 scripts/clip_studio.py --batch --port 9000
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

# Vocalization types (Cornell taxonomy)
VOCALIZATION_TYPES = [
    "song", "call", "flight call", "alarm call", "chip",
    "drum", "wing sound", "rattle", "trill", "duet",
    "juvenile", "other"
]

CLIPS_JSON_PATH = PROJECT_ROOT / "data" / "clips.json"
REJECTED_XC_IDS_PATH = PROJECT_ROOT / "data" / "rejected_xc_ids.json"


# ═══════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════

def load_clips() -> List[Dict]:
    """Load clips from clips.json"""
    if CLIPS_JSON_PATH.exists():
        with open(CLIPS_JSON_PATH, 'r') as f:
            return json.load(f)
    return []


def load_species_data() -> Dict:
    """Load species data from species.json, keyed by species_code"""
    species_path = PROJECT_ROOT / "data" / "species.json"
    if species_path.exists():
        with open(species_path, 'r') as f:
            return {s['species_code']: s for s in json.load(f)}
    return {}


def load_packs() -> Dict[str, List[Dict]]:
    """Load all pack definitions grouped by region"""
    packs_dir = PROJECT_ROOT / 'data' / 'packs'
    packs_by_region = {}

    if packs_dir.exists():
        for pack_file in sorted(packs_dir.glob('*.json')):
            with open(pack_file, 'r') as f:
                pack = json.load(f)
                region = pack.get('region', 'na')
                packs_by_region.setdefault(region, []).append({
                    'id': pack.get('pack_id'),
                    'name': pack.get('display_name') or pack.get('pack_name') or pack.get('pack_id'),
                    'region': region,
                    'species': pack.get('species', []),
                    'species_count': len(pack.get('species', []))
                })

    return packs_by_region


def load_degraded_species() -> Dict[str, List[str]]:
    """Load degraded species from degraded_clips.json, cross-referenced with current clips.json.
    Species drop off once their degraded clips have been replaced."""
    report_path = PROJECT_ROOT / 'data' / 'degraded_clips.json'
    if not report_path.exists():
        return {'all': [], 'canonical': []}
    with open(report_path, 'r') as f:
        report = json.load(f)

    # Build set of degraded clip IDs
    degraded_canonical_ids = {c['clip_id'] for c in report.get('degraded_canonical', [])}
    degraded_all_ids = degraded_canonical_ids | {c['clip_id'] for c in report.get('degraded_non_canonical', [])}

    # Cross-reference with current clips — only include species that still have degraded clips
    clips = load_clips()
    all_species = set()
    canonical_species = set()
    for clip in clips:
        if clip.get('rejected', False):
            continue
        cid = clip['clip_id']
        sp = clip['species_code']
        if cid in degraded_all_ids:
            all_species.add(sp)
        if cid in degraded_canonical_ids and clip.get('canonical'):
            canonical_species.add(sp)

    return {'all': sorted(all_species), 'canonical': sorted(canonical_species)}


def load_cornell_cd_species() -> List[str]:
    """Load species that have Cornell CD clips (no source URL available)"""
    clips = load_clips()
    species = set()
    for clip in clips:
        if clip.get('rejected', False):
            continue
        source_id = clip.get('source_id', '')
        if 'Cornell' in str(source_id):
            species.add(clip['species_code'])
    return sorted(species)


def load_candidates_for_species(species_code: str) -> List[Dict]:
    """Load candidate sources for a species from ingest manifests"""
    candidates = []
    candidate_dirs = list((PROJECT_ROOT / 'data').glob('candidates_*'))

    for cdir in candidate_dirs:
        manifest = cdir / '.ingest_manifest.json'
        if not manifest.exists():
            continue

        with open(manifest, 'r') as f:
            manifest_data = json.load(f)
            for item in manifest_data:
                if item.get('species_code') == species_code:
                    xc_id = item.get('xc_id') or (item.get('source_id', '').replace('XC', '') or None)
                    if not xc_id:
                        continue
                    audio_file = None
                    for ext in ['.mp3', '.wav']:
                        matches = list(cdir.glob(f'XC{xc_id}*{ext}'))
                        if not matches:
                            matches = list(cdir.glob(f'*{xc_id}*{ext}'))
                        if matches:
                            audio_file = str(matches[0])
                            break

                    if audio_file:
                        candidates.append({
                            'xc_id': xc_id,
                            'path': audio_file,
                            'recordist': item.get('recordist', 'Unknown'),
                            'vocalization_type': item.get('vocalization_type') or item.get('type', 'song'),
                            'license': item.get('license', 'unknown')
                        })

    # Fallback: if no candidates from manifests, extract XC source IDs from clips.json
    if not candidates:
        clips = load_clips()
        seen_xc = set()
        for clip in clips:
            if clip.get('rejected'):
                continue
            if clip.get('species_code') != species_code:
                continue
            sid = clip.get('source_id', '')
            xc_match = re.match(r'XC(\d+)', sid)
            if xc_match and xc_match.group(1) not in seen_xc:
                xc_id = xc_match.group(1)
                seen_xc.add(xc_id)
                # Check if audio already downloaded
                audio_file = None
                for cdir in (PROJECT_ROOT / 'data').glob(f'candidates_{species_code}'):
                    for ext in ['.mp3', '.wav']:
                        matches = list(cdir.glob(f'*{xc_id}*{ext}'))
                        if matches:
                            audio_file = str(matches[0])
                            break
                candidates.append({
                    'xc_id': xc_id,
                    'path': audio_file,  # None if not yet downloaded
                    'recordist': clip.get('recordist', 'Unknown'),
                    'vocalization_type': clip.get('vocalization_type', 'song'),
                    'license': clip.get('license', 'unknown'),
                    'from_clips': True,  # Flag: derived from clips.json, not manifest
                })

    return candidates


def count_candidates_per_species() -> Dict[str, int]:
    """Count candidate sources per species (cached per request)"""
    counts = {}
    candidate_dirs = list((PROJECT_ROOT / 'data').glob('candidates_*'))

    for cdir in candidate_dirs:
        manifest = cdir / '.ingest_manifest.json'
        if not manifest.exists():
            continue

        with open(manifest, 'r') as f:
            manifest_data = json.load(f)
            for item in manifest_data:
                code = item.get('species_code', '')
                counts[code] = counts.get(code, 0) + 1

    return counts


# ═══════════════════════════════════════════════════════════════════
# AUDIO PROCESSING (from clip_editor.py — proven logic)
# ═══════════════════════════════════════════════════════════════════

def extract_clip(source_path: Path, start_time: float, duration: float,
                 species_code: str, xc_id: str = None,
                 vocalization_type: str = 'song', recordist: str = 'Unknown',
                 license: str = '', denoise: bool = False,
                 denoise_strength: float = 0.7) -> dict:
    """Extract a clip segment from source recording.

    Saves immediately to clips.json (extraction is not batched).
    """
    if duration < MIN_DURATION or duration > MAX_DURATION:
        raise ValueError(f"Duration must be {MIN_DURATION}-{MAX_DURATION}s, got {duration}")

    # Load audio
    audio, sr = sf.read(str(source_path))
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    # Extract segment
    start_sample = int(start_time * sr)
    end_sample = int((start_time + duration) * sr)

    if start_sample < 0 or end_sample > len(audio):
        raise ValueError(f"Selection out of bounds: {start_time}-{start_time+duration}s "
                         f"(source is {len(audio)/sr:.1f}s)")

    segment = audio[start_sample:end_sample]

    # Resample using librosa (NEVER use np.interp — causes metallic artifacts)
    if sr != OUTPUT_SAMPLE_RATE:
        import librosa
        segment = librosa.resample(segment, orig_sr=sr, target_sr=OUTPUT_SAMPLE_RATE)
        sr = OUTPUT_SAMPLE_RATE

    # Noise reduction (spectral gating)
    if denoise and denoise_strength > 0:
        import noisereduce as nr_lib
        segment = nr_lib.reduce_noise(
            y=segment, sr=sr,
            prop_decrease=min(1.0, max(0.0, denoise_strength)),
            stationary=True,
        )

    # Normalize loudness to -16 LUFS, fall back to peak normalization if clipping
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(segment)
    if not np.isinf(loudness) and not np.isnan(loudness):
        gain_db = TARGET_LUFS - loudness
        peak = np.max(np.abs(segment))
        max_gain_db = 20 * np.log10(0.95 / peak) if peak > 0 else 40
        if gain_db <= max_gain_db:
            # Safe to normalize to -16 LUFS without clipping
            segment = pyln.normalize.loudness(segment, loudness, TARGET_LUFS)
        else:
            # Would clip — apply max safe gain (peak at 0.95)
            segment = segment * (0.95 / peak)
        segment = np.clip(segment, -1.0, 1.0)

    # Load existing clips
    clips = load_clips()

    # Generate clip ID — preserve original case for eBird codes (lowercase like carcro1)
    if xc_id:
        prefix = f"{species_code}_{xc_id}_"
    else:
        prefix = f"{species_code}_clip_"

    existing_nums = [int(c['clip_id'][len(prefix):])
                     for c in clips
                     if c['clip_id'].startswith(prefix)
                     and c['clip_id'][len(prefix):].isdigit()]
    next_num = max(existing_nums, default=0) + 1
    clip_id = f"{prefix}{next_num}"

    # Save audio file
    output_filename = f"{clip_id}.wav"
    output_path = PROJECT_ROOT / 'data' / 'clips' / output_filename
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), segment, sr, subtype='PCM_16')

    # Generate spectrogram (locked settings)
    spectrogram_path = PROJECT_ROOT / 'data' / 'spectrograms' / f"{clip_id}.png"
    spectrogram_path.parent.mkdir(parents=True, exist_ok=True)
    generate_spectrogram(segment, sr, str(spectrogram_path))

    # Measure final loudness
    final_loudness = meter.integrated_loudness(segment)
    duration_ms = int(len(segment) / sr * 1000)

    # Look up common name
    species_data = load_species_data()
    common_name = (species_data.get(species_code, {}).get('common_name') or
                   species_data.get(species_code.upper(), {}).get('common_name', species_code))

    # Build clip metadata
    clip_data = {
        'clip_id': clip_id,
        'species_code': species_code,
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
        'license': license,
    }

    clips.append(clip_data)

    # Save clips.json immediately
    with open(CLIPS_JSON_PATH, 'w') as f:
        json.dump(clips, f, indent=2)

    return {
        'success': True,
        'clip_id': clip_id,
        'clip': clip_data,
        'file_path': f"data/clips/{output_filename}",
        'spectrogram_path': f"data/spectrograms/{clip_id}.png",
        'duration_ms': duration_ms,
        'loudness_lufs': round(final_loudness, 1),
    }


def generate_spectrogram(audio: np.ndarray, sr: int, output_path: str):
    """Generate spectrogram matching game style (locked settings).

    Uses scipy.signal.spectrogram with pcolormesh + gouraud shading,
    matching spectrogram_gen.py exactly.
    """
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from scipy import signal

        # LOCKED SETTINGS — DO NOT MODIFY (must match spectrogram_gen.py)
        n_fft = 1024
        hop_length = 256
        freq_min = 500
        freq_max = 10000

        frequencies, times, Sxx = signal.spectrogram(
            audio, fs=sr,
            nperseg=n_fft,
            noverlap=n_fft - hop_length,
            scaling='density'
        )

        Sxx_db = 10 * np.log10(Sxx + 1e-10)

        freq_mask = (frequencies >= freq_min) & (frequencies <= freq_max)
        frequencies_filtered = frequencies[freq_mask]
        Sxx_filtered = Sxx_db[freq_mask, :]

        vmin = np.percentile(Sxx_filtered, 5)
        vmax = np.percentile(Sxx_filtered, 95)

        # 400x200px output (2:1 aspect ratio)
        fig, ax = plt.subplots(figsize=(4, 2), dpi=100)
        ax.pcolormesh(
            times, frequencies_filtered, Sxx_filtered,
            shading='gouraud', cmap='magma',
            vmin=vmin, vmax=vmax
        )
        ax.axis('off')
        plt.tight_layout(pad=0)
        fig.savefig(
            output_path,
            dpi=100,
            bbox_inches='tight',
            pad_inches=0,
            transparent=False,
            facecolor='black'
        )
        plt.close(fig)
    except Exception as e:
        print(f"Warning: Could not generate spectrogram: {e}")


def download_xc_recording(xc_id: str, output_dir: Path) -> Path:
    """Download a recording from Xeno-Canto"""
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


# ═══════════════════════════════════════════════════════════════════
# SAVE CHANGES (from review_clips.py — proven batch save logic)
# ═══════════════════════════════════════════════════════════════════

def save_changes(changes: Dict) -> Dict:
    """Save batched metadata changes to clips.json, delete rejected files, git commit.

    Expected format:
    {
        "modifications": {
            "CLIP_ID": {
                "canonical": true/false,
                "quality_score": 1-5,
                "vocalization_type": "song",
                "recordist": "Name"
            }
        },
        "deletions": ["CLIP_ID1", "CLIP_ID2"]
    }
    """
    # 1. Backup clips.json
    backup_path = CLIPS_JSON_PATH.with_suffix('.json.backup')
    shutil.copy(CLIPS_JSON_PATH, backup_path)
    print(f"Backup created: {backup_path}")

    # 2. Load current clips
    clips = load_clips()
    clips_by_id = {clip['clip_id']: clip for clip in clips}

    # 3. Track changes for commit message
    stats = {
        'canonical_changes': 0,
        'rejections': 0,
        'quality_changes': 0,
        'vocalization_changes': 0,
        'recordist_changes': 0,
        'files_deleted': 0,
    }

    # 4. Apply modifications
    modified = changes.get('modifications', {})
    for clip_id, updates in modified.items():
        if clip_id not in clips_by_id:
            continue

        clip = clips_by_id[clip_id]

        if 'canonical' in updates and updates['canonical'] != clip.get('canonical', False):
            stats['canonical_changes'] += 1
            clip['canonical'] = updates['canonical']

        if 'quality_score' in updates and updates['quality_score'] != clip.get('quality_score'):
            stats['quality_changes'] += 1
            clip['quality_score'] = updates['quality_score']

        if 'vocalization_type' in updates and updates['vocalization_type'] != clip.get('vocalization_type'):
            stats['vocalization_changes'] += 1
            clip['vocalization_type'] = updates['vocalization_type']

        if 'recordist' in updates and updates['recordist'] != clip.get('recordist'):
            stats['recordist_changes'] += 1
            clip['recordist'] = updates['recordist']

    # 5. Process deletions
    deletions = set(changes.get('deletions', []))
    for clip_id in deletions:
        if clip_id in clips_by_id:
            clip = clips_by_id[clip_id]
            clip['rejected'] = True
            clip['canonical'] = False
            stats['rejections'] += 1

    # 6. Validate canonical uniqueness (exactly 1 per species max)
    species_canonicals = {}
    for clip in clips:
        if clip.get('canonical') and not clip.get('rejected'):
            species = clip['species_code']
            if species in species_canonicals:
                raise ValueError(
                    f"Multiple canonicals for {species}: "
                    f"{species_canonicals[species]} and {clip['clip_id']}"
                )
            species_canonicals[species] = clip['clip_id']

    # 7. Log rejected XC IDs
    rejected_xc_ids = {}
    for clip in clips:
        if clip.get('rejected') and clip.get('source_id'):
            xc_match = re.match(r'XC(\d+)', clip['source_id'])
            if xc_match:
                species = clip['species_code']
                rejected_xc_ids.setdefault(species, []).append(xc_match.group(1))

    if rejected_xc_ids:
        if REJECTED_XC_IDS_PATH.exists():
            with open(REJECTED_XC_IDS_PATH, 'r') as f:
                rejection_log = json.load(f)
        else:
            rejection_log = {}

        for species, xc_ids in rejected_xc_ids.items():
            if species not in rejection_log:
                rejection_log[species] = []
            rejection_log[species].extend(xc_ids)
            rejection_log[species] = sorted(list(set(rejection_log[species])))

        with open(REJECTED_XC_IDS_PATH, 'w') as f:
            json.dump(rejection_log, f, indent=2, sort_keys=True)
        print(f"Logged {sum(len(v) for v in rejected_xc_ids.values())} rejected XC IDs")

    # 8. Delete rejected files from disk
    for clip in clips:
        if clip.get('rejected'):
            for path_key in ['file_path', 'spectrogram_path']:
                path = clip.get(path_key)
                if path:
                    full_path = PROJECT_ROOT / path
                    if full_path.exists():
                        full_path.unlink()
                        stats['files_deleted'] += 1
                        print(f"Deleted: {path}")

    # 9. Remove rejected clips from array
    clips = [c for c in clips if not c.get('rejected', False)]

    # 10. Save updated clips.json
    with open(CLIPS_JSON_PATH, 'w') as f:
        json.dump(clips, f, indent=2)
    print(f"Saved {len(clips)} clips to {CLIPS_JSON_PATH}")

    # 11. Git commit
    commit_parts = []
    if stats['canonical_changes']:
        commit_parts.append(f"{stats['canonical_changes']} canonical updates")
    if stats['rejections']:
        commit_parts.append(f"{stats['rejections']} clips rejected")
    if stats['quality_changes']:
        commit_parts.append(f"{stats['quality_changes']} quality changes")
    if stats['vocalization_changes']:
        commit_parts.append(f"{stats['vocalization_changes']} vocalization type changes")
    if stats['recordist_changes']:
        commit_parts.append(f"{stats['recordist_changes']} recordist updates")

    if commit_parts:
        commit_msg = "Clip Studio: " + ", ".join(commit_parts)
    else:
        commit_msg = "Clip Studio: save changes"

    try:
        os.chdir(PROJECT_ROOT)
        # Stage clips.json and any deleted/added files
        subprocess.run(['git', 'add', 'data/clips.json'], check=True)
        if REJECTED_XC_IDS_PATH.exists():
            subprocess.run(['git', 'add', str(REJECTED_XC_IDS_PATH)], check=True)
        # Stage deleted audio/spectrogram files
        subprocess.run(['git', 'add', '-u', 'data/clips/', 'data/spectrograms/'],
                       check=True, capture_output=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        print(f"Git commit: {commit_msg}")
        stats['git_committed'] = True
    except subprocess.CalledProcessError as e:
        print(f"Git commit failed: {e}")
        stats['git_committed'] = False

    return {
        'success': True,
        'stats': stats,
        'clips_remaining': len(clips),
    }


# ═══════════════════════════════════════════════════════════════════
# HTTP SERVER
# ═══════════════════════════════════════════════════════════════════

class ClipStudioHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for unified clip studio"""

    filter_pack = None  # Optional initial pack filter

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/':
            self.send_html()
        elif path == '/api/init':
            self.handle_init(query)
        elif path == '/api/species':
            self.handle_species(query)
        elif path == '/api/clips':
            self.handle_clips(query)
        elif path == '/api/candidates':
            self.handle_candidates(query)
        elif path == '/api/waveform':
            self.handle_waveform(query)
        elif path == '/api/load-xc':
            self.handle_load_xc(query)
        elif path == '/api/search-xc':
            self.handle_search_xc(query)
        elif path == '/api/preview-denoise':
            self.handle_preview_denoise(query)
        elif path.startswith('/audio/'):
            self.serve_audio(path[7:])
        elif path.startswith('/data/'):
            self.serve_file(path[1:])
        else:
            self.send_error(404)

    def do_HEAD(self):
        """Handle HEAD requests for audio range support"""
        if self.path.startswith('/data/'):
            file_path = PROJECT_ROOT / self.path[1:]
            if not file_path.exists():
                self.send_error(404)
                return
            self.send_response(200)
            if file_path.suffix == '.wav':
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('Accept-Ranges', 'bytes')
            elif file_path.suffix == '.png':
                self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(file_path.stat().st_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
        else:
            self.send_error(404)

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        if self.path == '/api/extract':
            self.handle_extract(post_data)
        elif self.path == '/api/save-changes':
            self.handle_save_changes(post_data)
        else:
            self.send_error(404)

    # ── GET handlers ──────────────────────────────────────────────

    def send_html(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(generate_html().encode())

    def handle_init(self, query):
        """Send initial state: packs, species counts, canonical count"""
        packs = load_packs()
        clips = load_clips()

        clip_counts = {}
        canonical_count = 0
        for clip in clips:
            if not clip.get('rejected', False):
                code = clip['species_code']
                clip_counts[code] = clip_counts.get(code, 0) + 1
                if clip.get('canonical'):
                    canonical_count += 1

        degraded = load_degraded_species()
        cornell_cd_species = load_cornell_cd_species()

        # Build map of clip_id → {rate, degraded} for all checked clips
        clip_sample_rates = {}
        report_path = PROJECT_ROOT / 'data' / 'degraded_clips.json'
        if report_path.exists():
            with open(report_path, 'r') as f:
                report = json.load(f)
            for d in report.get('degraded_canonical', []) + report.get('degraded_non_canonical', []):
                clip_sample_rates[d['clip_id']] = {'rate': d.get('source_sample_rate', 0), 'degraded': True}
            for d in report.get('clean', []):
                clip_sample_rates[d['clip_id']] = {'rate': d.get('source_sample_rate', 0), 'degraded': False}

        self.send_json({
            'packs': packs,
            'total_clips': sum(clip_counts.values()),
            'total_canonical': canonical_count,
            'clip_counts': clip_counts,
            'filter_pack': self.filter_pack,
            'degraded_species': degraded,
            'cornell_cd_species': cornell_cd_species,
            'clip_sample_rates': clip_sample_rates,
        })

    def handle_species(self, query):
        """Send species list filtered by pack"""
        pack_id = query.get('pack', [None])[0]

        # Determine which species to include
        pack_species = None
        if pack_id == '__degraded__':
            degraded = load_degraded_species()
            pack_species = set(degraded['all'])
        elif pack_id == '__degraded_canonical__':
            degraded = load_degraded_species()
            pack_species = set(degraded['canonical'])
        elif pack_id == '__cornell_cd__':
            pack_species = set(load_cornell_cd_species())
        elif pack_id:
            packs = load_packs()
            for region_packs in packs.values():
                for pack in region_packs:
                    if pack['id'] == pack_id:
                        pack_species = set(pack['species'])
                        break

        # Load species data
        species_path = PROJECT_ROOT / 'data' / 'species.json'
        if species_path.exists():
            with open(species_path, 'r') as f:
                all_species = json.load(f)
        else:
            all_species = []

        # Load clip counts
        clips = load_clips()
        clip_counts = {}
        for clip in clips:
            if not clip.get('rejected', False):
                code = clip['species_code']
                clip_counts[code] = clip_counts.get(code, 0) + 1

        # Load candidate counts
        candidate_counts = count_candidates_per_species()

        # Build result
        result = []
        for sp in all_species:
            code = sp['species_code']
            if pack_species and code not in pack_species:
                continue

            result.append({
                'species_code': code,
                'common_name': sp.get('common_name'),
                'scientific_name': sp.get('scientific_name'),
                'clip_count': clip_counts.get(code, 0),
                'candidate_count': candidate_counts.get(code, 0),
            })

        # Sort: 0-clip species first, then alphabetically
        result.sort(key=lambda x: (x['clip_count'], x['species_code']))

        self.send_json(result)

    def handle_clips(self, query):
        """Send clips for a species"""
        species_code = query.get('species', [None])[0]
        if not species_code:
            self.send_json([])
            return

        clips = load_clips()
        species_clips = [c for c in clips
                         if c['species_code'] == species_code
                         and not c.get('rejected', False)]

        self.send_json(species_clips)

    def handle_candidates(self, query):
        """Send candidate sources for a species"""
        species_code = query.get('species', [None])[0]
        if not species_code:
            self.send_json([])
            return

        candidates = load_candidates_for_species(species_code)
        self.send_json(candidates)

    def handle_waveform(self, query):
        """Generate and send waveform data for visualization"""
        source = query.get('source', [None])[0]
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
                'source_path': str(source_path),
            })
        except Exception as e:
            self.send_error(500, str(e))

    def handle_load_xc(self, query):
        """Download XC recording and return metadata"""
        xc_id = query.get('id', [None])[0]
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
                'duration': info.duration,
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
                        result['common_name'] = rec.get('en', '')
                        # Preserve XC vocalization type as-is
                        result['vocalization_type'] = rec.get('type', 'call')
                        # License info
                        result['license'] = rec.get('lic', '')
            except Exception as e:
                print(f"Warning: Could not fetch XC metadata for {xc_id}: {e}")

            self.send_json(result)
        except Exception as e:
            self.send_json({'success': False, 'error': str(e)})

    def handle_preview_denoise(self, query):
        """Generate a denoised preview WAV of the current selection"""
        source = query.get('source', [None])[0]
        start = float(query.get('start', [0])[0])
        duration = float(query.get('duration', [2.0])[0])
        strength = float(query.get('strength', [0.7])[0])

        print(f"[preview-denoise] source={source} start={start} dur={duration} str={strength}")

        if not source or source in ('null', 'undefined', 'None'):
            self.send_error(400, "Missing source")
            return

        source_path = Path(source)
        if not source_path.exists():
            source_path = PROJECT_ROOT / source
        if not source_path.exists():
            print(f"[preview-denoise] Source not found: {source}")
            self.send_error(404, f"Source not found: {source}")
            return

        try:
            import noisereduce as nr_lib
            import io

            audio, sr = sf.read(str(source_path))
            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=1)

            start_sample = int(start * sr)
            end_sample = int((start + duration) * sr)
            segment = audio[max(0, start_sample):min(len(audio), end_sample)]

            # Resample if needed
            if sr != OUTPUT_SAMPLE_RATE:
                import librosa
                segment = librosa.resample(segment, orig_sr=sr, target_sr=OUTPUT_SAMPLE_RATE)
                sr = OUTPUT_SAMPLE_RATE

            # Apply noise reduction (skip if strength is 0)
            if strength > 0:
                segment = nr_lib.reduce_noise(
                    y=segment, sr=sr,
                    prop_decrease=min(1.0, max(0.0, strength)),
                    stationary=True,
                )

            # Write to temp file
            preview_path = Path('/tmp/clip-studio/preview_denoise.wav')
            preview_path.parent.mkdir(parents=True, exist_ok=True)
            sf.write(str(preview_path), segment, sr, subtype='PCM_16')

            # Serve the WAV
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            with open(preview_path, 'rb') as f:
                self.wfile.write(f.read())
        except Exception as e:
            self.send_error(500, str(e))

    def handle_search_xc(self, query):
        """Search Xeno-Canto for recordings of a species"""
        import urllib.request
        import urllib.parse

        species_name = query.get('name', [None])[0]
        quality = query.get('quality', [None])[0]  # e.g. "A", "A B"
        voc_type = query.get('type', [None])[0]  # e.g. "song", "call"

        if not species_name:
            self.send_json({'error': 'Missing species name'})
            return

        api_key = os.environ.get('XENO_CANTO_API_KEY', '')
        if not api_key:
            self.send_json({'error': 'XENO_CANTO_API_KEY not set'})
            return

        # Build XC query — v3 API requires tagged search (en:"Name" or sp:epithet gen:Genus)
        def build_xc_query(name):
            q_parts = [f'en:"{name}"']
            if quality:
                for q in quality.split():
                    q_parts.append(f'q:{q}')
            if voc_type:
                q_parts.append(f'type:{voc_type}')
            q_parts.append('grp:birds')
            return ' '.join(q_parts)

        try:
            # Build list of name variants to try:
            # 1. Original name
            # 2. First name before " / " (for "Morepork / Ruru" style names)
            # 3. Without hyphens (XC is inconsistent: "Red-winged" works but "Scrub-Jay" doesn't)
            name_variants = [species_name]
            if ' / ' in species_name:
                name_variants.append(species_name.split(' / ')[0].strip())
            if '-' in species_name:
                name_variants.append(species_name.replace('-', ' '))

            data = None
            for name_variant in name_variants:
                xc_query = build_xc_query(name_variant)
                url = f"https://xeno-canto.org/api/3/recordings?query={urllib.parse.quote(xc_query)}&key={api_key}&per_page=200"
                req = urllib.request.Request(url, headers={'User-Agent': 'ChipNotes/1.0'})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode())
                if int(data.get('numRecordings', 0)) > 0:
                    break

            # Get existing XC IDs for this species to mark them
            clips = load_clips()
            species_code = query.get('species', [None])[0] or ''
            existing_xc = set()
            rejected_xc = set()
            for c in clips:
                if c.get('species_code') == species_code:
                    sid = c.get('source_id', '').replace('XC', '')
                    if sid:
                        if c.get('rejected'):
                            rejected_xc.add(sid)
                        else:
                            existing_xc.add(sid)

            # Filter out ND (No Derivatives) licenses — we modify clips (trim, resample, normalize)
            ND_LICENSES = {'//creativecommons.org/licenses/by-nd/', '//creativecommons.org/licenses/by-nc-nd/'}
            results = []
            for rec in data.get('recordings', []):
                lic = rec.get('lic', '')
                if any(nd in lic for nd in ND_LICENSES):
                    continue
                xc_id = str(rec.get('id', ''))
                # Parse duration string "M:SS" to seconds
                length_str = rec.get('length', '0:00')
                try:
                    parts = length_str.split(':')
                    duration_s = int(parts[0]) * 60 + int(parts[1]) if len(parts) == 2 else 0
                except (ValueError, IndexError):
                    duration_s = 0

                results.append({
                    'xc_id': xc_id,
                    'recordist': rec.get('rec', ''),
                    'quality': rec.get('q', ''),
                    'type': rec.get('type', ''),
                    'duration': duration_s,
                    'duration_str': length_str,
                    'license': rec.get('lic', ''),
                    'country': rec.get('cnt', ''),
                    'date': rec.get('date', ''),
                    'sample_rate': int(rec.get('smp', 0)),
                    'remarks': rec.get('rmk', '')[:100] if rec.get('rmk') else '',
                    'existing': xc_id in existing_xc,
                    'rejected': xc_id in rejected_xc,
                })

            self.send_json({
                'total': int(data.get('numRecordings', 0)),
                'shown': len(results),
                'results': results,
            })
        except Exception as e:
            self.send_json({'error': str(e)})

    # ── POST handlers ─────────────────────────────────────────────

    def handle_extract(self, post_data):
        """Extract a new clip (saves immediately)"""
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
                license=params.get('license', ''),
                denoise=params.get('denoise', False),
                denoise_strength=params.get('denoise_strength', 0.7),
            )
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    def handle_save_changes(self, post_data):
        """Save batched changes (modifications + deletions) with git commit"""
        params = json.loads(post_data.decode())

        try:
            result = save_changes(params)
            self.send_json(result)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_json({'success': False, 'error': str(e)})

    # ── File serving ──────────────────────────────────────────────

    def serve_audio(self, source_path):
        """Serve audio file from absolute or relative path"""
        source_path = unquote(source_path)

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

        self.send_header('Content-Length', str(file_path.stat().st_size))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        with open(file_path, 'rb') as f:
            self.wfile.write(f.read())

    def serve_file(self, relative_path):
        """Serve files from data directory with range request support"""
        file_path = PROJECT_ROOT / relative_path

        if not file_path.exists():
            self.send_error(404)
            return

        file_size = file_path.stat().st_size
        range_header = self.headers.get('Range')

        # Handle range requests for audio
        if range_header and file_path.suffix == '.wav':
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1

            if start >= file_size:
                self.send_error(416)
                return

            end = min(end, file_size - 1)
            length = end - start + 1

            self.send_response(206)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Content-Length', str(length))
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            with open(file_path, 'rb') as f:
                f.seek(start)
                self.wfile.write(f.read(length))
        else:
            self.send_response(200)

            if file_path.suffix == '.wav':
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('Accept-Ranges', 'bytes')
            elif file_path.suffix == '.png':
                self.send_header('Content-Type', 'image/png')
            elif file_path.suffix == '.json':
                self.send_header('Content-Type', 'application/json')

            self.send_header('Content-Length', str(file_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


# ═══════════════════════════════════════════════════════════════════
# HTML UI
# ═══════════════════════════════════════════════════════════════════

def generate_html() -> str:
    """Generate the unified 3-panel Clip Studio UI"""

    voc_type_options = ''.join(
        f'<option value="{vt}">{vt}</option>' for vt in VOCALIZATION_TYPES
    )

    return '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Clip Studio - ChipNotes!</title>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0d0d0d;
            --bg-secondary: #1a1a1a;
            --bg-tertiary: #222;
            --bg-elevated: #2a2a2a;
            --teal: #4db6ac;
            --teal-dark: #3d9b91;
            --teal-hover: #5dc6bc;
            --teal-bg: rgba(77, 182, 172, 0.12);
            --gold: #ffd700;
            --gold-bg: rgba(255, 215, 0, 0.1);
            --red: #ff4444;
            --red-bg: rgba(255, 68, 68, 0.1);
            --green: #66bb6a;
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

        /* ── Top Bar ────────────────────────────────────── */
        .top-bar {
            height: 56px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
        }

        .studio-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .stats-bar {
            display: flex;
            gap: 28px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-secondary);
        }

        .stat-value {
            color: var(--teal);
            margin-left: 6px;
            font-weight: 600;
        }

        /* ── Main Layout ────────────────────────────────── */
        .studio {
            display: flex;
            height: calc(100vh - 56px);
        }

        /* ── Left Panel ─────────────────────────────────── */
        .left-panel {
            width: 300px;
            min-width: 300px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .section-label {
            padding: 16px 16px 8px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-dim);
            font-weight: 600;
        }

        /* Pack Filter */
        .pack-tree { padding: 0 8px; }

        .pack-all {
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-weight: 500;
            margin-bottom: 4px;
            border-left: 2px solid transparent;
            transition: all 0.15s;
        }
        .pack-all:hover { background: var(--bg-tertiary); }
        .pack-all.active {
            background: var(--teal-bg);
            border-left-color: var(--teal);
            color: var(--teal);
        }

        .pack-group { margin-bottom: 2px; }

        .pack-group-hdr {
            display: flex;
            align-items: center;
            padding: 7px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.15s;
            user-select: none;
        }
        .pack-group-hdr:hover { background: var(--bg-tertiary); }

        .pack-arrow {
            width: 16px;
            font-size: 10px;
            color: var(--text-secondary);
            transition: transform 0.2s;
        }
        .pack-group.open .pack-arrow { transform: rotate(90deg); }

        .pack-group-name { flex: 1; font-weight: 500; }

        .pack-group-count {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
        }

        .pack-children { display: none; padding-left: 20px; }
        .pack-group.open .pack-children { display: block; }

        .pack-child {
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 1px;
            transition: all 0.15s;
            border-left: 2px solid transparent;
            font-size: 12px;
        }
        .pack-child:hover { background: var(--bg-tertiary); }
        .pack-child.active {
            background: var(--teal-bg);
            border-left-color: var(--teal);
            color: var(--teal);
        }
        .pack-child-count {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            color: var(--text-dim);
            margin-left: 6px;
        }

        /* Search */
        .search-wrap { padding: 8px 16px 12px; }

        .search-input {
            width: 100%;
            padding: 9px 32px 9px 12px;
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
        .search-input::placeholder { color: var(--text-dim); }

        /* Species List */
        .species-list {
            flex: 1;
            overflow-y: auto;
            padding: 0 8px 16px;
        }

        .sp-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 9px 10px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            margin-bottom: 4px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .sp-item:hover {
            background: var(--bg-elevated);
            border-color: var(--border);
        }
        .sp-item.active {
            background: var(--teal-bg);
            border-color: var(--teal);
        }
        .sp-item.no-clips .sp-code { color: var(--red); }

        .sp-info { flex: 1; min-width: 0; }

        .sp-name {
            font-weight: 500;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .sp-code {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: 1px;
        }

        .sp-counts {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--text-dim);
            flex-shrink: 0;
            text-align: right;
        }
        .sp-counts .clips-n { color: var(--teal); }
        .sp-counts .cand-n { color: var(--text-dim); }

        /* ── Center Panel ───────────────────────────────── */
        .center-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: var(--bg-primary);
            min-width: 0;
        }

        .species-header {
            padding: 12px 32px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-secondary);
        }

        .species-header h2 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-bottom: 2px;
        }

        .species-sci {
            font-style: italic;
            color: var(--text-secondary);
            font-size: 14px;
        }

        /* Source chips */
        .source-bar {
            padding: 8px 32px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .source-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-dim);
            font-weight: 600;
            margin-right: 4px;
        }

        .source-chip {
            padding: 5px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--text-primary);
            transition: all 0.15s;
        }
        .source-chip:hover {
            border-color: var(--teal);
            background: var(--bg-elevated);
        }
        .source-chip.active {
            border-color: var(--teal);
            background: var(--teal-bg);
            color: var(--teal);
        }
        .btn-browse {
            background: var(--bg-tertiary);
            color: var(--teal);
            border-color: var(--teal);
        }
        .btn-browse:hover { background: var(--teal-bg); }
        .browse-xc-panel {
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-secondary);
            margin: 8px 0;
            overflow: hidden;
        }
        .browse-filters {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-tertiary);
        }
        .browse-select {
            background: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            font-family: inherit;
        }
        .browse-results {
            max-height: 240px;
            overflow-y: auto;
            padding: 4px;
        }
        .xc-result {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.15s;
        }
        .xc-result:hover { background: var(--bg-elevated); }
        .xc-result.existing { opacity: 0.4; }
        .xc-result.rejected { opacity: 0.3; text-decoration: line-through; }
        .xc-result-id { font-family: 'IBM Plex Mono', monospace; font-size: 11px; min-width: 70px; color: var(--teal); }
        .xc-result-q { font-weight: 700; min-width: 18px; text-align: center; }
        .xc-result-q.qA { color: #66bb6a; }
        .xc-result-q.qB { color: #aed581; }
        .xc-result-q.qC { color: #fdd835; }
        .xc-result-q.qD { color: #ffa726; }
        .xc-result-q.qE { color: #ef5350; }
        .xc-result-type { color: #bbb; min-width: 60px; }
        .xc-result-dur { color: #bbb; min-width: 40px; text-align: right; }
        .xc-result-rec { color: #ccc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .xc-result-badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; }
        .xc-result-badge.in-use { background: var(--teal-bg); color: var(--teal); }
        .xc-result-badge.rejected-badge { background: rgba(239,83,80,0.15); color: #ef5350; }

        .xc-load-area {
            margin-left: auto;
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .xc-input {
            width: 110px;
            padding: 5px 10px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            color: var(--text-primary);
            font-family: 'IBM Plex Mono', monospace;
            font-size: 12px;
        }
        .xc-input:focus { outline: none; border-color: var(--teal); }

        /* Placeholder */
        .center-placeholder {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-dim);
            font-size: 14px;
        }

        /* Waveform area */
        .waveform-area {
            flex: 1;
            overflow-y: auto;
            padding: 12px 32px;
        }

        .waveform-container { max-width: 900px; }

        #waveform {
            width: 100%;
            height: 130px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            position: relative;
            cursor: crosshair;
            margin-bottom: 8px;
            overflow-x: auto;
            overflow-y: hidden;
        }

        #waveformInner {
            position: relative;
            height: 100%;
            min-width: 100%;
        }

        #waveformCanvas {
            height: 100%;
            border-radius: 6px;
            display: block;
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

        .playhead {
            position: absolute;
            top: 0;
            height: 100%;
            width: 2px;
            background: var(--red);
            pointer-events: none;
        }

        /* Controls row */
        .controls-row {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 8px;
        }

        .btn {
            padding: 8px 16px;
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            font-family: inherit;
            transition: all 0.15s;
        }
        .btn:hover { background: var(--bg-tertiary); border-color: var(--teal); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-primary {
            background: var(--teal);
            border-color: var(--teal);
            color: #000;
            font-weight: 600;
        }
        .btn-primary:hover { background: var(--teal-hover); border-color: var(--teal-hover); }

        .time-display {
            font-family: 'IBM Plex Mono', monospace;
            color: var(--text-secondary);
            font-size: 12px;
            margin-left: auto;
        }

        /* Extract form */
        .extract-form {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 12px 16px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 10px;
        }

        .form-field { display: flex; flex-direction: column; gap: 4px; }

        .form-label {
            font-size: 10px;
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

        .form-input, .form-select {
            width: 100%;
            padding: 8px 10px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            color: var(--text-primary);
            font-size: 13px;
            font-family: inherit;
        }
        .form-input:focus, .form-select:focus {
            outline: none;
            border-color: var(--teal);
        }

        .dur-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .dur-btn {
            padding: 6px 12px;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 600;
        }
        .dur-btn:hover { background: var(--bg-elevated); border-color: var(--teal); }

        .dur-display {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 15px;
            min-width: 45px;
            text-align: center;
        }

        .status-msg {
            padding: 10px 14px;
            border-radius: 4px;
            margin-top: 12px;
            font-size: 12px;
        }
        .status-msg.success { background: rgba(102,187,106,0.15); border: 1px solid rgba(102,187,106,0.3); color: var(--green); }
        .status-msg.error { background: var(--red-bg); border: 1px solid rgba(255,68,68,0.3); color: var(--red); }
        .status-msg.info { background: var(--teal-bg); border: 1px solid rgba(77,182,172,0.3); color: var(--teal); }

        /* ── Right Panel ────────────────────────────────── */
        .right-panel {
            width: 370px;
            min-width: 370px;
            background: var(--bg-secondary);
            border-left: 1px solid var(--border);
            display: flex;
            flex-direction: column;
        }

        .clips-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .clips-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .btn-save {
            padding: 7px 14px;
            background: var(--teal);
            color: #000;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            font-family: inherit;
            transition: all 0.15s;
        }
        .btn-save:hover { background: var(--teal-hover); }
        .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

        .unsaved-badge {
            background: var(--gold);
            color: #000;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 8px;
        }

        .clips-list {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .clips-empty {
            padding: 60px 24px;
            text-align: center;
            color: var(--text-dim);
            font-size: 13px;
        }

        /* Clip Cards */
        .clip-card {
            background: var(--bg-tertiary);
            border: 2px solid var(--border);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 10px;
            transition: all 0.2s;
            position: relative;
        }
        .clip-card:hover { border-color: #444; }
        .clip-card.canonical { border-color: var(--gold); }
        .clip-card.modified { box-shadow: 0 0 0 1px rgba(66,165,245,0.4); }
        .clip-card.deleted {
            opacity: 0.35;
            pointer-events: none;
        }

        .canonical-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 3px 8px;
            background: var(--gold);
            color: #000;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border-radius: 3px;
        }

        /* CRITICAL: object-fit: contain — never crop spectrograms */
        .clip-spec {
            width: 100%;
            max-height: 80px;
            object-fit: contain;
            border-radius: 4px;
            margin-bottom: 8px;
            background: var(--bg-primary);
            display: block;
        }

        .clip-id {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--teal);
            margin-bottom: 8px;
            word-break: break-all;
        }

        .clip-meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
        }

        .clip-meta-label {
            color: var(--text-dim);
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.08em;
            font-weight: 600;
        }

        .clip-meta-value {
            font-family: 'IBM Plex Mono', monospace;
            color: var(--text-primary);
            font-size: 11px;
        }

        /* Editable fields in clip cards */
        .clip-edit-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 6px;
        }

        .clip-edit-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-dim);
            font-weight: 600;
            min-width: 50px;
        }

        .clip-edit-select, .clip-edit-input {
            flex: 1;
            padding: 4px 6px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-subtle);
            border-radius: 3px;
            color: var(--text-primary);
            font-size: 11px;
            font-family: inherit;
        }
        .clip-edit-select:focus, .clip-edit-input:focus {
            outline: none;
            border-color: var(--teal);
        }

        /* Quality stars */
        .quality-stars {
            display: flex;
            gap: 1px;
        }

        .star {
            cursor: pointer;
            font-size: 14px;
            color: var(--text-dim);
            transition: color 0.1s;
        }
        .star.filled { color: var(--gold); }
        .star:hover { color: var(--gold); }

        /* Clip action buttons */
        .clip-actions {
            display: flex;
            gap: 6px;
            margin-top: 10px;
        }

        .clip-act {
            flex: 1;
            padding: 8px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.15s;
            text-align: center;
        }
        .clip-act:hover { border-color: var(--teal); transform: translateY(-1px); }
        .clip-act.play-btn { color: var(--teal); }
        .clip-act.canon-btn:hover { border-color: var(--gold); }
        .clip-act.canon-btn.is-canon { background: var(--gold-bg); border-color: var(--gold); }
        .clip-act.del-btn:hover { border-color: var(--red); }

        /* Scrollbars */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
    </style>
</head>
<body>

<!-- Top Bar -->
<div class="top-bar">
    <div class="studio-title">Clip Studio</div>
    <div class="stats-bar">
        <div>CLIPS: <span class="stat-value" id="statClips">0</span></div>
        <div>CANONICAL: <span class="stat-value" id="statCanonical">0</span></div>
        <div>SPECIES: <span class="stat-value" id="statSpecies">0</span></div>
    </div>
</div>

<div class="studio">

    <!-- Left Panel -->
    <div class="left-panel">
        <div class="section-label">PACK FILTER</div>
        <div class="pack-tree" id="packTree"></div>

        <div class="section-label" style="margin-top: 12px;">SPECIES</div>
        <div class="search-wrap" style="position:relative;">
            <input type="text" class="search-input" id="searchInput"
                   placeholder="Search species..." oninput="renderSpeciesList()">
            <span id="searchClear" onclick="document.getElementById('searchInput').value='';renderSpeciesList();"
                  style="position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;color:var(--text-dim);font-size:20px;line-height:1;padding:2px 4px;display:none;">&times;</span>
        </div>
        <div class="species-list" id="speciesList"></div>
    </div>

    <!-- Center Panel -->
    <div class="center-panel">
        <div class="species-header" id="speciesHeader" style="display:none;">
            <h2 id="speciesTitle"></h2>
            <div class="species-sci" id="speciesSci"></div>
        </div>

        <div class="source-bar" id="sourceBar" style="display:none;">
            <span class="source-label">Sources</span>
            <div id="sourceChips" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
            <div class="xc-load-area">
                <input type="text" class="xc-input" id="xcInput" placeholder="XC ID">
                <button class="btn" onclick="loadXC()">Load</button>
                <button class="btn btn-browse" onclick="toggleBrowseXC()">🔍 Browse XC</button>
            </div>
        </div>

        <div class="browse-xc-panel" id="browsePanel" style="display:none;">
            <div class="browse-filters">
                <select id="browseQuality" class="browse-select">
                    <option value="">Any quality</option>
                    <option value="A" selected>A only</option>
                    <option value="A B">A or B</option>
                </select>
                <select id="browseType" class="browse-select">
                    <option value="">Any type</option>
                    <option value="song">Song</option>
                    <option value="call">Call</option>
                    <option value="alarm call">Alarm</option>
                    <option value="flight call">Flight call</option>
                </select>
                <button class="btn" onclick="searchXC()">Search</button>
                <span id="browseStatus" style="font-size:11px;color:var(--text-dim);margin-left:8px;"></span>
            </div>
            <div class="browse-results" id="browseResults"></div>
        </div>

        <div class="center-placeholder" id="centerPlaceholder">
            Select a species to begin
        </div>

        <div class="waveform-area" id="waveformArea" style="display:none;">
            <div class="waveform-container">
                <div id="waveform">
                    <div id="waveformInner">
                        <canvas id="waveformCanvas"></canvas>
                        <div class="selection-overlay" id="selection" style="display:none;"></div>
                        <div class="playhead" id="playhead" style="display:none;"></div>
                    </div>
                </div>

                <div class="controls-row">
                    <button class="btn" id="btnSel" onclick="toggleSelection()">&#9654; Selection</button>
                    <button class="btn" id="btnFull" onclick="toggleFull()">&#9654; Full</button>
                    <div class="time-display" id="timeDisplay">0:00 - 0:00</div>
                    <span style="color:var(--text-dim);font-size:10px;margin-left:auto;">Zoom</span>
                    <input type="range" id="zoomSlider" min="1" max="5" step="0.5" value="1"
                           oninput="setZoom(parseFloat(this.value))"
                           style="width:100px;accent-color:var(--teal);">
                </div>

                <div class="extract-form">
                    <div class="form-grid">
                        <div class="form-field">
                            <label class="form-label">Start Time</label>
                            <div class="form-value" id="startTimeDisplay">0.0s</div>
                        </div>
                        <div class="form-field">
                            <label class="form-label">Duration</label>
                            <div style="display:flex;align-items:center;gap:4px;">
                                <button class="dur-btn" onclick="adjustDuration(-0.1)">&minus;</button>
                                <div class="dur-display" id="durationDisplay">2.0</div>
                                <button class="dur-btn" onclick="adjustDuration(0.1)">+</button>
                            </div>
                            <input type="range" id="durationSlider" min="0.5" max="3.0" step="0.1" value="2.0"
                                   oninput="setDuration(parseFloat(this.value))"
                                   style="width:100%;accent-color:var(--teal);margin-top:4px;">
                        </div>
                        <div class="form-field">
                            <label class="form-label">Vocalization Type</label>
                            <select class="form-select" id="vocType">''' + voc_type_options + '''</select>
                        </div>
                        <div class="form-field">
                            <label class="form-label">License</label>
                            <span id="licenseDisplay" style="font-size:11px;color:var(--text-dim);">—</span>
                        </div>
                        <div class="form-field" style="grid-column:3;">
                            <label class="form-label">Recordist</label>
                            <input type="text" class="form-input" id="recordist" placeholder="Unknown">
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;margin:8px 0;padding:8px 10px;background:var(--bg-tertiary);border-radius:6px;">
                        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;white-space:nowrap;">
                            <input type="checkbox" id="denoiseToggle" checked> Denoise
                        </label>
                        <input type="range" id="denoiseStrength" min="0" max="100" value="70"
                               style="flex:1;accent-color:var(--teal);"
                               oninput="document.getElementById('denoiseLabel').textContent=this.value+'%'">
                        <span id="denoiseLabel" style="font-size:11px;color:var(--text-dim);min-width:30px;">70%</span>
                    </div>
                    <button class="btn btn-primary" style="width:100%;" onclick="extractClip()">
                        Extract Clip
                    </button>
                    <div id="statusArea"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Right Panel -->
    <div class="right-panel">
        <div class="clips-header">
            <div>
                <span class="clips-title" id="clipsTitle">EXTRACTED (0)</span>
                <span class="unsaved-badge" id="unsavedBadge" style="display:none;">UNSAVED</span>
            </div>
            <button class="btn-save" id="btnSave" onclick="saveAllChanges()">💾 Save All</button>
        </div>
        <div class="clips-list" id="clipsList">
            <div class="clips-empty">Select a species to view clips</div>
        </div>
    </div>

</div>

<script>
// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

const S = {
    packs: {},
    selectedPack: null,
    species: [],
    selectedSpecies: null,
    clips: [],              // from server (current species)
    candidates: [],
    selectedSource: null,
    waveformData: null,
    startTime: 0,
    duration: 2.0,
    zoom: 1,
    // Batched edits (not saved until Save All)
    modifications: {},      // clip_id -> {field: newValue}
    deletions: new Set(),   // clip_ids marked for deletion
    // Stats
    totalClips: 0,
    totalCanonical: 0,
};

let audio = null;
let isPlaying = false;
let animFrame = null;

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

fetch('/api/init')
    .then(r => r.json())
    .then(data => {
        S.packs = data.packs;
        S.totalClips = data.total_clips;
        S.totalCanonical = data.total_canonical;
        S.degradedSpecies = data.degraded_species || {all: [], canonical: []};
        S.cornellCdSpecies = data.cornell_cd_species || [];
        S.clipSampleRates = data.clip_sample_rates || {};
        S.selectedPack = data.filter_pack;
        renderPackTree();
        updateStatsDisplay();
        // Load species list
        loadSpeciesList(S.selectedPack);
    });

function loadSpeciesList(packId) {
    const url = '/api/species' + (packId ? '?pack=' + packId : '');
    fetch(url)
        .then(r => r.json())
        .then(species => {
            S.species = species;
            renderSpeciesList();
            document.getElementById('statSpecies').textContent = species.length;
            // Update clip/canonical counts from species data
            const totalClips = species.reduce((sum, sp) => sum + sp.clip_count, 0);
            document.getElementById('statClips').textContent = totalClips;
        });
}

// ═══════════════════════════════════════════════════════════════
// LEFT PANEL: Pack Tree
// ═══════════════════════════════════════════════════════════════

function renderPackTree() {
    const c = document.getElementById('packTree');
    c.innerHTML = '';

    // All Birds
    const all = document.createElement('div');
    all.className = 'pack-all' + (!S.selectedPack ? ' active' : '');
    all.textContent = 'All Birds';
    all.onclick = () => { S.selectedPack = null; renderPackTree(); loadSpeciesList(null); };
    c.appendChild(all);

    // Degraded Clips filters (from find_degraded_clips.py report)
    if (S.degradedSpecies && S.degradedSpecies.all && S.degradedSpecies.all.length > 0) {
        const group = document.createElement('div');
        group.className = 'pack-group';

        const hdr = document.createElement('div');
        hdr.className = 'pack-group-hdr';
        hdr.innerHTML = '<span class="pack-arrow">&#9654;</span>' +
            '<span class="pack-group-name" style="color:#e57373">⚠ Degraded Clips</span>' +
            '<span class="pack-group-count">' + S.degradedSpecies.all.length + '</span>';
        hdr.onclick = () => group.classList.toggle('open');

        const children = document.createElement('div');
        children.className = 'pack-children';

        // Canonical only
        const canon = document.createElement('div');
        canon.className = 'pack-child' + (S.selectedPack === '__degraded_canonical__' ? ' active' : '');
        canon.innerHTML = '⭐ Canonical Only<span class="pack-child-count">' + S.degradedSpecies.canonical.length + '</span>';
        canon.onclick = (e) => { e.stopPropagation(); S.selectedPack = '__degraded_canonical__'; renderPackTree(); loadSpeciesList('__degraded_canonical__'); };
        children.appendChild(canon);

        // All degraded
        const allDeg = document.createElement('div');
        allDeg.className = 'pack-child' + (S.selectedPack === '__degraded__' ? ' active' : '');
        allDeg.innerHTML = 'All Degraded<span class="pack-child-count">' + S.degradedSpecies.all.length + '</span>';
        allDeg.onclick = (e) => { e.stopPropagation(); S.selectedPack = '__degraded__'; renderPackTree(); loadSpeciesList('__degraded__'); };
        children.appendChild(allDeg);

        // Auto-expand if selected
        if (S.selectedPack === '__degraded__' || S.selectedPack === '__degraded_canonical__') {
            group.classList.add('open');
        }

        group.appendChild(hdr);
        group.appendChild(children);
        c.appendChild(group);
    }

    // Cornell CD filter (species needing XC replacements)
    if (S.cornellCdSpecies && S.cornellCdSpecies.length > 0) {
        const cornell = document.createElement('div');
        cornell.className = 'pack-child' + (S.selectedPack === '__cornell_cd__' ? ' active' : '');
        cornell.style.cssText = 'color:#ffb74d; font-weight:600; margin:4px 0; padding:6px 10px; border-radius:6px; cursor:pointer;';
        cornell.innerHTML = '📀 Cornell CD<span class="pack-child-count">' + S.cornellCdSpecies.length + '</span>';
        cornell.onclick = () => { S.selectedPack = '__cornell_cd__'; renderPackTree(); loadSpeciesList('__cornell_cd__'); };
        c.appendChild(cornell);
    }

    const regions = [
        ['eu', 'European Packs'],
        ['nz', 'New Zealand Packs'],
        ['na', 'North American Packs'],
    ];

    for (const [region, label] of regions) {
        const packs = S.packs[region] || [];
        if (!packs.length) continue;

        const group = document.createElement('div');
        group.className = 'pack-group';

        const hdr = document.createElement('div');
        hdr.className = 'pack-group-hdr';
        hdr.innerHTML = '<span class="pack-arrow">&#9654;</span>' +
            '<span class="pack-group-name">' + label + '</span>' +
            '<span class="pack-group-count">' + packs.length + '</span>';
        hdr.onclick = () => group.classList.toggle('open');

        const children = document.createElement('div');
        children.className = 'pack-children';

        packs.forEach(pack => {
            const item = document.createElement('div');
            item.className = 'pack-child' + (S.selectedPack === pack.id ? ' active' : '');
            item.innerHTML = pack.name + '<span class="pack-child-count">' + pack.species_count + '</span>';
            item.onclick = (e) => {
                e.stopPropagation();
                S.selectedPack = pack.id;
                renderPackTree();
                loadSpeciesList(pack.id);
            };
            children.appendChild(item);
        });

        // Auto-expand group if it contains the selected pack
        if (packs.some(p => p.id === S.selectedPack)) {
            group.classList.add('open');
        }

        group.appendChild(hdr);
        group.appendChild(children);
        c.appendChild(group);
    }
}

// ═══════════════════════════════════════════════════════════════
// LEFT PANEL: Species List
// ═══════════════════════════════════════════════════════════════

function renderSpeciesList() {
    const container = document.getElementById('speciesList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    document.getElementById('searchClear').style.display = search ? '' : 'none';

    let filtered = S.species.filter(sp =>
        sp.species_code.toLowerCase().includes(search) ||
        (sp.common_name && sp.common_name.toLowerCase().includes(search))
    );
    // When searching, show species with clips first (more likely targets)
    if (search) {
        filtered.sort((a, b) => (b.clip_count - a.clip_count) || a.species_code.localeCompare(b.species_code));
    }

    container.innerHTML = filtered.map(sp => {
        const isActive = S.selectedSpecies && S.selectedSpecies.species_code === sp.species_code;
        const noClips = sp.clip_count === 0;
        const spJson = JSON.stringify(sp).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        return '<div class="sp-item' + (isActive ? ' active' : '') + (noClips ? ' no-clips' : '') + '"' +
            ' onclick="selectSpecies(' + spJson + ')">' +
            '<div class="sp-info">' +
            '<div class="sp-name">' + (sp.common_name || sp.species_code) + '</div>' +
            '<div class="sp-code">' + sp.species_code + '</div>' +
            '</div>' +
            '<div class="sp-counts">' +
            '<span class="clips-n">' + sp.clip_count + '</span>' +
            '/<span class="cand-n">' + sp.candidate_count + '</span>' +
            '</div></div>';
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
// CENTER PANEL: Species Selection
// ═══════════════════════════════════════════════════════════════

function selectSpecies(species) {
    // Check for unsaved changes
    if (hasUnsavedChanges() && !confirm('You have unsaved changes. Discard them?')) {
        return;
    }

    S.selectedSpecies = species;
    S.modifications = {};
    S.deletions = new Set();
    renderSpeciesList();
    updateUnsavedBadge();

    // Show header, reset browse panel
    document.getElementById('speciesHeader').style.display = '';
    document.getElementById('speciesTitle').textContent = species.common_name || species.species_code;
    document.getElementById('speciesSci').textContent = species.scientific_name || '';
    document.getElementById('browsePanel').style.display = 'none';
    document.getElementById('browseResults').innerHTML = '';

    // Load clips and candidates in parallel
    Promise.all([
        fetch('/api/clips?species=' + species.species_code).then(r => r.json()),
        fetch('/api/candidates?species=' + species.species_code).then(r => r.json()),
    ]).then(([clips, candidates]) => {
        S.clips = clips;
        S.candidates = candidates;
        renderClips();
        renderSourceBar(candidates);

        // Auto-load first candidate if available
        if (candidates.length > 0) {
            loadCandidate(candidates[0]);
        } else {
            document.getElementById('centerPlaceholder').style.display = 'flex';
            document.getElementById('centerPlaceholder').textContent = 'No source recordings — enter an XC ID above';
            document.getElementById('waveformArea').style.display = 'none';
        }
    });
}

function renderSourceBar(candidates) {
    const bar = document.getElementById('sourceBar');
    bar.style.display = '';

    const chips = document.getElementById('sourceChips');
    if (candidates.length === 0) {
        chips.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">None available</span>';
    } else {
        chips.innerHTML = candidates.map((c, i) => {
            let licBadge = '';
            const lic = (c.license || '').toLowerCase();
            if (lic.includes('by-nc-nd')) {
                licBadge = ' <span style="color:#ff5252;font-size:9px;" title="BY-NC-ND (restrictive)">ND</span>';
            } else if (lic.includes('by-nc-sa')) {
                licBadge = ' <span style="color:#81c784;font-size:9px;" title="BY-NC-SA">SA</span>';
            } else if (lic.includes('by-sa')) {
                licBadge = ' <span style="color:#4db6ac;font-size:9px;" title="BY-SA">SA</span>';
            } else if (lic && lic !== 'unknown') {
                licBadge = ' <span style="color:#ffa726;font-size:9px;" title="' + c.license + '">?</span>';
            }
            return '<span class="source-chip' + (i === 0 ? ' active' : '') + '"' +
                ' data-idx="' + i + '"' +
                ' onclick="loadCandidateByIndex(' + i + ')">' +
                'XC' + c.xc_id +
                ' <span style="color:var(--text-dim);font-size:9px;">' + (c.vocalization_type || '') + '</span>' +
                licBadge +
                '</span>';
        }).join('');
    }
}

function loadCandidateByIndex(idx) {
    const c = S.candidates[idx];
    if (!c) return;

    // Update active chip
    document.querySelectorAll('.source-chip').forEach(el => el.classList.remove('active'));
    const chip = document.querySelector('.source-chip[data-idx="' + idx + '"]');
    if (chip) chip.classList.add('active');

    loadCandidate(c);
}

function setVocType(xcType) {
    // Set vocalization type dropdown, adding the XC type as an option if needed
    const sel = document.getElementById('vocType');
    const val = (xcType || 'call').toLowerCase();
    // Check if option exists
    const exists = Array.from(sel.options).some(o => o.value === val);
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
    }
    sel.value = val;
}

function loadCandidate(candidate) {
    document.getElementById('centerPlaceholder').style.display = 'none';
    document.getElementById('waveformArea').style.display = '';

    document.getElementById('recordist').value = candidate.recordist || '';
    setVocType(candidate.vocalization_type);

    // Show license
    const licEl = document.getElementById('licenseDisplay');
    const lic = (candidate.license || '').toLowerCase();
    if (lic.includes('by-nc-nd')) {
        licEl.innerHTML = '<span style="color:#ff5252;">CC BY-NC-ND 4.0 ⚠️</span>';
    } else if (lic.includes('by-nc-sa')) {
        licEl.innerHTML = '<span style="color:#81c784;">CC BY-NC-SA 4.0 ✓</span>';
    } else if (lic.includes('by-sa')) {
        licEl.innerHTML = '<span style="color:#4db6ac;">CC BY-SA 4.0 ✓</span>';
    } else if (lic && lic !== 'unknown') {
        licEl.innerHTML = '<span style="color:#ffa726;">' + candidate.license + '</span>';
    } else {
        licEl.innerHTML = '<span style="color:var(--text-dim);">Unknown</span>';
    }

    S.selectedSource = {
        path: candidate.path,
        xc_id: candidate.xc_id,
    };

    // If no local file, download from XC first
    if (!candidate.path) {
        showStatus('Downloading XC' + candidate.xc_id + '...', 'info');
        fetch('/api/load-xc?id=' + candidate.xc_id)
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    candidate.path = result.source_path;
                    S.selectedSource.path = result.source_path;
                    if (result.recordist) document.getElementById('recordist').value = result.recordist;
                    if (result.vocalization_type) setVocType(result.vocalization_type);
                    showStatus('Downloaded XC' + candidate.xc_id, 'success');
                    loadWaveformFromPath(result.source_path);
                } else {
                    showStatus('Download failed: ' + (result.error || 'unknown'), 'error');
                }
            });
        return;
    }

    loadWaveformFromPath(candidate.path);
}

function loadWaveformFromPath(path) {
    fetch('/api/waveform?source=' + encodeURIComponent(path))
        .then(r => r.json())
        .then(data => {
            S.waveformData = data;
            S.startTime = 0;
            // Auto-zoom: only for long recordings (>10s), gentle max 3x
            var containerW = document.getElementById('waveform').clientWidth;
            if (data.duration > 10) {
                var idealZoom = (data.duration * 20) / containerW;
                S.zoom = Math.max(1, Math.min(3, idealZoom));
            } else {
                S.zoom = 1;
            }
            document.getElementById('zoomSlider').value = S.zoom;
            drawWaveform();
            updateSelectionUI();
        });
}

function loadXC() {
    const xcId = document.getElementById('xcInput').value.trim();
    if (!xcId) return;

    showStatus('Downloading XC' + xcId + '...', 'info');

    fetch('/api/load-xc?id=' + xcId)
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                S.selectedSource = {
                    path: result.source_path,
                    xc_id: result.xc_id,
                };

                if (result.recordist) document.getElementById('recordist').value = result.recordist;
                if (result.vocalization_type) setVocType(result.vocalization_type);

                document.getElementById('centerPlaceholder').style.display = 'none';
                document.getElementById('waveformArea').style.display = '';

                fetch('/api/waveform?source=' + encodeURIComponent(result.source_path))
                    .then(r => r.json())
                    .then(data => {
                        S.waveformData = data;
                        S.startTime = 0;
                        var containerW = document.getElementById('waveform').clientWidth;
                        var idealZoom = (data.duration * 30) / containerW;
                        S.zoom = Math.max(1, Math.min(10, idealZoom));
                        document.getElementById('zoomSlider').value = S.zoom;
                        drawWaveform();
                        updateSelectionUI();
                        showStatus('Loaded XC' + xcId + ' (' + result.duration.toFixed(1) + 's)' +
                            (result.recordist ? ' — ' + result.recordist : ''), 'success');
                    });
            } else {
                showStatus('Failed: ' + result.error, 'error');
            }
        });
}

// ═══════════════════════════════════════════════════════════════
// CENTER PANEL: Browse XC
// ═══════════════════════════════════════════════════════════════

function toggleBrowseXC() {
    const panel = document.getElementById('browsePanel');
    if (panel.style.display === 'none') {
        panel.style.display = '';
        if (!document.getElementById('browseResults').innerHTML) searchXC();
    } else {
        panel.style.display = 'none';
    }
}

function searchXC() {
    if (!S.selectedSpecies) return;
    const name = S.selectedSpecies.common_name || S.selectedSpecies.scientific_name;
    const quality = document.getElementById('browseQuality').value;
    const type = document.getElementById('browseType').value;
    const species = S.selectedSpecies.species_code;

    document.getElementById('browseStatus').textContent = 'Searching...';
    document.getElementById('browseResults').innerHTML = '';

    let url = '/api/search-xc?name=' + encodeURIComponent(name) + '&species=' + encodeURIComponent(species);
    if (quality) url += '&quality=' + encodeURIComponent(quality);
    if (type) url += '&type=' + encodeURIComponent(type);

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                document.getElementById('browseStatus').textContent = 'Error: ' + data.error;
                return;
            }
            document.getElementById('browseStatus').textContent = data.shown + ' of ' + data.total + ' recordings';
            renderBrowseResults(data.results);
        })
        .catch(err => {
            document.getElementById('browseStatus').textContent = 'Error: ' + err;
        });
}

function renderBrowseResults(results) {
    const container = document.getElementById('browseResults');
    if (!results.length) {
        container.innerHTML = '<div style="padding:16px;color:var(--text-dim);text-align:center;">No recordings found. Try different filters.</div>';
        return;
    }
    container.innerHTML = results.map(r => {
        let cls = 'xc-result';
        if (r.existing) cls += ' existing';
        if (r.rejected) cls += ' rejected';
        const qClass = r.quality ? ' q' + r.quality : '';
        let badge = '';
        if (r.existing) badge = '<span class="xc-result-badge in-use">in use</span>';
        else if (r.rejected) badge = '<span class="xc-result-badge rejected-badge">rejected</span>';
        const licShort = (function(lic) {
            if (!lic) return '';
            lic = lic.toLowerCase();
            if (lic.includes('by-nc-nd')) return '<span style="color:#ff5252" title="BY-NC-ND">ND</span>';
            if (lic.includes('by-nc-sa')) return '<span style="color:#81c784" title="BY-NC-SA">SA</span>';
            if (lic.includes('by-sa')) return '<span style="color:#4db6ac" title="BY-SA">SA</span>';
            return '';
        })(r.license);
        return '<div class="' + cls + '" onclick="loadFromBrowse(\\'' + r.xc_id + '\\',\\'' + escHtml(r.recordist) + '\\',\\'' + escHtml(r.type) + '\\',\\'' + escHtml(r.license) + '\\')" title="' + escHtml(r.remarks) + '">' +
            '<span class="xc-result-id">XC' + r.xc_id + '</span>' +
            '<span class="xc-result-q' + qClass + '">' + (r.quality || '?') + '</span>' +
            '<span class="xc-result-type">' + escHtml(r.type || '') + '</span>' +
            '<span class="xc-result-dur">' + r.duration_str + '</span>' +
            '<span class="xc-result-rec">' + escHtml(r.recordist) + '</span>' +
            (r.sample_rate && r.sample_rate !== 44100 ? '<span style="color:#e57373;font-size:10px;" title="' + r.sample_rate + 'Hz source">⚠</span>' : '') +
            (licShort ? ' ' + licShort : '') +
            badge +
            '</div>';
    }).join('');
}

function loadFromBrowse(xcId, recordist, vocType, license) {
    // Download and load this XC recording
    showStatus('Downloading XC' + xcId + '...', 'info');
    document.getElementById('browsePanel').style.display = 'none';

    fetch('/api/load-xc?id=' + xcId)
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                S.selectedSource = {
                    path: result.source_path,
                    xc_id: xcId,
                };

                document.getElementById('recordist').value = result.recordist || recordist;
                setVocType(result.vocalization_type || vocType);

                // Update license display
                const licEl = document.getElementById('licenseDisplay');
                const lic = (result.license || license || '').toLowerCase();
                if (lic.includes('by-nc-nd')) licEl.innerHTML = '<span style="color:#ff5252;">CC BY-NC-ND 4.0 ⚠️</span>';
                else if (lic.includes('by-nc-sa')) licEl.innerHTML = '<span style="color:#81c784;">CC BY-NC-SA 4.0 ✓</span>';
                else if (lic.includes('by-sa')) licEl.innerHTML = '<span style="color:#4db6ac;">CC BY-SA 4.0 ✓</span>';
                else licEl.innerHTML = '<span style="color:var(--text-dim);">' + (result.license || license || 'Unknown') + '</span>';

                document.getElementById('centerPlaceholder').style.display = 'none';
                document.getElementById('waveformArea').style.display = '';

                showStatus('Loaded XC' + xcId + ' — ' + (result.recordist || recordist), 'success');
                loadWaveformFromPath(result.source_path);

                // Also add to source chips for easy re-selection
                S.candidates.push({xc_id: xcId, path: result.source_path, recordist: result.recordist || recordist, vocalization_type: result.vocalization_type || vocType, license: result.license || license});
                renderSourceBar(S.candidates);
                // Mark new chip active
                document.querySelectorAll('.source-chip').forEach(el => el.classList.remove('active'));
                const last = document.querySelector('.source-chip:last-child');
                if (last) last.classList.add('active');
            } else {
                showStatus('Download failed: ' + (result.error || 'unknown'), 'error');
            }
        });
}

// ═══════════════════════════════════════════════════════════════
// CENTER PANEL: Waveform
// ═══════════════════════════════════════════════════════════════

function drawWaveform() {
    if (!S.waveformData) return;

    const container = document.getElementById('waveform');
    const inner = document.getElementById('waveformInner');
    const canvas = document.getElementById('waveformCanvas');
    const ctx = canvas.getContext('2d');

    const containerW = container.clientWidth;
    const w = containerW * S.zoom;
    const h = container.clientHeight;

    // Size the inner div and canvas
    inner.style.width = w + 'px';
    canvas.style.width = w + 'px';
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const mid = h / 2;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Draw waveform
    ctx.strokeStyle = '#4db6ac';
    ctx.lineWidth = 1.5;
    const mins = S.waveformData.mins;
    const maxs = S.waveformData.maxs;
    const step = w / mins.length;

    ctx.beginPath();
    for (let i = 0; i < mins.length; i++) {
        const x = i * step;
        ctx.moveTo(x, mid + mins[i] * mid * 0.85);
        ctx.lineTo(x, mid + maxs[i] * mid * 0.85);
    }
    ctx.stroke();

    // Time markers
    ctx.fillStyle = '#555';
    ctx.font = '10px "IBM Plex Mono", monospace';
    const dur = S.waveformData.duration;
    const interval = dur > 60 ? 10 : dur > 20 ? 5 : dur > 5 ? 1 : 0.5;
    for (let t = 0; t <= dur; t += interval) {
        const x = (t / dur) * w;
        ctx.fillRect(x, 0, 1, 4);
        ctx.fillText(t + 's', x + 2, 12);
    }
}

function setZoom(val) {
    S.zoom = val;
    drawWaveform();
    updateSelectionUI();
    // Scroll to keep selection visible
    const container = document.getElementById('waveform');
    if (S.waveformData) {
        const selLeft = (S.startTime / S.waveformData.duration) * container.clientWidth * S.zoom;
        const visLeft = container.scrollLeft;
        const visRight = visLeft + container.clientWidth;
        if (selLeft < visLeft || selLeft > visRight) {
            container.scrollLeft = selLeft - container.clientWidth * 0.3;
        }
    }
}

document.getElementById('waveform').addEventListener('click', function(e) {
    if (!S.waveformData) return;
    const rect = this.getBoundingClientRect();
    const clickX = e.clientX - rect.left + this.scrollLeft;
    const totalW = this.clientWidth * S.zoom;
    const ratio = clickX / totalW;

    S.startTime = ratio * S.waveformData.duration;
    if (S.startTime + S.duration > S.waveformData.duration) {
        S.startTime = Math.max(0, S.waveformData.duration - S.duration);
    }
    updateSelectionUI();
});

function setDuration(val) {
    S.duration = Math.max(0.5, Math.min(3.0, +val.toFixed(1)));
    if (S.waveformData && S.startTime + S.duration > S.waveformData.duration) {
        S.startTime = Math.max(0, S.waveformData.duration - S.duration);
    }
    updateSelectionUI();
}

function adjustDuration(delta) {
    setDuration(S.duration + delta);
}

function updateSelectionUI() {
    const sel = document.getElementById('selection');
    if (!S.waveformData) { sel.style.display = 'none'; return; }

    const dur = S.waveformData.duration;
    sel.style.display = 'block';
    sel.style.left = (S.startTime / dur * 100) + '%';
    sel.style.width = (S.duration / dur * 100) + '%';

    document.getElementById('startTimeDisplay').textContent = S.startTime.toFixed(1) + 's';
    document.getElementById('durationDisplay').textContent = S.duration.toFixed(1);
    document.getElementById('durationSlider').value = S.duration;
    document.getElementById('timeDisplay').textContent =
        fmtTime(S.startTime) + ' - ' + fmtTime(S.startTime + S.duration) + ' / ' + fmtTime(dur);
}

// ═══════════════════════════════════════════════════════════════
// PLAYBACK
// ═══════════════════════════════════════════════════════════════

var centerPlayMode = null; // 'full' or 'selection'

function updateCenterButtons() {
    var btnFull = document.getElementById('btnFull');
    var btnSel = document.getElementById('btnSel');
    btnFull.innerHTML = (centerPlayMode === 'full') ? '&#9632; Full' : '&#9654; Full';
    btnSel.innerHTML = (centerPlayMode === 'selection') ? '&#9632; Selection' : '&#9654; Selection';
}

function toggleFull() {
    if (!S.selectedSource) return;
    if (centerPlayMode === 'full') {
        stopAudio();
        return;
    }
    stopAudio();
    centerPlayMode = 'full';
    updateCenterButtons();
    audio = new Audio('/audio/' + encodeURIComponent(S.selectedSource.path));
    audio.play();
    isPlaying = true;
    updatePlayhead();
    audio.onended = () => { stopAudio(); };
}

function toggleSelection() {
    if (!S.selectedSource) return;
    if (centerPlayMode === 'selection') {
        stopAudio();
        return;
    }
    stopAudio();
    centerPlayMode = 'selection';
    updateCenterButtons();

    // Always use server-side preview for accurate selection playback
    const denoiseOn = document.getElementById('denoiseToggle').checked;
    const strength = denoiseOn ? parseInt(document.getElementById('denoiseStrength').value) / 100 : 0;
    const url = '/api/preview-denoise?source=' + encodeURIComponent(S.selectedSource.path) +
        '&start=' + S.startTime + '&duration=' + S.duration + '&strength=' + strength;
    document.getElementById('btnSel').textContent = denoiseOn ? '⏳ Denoising...' : '⏳ Loading...';
    fetch(url)
        .then(resp => {
            if (!resp.ok) throw new Error('Server returned ' + resp.status);
            return resp.blob();
        })
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            audio = new Audio(blobUrl);
            audio.onended = () => { URL.revokeObjectURL(blobUrl); stopAudio(); };
            document.getElementById('btnSel').innerHTML = '&#9632; Selection';
            audio.play();
            isPlaying = true;
            updatePlayhead();
        })
        .catch(err => {
            console.error('Selection preview error:', err);
            document.getElementById('btnSel').innerHTML = '&#9654; Selection';
            centerPlayMode = null;
            showStatus('Preview failed: ' + err.message, 'error');
        });
}

let playingClipPath = null;

function playClipAudio(path) {
    if (playingClipPath === path) {
        // Toggle off — stop
        stopAudio();
        playingClipPath = null;
        updatePlayButtons();
        return;
    }
    stopAudio();
    playingClipPath = path;
    audio = new Audio('/' + path);
    audio.play();
    updatePlayButtons();
    audio.onended = () => {
        playingClipPath = null;
        audio = null;
        updatePlayButtons();
    };
}

function updatePlayButtons() {
    document.querySelectorAll('.clip-act.play-btn').forEach(btn => {
        const btnPath = btn.dataset.path;
        if (btnPath === playingClipPath) {
            btn.innerHTML = '&#9632;';
            btn.style.background = 'var(--teal-bg)';
            btn.style.borderColor = 'var(--teal)';
        } else {
            btn.innerHTML = '&#9654;';
            btn.style.background = '';
            btn.style.borderColor = '';
        }
    });
}

function stopAudio() {
    if (audio) { audio.pause(); audio = null; }
    isPlaying = false;
    playingClipPath = null;
    centerPlayMode = null;
    document.getElementById('playhead').style.display = 'none';
    if (animFrame) cancelAnimationFrame(animFrame);
    updatePlayButtons();
    updateCenterButtons();
}

function updatePlayhead() {
    if (!isPlaying || !audio || !S.waveformData) return;
    const ph = document.getElementById('playhead');
    ph.style.display = 'block';
    if (centerPlayMode === 'selection') {
        // Server-side preview plays from 0..S.duration — offset to selection position
        const pos = S.startTime + audio.currentTime;
        ph.style.left = (pos / S.waveformData.duration * 100) + '%';
    } else {
        ph.style.left = (audio.currentTime / S.waveformData.duration * 100) + '%';
    }
    animFrame = requestAnimationFrame(updatePlayhead);
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractClip() {
    if (!S.selectedSource || !S.selectedSpecies) return;

    showStatus('Extracting...', 'info');

    fetch('/api/extract', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            source_path: S.selectedSource.path,
            start_time: S.startTime,
            duration: S.duration,
            species_code: S.selectedSpecies.species_code,
            xc_id: S.selectedSource.xc_id,
            vocalization_type: document.getElementById('vocType').value,
            recordist: document.getElementById('recordist').value || 'Unknown',
            license: document.getElementById('licenseDisplay').textContent || '',
            denoise: document.getElementById('denoiseToggle').checked,
            denoise_strength: parseInt(document.getElementById('denoiseStrength').value) / 100,
        })
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) {
            showStatus('Created: ' + result.clip_id + ' (' + result.duration_ms + 'ms)', 'success');
            // Reload clips
            fetch('/api/clips?species=' + S.selectedSpecies.species_code)
                .then(r => r.json())
                .then(clips => {
                    S.clips = clips;
                    renderClips();
                    refreshStats();
                    // Refresh browse results if open
                    if (document.getElementById('browsePanel').style.display !== 'none') {
                        searchXC();
                    }
                });
        } else {
            showStatus('Error: ' + result.error, 'error');
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// RIGHT PANEL: Clip Cards
// ═══════════════════════════════════════════════════════════════

function renderClips() {
    const container = document.getElementById('clipsList');
    const count = S.clips.filter(c => !S.deletions.has(c.clip_id)).length;
    document.getElementById('clipsTitle').textContent = 'EXTRACTED (' + count + ')';

    if (S.clips.length === 0) {
        container.innerHTML = '<div class="clips-empty">No clips extracted yet</div>';
        return;
    }

    container.innerHTML = S.clips.map(clip => {
        const id = clip.clip_id;
        const mods = S.modifications[id] || {};
        const isDeleted = S.deletions.has(id);
        const isCanonical = 'canonical' in mods ? mods.canonical : clip.canonical;
        const isModified = id in S.modifications || isDeleted;
        const vocType = mods.vocalization_type || clip.vocalization_type || 'song';
        const quality = mods.quality_score != null ? mods.quality_score : (clip.quality_score || 5);
        const recordist = mods.recordist != null ? mods.recordist : (clip.recordist || '');

        const vocOptions = ''' + json.dumps(VOCALIZATION_TYPES) + '''.map(vt =>
            '<option value="' + vt + '"' + (vt === vocType ? ' selected' : '') + '>' + vt + '</option>'
        ).join('');

        const stars = [1,2,3,4,5].map(i =>
            '<span class="star' + (i <= quality ? ' filled' : '') + '"' +
            ' onclick="setQuality(\\'' + id + '\\',' + i + ')">&#9733;</span>'
        ).join('');

        return '<div class="clip-card' +
            (isCanonical ? ' canonical' : '') +
            (isModified ? ' modified' : '') +
            (isDeleted ? ' deleted' : '') + '"' +
            ' data-clip-id="' + id + '">' +
            (isCanonical ? '<div class="canonical-badge">CANONICAL</div>' : '') +
            '<img src="/' + clip.spectrogram_path + '" class="clip-spec"' +
            ' onerror="this.style.display=\\'none\\'">' +
            '<div class="clip-id">' + id + '</div>' +
            '<div class="clip-edit-row">' +
            '<span class="clip-edit-label">Duration</span>' +
            '<span style="font-size:11px;">' + (clip.duration_ms/1000).toFixed(1) + 's</span></div>' +
            (clip.source_id ? '<div class="clip-edit-row"><span class="clip-edit-label">Source</span><span style="font-size:11px;">' + escHtml(clip.source_id) + '</span></div>' : '') +
            (function() {
                var info = S.clipSampleRates[id];
                if (!info) return '';
                var rateKhz = (info.rate / 1000).toFixed(1);
                if (info.degraded) {
                    return '<div class="clip-edit-row"><span class="clip-edit-label">Sample</span><span style="color:#e57373;font-size:11px;">⚠ ' + rateKhz + 'kHz (np.interp)</span></div>';
                } else {
                    return '<div class="clip-edit-row"><span class="clip-edit-label">Sample</span><span style="color:#81c784;font-size:11px;">' + rateKhz + 'kHz ✓</span></div>';
                }
            })() +
            '<div class="clip-edit-row">' +
            '<span class="clip-edit-label">Type</span>' +
            '<select class="clip-edit-select" onchange="setMod(\\'' + id + '\\',\\'vocalization_type\\',this.value)">' +
            vocOptions + '</select></div>' +
            '<div class="clip-edit-row">' +
            '<span class="clip-edit-label">Quality</span>' +
            '<div class="quality-stars">' + stars + '</div></div>' +
            '<div class="clip-edit-row">' +
            '<span class="clip-edit-label">By</span>' +
            '<input class="clip-edit-input" value="' + escHtml(recordist) + '"' +
            ' onchange="setMod(\\'' + id + '\\',\\'recordist\\',this.value)"></div>' +
            (function() {
                var lic = (clip.license || '').toLowerCase();
                if (lic.includes('by-nc-nd')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#ff5252;font-size:11px;">NC-ND ⚠</span></div>';
                if (lic.includes('by-nc-sa')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#81c784;font-size:11px;">NC-SA</span></div>';
                if (lic.includes('by-sa')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#4db6ac;font-size:11px;">BY-SA</span></div>';
                if (lic.includes('publicdomain') || lic.includes('zero')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#4db6ac;font-size:11px;">CC0</span></div>';
                if (lic.includes('crown')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#81c784;font-size:11px;">DOC</span></div>';
                if (lic.includes('macaulay')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#ffa726;font-size:11px;">ML</span></div>';
                if (lic.includes('peter') || lic.includes('original')) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:#4db6ac;font-size:11px;">Own</span></div>';
                if (lic) return '<div class="clip-edit-row"><span class="clip-edit-label">Lic</span><span style="color:var(--text-dim);font-size:11px;">Other</span></div>';
                return '';
            })() +
            '<div class="clip-actions">' +
            '<button class="clip-act canon-btn' + (isCanonical ? ' is-canon' : '') + '"' +
            ' onclick="toggleCanonical(\\'' + id + '\\')" title="Canonical">&#11088;</button>' +
            '<button class="clip-act play-btn" data-path="' + clip.file_path + '" onclick="playClipAudio(\\'' + clip.file_path + '\\')" title="Play">' + (playingClipPath === clip.file_path ? '&#9632;' : '&#9654;') + '</button>' +
            '<button class="clip-act del-btn" onclick="markDelete(\\'' + id + '\\')" title="Delete">&#128465;</button>' +
            '</div></div>';
    }).join('');
}

function setMod(clipId, field, value) {
    if (!S.modifications[clipId]) S.modifications[clipId] = {};
    S.modifications[clipId][field] = value;
    updateUnsavedBadge();
    // Don't re-render entire list for inline edits
    const card = document.querySelector('[data-clip-id="' + clipId + '"]');
    if (card && !card.classList.contains('modified')) card.classList.add('modified');
}

function setQuality(clipId, score) {
    setMod(clipId, 'quality_score', score);
    renderClips();
}

function toggleCanonical(clipId) {
    // Clear all canonicals for this species (in modifications)
    S.clips.forEach(clip => {
        if (clip.clip_id !== clipId) {
            if (!S.modifications[clip.clip_id]) S.modifications[clip.clip_id] = {};
            S.modifications[clip.clip_id].canonical = false;
        }
    });

    // Toggle this one
    if (!S.modifications[clipId]) S.modifications[clipId] = {};
    const clip = S.clips.find(c => c.clip_id === clipId);
    const currentVal = S.modifications[clipId].canonical != null
        ? S.modifications[clipId].canonical
        : (clip ? clip.canonical : false);
    S.modifications[clipId].canonical = !currentVal;

    updateUnsavedBadge();
    renderClips();
}

function markDelete(clipId) {
    if (!confirm('Mark this clip for deletion? (Applied on Save All)')) return;
    S.deletions.add(clipId);
    // Also clear canonical if set
    if (!S.modifications[clipId]) S.modifications[clipId] = {};
    S.modifications[clipId].canonical = false;
    updateUnsavedBadge();
    renderClips();
}

// ═══════════════════════════════════════════════════════════════
// SAVE ALL
// ═══════════════════════════════════════════════════════════════

function hasUnsavedChanges() {
    return Object.keys(S.modifications).length > 0 || S.deletions.size > 0;
}

function updateUnsavedBadge() {
    const badge = document.getElementById('unsavedBadge');
    badge.style.display = hasUnsavedChanges() ? '' : 'none';
}

function saveAllChanges() {
    if (!hasUnsavedChanges()) {
        alert('No changes to save.');
        return;
    }

    const modCount = Object.keys(S.modifications).length;
    const delCount = S.deletions.size;

    const payload = {
        modifications: S.modifications,
        deletions: Array.from(S.deletions),
    };

    fetch('/api/save-changes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(result => {
        if (result.success) {
            showStatus('Saved and committed to git.', 'success');

            // Flash the save button green for confirmation
            var btn = document.getElementById('btnSave');
            var origText = btn.textContent;
            btn.textContent = '✅ Saved!';
            btn.style.background = '#2e7d32';
            setTimeout(function() {
                btn.textContent = origText;
                btn.style.background = '';
            }, 2000);

            // Reset state and reload
            S.modifications = {};
            S.deletions = new Set();
            updateUnsavedBadge();

            // Reload clips for current species
            if (S.selectedSpecies) {
                fetch('/api/clips?species=' + S.selectedSpecies.species_code)
                    .then(r => r.json())
                    .then(clips => {
                        S.clips = clips;
                        renderClips();
                        refreshStats();
                    });
            }
        } else {
            alert('Save failed: ' + (result.error || 'Unknown error'));
        }
    })
    .catch(err => alert('Save failed: ' + err.message));
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function refreshStats() {
    fetch('/api/init')
        .then(r => r.json())
        .then(data => {
            S.totalClips = data.total_clips;
            S.totalCanonical = data.total_canonical;
            updateStatsDisplay();
        });
}

function updateStatsDisplay() {
    document.getElementById('statClips').textContent = S.totalClips;
    document.getElementById('statCanonical').textContent = S.totalCanonical;
}

function showStatus(msg, type) {
    const area = document.getElementById('statusArea');
    area.innerHTML = '<div class="status-msg ' + type + '">' + msg + '</div>';
    if (type !== 'error') setTimeout(() => { area.innerHTML = ''; }, 5000);
}

function fmtTime(s) {
    if (!s && s !== 0) return '0:00';
    return Math.floor(s/60) + ':' + Math.floor(s%60).toString().padStart(2,'0');
}

function escHtml(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Resize handler
window.addEventListener('resize', () => {
    if (S.waveformData) { drawWaveform(); updateSelectionUI(); }
});

// Warn on unload with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
    }
});
</script>

</body>
</html>'''


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Clip Studio - Unified Audio Workflow')
    parser.add_argument('--batch', action='store_true', help='Launch batch mode UI')
    parser.add_argument('--species', help='Single species mode (not yet implemented)')
    parser.add_argument('--pack', help='Initial pack filter')
    parser.add_argument('--port', type=int, default=PORT, help='Server port')

    args = parser.parse_args()

    if args.pack:
        ClipStudioHandler.filter_pack = args.pack

    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", args.port), ClipStudioHandler) as httpd:
        print("=" * 60)
        print("Clip Studio - ChipNotes!")
        print("=" * 60)
        if args.pack:
            print(f"Pack Filter: {args.pack}")
        print(f"\nServer: http://localhost:{args.port}")
        print(f"\nFeatures:")
        print(f"  - Browse species by pack (EU/NZ/NA)")
        print(f"  - Search & download from Xeno-Canto")
        print(f"  - Extract clips with waveform editor")
        print(f"  - Review & curate metadata (batched)")
        print(f"  - Mark canonical clips (1 per species)")
        print(f"  - Delete rejected clips")
        print(f"  - Git commits on Save All")
        print(f"\nPress Ctrl+C to stop.")
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
