# Chirp!

A bird sound identification game that trains your ear and eye to recognize birds by their songs, calls, and spectrograms.

### [Play Now](https://chrysogonum.github.io/bird-sound-game/)

## What Is This?

Chirp! helps you learn to identify birds by sound. Each round presents bird vocalizations as tiles scrolling down the screen. You hear the sound, see its spectrogram, and tap the matching bird before it reaches the bottom.

**The dual approach:** Learn to recognize both what birds *sound* like and what their songs *look* like. Spectrograms reveal patterns—rising whistles, buzzy trills, rapid chips—that become as recognizable as the sounds themselves.

## How To Play

1. **Hear a sound** — A bird vocalization plays
2. **See the spectrogram** — Visual fingerprint of the sound scrolls down
3. **Tap the match** — Select the correct bird from the options at the bottom

Build streaks for bonus points. Miss too many and the round ends.

## Bird Packs

| Pack | Species | Description |
|------|---------|-------------|
| **5 Common Backyard Birds** | 5 | Start here — bold, distinctive voices |
| **Expanded Local Birds** | 35 | Eastern US species, 9 random per round |
| **Sparrows** | 7 | Subtle songs of seven sparrow species |
| **Woodpeckers** | 7 | Drums, calls, and rattles |
| **Warbler Academy** | 33 | High-pitched songs of migration (experts only!) |

**Custom Packs:** Build your own training session. Drill a nemesis bird, compare confusing species head-to-head, or mix from any pack.

## Difficulty Levels

Each pack has 6 levels of increasing challenge:

1. **Meet the Birds** — Signature sounds only, one at a time
2. **Getting Comfortable** — A few more variations
3. **Building Skills** — Overlapping sounds begin
4. **Intermediate** — Faster pace, more variety
5. **Advanced** — Full repertoires, tighter timing
6. **Expert** — All variations, maximum challenge

## Features

- **650+ curated clips** from Xeno-canto, hand-reviewed for quality
- **Real spectrograms** generated for every clip
- **Progressive learning** from single canonical sounds to full repertoires
- **Continuous play mode** for relaxed practice (no timer)
- **Pre-round preview** to hear/see birds before playing
- **Custom pack builder** for targeted practice

## Species Coverage

**74 species** across 5 packs with 670+ audio clips:

- Backyard birds (cardinals, wrens, jays, chickadees)
- Raptors (hawks, owl, hummingbird)
- Woodpeckers (7 species from Downy to Pileated)
- Sparrows (7 species including White-throated, Song, Field)
- Warblers (33 spring migration species)

All audio sourced from [Xeno-canto](https://xeno-canto.org) with quality A ratings.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + TypeScript |
| Game Rendering | PixiJS 8 |
| Audio | Web Audio API |
| Hosting | GitHub Pages (PWA) |
| Audio Pipeline | Python (scipy, matplotlib) |

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Audio Pipeline

New species are added via:

1. **Download** from Xeno-canto API (`scripts/audio_ingest.py`)
2. **Normalize** to -16 LUFS, trim to 3 seconds
3. **Review** using the clip curator tool (`data/review-clips.html`)
4. **Generate spectrograms** (`scripts/generate_spectrograms.py`)
5. **Update** clips.json with canonical/rejected flags

## Project Structure

```
src/ui-app/
├── screens/      # React screens (MainMenu, PackSelect, etc.)
├── game/         # PixiJS gameplay + useGameEngine hook
└── styles/       # Global CSS

data/
├── clips/        # WAV files (3s, normalized)
├── spectrograms/ # PNG spectrograms
├── icons/        # Bird icon assets
├── packs/        # Pack configuration JSON
└── clips.json    # Master clip metadata
```

## License

MIT License

Bird recordings from [Xeno-canto](https://xeno-canto.org) retain their original CC licenses.

---

*Built with [Claude Code](https://claude.ai/code)*
