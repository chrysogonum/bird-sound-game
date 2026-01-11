SoundField: Birds - v1.x Fixes and v2.0 Planning

 Overview

 This plan organizes pre-v2.0 bug fixes and the v2.0 feature roadmap for the bird sound game. The codebase
 is well-structured (React + TypeScript + PixiJS 8, 522 tests passing, 317+ clips across 4 packs).

 ---
 Part 1: v1.x Fixes (Do Now, Before v2)

 These are bugs that should be fixed in the current main branch before starting v2 development.

 Fix 1: Service Worker Path Bug (Critical)

 Problem: Service worker registered at /sw.js but app deployed to /bird-sound-game/ on GitHub Pages. This
 causes caching failures and may explain mobile playback inconsistencies.

 Files to modify:
 - /src/ui-app/index.html (line 37) - change registration path
 - /src/ui-app/sw.js - update static asset paths

 Solution:
 // Change from: navigator.serviceWorker.register('/sw.js')
 // To: navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')

 Fix 2: Sound Repetition Prevention

 Problem: Same clip can play 5+ times per round (purely random selection with no tracking).

 Files to modify:
 - /src/ui-app/game/useGameEngine.ts - add clip usage tracking

 Solution: Track clipId -> usageCount per round, limit to 2-3 plays max, fallback to any clip if all maxed
 out.

 ---
 Part 2: Version Control Strategy

 Branching Approach (User Selected)

 main (current stable v1.x)
   └── v2-dev (all v2 development)
        ├── v2/cross-browser-audio
        ├── v2/simplified-menu
        ├── v2/custom-packs
        └── etc.

 Commands to set up:
 git checkout -b v2-dev
 # Feature branches merged into v2-dev, then v2-dev merged to main for release

 Android Testing Approach

 Since you're on Mac, options (in order of ease):
 1. Ask Android users to test - easiest, real device feedback
 2. BrowserStack/LambdaTest - cloud-based real device testing (free tiers available)
 3. Android Studio emulator - heavier but free, full control

 Recommendation: Start with real user testers, use BrowserStack for specific bug reproduction.

 ---
 Part 3: v2.0 Feature Roadmap

 Phase 1: Foundation

 1.1 Cross-Browser Audio (Chrome iOS Fix)

 Problem: Chrome iOS fails because it has restricted Web Audio API StereoPanner support.

 Solution: Create CrossBrowserAudioAdapter.ts with feature detection and fallback to gain-based manual
 panning.

 Files:
 - NEW: /src/audio/CrossBrowserAudioAdapter.ts
 - MODIFY: /src/audio/ChannelMixer.ts
 - MODIFY: /src/audio/AudioEngine.ts

 1.2 Simplified Main Menu

 Current: 4 modes (Learn, Practice, Challenge, Random) - 3 disabled
 New: Fun landing screen → single "Play" button → Pack Select → Level Select

 New User Flow:
 MainMenu (landing) → PackSelect → LevelSelect → PreRoundPreview → Gameplay → Summary

 Files:
 - MODIFY: /src/ui-app/screens/MainMenu.tsx - redesign as landing
 - NEW: /src/ui-app/screens/LevelSelect.tsx
 - MODIFY: /src/ui-app/App.tsx - add new route

 Phase 2: Enhanced Navigation

 2.1 Pre-Round Bird Preview

 Feature: Show the 9 random birds selected for the round (not all 27+), with:
 - Bird circles with codes
 - Tap to preview canonical sound
 - "Shuffle" button to reroll selection
 - "Ready" button to start

 Files:
 - NEW: /src/ui-app/screens/PreRoundPreview.tsx
 - MODIFY: /src/ui-app/game/useGameEngine.ts - move species selection earlier

 2.2 Level Navigation

 Feature: Jump to any level from any pack, better post-round navigation.

 Files:
 - MODIFY: /src/ui-app/screens/RoundSummary.tsx - add level picker, prev/next/any/menu options

 Phase 3: Advanced Features

 3.1 Custom Bird Pack

 Feature: User selects up to 9 birds from all available species to create custom pack.

 Files:
 - NEW: /src/ui-app/screens/CustomPackBuilder.tsx
 - NEW: /src/ui-app/hooks/useCustomPacks.ts
 - Storage: localStorage (with export/import)

 3.2 Continuous Play Mode

 Feature: Keep playing through all sounds (especially for expanded pack level 2). No timer, ends when all
 unique clips played or user quits.

 Files:
 - MODIFY: /src/ui-app/game/useGameEngine.ts - timer-free mode
 - MODIFY: Settings screen - add continuous play toggle

 Phase 4: Content Pipeline

 4.1 Enhanced Audio Ingestion

 Current: audio_ingest.py + clip-review.html work but need polish.

 Enhancements:
 - Modular pipeline: download → review → process → integrate
 - Keyboard shortcuts in review interface
 - Auto-spectrogram generation
 - Better batch operations

 New structure:
 scripts/audio_ingest/
   ├── downloader.py      # Xeno-canto API
   ├── processor.py       # Normalize, trim
   ├── integrator.py      # clips.json, spectrograms
   └── main.py           # Orchestrate

 Note on Macaulay Library: Research shows no public API, requires formal requests via helpdesk, primarily
 for research/educational use. Xeno-canto remains the best choice for this project.

 Phase 5: Visual Polish

 5.1 Bird Images in Circles

 Current: Plain circles with 4-letter codes
 New: Circles with bird images + small code label

 Image source options:
 - Icons/silhouettes (cleanest, smallest, easiest)
 - Photos (most recognizable, copyright concerns)
 - Illustrations (balanced, may need licensing)

 Recommendation: Start with stylized icons or silhouettes.

 Files:
 - NEW: /src/ui-app/game/BirdAssetLoader.ts
 - MODIFY: /src/ui-app/game/TileSprite.ts
 - NEW: /data/birds/icons/ directory

 5.2 Guitar Hero Effects

 Enhancements:
 - Hit explosions (particle bursts)
 - Streak flames
 - Glow effects on approaching tiles
 - Miss animations (red flash, shatter)

 Technologies: PixiJS Particle System, GSAP, Pixi Filters

 Files:
 - MODIFY: /src/ui-app/game/PixiGame.tsx
 - NEW: /src/ui-app/game/Effects.ts

 ---
 Part 4: Implementation Order Summary

 Immediate (v1.x - before branching)

 1. Fix service worker path bug
 2. Add sound repetition prevention
 3. Deploy and verify mobile caching fixed

 v2.0 Phase 1

 4. Create v2-dev branch
 5. Cross-browser audio adapter
 6. Simplified main menu + level select screen

 v2.0 Phase 2

 7. Pre-round bird preview
 8. Enhanced level navigation

 v2.0 Phase 3

 9. Custom bird pack builder
 10. Continuous play mode

 v2.0 Phase 4

 11. Modular audio ingestion pipeline
 12. Enhanced clip review interface

 v2.0 Phase 5

 13. Bird images in circles
 14. Visual effects (particles, glow, animations)

 ---
 Part 5: Key Files Reference

 | Purpose                     | File Path                            |
 |-----------------------------|--------------------------------------|
 | Service worker registration | /src/ui-app/index.html               |
 | Service worker              | /src/ui-app/sw.js                    |
 | Core game logic             | /src/ui-app/game/useGameEngine.ts    |
 | Audio engine                | /src/audio/AudioEngine.ts            |
 | Channel panning             | /src/audio/ChannelMixer.ts           |
 | Main menu                   | /src/ui-app/screens/MainMenu.tsx     |
 | Pack selection              | /src/ui-app/screens/PackSelect.tsx   |
 | Round summary               | /src/ui-app/screens/RoundSummary.tsx |
 | App routing                 | /src/ui-app/App.tsx                  |
 | PixiJS rendering            | /src/ui-app/game/PixiGame.tsx        |
 | Audio ingestion             | /scripts/audio_ingest.py             |
 | Clip review tool            | /data/clip-review.html               |
 | Level definitions           | /data/levels.json                    |
 | Clip metadata               | /data/clips.json                     |

 ---
 Part 6: Risks and Mitigations

 | Risk                                 | Mitigation
  |
 |--------------------------------------|------------------------------------------------------------------
 -|
 | Chrome iOS audio still fails         | Multiple fallback layers, mono audio as last resort, user warning
  |
 | Bird images bloat bundle             | WebP format, lazy loading, start with icons (~5KB each)
  |
 | localStorage limits for custom packs | Export/import JSON functionality
  |
 | Xeno-canto API changes               | Cache responses, retry logic, store candidates locally
  |

 ---
 Part 7: Ralph Loop Suitability

 Ralph loops work best for tasks with clear success criteria that can be verified automatically (tests
 pass, build succeeds, specific behavior works). Here's the breakdown:

 Good for Ralph Loops

 | Task                        | Why                                        | Success Criteria
           |
 |-----------------------------|--------------------------------------------|------------------------------
 ----------|
 | Service worker path fix     | Well-defined bug, small scope              | Build succeeds, SW registers
 correctly |
 | Sound repetition prevention | Clear requirement, testable                | Tests pass, max 3 repeats per
  clip     |
 | Cross-browser audio adapter | Bounded problem, can test on real browsers | Audio plays in Chrome iOS
           |
 | Custom bird pack builder    | Clear feature spec                         | Can create/save/load custom
 pack       |
 | Level navigation            | Well-defined UI changes                    | Can jump to any level from
 summary     |

 Needs Human Guidance (Not Ideal for Ralph)

 | Task                        | Why                                                               |
 |-----------------------------|-------------------------------------------------------------------|
 | Main menu redesign          | Design decisions about visual appeal, "fun landing" is subjective |
 | Bird images                 | Need to choose icons vs photos vs illustrations, source assets    |
 | Guitar Hero effects         | Aesthetic choices about particle colors, animation timing         |
 | Audio pipeline enhancements | Requires judgment on clip quality during review                   |
 | Pre-round preview           | UX decisions about layout and interaction                         |

 Recommended Approach

 1. Start v1.x fixes with Ralph loop - Fix SW path + repetition prevention, verify with tests
 2. v2 foundation with Ralph - Cross-browser audio is perfect for a loop
 3. Pause for design decisions - Menu redesign, preview screen need your input
 4. Resume Ralph for features - Custom pack, level navigation, continuous play

 ---
 Decision: What's a Bug vs. Feature?

 Fix Now (v1.x): Issues that affect current users or break functionality
 - Service worker path (causes caching failures)
 - Sound repetition (affects gameplay quality)

 Save for v2: New functionality or major changes
 - Chrome iOS (requires architectural change)
 - Menu simplification (UX overhaul)
 - Everything else

 This approach keeps v1 stable while allowing focused v2 development on the branch.