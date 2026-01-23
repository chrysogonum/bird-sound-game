#!/usr/bin/env python3
"""
Add NZ bird species to the taxonomy source of truth CSV.

Uses official eBird 6-character species codes.
Common names include Māori names in "English / Māori" format per DOC convention.
Scientific names from eBird/Clements 2025 taxonomy.

This script ONLY adds new NZ species - it does NOT modify any existing entries.
"""

import csv
from pathlib import Path

# NZ species with eBird codes and bilingual names
# Format: ebird_code -> (common_name_with_maori, scientific_name)
# Codes verified against eBird/Clements v2025 taxonomy
NZ_SPECIES_TAXONOMY = {
    # Tui and honeyeaters
    "tui1": ("Tūī", "Prosthemadera novaeseelandiae"),
    "nezbel1": ("Bellbird / Korimako", "Anthornis melanura"),

    # Fantail - single species, multiple subspecies
    "nezfan1": ("New Zealand Fantail / Pīwakawaka", "Rhipidura fuliginosa"),

    # Warbler
    "gryger1": ("Grey Warbler / Riroriro", "Gerygone igata"),

    # Owl
    "morepo2": ("Morepork / Ruru", "Ninox novaeseelandiae"),

    # Parrots
    "kea1": ("Kea", "Nestor notabilis"),
    "nezkak1": ("New Zealand Kākā", "Nestor meridionalis"),
    "kakapo2": ("Kākāpō", "Strigops habroptilus"),
    "refpar4": ("Red-crowned Parakeet / Kākāriki", "Cyanoramphus novaezelandiae"),
    "malpar2": ("Orange-fronted Parakeet / Kākāriki", "Cyanoramphus malherbi"),

    # Kiwi
    "nibkiw1": ("North Island Brown Kiwi", "Apteryx mantelli"),

    # Kokako
    "kokako3": ("Kōkako", "Callaeas wilsoni"),

    # Pigeons
    "nezpig2": ("Kererū", "Hemiphaga novaeseelandiae"),
    "nezpig3": ("Chatham Islands Pigeon / Parea", "Hemiphaga chathamensis"),

    # Falcon
    "nezfal1": ("New Zealand Falcon / Kārearea", "Falco novaeseelandiae"),

    # Robins
    "nezrob2": ("North Island Robin / Toutouwai", "Petroica longipes"),
    "nezrob3": ("South Island Robin / Toutouwai", "Petroica australis"),

    # Tomtit - single species
    "tomtit1": ("Tomtit / Miromiro", "Petroica macrocephala"),

    # Shelduck
    "parshe1": ("Paradise Shelduck / Pūtangitangi", "Tadorna variegata"),

    # Wren
    "soiwre1": ("Rock Wren / Pīwauwau", "Xenicus gilviventris"),

    # Saddlebacks
    "saddle2": ("North Island Saddleback / Tīeke", "Philesturnus rufusater"),
    "saddle3": ("South Island Saddleback / Tīeke", "Philesturnus carunculatus"),

    # Silvereye
    "silver3": ("Silvereye / Tauhou", "Zosterops lateralis"),

    # Stitchbird
    "stitch1": ("Hihi / Stitchbird", "Notiomystis cincta"),

    # Takahe
    "takahe3": ("Takahē", "Porphyrio hochstetteri"),

    # Mohua (Whitehead/Yellowhead)
    "whiteh1": ("Whitehead / Pōpokotea", "Mohoua albicilla"),
    "yellow3": ("Yellowhead / Mohua", "Mohoua ochrocephala"),

    # Penguin
    "yeepen1": ("Yellow-eyed Penguin / Hoiho", "Megadyptes antipodes"),

    # Dotterel
    "rebdot1": ("New Zealand Dotterel / Tūturiwhatu", "Anarhynchus obscurus"),

    # Oystercatcher
    "chaoys1": ("Chatham Islands Oystercatcher / Tōrea", "Haematopus chathamensis"),

    # Shearwater
    "hutshe1": ("Hutton's Shearwater / Tītī", "Puffinus huttoni"),

    # Petrel
    "wespet1": ("Westland Petrel / Tāiko", "Procellaria westlandica"),

    # Bittern
    "ausbit1": ("Australasian Bittern / Matuku-hūrepo", "Botaurus poiciloptilus"),

    # Stilt
    "blasti1": ("Black Stilt / Kakī", "Himantopus novaezelandiae"),

    # Duck
    "bluduc1": ("Blue Duck / Whio", "Hymenolaimus malacorhynchos"),

    # Teal
    "auitea1": ("Auckland Islands Teal", "Anas aucklandica"),

    # Grebe
    "grcgre1": ("Australasian Crested Grebe", "Podiceps cristatus"),

    # Weka - single species
    "weka1": ("Weka", "Gallirallus australis"),

    # Heron
    "greegr": ("White Heron / Kōtuku", "Ardea alba"),
}


def main():
    csv_path = Path(__file__).parent.parent / "docs" / "IBP-AOS-list25.csv"

    if not csv_path.exists():
        print(f"ERROR: CSV file not found at {csv_path}")
        return 1

    # Read existing CSV
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    header = rows[0]
    existing_rows = rows[1:]

    # Find column indices
    spec_idx = header.index('SPEC')
    name_idx = header.index('COMMONNAME')
    sci_idx = header.index('SCINAME')

    # Check which codes already exist
    existing_codes = {row[spec_idx].lower() for row in existing_rows if len(row) > spec_idx}

    # Add NZ species that don't exist
    new_rows = []
    skipped = []
    for code, (common_name, scientific_name) in NZ_SPECIES_TAXONOMY.items():
        if code.lower() not in existing_codes:
            # Create new row with same structure
            # SP,B4,SPEC,CONF,B1,COMMONNAME,B2,SCINAME,SPEC6,CONF6
            new_row = ['', '', code, '', '', common_name, '', scientific_name, '', '']
            new_rows.append(new_row)
            print(f"  Adding: {code} - {common_name} ({scientific_name})")
        else:
            skipped.append(code)

    if skipped:
        print(f"\nSkipped {len(skipped)} codes that already exist: {', '.join(skipped)}")

    if not new_rows:
        print("\nNo new species to add.")
        return 0

    # Append new rows to CSV (do NOT modify existing rows)
    all_rows = [header] + existing_rows + new_rows

    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(all_rows)

    print(f"\nAdded {len(new_rows)} NZ species to {csv_path}")
    print("\nNext steps:")
    print("  1. Run 'python3 scripts/generate_species_data.py' to regenerate species.json")
    print("  2. Verify with 'make validate-schemas'")

    return 0


if __name__ == "__main__":
    exit(main())
