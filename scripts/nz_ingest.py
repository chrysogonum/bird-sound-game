#!/usr/bin/env python3
"""
NZ DOC Audio Download for ChipNotes!

Downloads raw bird audio from NZ Department of Conservation for manual clip selection.
Source: https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/

License: Crown Copyright - FREE to use commercially with attribution
Attribution: "Department of Conservation (NZ)"

Usage:
    # Download all NZ bird audio to data/raw-nz/
    python nz_ingest.py

    # Download specific species only
    python nz_ingest.py --species tui1 nezbel1 morepo2

    # Dry run (show what would be downloaded)
    python nz_ingest.py --dry-run

After downloading, use clip_selector.py to manually select clips:
    python clip_selector.py --input data/raw-nz --port 8890
"""

import argparse
import urllib.request
from pathlib import Path

# DOC base URL
DOC_BASE_URL = "https://www.doc.govt.nz"

# Output directory for raw downloads
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "raw-nz"

# Complete NZ bird species catalog from DOC
# Uses official eBird 6-character codes from eBird/Clements v2025 taxonomy
# Format: ebird_code -> {common_name, maori_name (optional), files: [{url, voc_type}]}
NZ_SPECIES = {
    "auitea1": {
        "common_name": "Auckland Islands Teal",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/auckland-island-teal-song.mp3", "voc_type": "call"}
        ]
    },
    "ausbit1": {
        "common_name": "Australasian Bittern",
        "maori_name": "Matuku-hūrepo",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/australasian-bittern.mp3", "voc_type": "call"}
        ]
    },
    "grcgre1": {
        "common_name": "Australasian Crested Grebe",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/southern-crested-grebe-song.mp3", "voc_type": "call"}
        ]
    },
    "nezbel1": {
        "common_name": "Bellbird",
        "maori_name": "Korimako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-06.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/bellbird-04.mp3", "voc_type": "call"}
        ]
    },
    "blasti1": {
        "common_name": "Black Stilt",
        "maori_name": "Kakī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/black-stilt.mp3", "voc_type": "call"}
        ]
    },
    "bluduc1": {
        "common_name": "Blue Duck",
        "maori_name": "Whio",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/blue-duck.mp3", "voc_type": "call"}
        ]
    },
    "chaoys1": {
        "common_name": "Chatham Islands Oystercatcher",
        "maori_name": "Tōrea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-oystercatcher-song.mp3", "voc_type": "call"}
        ]
    },
    "nezpig3": {
        "common_name": "Chatham Islands Pigeon",
        "maori_name": "Parea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-pigeon.mp3", "voc_type": "call"}
        ]
    },
    "nezfan1": {
        "common_name": "New Zealand Fantail",
        "maori_name": "Pīwakawaka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-02.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/fantail-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-fantail.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-fantail.mp3", "voc_type": "song"}
        ]
    },
    "gryger1": {
        "common_name": "Grey Warbler",
        "maori_name": "Riroriro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/grey-warbler-song.mp3", "voc_type": "song"}
        ]
    },
    "hutshe1": {
        "common_name": "Hutton's Shearwater",
        "maori_name": "Tītī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/huttons-shearwater.mp3", "voc_type": "call"}
        ]
    },
    "nezkak1": {
        "common_name": "New Zealand Kākā",
        "maori_name": "Kākā",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-kaka.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-kaka.mp3", "voc_type": "call"}
        ]
    },
    "kakapo2": {
        "common_name": "Kākāpō",
        "maori_name": "Kākāpō",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-18.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-bill-ching-1.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-20.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kakapo-26.mp3", "voc_type": "song"}
        ]
    },
    "kea1": {
        "common_name": "Kea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kea-song.mp3", "voc_type": "call"}
        ]
    },
    "nibkiw1": {
        "common_name": "North Island Brown Kiwi",
        "maori_name": "Kiwi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/male-ni-brown-kiwi.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/kiwi-cd/female-ni-brown-kiwi.mp3", "voc_type": "call"}
        ]
    },
    "kokako3": {
        "common_name": "Kōkako",
        "maori_name": "Kōkako",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/kokako-song-12.mp3", "voc_type": "song"}
        ]
    },
    "morepo2": {
        "common_name": "Morepork",
        "maori_name": "Ruru",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/morepork-song.mp3", "voc_type": "call"}
        ]
    },
    "rebdot1": {
        "common_name": "New Zealand Dotterel",
        "maori_name": "Tūturiwhatu",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-dotterel-song.mp3", "voc_type": "call"}
        ]
    },
    "nezpig2": {
        "common_name": "Kererū",
        "maori_name": "Kererū",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-pigeon-song.mp3", "voc_type": "call"}
        ]
    },
    "nezfal1": {
        "common_name": "New Zealand Falcon",
        "maori_name": "Kārearea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/nz-falcon-song-12.mp3", "voc_type": "call"}
        ]
    },
    "refpar4": {
        "common_name": "Red-crowned Parakeet",
        "maori_name": "Kākāriki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-4.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/red-crowned-parakeet-song-8.mp3", "voc_type": "call"}
        ]
    },
    "malpar2": {
        "common_name": "Orange-fronted Parakeet",
        "maori_name": "Kākāriki",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/orange-fronted-parakeet-song.mp3", "voc_type": "call"}
        ]
    },
    "nezrob3": {
        "common_name": "South Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-robin-song-48.mp3", "voc_type": "song"}
        ]
    },
    "nezrob2": {
        "common_name": "North Island Robin",
        "maori_name": "Toutouwai",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-robin-song.mp3", "voc_type": "song"}
        ]
    },
    "parshe1": {
        "common_name": "Paradise Shelduck",
        "maori_name": "Pūtangitangi",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/paradise-duck-song.mp3", "voc_type": "call"}
        ]
    },
    "soiwre1": {
        "common_name": "Rock Wren",
        "maori_name": "Pīwauwau",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-contact-call.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/rock-wren-chicks-begging.mp3", "voc_type": "call"}
        ]
    },
    "saddle2": {
        "common_name": "North Island Saddleback",
        "maori_name": "Tīeke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "saddle3": {
        "common_name": "South Island Saddleback",
        "maori_name": "Tīeke",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-saddleback-song.mp3", "voc_type": "song"}
        ]
    },
    "silver3": {
        "common_name": "Silvereye",
        "maori_name": "Tauhou",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/silvereye-song-22sy.mp3", "voc_type": "song"}
        ]
    },
    "stitch1": {
        "common_name": "Hihi",
        "maori_name": "Stitchbird",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/stitchbird-song.mp3", "voc_type": "song"}
        ]
    },
    "takahe3": {
        "common_name": "Takahē",
        "maori_name": "Takahē",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-10.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/takahe-song-12.mp3", "voc_type": "call"}
        ]
    },
    "tomtit1": {
        "common_name": "Tomtit",
        "maori_name": "Miromiro",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-tomtit-song-18ni.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/south-island-tomtit-song-24yb.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tomtit-song-32ci.mp3", "voc_type": "song"}
        ]
    },
    "tui1": {
        "common_name": "Tūī",
        "maori_name": "Tūī",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-42.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/tui-song-50.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/chatham-island-tui.mp3", "voc_type": "song"}
        ]
    },
    "weka1": {
        "common_name": "Weka",
        "maori_name": "Weka",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/buff-weka-song.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/north-island-weka-song.mp3", "voc_type": "call"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/western-weka-song.mp3", "voc_type": "call"}
        ]
    },
    "wespet1": {
        "common_name": "Westland Petrel",
        "maori_name": "Tāiko",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/westland-black-petrel-song.mp3", "voc_type": "call"}
        ]
    },
    "greegr": {
        "common_name": "White Heron",
        "maori_name": "Kōtuku",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/white-heron-song.mp3", "voc_type": "call"}
        ]
    },
    "whiteh1": {
        "common_name": "Whitehead",
        "maori_name": "Pōpokotea",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-song-56.mp3", "voc_type": "song"},
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/whitehead-territorial-call-male-60.mp3", "voc_type": "call"}
        ]
    },
    "yeepen1": {
        "common_name": "Yellow-eyed Penguin",
        "maori_name": "Hoiho",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/yellow-eyed-penguin.mp3", "voc_type": "call"}
        ]
    },
    "yellow3": {
        "common_name": "Yellowhead",
        "maori_name": "Mohua",
        "files": [
            {"url": "/globalassets/documents/conservation/native-animals/birds/bird-song/yellowhead-song.mp3", "voc_type": "song"}
        ]
    },
}


def download_file(url: str, output_path: Path) -> bool:
    """Download a file from URL."""
    try:
        full_url = DOC_BASE_URL + url if url.startswith('/') else url
        req = urllib.request.Request(full_url, headers={'User-Agent': 'ChipNotes-NZ/1.0'})
        with urllib.request.urlopen(req, timeout=60) as response:
            output_path.write_bytes(response.read())
        return True
    except Exception as e:
        print(f"    Download failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Download NZ DOC bird audio for manual clip selection')
    parser.add_argument('--species', '-s', nargs='*', help='Specific species codes to download')
    parser.add_argument('--dry-run', '-n', action='store_true', help='Show what would be downloaded')
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Filter species if specified
    species_to_download = NZ_SPECIES
    if args.species:
        species_to_download = {k: v for k, v in NZ_SPECIES.items() if k in args.species}
        if not species_to_download:
            print(f"ERROR: No matching species found. Available: {', '.join(NZ_SPECIES.keys())}")
            return 1

    print(f"Downloading audio for {len(species_to_download)} NZ bird species...")
    print(f"Output directory: {OUTPUT_DIR}")
    if args.dry_run:
        print("(DRY RUN - no files will be downloaded)")
    print()

    total_files = 0
    skipped = 0

    for species_code, info in species_to_download.items():
        common_name = info['common_name']
        maori_name = info.get('maori_name')
        files = info['files']

        print(f"{species_code}: {common_name}" + (f" / {maori_name}" if maori_name else ""))

        for file_info in files:
            url = file_info['url']
            filename = Path(url).name

            output_path = OUTPUT_DIR / filename

            if args.dry_run:
                print(f"  Would download: {filename}")
                total_files += 1
                continue

            if output_path.exists():
                print(f"  Skipping (exists): {filename}")
                skipped += 1
                continue

            print(f"  Downloading: {filename}...")
            if download_file(url, output_path):
                total_files += 1
            else:
                print(f"  FAILED: {filename}")

    print()
    print(f"Downloaded: {total_files} files")
    if skipped:
        print(f"Skipped (already exist): {skipped} files")
    print()
    print("Next step: Use clip_selector.py to manually select clips:")
    print(f"  python scripts/clip_selector.py --input {OUTPUT_DIR} --port 8890")


if __name__ == '__main__':
    main()
