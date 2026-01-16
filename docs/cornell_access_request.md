# Macaulay Library Media Access Request - ChipNotes!

**Date:** January 16, 2026
**Requester:** Peter Repetti
**Project:** ChipNotes! - Bird Sound Identification Training Application

---

## Project Information

### Affiliation
Independent developer / Open-source educational project

### Project Name and URL
**ChipNotes!**
Live Application: https://chrysogonum.github.io/bird-sound-game/
Source Code: https://github.com/chrysogonum/bird_sound_game

### Project Type
Educational, non-commercial, open-source (MIT License)

---

## Project Description

ChipNotes! is a free, web-based application that teaches people to identify bird species by sound using game-like mechanics. The application helps users develop aural identification skills through interactive training with immediate feedback.

### Key Features:
- **Audio-first learning:** Primary focus on sound identification with optional spectrogram scaffolding
- **Progressive difficulty:** 6 levels per pack, from signature sounds to full repertoires
- **Multiple game modes:** Campaign, Practice, Challenge, and Random Soundfield
- **Spatial audio training:** Stereo panning helps users locate birds in a soundscape
- **Real-time feedback:** Immediate scoring with confusion matrix analysis
- **Offline capable:** Progressive Web App (PWA) for field use

### Current Status:
- **Launched January 8, 2026** (8 days ago)
- **Rapid development:** 129 commits implementing full game engine, UI, and content system
- **87 species** currently available (primarily from Xeno-Canto)
- **Multiple curated packs:** Common Eastern US, Spring Warblers, Sparrows, Woodpeckers, Western Birds
- **Production-ready:** Deployed as PWA with offline support
- **All content properly attributed** with source links and recordist credits

### Educational Potential:
ChipNotes! aims to fill a gap in accessible bird sound training tools by:
- Making high-quality audio identification training free and accessible
- Providing structured progression from beginner to expert
- Offering immediate feedback and spaced repetition
- Supporting both desktop and mobile learning
- Complementing field guides with interactive practice

### Why Request Cornell Media at Launch?
Rather than building user base first, I'm prioritizing content quality and proper attribution from day one. Cornell's curated recordings would:
- Establish credibility for a new educational tool
- Ensure consistent quality across all species
- Support Cornell Lab's educational mission from the project's inception
- Demonstrate commitment to scientific accuracy over rapid growth

---

## Media Request Details

### Request Type
I am requesting access to high-quality audio recordings from the Macaulay Library for educational expansion of ChipNotes!

### Primary Request: Bulk Download (180 recordings)

**Species Count:** 18 Eastern US species
**Recordings per Species:** 10 carefully selected recordings
**Total Recordings:** 180 audio files

**Species List:**
1. Great Crested Flycatcher (GCFL)
2. Eastern Phoebe (EAPH)
3. Eastern Wood-Pewee (EWPE)
4. Acadian Flycatcher (ACFL)
5. White-eyed Vireo (WEVI)
6. Red-eyed Vireo (REVI)
7. Northern House Wren (NHWR)
8. Blue-gray Gnatcatcher (BGGN)
9. Swainson's Thrush (SWTH)
10. Veery (VEER)
11. Summer Tanager (SUTA)
12. Scarlet Tanager (SCTA)
13. Purple Finch (PUFI)
14. Rose-breasted Grosbeak (RBGR)
15. Dark-eyed Junco (DEJU)
16. Brown-headed Cowbird (BHCO)
17. European Starling (EUST)
18. Chimney Swift (CHSW)

**Selection Methodology:**
Recordings were systematically selected from North Carolina archives using:
- Quality score formula: `rating × √(num_ratings + 1)`
- Minimum quality threshold: Rating ≥ 3.0 OR ≥ 2 raters
- Vocalization diversity: Songs, calls, dawn songs, flight calls, etc.
- Seasonal coverage: Multiple months/years per species
- Average rating of selections: **4.32/5.00**

**Catalog Numbers:**
Complete list of 180 ML catalog numbers attached as CSV:
- `cornell_selected_recordings.csv`
- Includes: ML number, species, rating, vocalization type, recordist

### Secondary Request: API Access for Educational Developers

In addition to the immediate bulk download, I am requesting consideration for:

**API access or programmatic download capability** for educational/non-commercial developers.

**Rationale:**
- Facilitates future expansions (e.g., upcoming warbler audit with 30+ species)
- Enables systematic quality control and metadata management
- Reduces manual workload for both Cornell staff and developers
- Supports reproducible, documented audio selection processes
- Maintains Cornell's attribution requirements programmatically

**Use Case Example:**
A Python script that:
1. Queries by species code, quality rating, region
2. Downloads selected recordings with metadata
3. Auto-generates attribution files with ML numbers and recordist credits
4. Creates audit trail of all downloaded media

**Commitment:**
If granted API access, I commit to:
- Non-commercial, educational use only
- Proper attribution on all media (ML number, recordist, links)
- Reasonable rate limits and respectful usage
- Sharing code/tools that might benefit other educational developers

---

## Attribution Plan

All Macaulay Library recordings will be properly credited following Cornell's guidelines:

### In-Application Attribution:
- **Bird Reference screen:** ML catalog number displayed with each clip
- **Expandable details:** Full recordist name, date, location
- **Source links:** Direct links to ML specimen pages
- **Credits page:** Comprehensive list of all ML media with recordist acknowledgments

### Example Attribution Format:
```
Great Crested Flycatcher - Song
ML347203291 • LynnErla Beegle • June 2021
North Carolina, United States
[Link to ML specimen page]
```

### In Code Repository:
- `data/clips.json` includes ML catalog numbers and recordist names
- `ATTRIBUTION.md` lists all Macaulay Library contributors
- Source code comments reference Cornell attribution requirements

---

## Technical Specifications

### Audio Processing:
All recordings will be processed to meet ChipNotes! requirements:
- **Format:** Converted to WAV (mono, 44.1kHz)
- **Duration:** Trimmed to 0.5-3.0 seconds
- **Normalization:** -16 LUFS for consistent playback
- **Spectrograms:** Auto-generated from processed audio
- **No pitch/speed changes:** Original recordings preserved (only trimming/normalization)

### Integration:
- Cornell audio tagged with `source: "macaulay"` in metadata
- ML catalog numbers stored for full traceability
- Credit links maintained in perpetuity
- Updates/corrections easy to apply via catalog number lookup

---

## Educational Value Alignment

ChipNotes! directly supports Cornell Lab's mission:

### Shared Goals:
- **Citizen Science:** Help birders develop identification skills for eBird contributions
- **Conservation:** Better birders = better data = better conservation outcomes
- **Accessibility:** Free tool removes financial barriers to birding education
- **Scientific Accuracy:** Expert-curated recordings from ML archive

### Intended Audience:
- **Students:** Structured learning for ornithology courses
- **Educators:** Free teaching tool for environmental education
- **Birders:** Skill development for field identification
- **Researchers:** Ear training for field study quality

### Development Approach:
This project demonstrates serious commitment through:
- **Systematic methodology:** Quality score formula for recording selection
- **Professional codebase:** 129 commits with comprehensive test coverage (522 tests)
- **Proper attribution infrastructure:** Automated credit tracking from day one
- **Open source:** Full transparency and community benefit
- **Long-term vision:** Multi-year roadmap for North American coverage

---

## Future Plans

### Immediate (2026):
- Add these 18 species to "Expanded Eastern US Birds" pack
- Complete warbler audit (review/curate 30+ spring warbler species)
- Generate icons for new species using AI-assisted design

### Near-term (2026-2027):
- Regional packs: Gulf Coast, Great Lakes, Rocky Mountains
- Advanced training: Song dialects, geographic variations
- Seasonal packs: Migration, winter specialties
- Integration with eBird API for personalized practice

### Long-term Vision:
- Comprehensive coverage of North American birds (600+ species)
- Multi-language support for international users
- Mobile apps (iOS/Android) for field training
- Educator resources: Lesson plans, assessment tools
- Community features: Leaderboards, challenges, user-contributed packs

All expansion will maintain Cornell attribution standards and support the broader birding education community.

---

## Licensing and Usage Commitment

### Intended Use:
- **Educational:** Bird sound identification training
- **Non-commercial:** Free application, no revenue generation
- **Open source:** Code publicly available (MIT License)
- **Attribution compliant:** Full credit to Cornell Lab and recordists

### Not Intended For:
- Commercial products or paid services
- Resale or redistribution of raw audio files
- Competitive products to Cornell's commercial offerings
- Any use that violates Cornell's mission or values

### Data Handling:
- Recordings hosted on GitHub Pages (publicly accessible)
- No DRM or access restrictions (educational fair use)
- Users can download processed clips for personal study
- Original ML files not redistributed (only processed versions)

---

## Contact Information

**Name:** Peter Repetti
**Email:** peter.repetti@gmail.com
**GitHub:** https://github.com/chrysogonum
**Project Repository:** https://github.com/chrysogonum/bird_sound_game

I am happy to provide additional information, discuss licensing terms, or adjust the request scope as needed. Thank you for considering this educational media request.

---

## Attachments

1. **cornell_selected_recordings.csv** - List of 180 ML catalog numbers with metadata
2. **cornell_selection_summary.txt** - Detailed analysis of selection methodology
3. **Screenshots** (if needed) - ChipNotes! application interface

---

## Submission Information

**Submit to:** Cornell Lab Helpdesk
**URL:** https://support.ebird.org/en/support/tickets/new
**Topic:** The Macaulay Library (Media Requests)
**Priority:** Normal
**Response Requested:** Approval for bulk download + API access discussion

---

*This request prepared January 16, 2026 for submission to Cornell Lab of Ornithology, Macaulay Library.*
