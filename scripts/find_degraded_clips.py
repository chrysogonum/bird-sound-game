#!/usr/bin/env python3
"""
Find clips potentially degraded by np.interp resampling.

Identifies clips processed with the old tool (hash-style clip IDs) and queries
the Xeno-canto API to determine which source recordings were 48kHz — these are
the clips that went through np.interp resampling and likely have artifacts.

Usage:
    python3 scripts/find_degraded_clips.py

Output:
    data/degraded_clips.json — full report
    Console summary with counts and priority lists
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

CLIPS_PATH = "data/clips.json"
OUTPUT_PATH = "data/degraded_clips.json"
TARGET_RATE = 44100

# XC API rate limiting
REQUEST_DELAY = 0.35  # seconds between requests
MAX_RETRIES = 3


def get_xc_sample_rate(xc_id: str, api_key: str) -> dict:
    """Query XC API for a recording's sample rate and metadata."""
    url = f"https://xeno-canto.org/api/3/recordings?query=nr:{xc_id}&key={api_key}"
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ChipNotes/1.0"})
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read())
            if data.get("recordings"):
                rec = data["recordings"][0]
                return {
                    "sample_rate": int(rec.get("smp", 0)),
                    "quality": rec.get("q", ""),
                    "length": rec.get("length", ""),
                    "type": rec.get("type", ""),
                    "recordist": rec.get("rec", ""),
                }
            return {"sample_rate": 0, "error": "no recordings found"}
        except urllib.error.HTTPError as e:
            if e.code == 429:  # rate limited
                wait = 5 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            return {"sample_rate": 0, "error": f"HTTP {e.code}"}
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2)
                continue
            return {"sample_rate": 0, "error": str(e)}
    return {"sample_rate": 0, "error": "max retries exceeded"}


def is_hash_id(clip_id: str) -> bool:
    """Check if clip ID uses hash format (old tool) vs numeric format (newer tool)."""
    parts = clip_id.split("_", 1)
    if len(parts) != 2:
        return True
    try:
        int(parts[1])
        return False
    except ValueError:
        return True


def main():
    api_key = os.environ.get("XENO_CANTO_API_KEY", "")
    if not api_key:
        print("ERROR: XENO_CANTO_API_KEY not set. Source it from ~/.zshrc")
        sys.exit(1)

    with open(CLIPS_PATH) as f:
        clips = json.load(f)

    print(f"Total clips: {len(clips)}")

    # Identify potentially affected clips: hash IDs from XC source
    candidates = []
    for c in clips:
        if c.get("rejected"):
            continue
        if not is_hash_id(c["clip_id"]):
            continue
        if c.get("source") != "xenocanto":
            continue
        candidates.append(c)

    print(f"Hash-ID XC clips to check: {len(candidates)}")
    canonical_count = sum(1 for c in candidates if c.get("canonical"))
    print(f"  Of which canonical: {canonical_count}")

    # Also check DOC and Macaulay hash clips (different pipeline, but worth noting)
    doc_hash = [c for c in clips if not c.get("rejected") and is_hash_id(c["clip_id"]) and c.get("source") == "doc"]
    mac_hash = [c for c in clips if not c.get("rejected") and is_hash_id(c["clip_id"]) and c.get("source") == "macaulay"]
    print(f"DOC hash clips (not checked via API): {len(doc_hash)}")
    print(f"Macaulay hash clips (not checked via API): {len(mac_hash)}")

    # Deduplicate XC source IDs — many clips share the same source recording
    source_ids = {}
    for c in candidates:
        xc_id = c.get("source_id", "").replace("XC", "")
        if xc_id:
            if xc_id not in source_ids:
                source_ids[xc_id] = []
            source_ids[xc_id].append(c)

    unique_sources = list(source_ids.keys())
    print(f"\nUnique XC source recordings to query: {len(unique_sources)}")
    print("Querying XC API (this may take a few minutes)...\n")

    # Query XC API for each unique source
    source_rates = {}
    for i, xc_id in enumerate(unique_sources):
        if (i + 1) % 25 == 0 or i == 0:
            print(f"  Checking {i + 1}/{len(unique_sources)}...")
        result = get_xc_sample_rate(xc_id, api_key)
        source_rates[xc_id] = result
        time.sleep(REQUEST_DELAY)

    # Classify clips
    degraded = []  # 48kHz source → np.interp artifacts
    clean = []     # 44.1kHz source → no resampling needed
    unknown = []   # API error

    for xc_id, clip_list in source_ids.items():
        rate_info = source_rates.get(xc_id, {})
        source_rate = rate_info.get("sample_rate", 0)

        for c in clip_list:
            entry = {
                "clip_id": c["clip_id"],
                "species_code": c["species_code"],
                "common_name": c.get("common_name", ""),
                "source_id": c.get("source_id", ""),
                "source_sample_rate": source_rate,
                "is_canonical": c.get("canonical", False),
                "vocalization_type": c.get("vocalization_type", ""),
                "file_path": c.get("file_path", ""),
            }
            if rate_info.get("error"):
                entry["error"] = rate_info["error"]
                unknown.append(entry)
            elif source_rate != TARGET_RATE:
                degraded.append(entry)
            else:
                clean.append(entry)

    # Sort degraded: canonical first, then by species
    degraded.sort(key=lambda x: (not x["is_canonical"], x["species_code"], x["clip_id"]))

    # Summary
    degraded_canonical = [d for d in degraded if d["is_canonical"]]
    degraded_species = sorted(set(d["species_code"] for d in degraded))
    clean_species = sorted(set(c["species_code"] for c in clean))

    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"Degraded (48kHz source, np.interp resampled): {len(degraded)} clips")
    print(f"  Canonical (PRIORITY 1):  {len(degraded_canonical)} clips")
    print(f"  Non-canonical:           {len(degraded) - len(degraded_canonical)} clips")
    print(f"  Species affected:        {len(degraded_species)}")
    print(f"Clean (44.1kHz source, no resampling):        {len(clean)} clips")
    print(f"Unknown (API error):                          {len(unknown)} clips")

    # Source rate breakdown
    rate_counts = {}
    for d in degraded:
        r = d["source_sample_rate"]
        rate_counts[r] = rate_counts.get(r, 0) + 1
    if rate_counts:
        print(f"\nSource sample rates of degraded clips:")
        for r, count in sorted(rate_counts.items()):
            print(f"  {r} Hz: {count} clips")

    # Print canonical clips needing repair
    if degraded_canonical:
        print(f"\n{'='*60}")
        print(f"PRIORITY 1: Degraded Canonical Clips ({len(degraded_canonical)})")
        print(f"{'='*60}")
        for d in degraded_canonical:
            print(f"  {d['species_code']:8s} {d['clip_id']:30s} {d['source_id']:12s} {d['source_sample_rate']}Hz  {d['common_name']}")

    # Write full report
    report = {
        "generated": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total_checked": len(candidates),
            "degraded": len(degraded),
            "degraded_canonical": len(degraded_canonical),
            "clean": len(clean),
            "unknown": len(unknown),
            "degraded_species_count": len(degraded_species),
        },
        "degraded_canonical": degraded_canonical,
        "degraded_non_canonical": [d for d in degraded if not d["is_canonical"]],
        "clean": clean,
        "unknown": unknown,
        "doc_clips_not_checked": len(doc_hash),
        "macaulay_clips_not_checked": len(mac_hash),
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nFull report written to {OUTPUT_PATH}")
    print(f"Next step: reprocess {len(degraded_canonical)} canonical clips in Clip Studio")


if __name__ == "__main__":
    main()
