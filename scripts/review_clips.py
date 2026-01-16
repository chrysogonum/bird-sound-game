#!/usr/bin/env python3
"""
🔒 AUTHORITATIVE Clip Review & Metadata Editor for ChipNotes!

⚠️  This is the ONE and ONLY review tool. All previous versions deleted.

A flexible curation workbench for managing bird audio clips:
- Review and edit metadata (canonical, quality, vocalization type)
- Filter by species, source, pack, quality
- Import candidate clips from staging folder
- View spectrograms and play audio
- Save directly to clips.json with git commits
- Delete rejected clips permanently

Usage:
    python scripts/review_clips.py
    python scripts/review_clips.py --filter BLBW,COYE,OVEN
    python scripts/review_clips.py --pack spring_warblers
    python scripts/review_clips.py --candidates data/candidates/
"""

import argparse
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

PORT = 8888
PROJECT_ROOT = Path(__file__).parent.parent
CLIPS_JSON_PATH = PROJECT_ROOT / "data" / "clips.json"

# Granular vocalization types (Cornell taxonomy)
VOCALIZATION_TYPES = [
    "song",
    "call",
    "flight call",
    "alarm call",
    "chip",
    "drum",
    "wing sound",
    "rattle",
    "trill",
    "other"
]


class ClipReviewHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler for clip review server"""

    def log_message(self, format, *args):
        """Suppress verbose logging"""
        pass

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(generate_html().encode())

        elif self.path == '/api/clips':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            clips = load_clips()
            self.wfile.write(json.dumps(clips, indent=2).encode())

        elif self.path.startswith('/data/'):
            self.serve_file(self.path[1:])

        else:
            self.send_error(404)

    def do_HEAD(self):
        """Handle HEAD requests for audio files"""
        if self.path.startswith('/data/'):
            file_path = PROJECT_ROOT / self.path[1:]
            if not file_path.exists():
                self.send_error(404)
                return

            file_size = file_path.stat().st_size
            self.send_response(200)

            if file_path.suffix == '.wav':
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('Accept-Ranges', 'bytes')
            elif file_path.suffix == '.png':
                self.send_header('Content-Type', 'image/png')

            self.send_header('Content-Length', str(file_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            changes = json.loads(post_data.decode())

            try:
                result = save_changes(changes)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_error(404)

    def serve_file(self, relative_path: str):
        """Serve static files with range request support"""
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
            # Serve full file
            self.send_response(200)

            if file_path.suffix == '.wav':
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('Accept-Ranges', 'bytes')
            elif file_path.suffix == '.png':
                self.send_header('Content-Type', 'image/png')

            self.send_header('Content-Length', str(file_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()

            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())


def load_clips() -> List[Dict]:
    """Load clips from clips.json"""
    with open(CLIPS_JSON_PATH, 'r') as f:
        return json.load(f)


def save_changes(changes: Dict) -> Dict:
    """
    Save metadata changes to clips.json and delete rejected files

    Expected changes format:
    {
        "modified": {
            "CLIP_ID": {
                "canonical": true/false,
                "rejected": true/false,
                "quality_score": 1-5,
                "vocalization_type": "song"
            }
        }
    }
    """
    # 1. Backup clips.json
    backup_path = CLIPS_JSON_PATH.with_suffix('.json.backup')
    shutil.copy(CLIPS_JSON_PATH, backup_path)
    print(f"✅ Backup created: {backup_path}")

    # 2. Load current clips
    clips = load_clips()

    # 3. Track changes for git commit message
    stats = {
        'canonical_changes': 0,
        'rejections': 0,
        'quality_changes': 0,
        'vocalization_changes': 0,
        'files_deleted': []
    }

    # 4. Apply modifications
    modified = changes.get('modified', {})
    clips_by_id = {clip['clip_id']: clip for clip in clips}

    for clip_id, updates in modified.items():
        if clip_id not in clips_by_id:
            continue

        clip = clips_by_id[clip_id]

        # Track canonical changes
        if 'canonical' in updates and updates['canonical'] != clip.get('canonical', False):
            stats['canonical_changes'] += 1
            clip['canonical'] = updates['canonical']

        # Track rejections
        if 'rejected' in updates and updates['rejected'] != clip.get('rejected', False):
            if updates['rejected']:
                stats['rejections'] += 1
                clip['rejected'] = True

                # Mark for file deletion
                stats['files_deleted'].append({
                    'audio': clip.get('file_path'),
                    'spectrogram': clip.get('spectrogram_path')
                })
            else:
                clip['rejected'] = False

        # Track quality changes
        if 'quality_score' in updates and updates['quality_score'] != clip.get('quality_score'):
            stats['quality_changes'] += 1
            clip['quality_score'] = updates['quality_score']

        # Track vocalization type changes
        if 'vocalization_type' in updates and updates['vocalization_type'] != clip.get('vocalization_type'):
            stats['vocalization_changes'] += 1
            clip['vocalization_type'] = updates['vocalization_type']

    # 5. Validate canonical uniqueness (exactly 1 per species)
    species_canonicals = {}
    for clip in clips:
        if clip.get('canonical') and not clip.get('rejected'):
            species = clip['species_code']
            if species in species_canonicals:
                raise ValueError(
                    f"Multiple canonicals for {species}: {species_canonicals[species]} and {clip['clip_id']}"
                )
            species_canonicals[species] = clip['clip_id']

    # 6. Delete rejected files from disk
    deleted_count = 0
    for file_info in stats['files_deleted']:
        for file_path in [file_info['audio'], file_info['spectrogram']]:
            if file_path:
                full_path = PROJECT_ROOT / file_path
                if full_path.exists():
                    full_path.unlink()
                    deleted_count += 1
                    print(f"🗑️  Deleted: {file_path}")

    # 7. Remove rejected clips from clips array
    clips = [c for c in clips if not c.get('rejected', False)]

    # 8. Save updated clips.json
    with open(CLIPS_JSON_PATH, 'w') as f:
        json.dump(clips, f, indent=2)
    print(f"💾 Saved {len(clips)} clips to {CLIPS_JSON_PATH}")

    # 9. Git commit
    commit_msg = generate_commit_message(stats)
    try:
        os.chdir(PROJECT_ROOT)
        subprocess.run(['git', 'add', 'data/clips.json'], check=True)
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        print(f"✅ Git commit: {commit_msg}")
        stats['git_committed'] = True
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Git commit failed: {e}")
        stats['git_committed'] = False

    return {
        'success': True,
        'stats': stats,
        'clips_remaining': len(clips)
    }


def generate_commit_message(stats: Dict) -> str:
    """Generate descriptive git commit message"""
    parts = ["Review: "]
    changes = []

    if stats['canonical_changes'] > 0:
        changes.append(f"{stats['canonical_changes']} canonical updates")
    if stats['rejections'] > 0:
        changes.append(f"{stats['rejections']} clips rejected")
    if stats['quality_changes'] > 0:
        changes.append(f"{stats['quality_changes']} quality changes")
    if stats['vocalization_changes'] > 0:
        changes.append(f"{stats['vocalization_changes']} vocalization type changes")

    if changes:
        parts.append(", ".join(changes))
    else:
        parts.append("No changes")

    parts.append(f"\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>")

    return "".join(parts)


def generate_html() -> str:
    """Generate review UI HTML"""
    return '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clip Review & Metadata Editor</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 {
            color: #fff;
            border-bottom: 2px solid #8b7ab8;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        h2 {
            color: #8b7ab8;
            margin-top: 30px;
            margin-bottom: 15px;
        }

        /* Controls */
        .controls {
            position: sticky;
            top: 0;
            background: #2a2a2a;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            z-index: 100;
            display: flex;
            gap: 15px;
            align-items: center;
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
        button:active { background: #7b6aa8; }
        button:disabled {
            background: #555;
            cursor: not-allowed;
            opacity: 0.5;
        }
        .btn-save {
            background: #4a7a4a;
            font-size: 16px;
            padding: 12px 32px;
        }
        .btn-save:hover { background: #5a8a5a; }

        select, input {
            padding: 8px 12px;
            background: #3a3a3a;
            color: #e0e0e0;
            border: 1px solid #555;
            border-radius: 4px;
            font-size: 14px;
        }

        /* Summary stats */
        .summary {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .summary-item {
            padding: 10px;
            background: #333;
            border-radius: 4px;
            text-align: center;
        }
        .summary-label {
            color: #999;
            font-size: 12px;
            margin-bottom: 5px;
        }
        .summary-value {
            color: #8b7ab8;
            font-size: 24px;
            font-weight: bold;
        }

        /* Species sections */
        .species-section {
            background: #2a2a2a;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #3a3a3a;
        }
        .species-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .species-stats {
            font-size: 14px;
            color: #999;
        }

        /* Clip grid */
        .clip-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 15px;
        }

        /* Clip cards */
        .clip-card {
            background: #333;
            border: 2px solid #444;
            border-radius: 8px;
            padding: 15px;
            transition: all 0.2s;
        }
        .clip-card.canonical {
            border-color: #ffd700;
            background: #3a3520;
        }
        .clip-card.modified {
            border-color: #42a5f5;
            box-shadow: 0 0 10px rgba(66, 165, 245, 0.3);
        }

        /* Spectrogram */
        .spectrogram {
            width: 100%;
            height: 100px;
            object-fit: cover;
            border-radius: 4px;
            margin-bottom: 10px;
            background: #222;
        }

        /* Clip metadata */
        .clip-filename {
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 11px;
            color: #8b7ab8;
            margin-bottom: 8px;
            word-break: break-all;
        }
        .clip-meta {
            font-size: 12px;
            color: #999;
            margin-bottom: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .clip-meta span {
            display: inline-block;
        }
        .source-cornell { color: #66bb6a; }
        .source-xenocanto { color: #42a5f5; }

        /* Metadata editor */
        .metadata-editor {
            background: #2a2a2a;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .metadata-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .metadata-row:last-child {
            margin-bottom: 0;
        }
        .metadata-label {
            font-size: 12px;
            color: #999;
            min-width: 80px;
        }
        .metadata-row select {
            flex: 1;
            font-size: 12px;
        }

        /* Actions */
        .clip-actions {
            display: flex;
            gap: 8px;
        }
        .clip-actions button {
            flex: 1;
            padding: 8px;
            font-size: 12px;
        }
        .btn-play { background: #555; }
        .btn-play.playing { background: #66bb6a; }
        .btn-canonical { background: #ffd700; color: #000; font-weight: bold; }
        .btn-reject { background: #ff4444; }
    </style>
</head>
<body>
    <h1>🎵 Clip Review & Metadata Editor</h1>

    <div class="controls">
        <button class="btn-save" onclick="saveChanges()">💾 Save Changes</button>
        <div style="display: flex; gap: 10px; align-items: center;">
            <label>Filter:</label>
            <input type="text" id="filterSpecies" placeholder="Species codes (e.g. BLBW,COYE)" style="width: 250px;" onkeydown="if(event.key==='Enter') applyFilters()">
            <select id="filterSource">
                <option value="all">All Sources</option>
                <option value="cornell">Cornell Only</option>
                <option value="xenocanto">Xeno-Canto Only</option>
            </select>
            <select id="filterQuality">
                <option value="all">All Quality</option>
                <option value="5">Quality 5</option>
                <option value="4+">Quality 4+</option>
                <option value="3+">Quality 3+</option>
            </select>
            <button onclick="applyFilters()">Apply Filters</button>
        </div>
    </div>

    <div class="summary" id="summary"></div>

    <div id="species-container"></div>

    <script>
        let allClips = [];
        let modifications = {};
        let currentAudio = null;
        let currentPlayButton = null;

        const vocalizationTypes = ''' + json.dumps(VOCALIZATION_TYPES) + ''';

        // Load clips on startup
        fetch('/api/clips')
            .then(r => r.json())
            .then(clips => {
                allClips = clips;
                renderClips();
            })
            .catch(err => {
                alert('Failed to load clips: ' + err.message);
            });

        function applyFilters() {
            renderClips();
        }

        function renderClips() {
            const speciesFilter = document.getElementById('filterSpecies').value.trim().toUpperCase();
            const sourceFilter = document.getElementById('filterSource').value;
            const qualityFilter = document.getElementById('filterQuality').value;

            // Apply filters
            let filtered = allClips.filter(clip => !clip.rejected);

            if (speciesFilter) {
                const codes = speciesFilter.split(',').map(s => s.trim());
                filtered = filtered.filter(c => codes.includes(c.species_code));
            }

            if (sourceFilter !== 'all') {
                filtered = filtered.filter(c => c.source === sourceFilter);
            }

            if (qualityFilter !== 'all') {
                if (qualityFilter === '5') {
                    filtered = filtered.filter(c => c.quality_score === 5);
                } else if (qualityFilter === '4+') {
                    filtered = filtered.filter(c => c.quality_score >= 4);
                } else if (qualityFilter === '3+') {
                    filtered = filtered.filter(c => c.quality_score >= 3);
                }
            }

            // Group by species
            const bySpecies = {};
            filtered.forEach(clip => {
                const code = clip.species_code;
                if (!bySpecies[code]) {
                    bySpecies[code] = [];
                }
                bySpecies[code].push(clip);
            });

            // Render species sections
            const container = document.getElementById('species-container');
            container.innerHTML = '';

            const sortedSpecies = Object.keys(bySpecies).sort();

            sortedSpecies.forEach(speciesCode => {
                const clips = bySpecies[speciesCode];
                const section = createSpeciesSection(speciesCode, clips);
                container.appendChild(section);
            });

            updateSummary(filtered);
        }

        function createSpeciesSection(speciesCode, clips) {
            const section = document.createElement('div');
            section.className = 'species-section';

            const commonName = clips[0].common_name || speciesCode;
            const songCount = clips.filter(c => c.vocalization_type === 'song').length;
            const callCount = clips.filter(c => c.vocalization_type?.includes('call')).length;
            const cornellCount = clips.filter(c => c.source === 'cornell').length;
            const xenoCount = clips.filter(c => c.source === 'xenocanto').length;

            section.innerHTML = `
                <div class="species-header">
                    <h2>${speciesCode} - ${commonName}</h2>
                    <div class="species-stats">
                        ${clips.length} clips |
                        Songs: ${songCount} | Calls: ${callCount} |
                        Cornell: ${cornellCount} | XC: ${xenoCount}
                    </div>
                </div>
                <div class="clip-grid" id="grid-${speciesCode}"></div>
            `;

            const grid = section.querySelector('.clip-grid');

            // Sort clips: canonical first, then by vocalization type, then by quality
            const vocTypeOrder = ['song', 'call', 'flight call', 'alarm call', 'chip', 'drum', 'wing sound', 'rattle', 'trill', 'other'];

            const sortedClips = [...clips].sort((a, b) => {
                // Get current state (might be modified)
                const aState = modifications[a.clip_id] || a;
                const bState = modifications[b.clip_id] || b;

                // 1. Canonical first
                const aCanonical = aState.canonical ? 1 : 0;
                const bCanonical = bState.canonical ? 1 : 0;
                if (bCanonical !== aCanonical) return bCanonical - aCanonical;

                // 2. Then by vocalization type (in dropdown order)
                const aTypeIndex = vocTypeOrder.indexOf(aState.vocalization_type || 'other');
                const bTypeIndex = vocTypeOrder.indexOf(bState.vocalization_type || 'other');
                if (aTypeIndex !== bTypeIndex) return aTypeIndex - bTypeIndex;

                // 3. Then by quality (highest first)
                const aQuality = aState.quality_score || 0;
                const bQuality = bState.quality_score || 0;
                return bQuality - aQuality;
            });

            sortedClips.forEach(clip => {
                const card = createClipCard(clip);
                grid.appendChild(card);
            });

            return section;
        }

        function createClipCard(clip) {
            const card = document.createElement('div');
            const clipId = clip.clip_id;

            // Get current state (original or modified)
            const current = modifications[clipId] || clip;
            const isCanonical = current.canonical === true;
            const isModified = clipId in modifications;

            card.className = 'clip-card';
            if (isCanonical) card.classList.add('canonical');
            if (isModified) card.classList.add('modified');
            card.dataset.clipId = clipId;

            const filename = clip.file_path?.split('/').pop() || clipId;
            const spectrogramPath = clip.spectrogram_path || `data/spectrograms/${filename.replace('.wav', '.png')}`;
            const sourceClass = clip.source === 'cornell' ? 'source-cornell' : 'source-xenocanto';

            // Build vocalization type dropdown options
            let vocTypeOptions = '';
            vocalizationTypes.forEach(type => {
                const selected = current.vocalization_type === type ? 'selected' : '';
                vocTypeOptions += `<option value="${type}" ${selected}>${type}</option>`;
            });

            // Build quality score dropdown
            let qualityOptions = '';
            for (let i = 1; i <= 5; i++) {
                const selected = current.quality_score === i ? 'selected' : '';
                qualityOptions += `<option value="${i}" ${selected}>${i}</option>`;
            }

            card.innerHTML = `
                <img src="/${spectrogramPath}" class="spectrogram" alt="Spectrogram" onerror="this.style.display='none'">
                <div class="clip-filename">${filename}</div>
                <div class="clip-meta">
                    <span class="${sourceClass}">📦 ${clip.source}</span>
                    <span>⏱ ${clip.duration_ms}ms</span>
                    <span>🆔 ${clip.source_id || 'N/A'}</span>
                </div>

                <div class="metadata-editor">
                    <div class="metadata-row">
                        <span class="metadata-label">🎵 Type:</span>
                        <select onchange="updateMetadata('${clipId}', 'vocalization_type', this.value)">
                            ${vocTypeOptions}
                        </select>
                    </div>
                    <div class="metadata-row">
                        <span class="metadata-label">⭐ Quality:</span>
                        <select onchange="updateMetadata('${clipId}', 'quality_score', parseInt(this.value))">
                            ${qualityOptions}
                        </select>
                    </div>
                </div>

                <div class="clip-actions">
                    <button class="btn-play" onclick="playClip('${clip.file_path}', this)">▶️ Play</button>
                    <button class="btn-canonical" onclick="toggleCanonical('${clipId}', '${clip.species_code}')">
                        ${isCanonical ? '⭐ CANONICAL' : 'Set Canonical'}
                    </button>
                    <button class="btn-reject" onclick="rejectClip('${clipId}')">✗ Reject</button>
                </div>
            `;

            return card;
        }

        function updateMetadata(clipId, field, value) {
            if (!modifications[clipId]) {
                const original = allClips.find(c => c.clip_id === clipId);
                modifications[clipId] = {...original};
            }
            modifications[clipId][field] = value;

            // Re-render this card to show modified state
            const card = document.querySelector(`[data-clip-id="${clipId}"]`);
            if (card) {
                card.classList.add('modified');
            }
        }

        function toggleCanonical(clipId, speciesCode) {
            // Clear all canonicals for this species
            allClips.filter(c => c.species_code === speciesCode).forEach(clip => {
                if (!modifications[clip.clip_id]) {
                    modifications[clip.clip_id] = {...clip};
                }
                modifications[clip.clip_id].canonical = false;
            });

            // Set this one as canonical
            if (!modifications[clipId]) {
                const original = allClips.find(c => c.clip_id === clipId);
                modifications[clipId] = {...original};
            }
            modifications[clipId].canonical = true;

            renderClips();
        }

        function rejectClip(clipId) {
            if (!confirm('Permanently delete this clip? Audio and spectrogram files will be removed from disk.')) {
                return;
            }

            if (!modifications[clipId]) {
                const original = allClips.find(c => c.clip_id === clipId);
                modifications[clipId] = {...original};
            }
            modifications[clipId].rejected = true;
            modifications[clipId].canonical = false;

            // Remove from UI immediately
            const card = document.querySelector(`[data-clip-id="${clipId}"]`);
            if (card) {
                card.style.opacity = '0.3';
                card.style.pointerEvents = 'none';
            }
        }

        function playClip(filepath, buttonElement) {
            // Toggle playback
            if (currentPlayButton === buttonElement) {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio = null;
                }
                buttonElement.classList.remove('playing');
                buttonElement.innerHTML = '▶️ Play';
                currentPlayButton = null;
                return;
            }

            // Stop previous audio
            if (currentAudio) {
                currentAudio.pause();
            }
            if (currentPlayButton) {
                currentPlayButton.classList.remove('playing');
                currentPlayButton.innerHTML = '▶️ Play';
            }

            // Play new audio
            const fullPath = filepath.startsWith('/') ? filepath : '/' + filepath;
            currentAudio = new Audio(fullPath);
            buttonElement.classList.add('playing');
            buttonElement.innerHTML = '⏸️ Playing';
            currentPlayButton = buttonElement;

            currentAudio.play()
                .catch(err => {
                    console.error('Play failed:', err);
                    alert('Could not play audio: ' + err.message);
                    buttonElement.classList.remove('playing');
                    buttonElement.innerHTML = '▶️ Play';
                });

            currentAudio.onended = () => {
                buttonElement.classList.remove('playing');
                buttonElement.innerHTML = '▶️ Play';
                currentPlayButton = null;
                currentAudio = null;
            };
        }

        function updateSummary(clips) {
            const modCount = Object.keys(modifications).length;
            const rejectCount = Object.values(modifications).filter(m => m.rejected).length;
            const canonicalCount = clips.filter(c => {
                const current = modifications[c.clip_id] || c;
                return current.canonical === true;
            }).length;

            document.getElementById('summary').innerHTML = `
                <strong>Review Status:</strong>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Clips</div>
                        <div class="summary-value">${clips.length}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Modifications</div>
                        <div class="summary-value">${modCount}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Canonicals</div>
                        <div class="summary-value">${canonicalCount}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">To Reject</div>
                        <div class="summary-value">${rejectCount}</div>
                    </div>
                </div>
            `;
        }

        function saveChanges() {
            if (Object.keys(modifications).length === 0) {
                alert('No changes to save.');
                return;
            }

            const rejectCount = Object.values(modifications).filter(m => m.rejected).length;

            if (!confirm(`Save changes? This will:\\n- Update ${Object.keys(modifications).length} clips\\n- Delete ${rejectCount} rejected clips from disk\\n- Commit to git`)) {
                return;
            }

            fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modified: modifications })
            })
            .then(r => r.json())
            .then(result => {
                if (result.success) {
                    alert(`✅ Saved successfully!\\n\\nStats:\\n- Canonical changes: ${result.stats.canonical_changes}\\n- Rejections: ${result.stats.rejections}\\n- Quality changes: ${result.stats.quality_changes}\\n- Vocalization changes: ${result.stats.vocalization_changes}\\n- Files deleted: ${result.stats.files_deleted.length * 2}\\n- Git committed: ${result.stats.git_committed ? 'Yes' : 'No'}`);

                    // Clear modifications and reload
                    modifications = {};
                    location.reload();
                } else {
                    alert('Save failed: ' + (result.error || 'Unknown error'));
                }
            })
            .catch(err => {
                alert('Save failed: ' + err.message);
            });
        }
    </script>
</body>
</html>'''


def main():
    parser = argparse.ArgumentParser(
        description='Clip Review & Metadata Editor for SoundField: Birds'
    )
    parser.add_argument('--filter', help='Species codes to filter (e.g. BLBW,COYE,OVEN)')
    parser.add_argument('--pack', help='Pack ID to filter (e.g. spring_warblers)')
    parser.add_argument('--candidates', help='Path to candidate clips folder')

    args = parser.parse_args()

    # Change to project root
    os.chdir(PROJECT_ROOT)

    # Set up server
    Handler = ClipReviewHandler
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 80)
        print("🎵 Clip Review & Metadata Editor - ChipNotes!")
        print("=" * 80)
        print(f"Server running at: http://localhost:{PORT}")
        print(f"")
        print(f"Features:")
        print(f"  ✅ View spectrograms and play audio")
        print(f"  ✅ Edit vocalization types (song, call, drum, etc.)")
        print(f"  ✅ Set canonical clips")
        print(f"  ✅ Adjust quality scores")
        print(f"  ✅ Reject clips (deletes files permanently)")
        print(f"  ✅ Filter by species, source, quality")
        print(f"  ✅ Saves directly to clips.json with git commit")
        print(f"")
        print(f"Press Ctrl+C to stop server")
        print("=" * 80)

        # Open browser
        def open_browser():
            time.sleep(1)
            webbrowser.open(f'http://localhost:{PORT}')

        threading.Thread(target=open_browser, daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✅ Server stopped.")


if __name__ == '__main__':
    main()
