You are Claude Code running in the repo for ChipNotes.app / bird_sound_game. Implement “tablet-quality scaling” for the game using a container-driven scaling model (single source of truth), plus one tablet layout breakpoint. Do not bikeshed. Make concrete changes with tests and a clear PR summary.

GOALS (non-negotiable)
1) iPad/tablet shows “bigger everything” and uses screen real estate well.
2) Pixi canvas + DOM UI scale together from ONE computed scale factor.
3) Game should respond to: orientation changes, iPad split-screen resizing, and desktop window resizes.
4) Maintain phone behavior (no regressions).
5) Provide smoke + idempotency checks.

CONTEXT / CURRENT STATE (what you should assume)
- GameplayScreen.tsx currently initializes dimensions to fixed 400x400 (seen in grep).
- PixiGame.tsx creates a PIXI.Application and calls createLanes(app, width, height) with width/height passed from props.
- Global styles are in src/ui-app/styles/global.css.
- The current problem is fixed sizing and hard-coded pixel UI sizes that look tiny on iPad.

IMPLEMENTATION STRATEGY (follow this exactly)
A) Container-driven sizing
- Wrap Pixi game in a container div (e.g., <div ref={containerRef} className="gameContainer">).
- Use ResizeObserver to measure container width/height (NOT window.innerWidth/innerHeight).
- Store container dimensions in state; update on observer callbacks.
- Remove fixed 400x400 defaults except as a safe fallback for server render / initial mount.
- Ensure cleanup works and no observer leaks.

B) Single scale factor (ONE source of truth)
- Define “design space” for gameplay. Pick a fixed design size appropriate to the game. Use:
  - const DESIGN_W = 400;
  - const DESIGN_H = 400;
  (If the game is not square, infer from current layout; but default to 400x400 to match existing behavior.)
- Compute scale:
  - const raw = Math.min(containerW / DESIGN_W, containerH / DESIGN_H);
  - const scale = clamp(raw, 1.0, 2.25);  // phone stays ~1, tablets can grow
- Compute the “logical game size” in pixels:
  - gameW = Math.floor(DESIGN_W * scale)
  - gameH = Math.floor(DESIGN_H * scale)
- Center the game within the container (letterbox if needed). Use flex or CSS to center.

C) Pixi scaling model: Scale the stage (fast path)
- Keep createLanes and gameplay geometry in DESIGN units (400x400).
- In PixiGame.tsx:
  1) Initialize PIXI.Application with width/height equal to container pixel size OR gameW/gameH (choose the approach that avoids blur; see section D).
  2) Call app.renderer.resize(pixelW, pixelH) on dimension changes.
  3) Set app.stage.scale.set(scale) OR set a root container’s scale.
  4) Ensure the stage is positioned so the scaled content is centered.
- IMPORTANT: Don’t continuously recreate PIXI.Application on resize; resize the renderer and adjust transforms.

D) Crisp rendering on iPad (required)
- Configure PIXI.Application with:
  - resolution: Math.min(2, window.devicePixelRatio || 1)
  - autoDensity: true
- Ensure canvas CSS size matches the container size while internal buffer uses resolution.
- Verify no obvious blurriness from mismatched CSS sizing.

E) DOM UI scaling tied to the same scale
- Expose uiScale to CSS as a variable on a root element near GameplayScreen:
  - style={{ ["--ui-scale" as any]: scale }}
- In global.css:
  - Create/extend rules that multiply font sizes, spacing, and button sizes by var(--ui-scale).
  - Ensure minimum tap targets: 44px (use scaled size but never below 44px).
  - Avoid scaling icons/images in ways that break alignment.

F) Tablet layout breakpoint (one breakpoint only)
- Add one responsive layout mode for >= 768px (or when containerW >= 768):
  - Two-column layout:
    - Left: game area (centered and large)
    - Right: wheel/panels/controls
- Do not redesign everything; just ensure tablet no longer looks like a tiny centered phone screen.
- If wheel/panels are currently below the game, move them to the side on tablet.

G) Tests & checks
- Add at least:
  1) Smoke test: rendering GameplayScreen doesn’t throw and creates a Pixi canvas node.
  2) Idempotency-ish: resizing (simulate dimension change) should not create multiple canvases / multiple PIXI.Applications. Ensure only one canvas exists after a “resize” update.
- Use whatever test setup exists (vitest/jest). If none exists, add minimal vitest + react-testing-library config scoped to ui-app, and keep it light.
- Add a simple “dev sanity script” if helpful (e.g., npm run test:ui).

H) Deliverables
1) Code changes committed across appropriate files.
2) A short PR-style summary in the final response:
   - what changed
   - how scaling works
   - how to test locally
3) Mention any known limitations / follow-ups (max 5 bullet points).

FILES TO TOUCH (expected)
- src/ui-app/game/GameplayScreen.tsx
- src/ui-app/game/PixiGame.tsx
- src/ui-app/styles/global.css
- Any layout component(s) that host wheel/panels if needed

ACCEPTANCE CRITERIA
- On iPad, gameplay and UI elements are noticeably larger and fill space tastefully.
- On phone, it looks essentially the same as before.
- Rotate iPad or resize desktop: game resizes smoothly without reinitializing Pixi repeatedly.
- No console spam, no memory leaks.
- Tests pass.

DO THE WORK NOW
- Make the changes directly in the repo.
- If you discover something that conflicts with this plan, pick the closest implementation that satisfies the acceptance criteria and proceed.


Yes — there are a few real “don’t break iPhone feel” risks with this approach. They’re manageable, but you want to be deliberate about them.
1) “Phone suddenly looks different” risk (scale not exactly 1.0)
If your scale formula uses the container size and then clamps, a typical iPhone viewport might yield a scale slightly above/below 1 depending on safe-area padding, CSS margins, or if the container isn’t exactly 400×400 anymore. That can subtly change note size, lane spacing, timing feel.
Mitigation
Make the phone baseline explicit: if containerW < 768, force scale = 1 (or force design size to match the current phone layout exactly).
Or define minScale = 1.0 and ensure the container is sized so raw scale is never < 1 on phone.
2) Touch target / hitbox mismatch
If you scale the Pixi stage but DOM overlays (or pointer/touch handling) rely on unscaled coordinates, taps may register “off” from what users see.
Mitigation
Ensure all pointer mapping goes through the same transform:
Convert screen coords → local stage coords using Pixi’s coordinate transforms (e.g., toLocal) or divide by scale consistently.
Add a small “tap accuracy” smoke check on mobile if you can.
3) Performance + battery on older iPhones (devicePixelRatio + autoDensity)
Setting resolution: devicePixelRatio can increase the internal render buffer (especially on retina) and raise GPU/CPU cost. If you’re already close to frame budget, this might introduce stutter.
Mitigation
Cap resolution on phones: resolution = Math.min(2, dpr) is good; you might even do:
Math.min(2, dpr) on tablets/desktop
1.5 or 1 on small screens if perf is tight
Add a simple FPS/perf toggle later if needed.
4) Resizing creates “re-init churn” (audio/timing glitches)
If the resize handler accidentally recreates the PIXI.Application, you can get:
timing resets
duplicate canvases
duplicated event listeners
audio nodes reattached / doubled
Mitigation
Treat the Pixi app as “create once” and only call:
renderer.resize()
adjust stage.scale + stage.position
Add the idempotency test you described (“after resize, still one canvas”).
5) “Letterboxing” changes the feel of focus
On iPhone, if the container becomes taller/shorter due to new layout wrappers, the game might no longer sit where the thumb expects (especially if the main interaction zone shifts vertically).
Mitigation
Keep the phone layout identical: same vertical stack and same padding.
Centering is fine, but don’t introduce extra top/bottom whitespace on phones.
6) CSS variable scaling can accidentally bloat headers/menus on phone
If --ui-scale is applied too high in the tree, you might scale parts of the UI you didn’t intend (nav bars, modals, etc.).
Mitigation
Apply --ui-scale on a tight wrapper around the game screen, not :root.
Scope CSS rules to a class like .gameScreen so global UI doesn’t change.
Bottom line
This approach is safe for iPhone if you enforce a “phone baseline” (scale=1, layout unchanged) and are careful about:
coordinate transforms for touch
not recreating Pixi on resize
managing DPR for performance
If you want a single “guardrail rule” to protect iPhone:
On widths < 768px: keep the old layout + force scale=1 unless you have a strong reason not to
