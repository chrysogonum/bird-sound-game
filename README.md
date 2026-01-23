<p align="center">
  <img src="data/icons/OwlHeadphones.png" alt="ChipNotes Owl Professor" width="200">
</p>

<h1 align="center">ChipNotes!</h1>

<p align="center">
  <strong>Train your ear. Know the birds.</strong><br>
  A rhythm-game for learning bird songs, calls, and spectrograms.
</p>

<p align="center">
  <a href="https://chipnotes.app">Play Now</a> · <a href="https://chrysogonum.github.io/bird-sound-game/">Mirror</a>
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

| Pack | Species | Description |
|------|---------|-------------|
| **Eastern Backyard Birds** | 6 | Start here — Cardinal, Carolina Wren, Titmouse, Blue Jay, Crow, Robin |
| **Grassland & Open Country** | 9 | Meadowlarks, Dickcissels, Indigo Buntings — songs of prairies and field edges |
| **Expanded Eastern Birds** | 46 | Comprehensive eastern US species, 9 random per round |
| **Common Southeast Birds** | 26 | Core southeastern species for focused practice |
| **Woodpeckers** | 9 | Drums, calls, and rattles from Downy to Pileated (includes Acorn & Lewis's!) |
| **Sparrows** | 9 | Nine sparrow species with distinctive patterns |
| **Warbler Academy** | 33 | High-pitched songs of spring migration (experts only!) |
| **Western Backyard Birds** | 18 | Steller's Jay, Western Scrub-Jay, and more |

**Custom Packs:** Build your own training session from 106 species — drill a nemesis bird, compare confusing species head-to-head, or create regional lists. Filter by pack, search by name, and save up to 10 custom packs.

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

- **106 species** with **513 curated clips** from Xeno-canto and Cornell Macaulay Library
- **Left/right stereo training** — spatial audio identification like real birding
- **Real spectrograms** generated for every clip (400x200px, 500-10000 Hz range)
- **8 curated packs** ranging from beginner (6 birds) to expert (46 birds)
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

## Species Coverage

**106 species** across 8 packs:

- Eastern backyard birds (cardinals, wrens, jays, chickadees, robins, bluebirds, thrushes)
- Grassland & open country birds (Eastern Meadowlark, Dickcissel, Indigo Bunting, Barn Swallow, Eastern Kingbird, Common Yellowthroat, Yellow Warbler)
- Western backyard birds (Steller's Jay, Western Scrub-Jay, Black-capped Chickadee, White-crowned Sparrow, and more)
- Woodpeckers (9 species from Downy to Pileated, including Acorn and Lewis's)
- Sparrows (9 species including White-throated, White-crowned, Song, Chipping, Field, Savannah)
- Warblers (33 spring migration species — the ultimate challenge!)
- Southeast regional pack (26 core species for focused regional training)

Audio sourced from [Xeno-canto](https://xeno-canto.org) and [Cornell Macaulay Library](https://www.macaulaylibrary.org/), with full attribution in the Bird Reference.

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

New species are added via:

1. **Download** from Xeno-canto API (`scripts/audio_ingest.py`)
2. **Normalize** to -16 LUFS, trim to 0.5-3 seconds
3. **Review** using the clip curator tool (`data/review-clips.html`)
4. **Generate spectrograms** (`scripts/spectrogram_gen.py`)
5. **Update** clips.json with canonical/rejected flags

## Project Structure

```
src/ui-app/
├── screens/      # React screens (MainMenu, PackSelect, Gameplay, etc.)
├── game/         # PixiJS gameplay + useGameEngine hook
└── styles/       # Global CSS

data/
├── clips/        # Audio files (mono, 0.5-3s, normalized to -16 LUFS)
├── spectrograms/ # PNG spectrograms (400x200px)
├── icons/        # Bird icon assets
├── packs/        # Pack configuration JSON
└── clips.json    # Master clip metadata
```

## Support

ChipNotes is free and ad-free. If it helps you learn birds, consider:
- [Supporting ChipNotes](https://ko-fi.com/chipnotes)
- [Donating to Xeno-canto](https://xeno-canto.org/about/donate)
- [Supporting Cornell Macaulay Library](https://www.birds.cornell.edu/home/support/)

## License

MIT License

Bird recordings from [Xeno-canto](https://xeno-canto.org) and [Cornell Macaulay Library](https://www.macaulaylibrary.org/) retain their original licenses.

---

*Built with [Claude Code](https://claude.ai/code) · v3.54 · January 2026*
