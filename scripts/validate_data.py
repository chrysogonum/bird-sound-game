#!/usr/bin/env python3
"""
Data Validation Script for ChipNotes!

Validates clips.json integrity and file existence before deployment.
Run this before deploying to catch any data issues.

Usage:
    python3 scripts/validate_data.py
"""

import json
import os
import sys
from pathlib import Path
import subprocess


def validate_clips_json():
    """Validate clips.json structure and references."""
    print('=== ChipNotes Data Validation ===')
    print()

    # Load clips.json
    with open('data/clips.json', 'r') as f:
        clips = json.load(f)

    print(f'Total clips in clips.json: {len(clips)}')
    print()

    issues = []

    # 1. Check for duplicate clip_ids
    print('1. Checking for duplicate clip_ids...')
    clip_ids = [c['clip_id'] for c in clips]
    duplicates = [cid for cid in set(clip_ids) if clip_ids.count(cid) > 1]
    if duplicates:
        print(f'  ❌ FOUND {len(duplicates)} DUPLICATES:')
        for dup in duplicates:
            print(f'     {dup}')
        issues.append(f'{len(duplicates)} duplicate clip_ids')
    else:
        print('  ✅ No duplicate clip_ids')
    print()

    # 2. Check for missing audio files
    print('2. Checking audio files...')
    missing_audio = []
    for clip in clips:
        if clip.get('rejected'):
            continue
        audio_path = clip.get('file_path', '')
        if not audio_path:
            missing_audio.append((clip['clip_id'], 'NO PATH'))
        elif not os.path.exists(audio_path):
            missing_audio.append((clip['clip_id'], audio_path))

    if missing_audio:
        print(f'  ❌ MISSING {len(missing_audio)} AUDIO FILES:')
        for clip_id, path in missing_audio[:10]:
            print(f'     {clip_id}: {path}')
        if len(missing_audio) > 10:
            print(f'     ... and {len(missing_audio) - 10} more')
        issues.append(f'{len(missing_audio)} missing audio files')
    else:
        print('  ✅ All audio files exist')
    print()

    # 3. Check for missing spectrogram files
    print('3. Checking spectrogram files...')
    missing_spectrograms = []
    for clip in clips:
        if clip.get('rejected'):
            continue
        spec_path = clip.get('spectrogram_path', '')
        if not spec_path:
            missing_spectrograms.append((clip['clip_id'], 'NO PATH'))
        elif not os.path.exists(spec_path):
            missing_spectrograms.append((clip['clip_id'], spec_path))

    if missing_spectrograms:
        print(f'  ❌ MISSING {len(missing_spectrograms)} SPECTROGRAM FILES:')
        for clip_id, path in missing_spectrograms[:10]:
            print(f'     {clip_id}: {path}')
        if len(missing_spectrograms) > 10:
            print(f'     ... and {len(missing_spectrograms) - 10} more')
        issues.append(f'{len(missing_spectrograms)} missing spectrogram files')
    else:
        print('  ✅ All spectrogram files exist')
    print()

    # 4. Check canonical clips
    print('4. Checking canonical clips...')
    species_codes = sorted(set(c['species_code'] for c in clips if not c.get('rejected')))
    missing_canonicals = []
    broken_canonicals = []

    for code in species_codes:
        species_clips = [c for c in clips if c['species_code'] == code and not c.get('rejected')]
        canonical_clips = [c for c in species_clips if c.get('canonical')]

        if not canonical_clips:
            missing_canonicals.append(code)
        elif len(canonical_clips) > 1:
            print(f'  ⚠️  {code}: Multiple canonicals ({len(canonical_clips)})')
        else:
            # Check if canonical file exists
            canonical = canonical_clips[0]
            if not os.path.exists(canonical.get('file_path', '')):
                broken_canonicals.append((code, canonical['clip_id']))

    if missing_canonicals:
        print(f'  ❌ {len(missing_canonicals)} SPECIES WITHOUT CANONICALS:')
        for code in missing_canonicals:
            print(f'     {code}')
        issues.append(f'{len(missing_canonicals)} species without canonicals')
    else:
        print(f'  ✅ All {len(species_codes)} species have canonical clips')

    if broken_canonicals:
        print(f'  ❌ {len(broken_canonicals)} CANONICAL FILES MISSING:')
        for code, clip_id in broken_canonicals:
            print(f'     {code}: {clip_id}')
        issues.append(f'{len(broken_canonicals)} broken canonical files')
    print()

    # 5. Verify audio file format for canonicals
    print('5. Verifying canonical audio file formats...')
    canonical_clips = [c for c in clips if c.get('canonical') and not c.get('rejected')]
    invalid_formats = []

    for clip in canonical_clips[:20]:  # Test first 20
        audio_path = clip.get('file_path', '')
        if not os.path.exists(audio_path):
            continue

        result = subprocess.run(['file', audio_path], capture_output=True, text=True)
        file_type = result.stdout.strip()

        if 'WAVE audio' not in file_type and 'RIFF' not in file_type:
            invalid_formats.append((clip['clip_id'], file_type))

    if invalid_formats:
        print(f'  ⚠️  {len(invalid_formats)} files with unexpected format')
        for clip_id, ftype in invalid_formats:
            print(f'     {clip_id}: {ftype}')
    else:
        print(f'  ✅ First 20 canonical clips are valid WAV files')
    print()

    # 6. Summary
    print('=== VALIDATION SUMMARY ===')
    active_clips = [c for c in clips if not c.get('rejected')]
    rejected_clips = [c for c in clips if c.get('rejected')]

    print(f'Total clips: {len(clips)}')
    print(f'  Active: {len(active_clips)}')
    print(f'  Rejected: {len(rejected_clips)}')
    print(f'Species: {len(species_codes)}')
    print(f'Canonical clips: {len(canonical_clips)}')
    print()

    if issues:
        print(f'❌ VALIDATION FAILED - {len(issues)} issue(s) found:')
        for issue in issues:
            print(f'   - {issue}')
        return False
    else:
        print('✅ ALL VALIDATION CHECKS PASSED!')
        print()
        print('🎉 Data is ready for testing and deployment')
        return True


def main():
    """Main entry point."""
    try:
        success = validate_clips_json()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f'❌ VALIDATION ERROR: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
