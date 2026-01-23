#!/usr/bin/env python3
"""
Clip Selector Tool for ChipNotes!

A web-based tool for selecting segments from longer source recordings.
Listen to full recordings, scrub through them, and mark 0.5-3 second
segments to extract for the game.

Usage:
    python scripts/clip_selector.py --input data/raw-nz/
    python scripts/clip_selector.py --input data/raw-nz/ --species TUIX,BELL

Workflow:
    1. Load raw recordings (MP3/WAV, any length)
    2. Display waveform, let you scrub and listen
    3. Select start point, adjust duration (0.5-3s)
    4. Extract selected segments
    5. Process through pipeline (normalize, spectrogram)
    6. Output to data/clips/ ready for review tool
"""

import argparse
import http.server
import json
import os
import socketserver
import subprocess
import tempfile
import threading
import time
import webbrowser
from pathlib import Path

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


class ClipSelectorHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for clip selector server"""

    input_dir = None
    species_filter = None

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == '/':
            self.send_html()
        elif self.path == '/api/recordings':
            self.send_recordings_list()
        elif self.path.startswith('/api/waveform/'):
            self.send_waveform(self.path[14:])
        elif self.path.startswith('/raw/'):
            self.serve_raw_audio(self.path[5:])
        elif self.path.startswith('/data/'):
            self.serve_file(self.path[1:])
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

    def send_recordings_list(self):
        """Send list of available recordings"""
        recordings = scan_recordings(self.input_dir, self.species_filter)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(recordings).encode())

    def send_waveform(self, filename):
        """Generate and send waveform data for visualization"""
        file_path = self.input_dir / filename
        if not file_path.exists():
            self.send_error(404)
            return

        try:
            audio, sr = sf.read(str(file_path))
            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=1)

            # Downsample for visualization (target ~1000 points)
            target_points = 1000
            if len(audio) > target_points:
                chunk_size = len(audio) // target_points
                # Get min/max for each chunk for better waveform
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
                'maxs': maxs
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        except Exception as e:
            self.send_error(500, str(e))

    def serve_raw_audio(self, filename):
        """Serve raw audio file"""
        file_path = self.input_dir / filename
        if not file_path.exists():
            self.send_error(404)
            return

        self.send_response(200)
        if file_path.suffix.lower() == '.mp3':
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
                input_dir=self.input_dir,
                filename=params['filename'],
                start_time=params['start_time'],
                duration=params['duration'],
                species_code=params['species_code'],
                common_name=params['common_name'],
                maori_name=params.get('maori_name'),
                vocalization_type=params.get('vocalization_type', 'call'),
                recordist=params.get('recordist', 'DOC NZ (Crown Copyright)')
            )

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())


def scan_recordings(input_dir: Path, species_filter: list = None) -> list:
    """Scan input directory for audio files"""
    recordings = []

    for ext in ['*.mp3', '*.wav', '*.MP3', '*.WAV']:
        for file_path in input_dir.glob(ext):
            filename = file_path.name

            # Try to get duration
            try:
                info = sf.info(str(file_path))
                duration = info.duration
            except:
                duration = 0

            recordings.append({
                'filename': filename,
                'duration': duration,
                'path': str(file_path.relative_to(input_dir))
            })

    # Sort by filename
    recordings.sort(key=lambda x: x['filename'])
    return recordings


def extract_clip(input_dir: Path, filename: str, start_time: float,
                 duration: float, species_code: str, common_name: str,
                 maori_name: str = None, vocalization_type: str = 'call',
                 recordist: str = 'DOC NZ (Crown Copyright)') -> dict:
    """
    Extract a clip segment from source recording.

    Returns dict with extracted clip info.
    """
    import hashlib

    # Validate inputs
    if duration < MIN_DURATION or duration > MAX_DURATION:
        raise ValueError(f"Duration must be {MIN_DURATION}-{MAX_DURATION}s, got {duration}")

    if len(species_code) != 4:
        raise ValueError(f"Species code must be 4 characters, got {species_code}")

    # Load audio
    input_path = input_dir / filename
    audio, sr = sf.read(str(input_path))

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

    # Generate clip ID
    source_hash = hashlib.md5(f"{filename}_{start_time}".encode()).hexdigest()[:8]
    clip_id = f"{species_code}_{source_hash}"

    # Output paths
    output_filename = f"{clip_id}.wav"
    output_path = PROJECT_ROOT / "data" / "clips" / output_filename
    spectrogram_path = PROJECT_ROOT / "data" / "spectrograms" / f"{clip_id}.png"

    # Save audio
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), segment, sr, subtype='PCM_16')

    # Generate spectrogram
    spectrogram_path.parent.mkdir(parents=True, exist_ok=True)
    generate_spectrogram(segment, sr, str(spectrogram_path))

    # Measure final loudness
    final_loudness = meter.integrated_loudness(segment)
    duration_ms = int(len(segment) / sr * 1000)

    # Create clip metadata
    clip_data = {
        'clip_id': clip_id,
        'species_code': species_code.upper(),
        'common_name': common_name,
        'maori_name': maori_name,
        'vocalization_type': vocalization_type,
        'duration_ms': duration_ms,
        'quality_score': 4,
        'loudness_lufs': round(final_loudness, 1),
        'source': 'doc',
        'source_id': f"DOC_{Path(filename).stem}",
        'file_path': f"data/clips/{output_filename}",
        'spectrogram_path': f"data/spectrograms/{clip_id}.png",
        'canonical': False,
        'rejected': False,
        'recordist': recordist
    }

    # Append to clips.json
    clips_json_path = PROJECT_ROOT / "data" / "clips.json"
    if clips_json_path.exists():
        with open(clips_json_path, 'r') as f:
            clips = json.load(f)
    else:
        clips = []

    # Check for duplicate clip_id
    existing_ids = {c['clip_id'] for c in clips}
    if clip_id in existing_ids:
        raise ValueError(f"Clip ID {clip_id} already exists")

    clips.append(clip_data)

    with open(clips_json_path, 'w') as f:
        json.dump(clips, f, indent=2)

    return {
        'success': True,
        'clip_id': clip_id,
        'file_path': str(output_path),
        'spectrogram_path': str(spectrogram_path),
        'duration_ms': duration_ms,
        'loudness_lufs': round(final_loudness, 1)
    }


def generate_spectrogram(audio: np.ndarray, sr: int, output_path: str):
    """Generate a spectrogram image"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from scipy import signal

        # Compute spectrogram
        nperseg = min(256, len(audio) // 4)
        f, t, Sxx = signal.spectrogram(audio, sr, nperseg=nperseg, noverlap=nperseg//2)

        # Convert to dB
        Sxx_db = 10 * np.log10(Sxx + 1e-10)

        # Create figure
        fig, ax = plt.subplots(figsize=(4, 1.5), dpi=100)
        ax.pcolormesh(t, f, Sxx_db, shading='gouraud', cmap='magma')
        ax.set_ylim(0, 10000)
        ax.axis('off')

        plt.tight_layout(pad=0)
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0,
                    facecolor='black', edgecolor='none')
        plt.close()

    except ImportError:
        # Fallback: create placeholder
        print(f"Warning: matplotlib/scipy not available, skipping spectrogram")


def generate_html() -> str:
    """Generate the clip selector UI"""
    return '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Clip Selector - ChipNotes!</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 { color: #fff; border-bottom: 2px solid #8b7ab8; padding-bottom: 10px; }
        h2 { color: #8b7ab8; margin-top: 20px; }

        .container { display: flex; gap: 20px; }
        .sidebar { width: 300px; flex-shrink: 0; }
        .main { flex: 1; }

        /* Recording list */
        .recording-list {
            background: #2a2a2a;
            border-radius: 8px;
            max-height: 70vh;
            overflow-y: auto;
        }
        .recording-item {
            padding: 12px 15px;
            border-bottom: 1px solid #3a3a3a;
            cursor: pointer;
            transition: background 0.2s;
        }
        .recording-item:hover { background: #3a3a3a; }
        .recording-item.active { background: #4a3a6a; border-left: 3px solid #8b7ab8; }
        .recording-name { font-weight: 600; margin-bottom: 4px; word-break: break-all; }
        .recording-duration { font-size: 12px; color: #999; }

        /* Waveform area */
        .waveform-container {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        #waveform {
            width: 100%;
            height: 150px;
            background: #1a1a1a;
            border-radius: 4px;
            position: relative;
            cursor: crosshair;
        }
        #waveformCanvas {
            width: 100%;
            height: 100%;
        }
        .selection-overlay {
            position: absolute;
            top: 0;
            height: 100%;
            background: rgba(139, 122, 184, 0.3);
            border-left: 2px solid #8b7ab8;
            border-right: 2px solid #8b7ab8;
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

        /* Controls */
        .controls {
            display: flex;
            gap: 15px;
            align-items: center;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        button {
            padding: 10px 20px;
            background: #8b7ab8;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        button:hover { background: #9b8ac8; }
        button:disabled { background: #555; cursor: not-allowed; }
        .btn-play { background: #4a7a4a; }
        .btn-play:hover { background: #5a8a5a; }
        .btn-extract { background: #7a4a4a; font-size: 16px; }
        .btn-extract:hover { background: #8a5a5a; }

        input, select {
            padding: 8px 12px;
            background: #3a3a3a;
            color: #e0e0e0;
            border: 1px solid #555;
            border-radius: 4px;
        }
        label { font-size: 14px; color: #999; }

        /* Time display */
        .time-display {
            font-family: monospace;
            font-size: 18px;
            color: #8b7ab8;
            min-width: 200px;
        }

        /* Metadata form */
        .metadata-form {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 20px;
        }
        .form-row {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            align-items: center;
        }
        .form-row label {
            min-width: 120px;
        }
        .form-row input, .form-row select {
            flex: 1;
        }

        /* Extracted clips */
        .extracted-list {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        .extracted-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: #333;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .extracted-item img {
            height: 40px;
            border-radius: 4px;
        }
        .extracted-info { flex: 1; }
        .extracted-id { font-weight: 600; color: #8b7ab8; }
        .extracted-meta { font-size: 12px; color: #999; }

        /* Instructions */
        .instructions {
            background: #2a3a2a;
            border: 1px solid #4a7a4a;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .instructions h3 { margin-top: 0; color: #6a9a6a; }
        .instructions ol { margin: 0; padding-left: 20px; }
        .instructions li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <h1>Clip Selector - ChipNotes!</h1>

    <div class="instructions">
        <h3>How to use:</h3>
        <ol>
            <li>Select a recording from the list on the left</li>
            <li>Click on the waveform to set the <strong>start point</strong></li>
            <li>Adjust duration (0.5-3 seconds) using the slider</li>
            <li>Use Play Selection to preview your clip</li>
            <li>Fill in metadata (species code, names, type)</li>
            <li>Click Extract Clip to save</li>
        </ol>
    </div>

    <div class="container">
        <div class="sidebar">
            <h2>Recordings</h2>
            <div class="recording-list" id="recordingList">
                Loading...
            </div>
        </div>

        <div class="main">
            <div class="waveform-container">
                <h2 id="currentFile">Select a recording</h2>
                <div id="waveform">
                    <canvas id="waveformCanvas"></canvas>
                    <div class="selection-overlay" id="selection" style="display:none;"></div>
                    <div class="playhead" id="playhead" style="display:none;"></div>
                </div>
                <div class="controls">
                    <button class="btn-play" onclick="playFull()" id="btnPlayFull" disabled>Play Full</button>
                    <button class="btn-play" onclick="playSelection()" id="btnPlaySel" disabled>Play Selection</button>
                    <button onclick="stopAudio()">Stop</button>
                    <div class="time-display" id="timeDisplay">--:-- / --:--</div>
                </div>
                <div class="controls">
                    <label>Start: <span id="startTimeDisplay">0.00s</span></label>
                    <label>Duration:</label>
                    <input type="range" id="durationSlider" min="0.5" max="3.0" step="0.1" value="2.5"
                           onchange="updateDuration()" oninput="updateDuration()">
                    <span id="durationDisplay">2.5s</span>
                </div>
            </div>

            <div class="metadata-form">
                <h2>Clip Metadata</h2>
                <div class="form-row">
                    <label>Species Code:</label>
                    <input type="text" id="speciesCode" maxlength="4" placeholder="e.g. TUIX"
                           style="text-transform: uppercase; width: 100px; flex: none;">
                    <label>Common Name:</label>
                    <input type="text" id="commonName" placeholder="e.g. Tui">
                </div>
                <div class="form-row">
                    <label>Maori Name:</label>
                    <input type="text" id="maoriName" placeholder="e.g. Tui (optional)">
                    <label>Type:</label>
                    <select id="vocType">
                        <option value="song">Song</option>
                        <option value="call" selected>Call</option>
                        <option value="alarm call">Alarm Call</option>
                        <option value="flight call">Flight Call</option>
                        <option value="contact call">Contact Call</option>
                        <option value="drum">Drum</option>
                    </select>
                </div>
                <div class="form-row">
                    <button class="btn-extract" onclick="extractClip()" id="btnExtract" disabled>
                        Extract Clip
                    </button>
                </div>
            </div>

            <div class="extracted-list" id="extractedList" style="display:none;">
                <h2>Extracted Clips</h2>
                <div id="extractedItems"></div>
            </div>
        </div>
    </div>

    <script>
        let recordings = [];
        let currentRecording = null;
        let waveformData = null;
        let audio = null;
        let startTime = 0;
        let duration = 2.5;
        let isPlaying = false;
        let animationFrame = null;

        // Load recordings list
        fetch('/api/recordings')
            .then(r => r.json())
            .then(data => {
                recordings = data;
                renderRecordingList();
            });

        function renderRecordingList() {
            const list = document.getElementById('recordingList');
            list.innerHTML = recordings.map((r, i) => `
                <div class="recording-item" onclick="selectRecording(${i})" id="rec-${i}">
                    <div class="recording-name">${r.filename}</div>
                    <div class="recording-duration">${formatTime(r.duration)}</div>
                </div>
            `).join('');
        }

        function selectRecording(index) {
            // Update UI
            document.querySelectorAll('.recording-item').forEach(el => el.classList.remove('active'));
            document.getElementById('rec-' + index).classList.add('active');

            currentRecording = recordings[index];
            document.getElementById('currentFile').textContent = currentRecording.filename;

            // Reset selection
            startTime = 0;
            updateSelectionUI();

            // Load waveform
            fetch('/api/waveform/' + encodeURIComponent(currentRecording.filename))
                .then(r => r.json())
                .then(data => {
                    waveformData = data;
                    drawWaveform();
                    document.getElementById('btnPlayFull').disabled = false;
                    document.getElementById('btnPlaySel').disabled = false;
                    document.getElementById('btnExtract').disabled = false;
                });

            // Pre-fill species code from filename if possible
            const match = currentRecording.filename.match(/^([a-z]+)/i);
            if (match) {
                // Try to guess from filename
                const name = match[1].toLowerCase();
                const guesses = {
                    'tui': ['TUIX', 'Tui', 'Tui'],
                    'bellbird': ['BELL', 'Bellbird', 'Korimako'],
                    'morepork': ['MORU', 'Morepork', 'Ruru'],
                    'fantail': ['NIFA', 'Fantail', 'Piwakawaka'],
                    'kea': ['KEAX', 'Kea', ''],
                    'kaka': ['KAKA', 'Kakapo', 'Kakapo'],
                    'kokako': ['KOKA', 'Kokako', 'Kokako'],
                    'kereru': ['KERE', 'Kereru', 'Kereru'],
                    'silvereye': ['SILV', 'Silvereye', 'Tauhou'],
                    'grey': ['GRWA', 'Grey Warbler', 'Riroriro'],
                };
                if (guesses[name]) {
                    document.getElementById('speciesCode').value = guesses[name][0];
                    document.getElementById('commonName').value = guesses[name][1];
                    document.getElementById('maoriName').value = guesses[name][2];
                }
            }
        }

        function drawWaveform() {
            if (!waveformData) return;

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

            ctx.strokeStyle = '#8b7ab8';
            ctx.lineWidth = 1;

            const mins = waveformData.mins;
            const maxs = waveformData.maxs;
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

            // Draw time markers
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            const totalDuration = waveformData.duration;
            for (let t = 0; t <= totalDuration; t += 10) {
                const x = (t / totalDuration) * width;
                ctx.fillRect(x, 0, 1, 5);
                ctx.fillText(t + 's', x + 2, 12);
            }
        }

        // Click on waveform to set start time
        document.getElementById('waveform').addEventListener('click', function(e) {
            if (!waveformData) return;

            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;

            startTime = ratio * waveformData.duration;

            // Clamp so selection doesn't go past end
            if (startTime + duration > waveformData.duration) {
                startTime = waveformData.duration - duration;
            }
            if (startTime < 0) startTime = 0;

            updateSelectionUI();
        });

        function updateDuration() {
            duration = parseFloat(document.getElementById('durationSlider').value);
            document.getElementById('durationDisplay').textContent = duration.toFixed(1) + 's';

            // Adjust start if needed
            if (waveformData && startTime + duration > waveformData.duration) {
                startTime = Math.max(0, waveformData.duration - duration);
            }

            updateSelectionUI();
        }

        function updateSelectionUI() {
            const selection = document.getElementById('selection');
            const waveformEl = document.getElementById('waveform');

            if (!waveformData) {
                selection.style.display = 'none';
                return;
            }

            const totalDuration = waveformData.duration;
            const startPercent = (startTime / totalDuration) * 100;
            const widthPercent = (duration / totalDuration) * 100;

            selection.style.display = 'block';
            selection.style.left = startPercent + '%';
            selection.style.width = widthPercent + '%';

            document.getElementById('startTimeDisplay').textContent = startTime.toFixed(2) + 's';
            document.getElementById('timeDisplay').textContent =
                formatTime(startTime) + ' - ' + formatTime(startTime + duration) +
                ' / ' + formatTime(totalDuration);
        }

        function playFull() {
            if (!currentRecording) return;
            stopAudio();

            audio = new Audio('/raw/' + encodeURIComponent(currentRecording.filename));
            audio.play();
            isPlaying = true;
            updatePlayhead();

            audio.onended = () => { isPlaying = false; };
        }

        function playSelection() {
            if (!currentRecording) return;
            stopAudio();

            audio = new Audio('/raw/' + encodeURIComponent(currentRecording.filename));
            audio.currentTime = startTime;
            audio.play();
            isPlaying = true;
            updatePlayhead();

            // Stop at end of selection
            const checkEnd = () => {
                if (audio && audio.currentTime >= startTime + duration) {
                    stopAudio();
                } else if (isPlaying) {
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
            isPlaying = false;
            document.getElementById('playhead').style.display = 'none';
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        }

        function updatePlayhead() {
            if (!isPlaying || !audio || !waveformData) return;

            const playhead = document.getElementById('playhead');
            const percent = (audio.currentTime / waveformData.duration) * 100;
            playhead.style.display = 'block';
            playhead.style.left = percent + '%';

            animationFrame = requestAnimationFrame(updatePlayhead);
        }

        function extractClip() {
            const speciesCode = document.getElementById('speciesCode').value.toUpperCase().trim();
            const commonName = document.getElementById('commonName').value.trim();
            const maoriName = document.getElementById('maoriName').value.trim() || null;
            const vocType = document.getElementById('vocType').value;

            if (!speciesCode || speciesCode.length !== 4) {
                alert('Please enter a valid 4-letter species code');
                return;
            }
            if (!commonName) {
                alert('Please enter a common name');
                return;
            }
            if (!currentRecording) {
                alert('Please select a recording');
                return;
            }

            document.getElementById('btnExtract').disabled = true;
            document.getElementById('btnExtract').textContent = 'Extracting...';

            fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentRecording.filename,
                    start_time: startTime,
                    duration: duration,
                    species_code: speciesCode,
                    common_name: commonName,
                    maori_name: maoriName,
                    vocalization_type: vocType
                })
            })
            .then(r => r.json())
            .then(result => {
                document.getElementById('btnExtract').disabled = false;
                document.getElementById('btnExtract').textContent = 'Extract Clip';

                if (result.success) {
                    addExtractedClip(result);
                    alert('Clip extracted: ' + result.clip_id + '\\nDuration: ' + result.duration_ms + 'ms\\nLoudness: ' + result.loudness_lufs + ' LUFS');
                } else {
                    alert('Error: ' + (result.error || 'Unknown error'));
                }
            })
            .catch(err => {
                document.getElementById('btnExtract').disabled = false;
                document.getElementById('btnExtract').textContent = 'Extract Clip';
                alert('Error: ' + err.message);
            });
        }

        function addExtractedClip(result) {
            const list = document.getElementById('extractedList');
            const items = document.getElementById('extractedItems');

            list.style.display = 'block';

            const item = document.createElement('div');
            item.className = 'extracted-item';
            item.innerHTML = `
                <img src="/${result.spectrogram_path || 'data/spectrograms/' + result.clip_id + '.png'}"
                     onerror="this.style.display='none'">
                <div class="extracted-info">
                    <div class="extracted-id">${result.clip_id}</div>
                    <div class="extracted-meta">${result.duration_ms}ms | ${result.loudness_lufs} LUFS</div>
                </div>
                <button onclick="playExtracted('${result.file_path}')">Play</button>
            `;
            items.insertBefore(item, items.firstChild);
        }

        function playExtracted(path) {
            stopAudio();
            audio = new Audio('/' + path);
            audio.play();
        }

        function formatTime(seconds) {
            if (!seconds && seconds !== 0) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            if (waveformData) drawWaveform();
            updateSelectionUI();
        });
    </script>
</body>
</html>'''


def main():
    parser = argparse.ArgumentParser(description='Clip Selector for ChipNotes!')
    parser.add_argument('--input', required=True, help='Directory containing source recordings')
    parser.add_argument('--species', help='Filter by species codes (comma-separated)')
    parser.add_argument('--port', type=int, default=PORT, help='Server port')

    args = parser.parse_args()

    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"ERROR: Input directory does not exist: {input_dir}")
        return 1

    # Set handler class variables
    ClipSelectorHandler.input_dir = input_dir
    ClipSelectorHandler.species_filter = args.species.split(',') if args.species else None

    # Start server
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", args.port), ClipSelectorHandler) as httpd:
        print("=" * 70)
        print("Clip Selector - ChipNotes!")
        print("=" * 70)
        print(f"Input directory: {input_dir}")
        print(f"Server: http://localhost:{args.port}")
        print()
        print("Select segments from source recordings to extract as game clips.")
        print("Press Ctrl+C to stop.")
        print("=" * 70)

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
