<p align="center">
  <img src="data/icons/OwlHeadphones.png" alt="ChipNotes Owl Professor" width="200">
</p>

<h1 align="center">ChipNotes!</h1>

<p align="center">
  <strong>Your gamified study guide to bird sounds</strong><br>
  Learn to identify birds by their songs, calls, and spectrograms.
</p>

<p align="center">
  <a href="https://chrysogonum.github.io/bird-sound-game/">Play Now</a>
</p>

---

## What Is This?

ChipNotes! helps you learn to identify birds by sound. Each round presents bird vocalizations as tiles scrolling down the screen. You hear the sound, see its spectrogram, and tap the matching bird before it reaches the bottom.

**The dual approach:** Learn to recognize both what birds *sound* like and what their songs *look* like. Spectrograms reveal patterns—rising whistles, buzzy trills, rapid chips—that become as recognizable as the sounds themselves.

## How To Play

1. **Hear a sound** — A bird vocalization plays
2. **See the spectrogram** — Visual fingerprint of the sound scrolls down
3. **Tap the match** — Select the correct bird from the options at the bottom

Build streaks for bonus points. Miss too many and the round ends.

## Bird Packs

| Pack | Species | Description |
|------|---------|-------------|
| **Common Eastern US Backyard Birds** | 5 | Start here — bold, distinctive voices |
| **Expanded Eastern US Birds** | 39 | Eastern US species, 9 random per round |
| **Sparrows** | 8 | Subtle songs of eight sparrow species |
| **Woodpeckers** | 7 | Drums, calls, and rattles |
| **Western Backyard Birds** | 14 | Common backyard birds of western North America |
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

- **700+ curated clips** from Xeno-canto, hand-reviewed for quality
- **Real spectrograms** generated for every clip
- **Training Mode** — Toggle to show bird icons on tiles while learning
- **Progressive learning** from single canonical sounds to full repertoires
- **Continuous play mode** for relaxed practice (no timer)
- **Pre-round preview** to hear/see birds before playing
- **Custom pack builder** for targeted practice

## Species Coverage

**91 species** across 6 packs with 700+ audio clips:

- Eastern backyard birds (cardinals, wrens, jays, chickadees, crows, robins, bluebirds)
- Western backyard birds (Steller's Jay, Western Scrub-Jay, Black-capped Chickadee, White-crowned Sparrow, and more)
- Woodpeckers (7 species from Downy to Pileated)
- Sparrows (8 species including White-throated, White-crowned, Song, Field)
- Warblers (33 spring migration species)

Audio sourced from [Xeno-canto](https://xeno-canto.org) and [Cornell Lab of Ornithology](https://www.birds.cornell.edu/), with quality A ratings.

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
