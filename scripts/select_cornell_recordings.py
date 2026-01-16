#!/usr/bin/env python3
"""
Select the best 10 recordings per species from Cornell Macaulay Library CSV exports.

Selection Strategy:
- Quality Score = rating × √(num_ratings + 1)
- Quality Threshold = rating ≥ 3.0 OR num_ratings ≥ 2
- Prioritize vocalization diversity (song, call, dawn song, etc.)
- Target: 10 recordings per species with behavioral and seasonal diversity
"""

import csv
import glob
import math
import os
from collections import defaultdict
from typing import Dict, List, Tuple

# Species mapping: eBird code -> 4-letter code
SPECIES_MAP = {
    'grcfly': 'GCFL',
    'easpho': 'EAPH',
    'eawpew': 'EWPE',
    'acafly': 'ACFL',
    'whevir': 'WEVI',
    'reevir1': 'REVI',
    'houwre': 'NHWR',
    'buggna': 'BGGN',
    'swathr': 'SWTH',
    'veery': 'VEER',
    'sumtan': 'SUTA',
    'scatan': 'SCTA',
    'purfin': 'PUFI',
    'robgro': 'RBGR',
    'daejun': 'DEJU',
    'bnhcow': 'BHCO',
    'eursta': 'EUST',
    'chiswi': 'CHSW',
}


def calculate_quality_score(rating: float, num_ratings: int) -> float:
    """Calculate quality score = rating × √(num_ratings + 1)"""
    return rating * math.sqrt(num_ratings + 1)


def meets_quality_threshold(rating: float, num_ratings: int) -> bool:
    """Check if recording meets minimum quality threshold"""
    return rating >= 3.0 or num_ratings >= 2


def extract_vocalization_type(behaviors: str, media_notes: str) -> str:
    """Extract vocalization type from Behaviors and Media notes columns"""
    # Combine both fields for analysis
    text = f"{behaviors} {media_notes}".lower()

    # Priority order for vocalization types
    if 'dawn' in text and 'song' in text:
        return 'dawn song'
    elif 'flight' in text and ('song' in text or 'call' in text):
        return 'flight call/song'
    elif 'song' in text:
        return 'song'
    elif 'call' in text:
        return 'call'
    elif 'chip' in text:
        return 'chip note'
    elif 'rattle' in text:
        return 'rattle'
    elif 'trill' in text:
        return 'trill'
    elif 'alarm' in text:
        return 'alarm'
    elif 'vocalization' in text or 'vocal' in text:
        return 'vocalization'
    else:
        return 'unknown'


def parse_csv_file(filepath: str) -> List[Dict]:
    """Parse a Cornell CSV file and extract relevant fields"""
    recordings = []

    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse rating and num_ratings
            try:
                rating = float(row['Average Community Rating']) if row['Average Community Rating'] else 0.0
                num_ratings = int(row['Number of Ratings']) if row['Number of Ratings'] else 0
            except (ValueError, KeyError):
                rating = 0.0
                num_ratings = 0

            # Extract vocalization type
            behaviors = row.get('Behaviors', '')
            media_notes = row.get('Media notes', '')
            voc_type = extract_vocalization_type(behaviors, media_notes)

            recordings.append({
                'ml_catalog': row['ML Catalog Number'],
                'common_name': row['Common Name'],
                'ebird_code': row['eBird Species Code'],
                'rating': rating,
                'num_ratings': num_ratings,
                'quality_score': calculate_quality_score(rating, num_ratings),
                'vocalization_type': voc_type,
                'behaviors': behaviors,
                'month': row.get('Month', ''),
                'year': row.get('Year', ''),
                'recordist': row.get('Recordist', ''),
                'media_notes': media_notes,
            })

    return recordings


def select_best_recordings(recordings: List[Dict], target_count: int = 10) -> List[Dict]:
    """
    Select best recordings with diversity in vocalization types.

    Strategy:
    1. Filter by quality threshold
    2. Group by vocalization type
    3. Select highest quality from each type
    4. Fill remaining slots with highest quality overall
    """
    # Filter by quality threshold
    quality_recordings = [r for r in recordings if meets_quality_threshold(r['rating'], r['num_ratings'])]

    # If we don't have enough quality recordings, relax threshold
    if len(quality_recordings) < target_count:
        quality_recordings = recordings

    # Group by vocalization type
    by_voc_type = defaultdict(list)
    for rec in quality_recordings:
        by_voc_type[rec['vocalization_type']].append(rec)

    # Sort each group by quality score
    for voc_type in by_voc_type:
        by_voc_type[voc_type].sort(key=lambda x: x['quality_score'], reverse=True)

    # Select diverse recordings
    selected = []

    # First pass: take top 1 from each vocalization type
    voc_types_with_recordings = sorted(by_voc_type.keys(),
                                       key=lambda vt: by_voc_type[vt][0]['quality_score'],
                                       reverse=True)

    for voc_type in voc_types_with_recordings:
        if len(selected) < target_count and by_voc_type[voc_type]:
            selected.append(by_voc_type[voc_type].pop(0))

    # Second pass: fill remaining slots with highest quality overall
    remaining = []
    for voc_type in by_voc_type:
        remaining.extend(by_voc_type[voc_type])

    remaining.sort(key=lambda x: x['quality_score'], reverse=True)

    while len(selected) < target_count and remaining:
        selected.append(remaining.pop(0))

    # Add selection reasons
    for i, rec in enumerate(selected):
        voc_count = sum(1 for r in selected if r['vocalization_type'] == rec['vocalization_type'])

        if i == 0:
            rec['selection_reason'] = f"Best overall ({rec['vocalization_type']})"
        elif voc_count == 1:
            rec['selection_reason'] = f"Only {rec['vocalization_type']}"
        elif rec['quality_score'] > 0:
            rec['selection_reason'] = f"High quality {rec['vocalization_type']}"
        else:
            rec['selection_reason'] = f"Additional {rec['vocalization_type']}"

    return selected


def main():
    # Find all CSV files
    csv_pattern = os.path.expanduser('~/Downloads/ML__2026-01-16T04-*_audio_US-NC.csv')
    csv_files = sorted(glob.glob(csv_pattern))

    print(f"Found {len(csv_files)} CSV files")

    all_selected = []
    summary_stats = {}

    # Process each species
    for csv_file in csv_files:
        # Extract eBird code from filename
        # Format: ML__2026-01-16T04-42_grcfly_audio_US-NC.csv
        filename = os.path.basename(csv_file)
        parts = filename.split('_')
        # Find the species code (between timestamp and 'audio')
        ebird_code = None
        for i, part in enumerate(parts):
            if i > 0 and i < len(parts) - 1:
                if 'T' in parts[i-1] and parts[i+1] == 'audio':
                    ebird_code = part
                    break

        if not ebird_code or ebird_code not in SPECIES_MAP:
            print(f"Warning: Could not determine species for {filename}")
            continue

        species_code = SPECIES_MAP[ebird_code]

        # Parse recordings
        recordings = parse_csv_file(csv_file)
        print(f"\n{species_code} ({ebird_code}): {len(recordings)} total recordings")

        # Select best 10
        selected = select_best_recordings(recordings, target_count=10)
        print(f"  Selected: {len(selected)} recordings")

        # Add species codes
        for rec in selected:
            rec['species_code'] = species_code

        all_selected.extend(selected)

        # Track stats
        voc_types = defaultdict(int)
        for rec in selected:
            voc_types[rec['vocalization_type']] += 1

        summary_stats[species_code] = {
            'total_available': len(recordings),
            'selected_count': len(selected),
            'avg_rating': sum(r['rating'] for r in selected) / len(selected) if selected else 0,
            'avg_quality_score': sum(r['quality_score'] for r in selected) / len(selected) if selected else 0,
            'vocalization_types': dict(voc_types),
        }

        print(f"  Vocalization types: {dict(voc_types)}")
        print(f"  Avg rating: {summary_stats[species_code]['avg_rating']:.2f}")
        print(f"  Avg quality score: {summary_stats[species_code]['avg_quality_score']:.2f}")

    # Write output CSV
    output_file = os.path.expanduser('~/Downloads/cornell_selected_recordings.csv')
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'Species_Code',
            'Common_Name',
            'ML_Catalog_Number',
            'Rating',
            'Num_Raters',
            'Vocalization_Type',
            'Month',
            'Year',
            'Recordist',
            'Selection_Reason',
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for rec in all_selected:
            writer.writerow({
                'Species_Code': rec['species_code'],
                'Common_Name': rec['common_name'],
                'ML_Catalog_Number': rec['ml_catalog'],
                'Rating': f"{rec['rating']:.2f}" if rec['rating'] > 0 else "0.00",
                'Num_Raters': rec['num_ratings'],
                'Vocalization_Type': rec['vocalization_type'],
                'Month': rec['month'],
                'Year': rec['year'],
                'Recordist': rec['recordist'],
                'Selection_Reason': rec['selection_reason'],
            })

    print(f"\n{'='*60}")
    print(f"OUTPUT: {output_file}")
    print(f"{'='*60}")
    print(f"\nTotal recordings selected: {len(all_selected)}")
    print(f"\nPer-species breakdown:")
    print(f"{'Species':<8} {'Available':<10} {'Selected':<10} {'Avg Rating':<12} {'Avg Quality':<12}")
    print(f"{'-'*60}")

    for species_code in sorted(summary_stats.keys()):
        stats = summary_stats[species_code]
        print(f"{species_code:<8} {stats['total_available']:<10} {stats['selected_count']:<10} "
              f"{stats['avg_rating']:<12.2f} {stats['avg_quality_score']:<12.2f}")

    # Species with < 10 recordings
    print(f"\nSpecies with < 10 quality recordings:")
    for species_code in sorted(summary_stats.keys()):
        if summary_stats[species_code]['selected_count'] < 10:
            print(f"  {species_code}: {summary_stats[species_code]['selected_count']} selected "
                  f"(from {summary_stats[species_code]['total_available']} available)")

    # Overall average rating
    if summary_stats:
        overall_avg_rating = sum(s['avg_rating'] for s in summary_stats.values()) / len(summary_stats)
        overall_avg_quality = sum(s['avg_quality_score'] for s in summary_stats.values()) / len(summary_stats)
    else:
        overall_avg_rating = 0
        overall_avg_quality = 0

    print(f"\nOverall averages across all selections:")
    print(f"  Average rating: {overall_avg_rating:.2f}")
    print(f"  Average quality score: {overall_avg_quality:.2f}")

    # Vocalization type distribution
    all_voc_types = defaultdict(int)
    for stats in summary_stats.values():
        for voc_type, count in stats['vocalization_types'].items():
            all_voc_types[voc_type] += count

    print(f"\nVocalization type distribution across all species:")
    for voc_type, count in sorted(all_voc_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {voc_type}: {count}")


if __name__ == '__main__':
    main()
