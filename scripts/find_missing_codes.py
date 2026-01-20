#!/usr/bin/env python3
"""Find species codes in PDF by searching for common/scientific names."""

import PyPDF2
import re
from pathlib import Path

# Species we're looking for
SPECIES_TO_FIND = {
    'SASP': 'Savannah Sparrow',
    'BTNW': 'Black-throated Blue Warbler',
    'BLBW': 'Blackburnian Warbler',  # or Black-and-white Warbler?
    'BLPW': 'Blackpoll Warbler',
    'WESJ': 'Western Scrub-Jay',
    'CEWA': 'Cerulean Warbler',
    'CARW': 'Carolina Wren',
    'CONW': 'Connecticut Warbler',
    'AMGO': 'American Goldfinch',
    'PROW': 'Prothonotary Warbler',
    'PRAW': 'Prairie Warbler',
}

pdf_path = Path(__file__).parent.parent / "docs" / "Alpha_codes_tax.pdf"

with open(pdf_path, 'rb') as f:
    reader = PyPDF2.PdfReader(f)

    for code, name in SPECIES_TO_FIND.items():
        print(f"\nSearching for {code}: {name}")
        found = False

        for page_num in range(len(reader.pages)):
            page = reader.pages[page_num]
            text = page.extract_text()

            # Search for the species name
            if name.upper() in text.upper():
                # Find the line with this species
                lines = text.split('\n')
                for line in lines:
                    if name.upper() in line.upper():
                        # Extract 4-letter code from this line
                        codes = re.findall(r'\b([A-Z]{4})\b', line)
                        if codes:
                            print(f"  Found on page {page_num + 1}: {line.strip()}")
                            print(f"  Possible codes: {codes}")
                            found = True
                            break
            if found:
                break

        if not found:
            print(f"  NOT FOUND in PDF")
