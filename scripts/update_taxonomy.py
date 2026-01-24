#!/usr/bin/env python3
"""
Update taxonomic_order.json from 2025 AOS taxonomy PDF.
Extracts 4-letter alpha codes and their taxonomic positions.
"""

import json
import re
import sys
from pathlib import Path
try:
    import PyPDF2
except ImportError:
    print("ERROR: PyPDF2 not installed. Run: pip install PyPDF2")
    sys.exit(1)

# Code mapping for species with different codes in game vs 2025 AOS
CODE_MAPPING = {
    'SASP': 'SAVS',  # Savannah Sparrow
    'CEWA': 'CERW',  # Cerulean Warbler
    'AMGO': 'AGOL',  # American Goldfinch
    'BTNW': 'BTBW',  # Black-throated Blue Warbler
    'WESJ': 'CASJ',  # Western Scrub-Jay → California Scrub-Jay (taxonomic split)
}


def extract_taxonomy_from_pdf(pdf_path):
    """Extract 4-letter codes and taxonomic positions from AOS PDF."""
    taxonomy = {}
    position = 1  # Start at position 1

    with open(pdf_path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)

        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            text = page.extract_text()

            # Split into lines
            lines = text.split('\n')

            for line in lines:
                # Skip header lines
                if 'ENGLISH NAME' in line or '4-LETTER CODE' in line:
                    continue
                if 'Four-letter' in line or 'Alpha Codes' in line:
                    continue
                if line.strip().startswith('+'):
                    # Skip non-species taxa
                    continue

                # Look for 4-letter codes (all caps, exactly 4 letters)
                # Format: "English Name  CODE*  Scientific name  6LETTER"
                # Example: "Savannah Sparrow  SAVS*  Passerculus sandwichensis  PASSAN"
                # The asterisk indicates non-first-order codes

                # Find all 4-letter uppercase sequences (possibly followed by *)
                matches = re.findall(r'\b([A-Z]{4})\*?\b', line)

                if not matches:
                    continue

                # Filter to get the species code (first 4-letter code before scientific name)
                valid_codes = []
                for code in matches:
                    # Get position of code in line
                    code_pattern = re.escape(code) + r'\*?'
                    match = re.search(code_pattern, line)
                    if match:
                        # Get text after the code
                        after_pos = match.end()
                        after = line[after_pos:].strip()

                        # If next word starts with uppercase (likely scientific name), it's valid
                        after_words = after.split()
                        if after_words and len(after_words[0]) > 0:
                            first_char = after_words[0][0]
                            if first_char.isupper():
                                # Could be scientific name (Genus species)
                                # Make sure it's not another 4-letter code
                                if len(after_words[0]) > 4 or not after_words[0].isupper():
                                    valid_codes.append(code)
                                    break  # Take first valid code only

                # Take first valid 4-letter code (should be the species code)
                if valid_codes:
                    code_4letter = valid_codes[0]
                    if code_4letter not in taxonomy:  # Avoid duplicates
                        taxonomy[code_4letter] = position
                        position += 1

    return taxonomy


def main():
    # Paths
    project_root = Path(__file__).parent.parent
    pdf_path = project_root / "docs" / "Alpha_codes_tax.pdf"
    current_taxonomy_path = project_root / "data" / "taxonomic_order.json"
    output_path = project_root / "data" / "taxonomic_order.json"

    # Check PDF exists
    if not pdf_path.exists():
        print(f"ERROR: PDF not found at {pdf_path}")
        sys.exit(1)

    # Load current taxonomy to get species list
    with open(current_taxonomy_path) as f:
        current_taxonomy = json.load(f)

    species_in_game = set(current_taxonomy.keys())
    print(f"Found {len(species_in_game)} species in game")

    # Extract taxonomy from PDF
    print(f"Extracting taxonomy from {pdf_path}...")
    full_taxonomy = extract_taxonomy_from_pdf(pdf_path)
    print(f"Extracted {len(full_taxonomy)} species from PDF")

    # Build new taxonomy for game species only
    new_taxonomy = {}
    missing_species = []
    mapped_codes = {}

    for species_code in species_in_game:
        # Check if we need to map this code to a different AOS 2025 code
        aos_code = CODE_MAPPING.get(species_code, species_code)

        if aos_code != species_code:
            mapped_codes[species_code] = aos_code
            print(f"Mapping {species_code} → {aos_code}")

        if aos_code in full_taxonomy:
            new_taxonomy[species_code] = full_taxonomy[aos_code]
        else:
            missing_species.append(species_code)
            # Keep old value if not found
            new_taxonomy[species_code] = current_taxonomy[species_code]
            print(f"WARNING: {species_code} (AOS: {aos_code}) not found in PDF, keeping old position {current_taxonomy[species_code]}")

    # Sort by taxonomic position for display
    sorted_species = sorted(new_taxonomy.items(), key=lambda x: x[1])

    # Save new taxonomy
    with open(output_path, 'w') as f:
        json.dump(new_taxonomy, f, indent=2, sort_keys=True)

    print(f"\nUpdated taxonomic_order.json with {len(new_taxonomy)} species")

    # Show changes
    changes = []
    for code in species_in_game:
        if code in full_taxonomy:
            old_pos = current_taxonomy[code]
            new_pos = new_taxonomy[code]
            if old_pos != new_pos:
                changes.append((code, old_pos, new_pos))

    if changes:
        print(f"\nFound {len(changes)} position changes:")
        for code, old_pos, new_pos in sorted(changes, key=lambda x: abs(x[2] - x[1]), reverse=True):
            delta = new_pos - old_pos
            sign = "+" if delta > 0 else ""
            print(f"  {code}: {old_pos} → {new_pos} ({sign}{delta})")
    else:
        print("\nNo position changes found")

    if missing_species:
        print(f"\nWARNING: {len(missing_species)} species not found in PDF:")
        print(f"  {', '.join(missing_species)}")


if __name__ == "__main__":
    main()
