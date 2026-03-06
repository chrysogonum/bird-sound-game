<p align="center">
  <img src="data/icons/OwlHeadphones.png" alt="ChipNotes Owl Professor" width="200">
</p>

<h1 align="center">ChipNotes!</h1>

<p align="center">
  <strong>Train your ear. Know the birds.</strong><br>
  A rhythm-game for learning bird songs, calls, and spectrograms.
</p>

<p align="center">
  <a href="https://chipnotes.app">Play Now</a>
</p>

---

## What Is This?

ChipNotes! is an audio training game that teaches you to identify birds by sound. Bird vocalizations play through your **left or right ear** while spectrograms scroll across the screen. Identify which bird is singing and tap the correct side before the tile passes the scoring zone.

**Why left/right?** It mimics real birding! In the field, you're constantly triangulating: "Cardinal to my left, chickadee to my right, warbler... somewhere up there?" Training your ears to separate simultaneous sounds dramatically sharpens your birding skills.

**The dual approach:** Learn to recognize both what birds *sound* like and what their songs *look* like. Spectrograms reveal patterns—rising whistles, buzzy trills, rapid chips—that become as recognizable as the sounds themselves.

## How To Play

1. **Hear a sound** — A bird vocalization plays in your left or right ear
2. **See the spectrogram** — Visual fingerprint of the sound scrolls across
3. **Tap the match** — Select the correct bird on the correct side (left/right)

Each round is 30 seconds. Use headphones for the best experience!

## Bird Packs

### North America

| Pack | Species | Description |
|------|---------|-------------|
| **Backyard Birds** | 6 | Start here — Cardinal, Carolina Wren, Titmouse, Blue Jay, Crow, Robin |
| **Grassland & Open Country** | 10 | Meadowlarks, Dickcissels, Indigo Buntings — songs of prairies and field edges |
| **Eastern Birds** | 60 | Comprehensive eastern US species, 9 random per round |
| **Western Birds** | 26 | Steller's Jay, California Scrub-Jay, Oak Titmouse, Killdeer, and more from the Pacific coast to the Rockies |
| **Woodpeckers** | 9 | Drums, calls, and rattles from Downy to Pileated (includes Acorn & Lewis's!) |
| **Sparrows** | 9 | Nine sparrow species with distinctive patterns |
| **Warbler Academy** | 36 | High-pitched songs of spring migration (experts only!) |
| **All North America** | 122 | Every NA species in one pack |

### Europe

| Pack | Species | Description |
|------|---------|-------------|
| **Warblers & Skulkers** | 35 | European warblers, skulkers, and secretive songbirds — Nightingale to Firecrest |
| **Woodland & Field** | 17 | Thrushes, corvids, woodpeckers, and oriole |
| **Raptors** | 9 | Hawks, kites, buzzards, and falcons |
| **All European Birds** | 61 | Every EU species in one pack |

### New Zealand

| Pack | Species | Description |
|------|---------|-------------|
| **Common Birds** | 9 | Most common birds of gardens, parks, and forests — Tui, Fantail, Bellbird |
| **North Island** | 21 | Birds of Te Ika-a-Maui |
| **South Island** | 22 | Birds of Te Waipounamu |
| **All NZ Birds** | 37 | Every NZ species in ChipNotes |

NZ birds display their **Maori names** (e.g., Tui, Ruru, Kereru). Subspecies are distinguished with abbreviations: (NI) North Island, (SI) South Island, (Ch.) Chatham Islands.

**Custom Packs:** Build your own training session from any combination of species — drill a nemesis bird, compare confusing species head-to-head, or create regional lists. Filter by pack, search by name, and save up to 10 custom packs (up to 50 species each).

## Difficulty Levels

Each pack has 6 levels that progressively build your skills:

| Level | Name | Description |
|-------|------|-------------|
| 1 | **Meet the Birds** | One clear recording per bird, single ear |
| 2 | **Sound Variations** | Up to 3 recordings per bird — same species, different songs |
| 3 | **Full Repertoire** | All recordings in play |
| 4 | **Both Ears** | Sounds from either side — identify bird AND direction |
| 5 | **Variations + Both Ears** | Multiple recordings, either ear |
| 6 | **Master Birder** | Everything at once — you're a pro now |

## Features

- **220 species** with **1,436 curated clips** from [Xeno-canto](https://xeno-canto.org) and [NZ Department of Conservation](https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/) (Crown Copyright)
- **Three regions** — North American, European, and New Zealand birds (with Maori names)
- **16 curated packs** — 8 North American + 4 European + 4 New Zealand
- **Left/right stereo training** — spatial audio identification like real birding
- **Real spectrograms** generated for every clip (400x200px, 500-10000 Hz range)
- **Training Mode** — Toggle eye icon to show bird labels on tiles while learning
- **Taxonomic sorting** — Toggle between alphabetical and phylogenetic order with scientific names
- **Bird Reference** — Preview all sounds in the game, organized by pack, with canonical recordings marked
- **Pre-round preview** — Hear and see birds before playing, toggle spectrograms on/off
- **Confusion matrix** — See which birds you're mixing up in the round summary
- **Share score cards** — Download/share your results with bird icons and stats
- **Continuous play mode** — Relaxed practice with no timer
- **Custom pack builder** — Create and save up to 10 custom packs from any combination of species
- **Random mode** — Shuffle feature for large packs (randomly selects subset each round)
- **PWA support** — Install on mobile, play offline (clips cache as you play)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript |
| Game Rendering | PixiJS 8 |
| Audio | Web Audio API (sample-accurate playback, real-time stereo panning) |
| Hosting | GitHub Pages (PWA) at chipnotes.app |
| Audio Pipeline | Python (scipy, librosa, matplotlib) |

## Development

```bash
# Install dependencies
make install

# Run dev server (http://localhost:3000)
make dev

# Build for production
make build

# Run tests
make test

# Deploy to GitHub Pages
cd src/ui-app && npm run deploy
```

## Audio Pipeline

New species are added via **Clip Studio** (`scripts/clip_studio.py`), a unified browser-based tool for extraction and curation:

1. **Search** Xeno-canto for source recordings by species
2. **Extract clips** from waveforms — click to set start time, adjust duration
3. **Normalize** to -16 LUFS, mono, 0.5-3 seconds
4. **Generate spectrograms** automatically on extraction
5. **Curate** — rate quality, mark canonical clips, reject poor recordings

## Project Structure

```
src/ui-app/
├── screens/      # React screens (MainMenu, PackSelect, Gameplay, etc.)
├── game/         # PixiJS gameplay + useGameEngine hook
└── styles/       # Global CSS

data/
├── clips/        # NA + EU audio files (mono, 0.5-3s, normalized to -16 LUFS)
├── clips-nz/     # NZ audio files (DOC recordings)
├── spectrograms/ # PNG spectrograms (400x200px)
├── icons/        # Bird icon assets
├── packs/        # Pack configuration JSON
├── clips.json    # NA + EU clip metadata
└── clips-nz.json # NZ clip metadata
```

## Support

ChipNotes is free and ad-free. If it helps you learn birds, consider:
- [Supporting ChipNotes](https://ko-fi.com/chipnotes)
- [Donating to Xeno-canto](https://xeno-canto.org/about/donate)

## License

MIT License

Bird recordings from [Xeno-canto](https://xeno-canto.org) retain their original Creative Commons licenses (see full attribution in the Bird Reference). New Zealand bird recordings are courtesy of the [NZ Department of Conservation](https://www.doc.govt.nz/) (Crown Copyright).

---

*Built with [Claude Code](https://claude.ai/code) · v5.06 · March 2026*
