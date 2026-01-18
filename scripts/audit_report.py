#!/usr/bin/env python3
"""
Generate audit priority report for ChipNotes clip collection.

Identifies species needing attention based on:
- Excess clips (>10)
- Lack of vocalization diversity (all one type)
- Low quality scores
- Too few clips (<5)
- Missing or duplicate canonical clips
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
CLIPS_JSON = PROJECT_ROOT / 'data' / 'clips.json'


def analyze_collection():
    """Analyze clip collection and generate priority report."""
    with open(CLIPS_JSON) as f:
        clips = json.load(f)

    # Group by species
    species_data = defaultdict(lambda: {
        'clips': [],
        'voc_types': Counter(),
        'quality': [],
        'canonical_count': 0
    })

    for clip in clips:
        if clip.get('rejected'):
            continue
        code = clip['species_code']
        species_data[code]['clips'].append(clip)
        species_data[code]['voc_types'][clip['vocalization_type']] += 1
        species_data[code]['quality'].append(clip.get('quality_score', 3))
        if clip.get('canonical'):
            species_data[code]['canonical_count'] += 1

    # Analyze each species
    issues = []

    for code, data in species_data.items():
        count = len(data['clips'])
        voc_types = data['voc_types']
        avg_quality = sum(data['quality']) / len(data['quality'])

        issue_flags = []
        priority = 0

        # Too many clips (redundancy)
        if count > 10:
            issue_flags.append(f'📊 {count} clips (excess)')
            priority += 3

        # Only one vocalization type (lacks diversity)
        if len(voc_types) == 1:
            voc_type = list(voc_types.keys())[0]
            issue_flags.append(f'🎵 All {voc_type} (no diversity)')
            priority += 2

        # Low average quality
        if avg_quality < 3.5:
            issue_flags.append(f'⭐ Low quality (avg {avg_quality:.1f})')
            priority += 2

        # Too few clips
        if count < 5:
            issue_flags.append(f'📉 Only {count} clips (sparse)')
            priority += 1

        # No canonical
        canonical_ct = data['canonical_count']
        if canonical_ct == 0:
            issue_flags.append('⚠️  No canonical set')
            priority += 2

        # Multiple canonicals
        if canonical_ct > 1:
            issue_flags.append(f'⚠️  {canonical_ct} canonicals (conflict)')
            priority += 3

        if issue_flags:
            common_name = data['clips'][0].get('common_name', code)
            issues.append({
                'code': code,
                'name': common_name,
                'count': count,
                'priority': priority,
                'flags': issue_flags,
                'voc_types': dict(voc_types),
                'avg_quality': avg_quality
            })

    # Sort by priority (highest first)
    issues.sort(key=lambda x: x['priority'], reverse=True)

    return species_data, issues


def print_report(species_data, issues):
    """Print formatted audit report."""
    print('=' * 80)
    print('AUDIT PRIORITY REPORT - ChipNotes Clip Collection')
    print('=' * 80)
    print()

    print(f'Total species analyzed: {len(species_data)}')
    print(f'Species needing attention: {len(issues)}')
    print()

    # High priority
    high_priority = [i for i in issues if i['priority'] >= 5]
    if high_priority:
        print(f'HIGH PRIORITY (Score 5+): {len(high_priority)} species')
        print('-' * 80)
        for item in high_priority:
            voc_str = ', '.join(f"{k}:{v}" for k, v in item['voc_types'].items())
            print(f"[{item['priority']}] {item['code']:6} {item['name']:30} ({item['count']} clips)")
            for flag in item['flags']:
                print(f"     {flag}")
            print(f"     Types: {voc_str}")
            print()

    # Medium priority
    medium_priority = [i for i in issues if 3 <= i['priority'] < 5]
    if medium_priority:
        print()
        print(f'MEDIUM PRIORITY (Score 3-4): {len(medium_priority)} species')
        print('-' * 80)
        for item in medium_priority:
            voc_str = ', '.join(f"{k}:{v}" for k, v in item['voc_types'].items())
            print(f"[{item['priority']}] {item['code']:6} {item['name']:30} ({item['count']} clips)")
            for flag in item['flags']:
                print(f"     {flag}")
            print(f"     Types: {voc_str}")
            print()

    # Low priority
    low_priority = [i for i in issues if i['priority'] < 3]
    if low_priority:
        print()
        print(f'LOW PRIORITY (Score 1-2): {len(low_priority)} species')
        print('-' * 80)
        for item in low_priority:
            voc_str = ', '.join(f"{k}:{v}" for k, v in item['voc_types'].items())
            print(f"[{item['priority']}] {item['code']:6} {item['name']:30} ({item['count']} clips)")
            for flag in item['flags']:
                print(f"     {flag}")
            print(f"     Types: {voc_str}")
            print()

    # Summary recommendations
    print()
    print('RECOMMENDED NEXT ACTIONS:')
    print('-' * 80)

    if high_priority:
        print('\n1. Address HIGH PRIORITY species first:')
        for item in high_priority[:5]:  # Top 5
            if '(no diversity)' in ' '.join(item['flags']):
                voc_type = list(item['voc_types'].keys())[0]
                opposite_type = 'call' if voc_type == 'song' else 'song'
                print(f"   • {item['code']}: Download {opposite_type} clips to add diversity")
            elif '(sparse)' in ' '.join(item['flags']) and item['count'] < 4:
                print(f"   • {item['code']}: Download more clips (currently only {item['count']})")
            elif 'Low quality' in ' '.join(item['flags']):
                print(f"   • {item['code']}: Review and potentially replace low-quality clips")


if __name__ == '__main__':
    species_data, issues = analyze_collection()
    print_report(species_data, issues)
