PRD: Working Title — “SoundField: Birds”
0. Product Vision & Goals
Vision
Create a rhythm-game–style audio experience that trains players to identify bird sounds in real time, including:
Species identity
Spatial position (left/right, later depth)
Temporal accuracy
The game should feel like DDR / Guitar Hero for the ears, not a quiz app.
Core Goals
Train auditory scene analysis for birders
Make bird sound ID fast, instinctive, and embodied
Start accessible → scale to realistic soundscapes
Use only publicly available bird audio data
Focus initially on common southeastern U.S. birds
Non-Goals (for v1)
No free-text entry of bird names
No full 3D spatial audio (head tracking) initially
No rare birds or vagrants
No AI sound classification (human-only ID)
1. Target Users
Primary
Beginner → intermediate birders
eBird / Merlin users who want to improve sound ID
Casual gamers with headphones
Secondary
Advanced birders seeking speed & multi-species challenge
Educators (classroom / workshops)
2. Core Gameplay Loop
Loop (10–60 seconds per round):
Game plays a timed audio “lane” containing bird vocalizations
Each sound appears at a specific:
Time window
Stereo position (L / R; later both)
Player identifies:
Which bird
Which side
At the right moment
Score updates continuously
Feedback is immediate (audio + visual)
Round ends → performance summary → retry / advance
Think:
DDR arrows = bird calls
Frets = species choices
Timing window = accuracy
3. Audio & Data Requirements (Critical)
3.1 Source Data (Public Only)
Primary sources:
Macaulay Library (Cornell Lab) – primary
Xeno-canto – supplemental
Selection criteria:
High signal-to-noise
Clear species ID
Call vs song labeled
Minimal overlap in raw recordings (we’ll mix ourselves)
3.2 Audio Preprocessing Pipeline
Each audio clip must be:
Trimmed to 0.5–3.0 sec
Normalized (LUFS target)
Tagged with:
species_code
common_name
vocalization_type (song / call)
quality_score
duration
Stored as mono assets
Stereo positioning is applied at playback time, not baked in.
3.3 Playback Engine Requirements
Must support:
Sample-accurate timing
Independent L / R panning per event
Overlapping sounds
Low latency (esp. mobile)
Future-ready for:
Binaural / HRTF
Distance simulation (volume + filtering)
4. Bird Scope (v1)
Geographic Scope
Southeastern United States
NC, SC, GA, TN, VA, FL (initial mental model)
Species Scope (v1)
Target: 30–50 species, all common.
Examples:
Northern Cardinal
Carolina Wren
Tufted Titmouse
Carolina Chickadee
Blue Jay
American Crow
Eastern Towhee
Northern Mockingbird
Red-bellied Woodpecker
Eastern Bluebird
White-throated Sparrow
Yellow-rumped Warbler
Mourning Dove
Common Grackle
Split into:
Tier A: ultra-common, distinctive
Tier B: common but confusable
5. Difficulty & Level Design
Level Axes
Difficulty increases along four independent axes:
Sound density
Species diversity
Spatial complexity
Timing tolerance
Example Level Progression
Level 1: Single Lane
One bird at a time
One ear only
Long gaps
Large timing window
4–6 species
Level 2: Alternating Stereo
One bird at a time
Alternates left / right
Shorter gaps
Level 3: Overlap Lite
Occasional overlap
Different species in each ear
Calls only
Level 4: Mixed Vocalizations
Songs + calls
Same species appearing twice
Faster tempo
Level 5+: Soundscape Mode
Multiple birds
Simultaneous overlap
Confusables
Tight timing windows
6. User Input System (Major Design Challenge)
Constraints
Must be fast
Must work without typing
Must scale to 50 species
Must be usable while listening
Proposed v1 Input Model: Radial Species Wheel
Screen shows a radial menu (8–12 birds per round)
Birds are pre-selected per level
Player:
Taps left/right side of screen to indicate ear
Flicks / taps bird icon to identify species
Optional assist:
Bird icons grouped by:
Color
Silhouette
Mnemonic cues
Timing Logic
Each sound has a scoring window
Input must occur during window
Late / early = partial credit
7. Scoring & Feedback
Scoring Dimensions
Each event scored on:
Species correctness
Spatial correctness (L/R)
Timing accuracy
Example:
Perfect: +100
Correct species, wrong side: +50
Correct side, wrong species: +25
Missed: 0
Feedback
Immediate:
Visual flash
Short tone
End of round:
Accuracy breakdown
Confusion matrix (“You confuse X with Y”)
Progress toward mastery
8. Game Modes (v1)
1. Campaign
Structured levels
Unlocks species gradually
2. Practice Mode
Focus on one species
Call vs song toggles
Slow playback
3. Challenge Mode
Timed
High score focus
Daily seed
9. UX & Accessibility
Audio
Mandatory headphone recommendation
Calibration step (left/right test)
Volume normalization
Visual
Minimal distraction during play
High-contrast icons
Colorblind-safe palette
Accessibility (Future)
Adjustable tempo
Larger timing windows
Visual-only practice mode
10. Tech Architecture (High Level)
Frontend
Unity / Godot / WebAudio-based stack
Mobile-first but desktop compatible
Backend
Static asset hosting (audio)
Metadata JSON
Optional leaderboard service
Data Storage
Species metadata
Player progress
Local caching of audio packs
11. Metrics of Success
Learning Metrics
Improved accuracy over time
Reduced confusion pairs
Faster response times
Engagement Metrics
Daily streaks
Level completion rate
Session length
12. Ralph-Loop-Friendly Phase Breakdown
Phase A: Audio asset ingestion & tagging
Phase B: Stereo playback + timing engine
Phase C: Core input & scoring loop
Phase D: Level definitions & difficulty scaling
Phase E: UX polish & feedback systems
Phase F: Species expansion + practice tools

13. Game Modes: Structured vs Open Random
13.1 Core Distinction
The game supports two orthogonal concepts:
Sound Pools (what birds can appear)
Gameplay Modes (how they appear)
This separation is critical for scalability.
14. “Standard Random” Mode (Foundational)
Mode Name (working):
Free Soundscape / Random Soundfield
Description
A continuously randomized mode where any bird from the selected pool may vocalize at any time, subject to difficulty constraints.
This is the most realistic and eventually the hardest mode.
Rules
Species drawn randomly from the active pool
Vocalization type randomized (call / song)
Stereo position randomized
Overlap probability increases with difficulty
Timing windows tighten at higher tiers
Difficulty Scaling
Level 1: max 1 bird at a time
Level 2: rare overlap
Level 3: frequent overlap
Level 4+: chaotic dawn-chorus simulation
Use Case
Skill assessment
Free play
High-score chasing
“How good am I really?”

15. Themed Game Packs (Key Feature)
This is a major strength of the concept and should be first-class in the PRD.
Definition: Sound Pack
A sound pack is a curated subset of species + metadata rules.
Each pack defines:
Species list
Relative frequency weights
Allowed vocalization types
Optional seasonal context
16. Example Sound Packs
16.1 Spring Warbler Songs
Focus:
Song-heavy
High-pitched
Confusable species
Species Examples:
Yellow-rumped Warbler
Pine Warbler
Black-throated Green Warbler
Northern Parula
Prairie Warbler
Common Yellowthroat
Rules:
Songs only (or 90% songs)
Faster tempo
Reduced gap between events
Higher overlap probability
Learning Outcome:
Song pattern recognition
Warbler separation under pressure
16.2 Sparrow Pack
Focus:
Short chips
Similar call structure
Subtle differences
Species Examples:
Song Sparrow
Chipping Sparrow
Field Sparrow
White-throated Sparrow
Savannah Sparrow
Rules:
Calls emphasized
Lower volume variance
Shorter clips
Tight timing windows
Learning Outcome:
Fine-grained auditory discrimination
16.3 Woodpeckers & Drummers
Focus:
Percussive sounds
Rhythmic patterns
Species Examples:
Red-bellied Woodpecker
Downy Woodpecker
Hairy Woodpecker
Pileated Woodpecker
Yellow-bellied Sapsucker
Rules:
Includes drums + calls
Rhythm-based scoring bonus
Stereo placement exaggerated for impact
Learning Outcome:
Recognizing non-vocal sounds
Rhythm differentiation
17. Pack Composition Rules (Data Model)
Each pack can be defined via a JSON spec (Ralph-loop friendly):
{
  "pack_id": "spring_warblers",
  "display_name": "Spring Warbler Songs",
  "species": ["parula", "yewar", "btgnwa"],
  "vocalization_weights": {
    "song": 0.9,
    "call": 0.1
  },
  "overlap_multiplier": 1.3,
  "tempo_multiplier": 1.2
}
This allows:
Rapid creation of new packs
Easy community or DLC-style expansion
Seasonal rotations
18. Mode × Pack Matrix
Any mode can run on any pack:
Mode	Pack Example	Experience
Campaign	Common Birds	Guided learning
Random Soundfield	All SE Birds	Realistic chaos
Challenge	Sparrow Pack	Confusion stress-test
Practice	Woodpeckers	Focused drilling
Daily Seed	Spring Warblers	Shared leaderboard
This matrix is a design superpower.
19. Progression & Unlocking (Optional but Strong)
Unlock Models
Packs unlocked via:
Campaign progress
Skill thresholds
Seasonal availability
Mastery Tracking
Per pack:
Accuracy %
Best streak
Confusion pairs
Time-to-response trends
This creates long-term retention without needing endless species expansion.
20. Ralph-Loop Phase Extensions
Add these cleanly:
Phase G: Sound pack schema & loader
Phase H: Pack-specific difficulty modifiers
Phase I: Random Soundfield mode
Phase J: Pack-based progression & stats
Each phase is isolated and testable.

21. Core Design Principle: Audio-First, Visual-Augmented
The game is never a spectrogram quiz.
Instead:
Audio is always primary
Spectrograms act as optional, time-aligned visual affordances
Players can choose to rely on:
Audio only
Audio + visual pattern recognition
Or gradually fade visuals as skill increases
This mirrors real-world learning:
“I hear it → I recognize the shape → eventually I don’t need the shape.”
22. Spectrograms as “Notes” (DDR/Guitar Hero Analogy)
Concept
Each bird vocalization generates a scrolling spectrogram tile that moves toward a “hit zone” as the sound plays.
Think:
Guitar Hero notes → spectrogram snippets
Lanes → left / right ear channels
Timing window → when the sound occurs
Key Insight
You are not showing full recordings—you’re showing tight, stylized, cropped spectrograms that map exactly to the sound event.
23. Spectrogram Rendering Rules
23.1 Generation
Spectrograms are:
Precomputed from the same audio clips used for playback
Log-frequency scale (bird-appropriate)
Cropped tightly to the vocalization
Rendered with consistent color mapping
23.2 Display Constraints
Only the active vocalization window is visible
No scrolling background noise
No time axis labels (keep it intuitive)
Minimal UI chrome
This prevents cognitive overload.
24. Stereo Mapping & Visual Lanes
Left / Right Encoding
Left-ear sounds appear in left visual lane
Right-ear sounds appear in right visual lane
Simultaneous birds → simultaneous lanes
Future extension:
Vertical offset or brightness → perceived distance
25. Gameplay Modes: Visual Dependency Spectrum
This is a huge design win.
Mode A: Audio + Spectrogram (Beginner)
Full spectrogram visible
Slower tempo
Larger timing windows
Ideal for learning shapes:
“Cardinal = thick whistle”
“Chipping Sparrow = vertical tick”
Mode B: Audio + Faded Spectrogram (Intermediate)
Spectrogram fades after first 30–50% of sound
Forces early recognition
Encourages audio-first processing
Mode C: Audio-Only (Advanced)
No spectrograms
Same soundscape complexity
True field-skill test
Players can toggle modes, or modes can be enforced by difficulty tier.
26. Spectrograms as an Input Aid (Important)
This helps with the fast input problem.
Highlighting on Selection
When a player selects a bird:
The spectrogram tile briefly:
Glows (correct)
Shakes / dims (incorrect)
This reinforces:
Shape ↔ species ↔ sound mapping
27. Confusion Feedback via Spectrograms
End-of-round analytics can include:
“You frequently confuse Chipping Sparrow and Field Sparrow.”
With:
Side-by-side spectrogram thumbnails
Short audio replays
Optional “spot the difference” drill
This is extremely powerful pedagogically.
28. Accessibility & Inclusivity Upside
Spectrograms are not just eye candy—they enable:
Hard-of-hearing users to participate
Visual learners to excel
Mixed-modality training (strong learning science support)
You are quietly making this game much more inclusive.
29. Data & Asset Implications
Asset Bundle Per Vocalization
Each sound event now has:
Audio clip
Spectrogram image (or render instructions)
Metadata (species, call/song, duration)
This is still manageable and very Ralph-loop friendly.
30. Ralph-Loop Phase Additions
Add these phases cleanly:
Phase K: Spectrogram generation pipeline
Phase L: Spectrogram tile renderer & lane logic
Phase M: Visual difficulty modulation (fade, hide, distort)
Phase N: Confusion analytics & spectrogram-based feedback
Each phase is isolated and testable.
31. Strategic Differentiation (Important)
With this addition, your product becomes:
The only bird-sound game that trains real-time auditory scene analysis with optional spectrogram scaffolding.
None of:
Bird Song Hero
Larkwire
Merlin
do this in a performance context.

Updated Section: Spectrogram System (Authoritative)
Spectrograms are always accurate, time-aligned visualizations of the audio being played.
Generated from the same audio assets
Continuous rolling display per channel
No alteration of time or frequency structure
Visual parameters (contrast, brightness) may vary by difficulty
Structural parameters (shape, timing, pitch) never vary
The system must guarantee:
If you learn the shape here, you will recognize it in the field.
Updated Section: Difficulty Scaling
Difficulty increases by modifying event density, not audio content.
Primary difficulty levers:
Reduced silence between events
Increased probability of overlap
Increased species diversity
Narrower scoring windows
Optional fading of spectrogram visibility (not distortion)
Explicitly excluded:
Speeding up or slowing down audio
Pitch shifting
Visual deception
Updated Section: Rolling Spectrogram Lanes
Each audio channel (left/right) has:
One continuous spectrogram strip
A visible “present moment” cursor
A short look-back window (recent past)
Players learn to:
Watch patterns emerge
Anticipate before full phrases complete
Associate early shape with species
This mirrors real birding skill:
You ID the bird before the song finishes.

Next Artifact #1 (Recommended)
Canonical PRD v1.0
One document
All decisions locked
No open questions
Ready to hand to an agent
I can assemble this cleanly next.
Next Artifact #2
Ralph Loop – Phase K Prompt
Build the spectrogram generation + rolling display engine using a fixed audio set of ~10 bird calls.
This would include:
Audio ingestion
Spectrogram computation
Rolling render logic
Sync with playback
Next Artifact #3
Species Pack v0: “Common SE Birds”
10–12 species
Calls + songs
Clean metadata
Enough to test overlap and confusion