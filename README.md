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
| **Expanded Eastern Birds** | 39 | Eastern US species, 9 random per round (shuffle anytime) |
| **Sparrows** | 8 | Eight sparrow species with distinctive patterns |
| **Woodpeckers** | 7 | Drums, calls, and rattles from Downy to Pileated |
| **Western Backyard Birds** | 14 | Steller's Jay, Western Scrub-Jay, and more |
| **Warbler Academy** | 33 | High-pitched songs of migration (experts only!) |

**Custom Packs:** Build your own training session — drill a nemesis bird, compare confusing species head-to-head, or mix from any pack.

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

- **86 species** with **400+ curated clips** from Xeno-canto and Cornell Macaulay Library
- **Left/right stereo training** — spatial audio identification like real birding
- **Real spectrograms** generated for every clip (400x200px, 500-10000 Hz range)
- **Training Mode** — Toggle eye icon to show bird labels on tiles while learning
- **Taxonomic sorting** — Toggle between alphabetical and phylogenetic order with scientific names
- **Bird Reference** — Preview all sounds in the game, organized by pack
- **Pre-round preview** — Hear and see birds before playing
- **Confusion matrix** — See which birds you're mixing up in the round summary
- **Share score cards** — Download/share your results with bird icons and stats
- **Continuous play mode** — Relaxed practice with no timer
- **Custom pack builder** — Build targeted practice sessions
- **PWA support** — Install on mobile, play offline (clips cache as you play)

## Species Coverage

**86 species** across 6 packs:

- Eastern backyard birds (cardinals, wrens, jays, chickadees, robins, bluebirds)
- Western backyard birds (Steller's Jay, Western Scrub-Jay, Black-capped Chickadee, White-crowned Sparrow)
- Woodpeckers (7 species from Downy to Pileated)
- Sparrows (8 species including White-throated, White-crowned, Song, Field)
- Warblers (33 spring migration species)

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

*Built with [Claude Code](https://claude.ai/code) · v3.37 · January 2026*
