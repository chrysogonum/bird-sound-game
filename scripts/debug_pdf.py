#!/usr/bin/env python3
"""Debug PDF text extraction to understand format."""

import PyPDF2
from pathlib import Path

pdf_path = Path(__file__).parent.parent / "docs" / "Alpha_codes_tax.pdf"

with open(pdf_path, 'rb') as f:
    reader = PyPDF2.PdfReader(f)

    # Print first 2 pages
    for page_num in range(min(2, len(reader.pages))):
        print(f"\n{'='*80}")
        print(f"PAGE {page_num + 1}")
        print('='*80)
        page = reader.pages[page_num]
        text = page.extract_text()
        print(text[:2000])  # First 2000 chars
