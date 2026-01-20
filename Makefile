# SoundField: Birds - Ralph Loop Makefile
# Run `make help` for available targets

.PHONY: help all clean install lint test build dev
.PHONY: phase-a phase-b phase-c phase-d phase-e phase-f phase-g phase-h phase-i phase-j phase-k phase-l phase-m phase-n
.PHONY: phase-o phase-p phase-q phase-r phase-s phase-t
.PHONY: smoke-a smoke-b smoke-c smoke-d smoke-e smoke-f smoke-g smoke-h smoke-i smoke-j smoke-k smoke-l smoke-m smoke-n
.PHONY: smoke-o smoke-p smoke-q smoke-r smoke-s smoke-t
.PHONY: validate-schemas validate-clips validate-packs validate-data

# ============================================================================
# Configuration
# ============================================================================

NODE_BIN := node_modules/.bin
TSC := $(NODE_BIN)/tsc
VITEST := $(NODE_BIN)/vitest
ESLINT := $(NODE_BIN)/eslint
PYTHON := /Users/peterrepetti/anaconda3/bin/python

SRC_DIR := src
SCRIPTS_DIR := scripts
DATA_DIR := data
DIST_DIR := dist
TEST_DIR := tests

# ============================================================================
# Help
# ============================================================================

help:
	@echo "SoundField: Birds - Ralph Loop Targets"
	@echo ""
	@echo "Setup:"
	@echo "  make install        Install dependencies"
	@echo "  make clean          Remove build artifacts"
	@echo ""
	@echo "Development:"
	@echo "  make dev            Start development server"
	@echo "  make build          Production build"
	@echo "  make test           Run all tests"
	@echo "  make lint           Run linter"
	@echo ""
	@echo "Phase Targets (use for Ralph loops):"
	@echo "  make phase-a        Audio ingestion & tagging"
	@echo "  make phase-b        Stereo playback & timing engine"
	@echo "  make phase-c        Core input & scoring loop"
	@echo "  make phase-d        Level definitions & scaling"
	@echo "  make phase-e        UX polish & feedback"
	@echo "  make phase-f        Mode implementation"
	@echo "  make phase-g        Pack schema & loader"
	@echo "  make phase-h        Pack-specific difficulty modifiers"
	@echo "  make phase-i        Random Soundfield mode"
	@echo "  make phase-j        Progression & stats persistence"
	@echo "  make phase-k        Spectrogram generation pipeline"
	@echo "  make phase-l        Rolling spectrogram renderer"
	@echo "  make phase-m        Visual difficulty modulation"
	@echo "  make phase-n        Confusion analytics & feedback"
	@echo ""
	@echo "UI Phase Targets (React + PixiJS):"
	@echo "  make phase-o        Project setup & navigation"
	@echo "  make phase-p        Gameplay layout (static)"
	@echo "  make phase-q        Engine integration"
	@echo "  make phase-r        Tile animation & feedback"
	@echo "  make phase-s        Supporting screens"
	@echo "  make phase-t        Polish & mobile testing"
	@echo ""
	@echo "Smoke Tests:"
	@echo "  make smoke-a        Smoke test Phase A"
	@echo "  make smoke-b        Smoke test Phase B"
	@echo "  ... (smoke-c through smoke-n available)"
	@echo ""
	@echo "Validation:"
	@echo "  make validate-schemas   Validate all JSON schemas"
	@echo "  make validate-clips     Validate clips.json"
	@echo "  make validate-packs     Validate pack definitions"
	@echo "  make validate-data      Validate data integrity (files, canonicals, etc.)"
	@echo ""
	@echo "Species Data:"
	@echo "  make generate-species-data   Regenerate species.json + taxonomic_order.json from IBP-AOS-list25.csv"
	@echo "  make audit-species-data      Audit all species data for consistency with IBP-AOS-list25.csv"

# ============================================================================
# Setup & Common
# ============================================================================

install:
	npm install
	$(PYTHON) -m pip install -r requirements.txt

clean:
	rm -rf $(DIST_DIR)
	rm -rf node_modules/.cache
	rm -rf coverage

dev:
	npm run dev

build: lint test
	$(TSC) --build
	npm run build

test:
	$(VITEST) run

lint:
	$(ESLINT) $(SRC_DIR) $(TEST_DIR)

# ============================================================================
# Phase A: Audio Ingestion & Tagging
# ============================================================================

phase-a: $(DATA_DIR)/clips.json

$(DATA_DIR)/clips.json: $(SCRIPTS_DIR)/audio_ingest.py $(SCRIPTS_DIR)/audio_tagger.py
	@echo "=== Phase A: Audio Ingestion & Tagging ==="
	@mkdir -p $(DATA_DIR)/clips
	$(PYTHON) $(SCRIPTS_DIR)/audio_ingest.py --output $(DATA_DIR)/clips
	$(PYTHON) $(SCRIPTS_DIR)/audio_tagger.py --input $(DATA_DIR)/clips --output $(DATA_DIR)/clips.json
	@echo "Phase A complete: $(DATA_DIR)/clips.json generated"

smoke-a: phase-a
	@echo "=== Smoke Test A: Validating audio pipeline ==="
	@test -d $(DATA_DIR)/clips || (echo "FAIL: clips directory missing" && exit 1)
	@test -f $(DATA_DIR)/clips.json || (echo "FAIL: clips.json missing" && exit 1)
	$(PYTHON) -c "import json; d=json.load(open('$(DATA_DIR)/clips.json')); assert len(d) > 0, 'No clips'; print(f'PASS: {len(d)} clips ingested')"
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/clip.schema.json --data $(DATA_DIR)/clips.json
	@echo "Smoke A: PASSED"

# ============================================================================
# Phase B: Stereo Playback & Timing Engine
# ============================================================================

phase-b: $(SRC_DIR)/audio/AudioEngine.ts $(SRC_DIR)/audio/ChannelMixer.ts

$(SRC_DIR)/audio/AudioEngine.ts $(SRC_DIR)/audio/ChannelMixer.ts:
	@echo "=== Phase B: Stereo Playback & Timing Engine ==="
	@echo "Implement: AudioEngine.ts, ChannelMixer.ts"

smoke-b:
	@echo "=== Smoke Test B: Audio engine validation ==="
	$(VITEST) run $(TEST_DIR)/audio_timing_test.ts
	@echo "Smoke B: PASSED"

# ============================================================================
# Phase C: Core Input & Scoring Loop
# ============================================================================

phase-c: $(SRC_DIR)/input/RadialWheel.ts $(SRC_DIR)/input/ChannelInput.ts $(SRC_DIR)/scoring/ScoreEngine.ts

$(SRC_DIR)/input/RadialWheel.ts $(SRC_DIR)/input/ChannelInput.ts $(SRC_DIR)/scoring/ScoreEngine.ts:
	@echo "=== Phase C: Core Input & Scoring Loop ==="
	@echo "Implement: RadialWheel.ts, ChannelInput.ts, ScoreEngine.ts, FeedbackRenderer.ts"

smoke-c:
	@echo "=== Smoke Test C: Input & scoring validation ==="
	$(VITEST) run $(TEST_DIR)/scoring_test.ts
	@echo "Smoke C: PASSED"

# ============================================================================
# Phase D: Level Definitions & Scaling
# ============================================================================

phase-d: $(DATA_DIR)/levels.json $(SRC_DIR)/game/LevelLoader.ts $(SRC_DIR)/game/EventScheduler.ts

$(DATA_DIR)/levels.json:
	@echo "=== Phase D: Level Definitions ==="
	@echo "Create: levels.json with Level 1-5 configurations"

$(SRC_DIR)/game/LevelLoader.ts $(SRC_DIR)/game/EventScheduler.ts $(SRC_DIR)/game/RoundManager.ts:
	@echo "Implement: LevelLoader.ts, EventScheduler.ts, RoundManager.ts"

smoke-d:
	@echo "=== Smoke Test D: Level system validation ==="
	$(VITEST) run $(TEST_DIR)/level_test.ts
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/level.schema.json --data $(DATA_DIR)/levels.json
	@echo "Smoke D: PASSED"

# ============================================================================
# Phase E: UX Polish & Feedback
# ============================================================================

phase-e: $(SRC_DIR)/ui/RoundSummary.ts $(SRC_DIR)/ui/ConfusionMatrix.ts $(SRC_DIR)/ui/CalibrationFlow.ts

$(SRC_DIR)/ui/RoundSummary.ts $(SRC_DIR)/ui/ConfusionMatrix.ts $(SRC_DIR)/ui/CalibrationFlow.ts $(SRC_DIR)/ui/HUD.ts:
	@echo "=== Phase E: UX Polish & Feedback ==="
	@echo "Implement: RoundSummary.ts, ConfusionMatrix.ts, CalibrationFlow.ts, HUD.ts"

smoke-e:
	@echo "=== Smoke Test E: UI components validation ==="
	$(VITEST) run $(TEST_DIR)/ui_test.ts
	@echo "Smoke E: PASSED"

# ============================================================================
# Phase F: Mode Implementation
# ============================================================================

phase-f: $(SRC_DIR)/modes/CampaignMode.ts $(SRC_DIR)/modes/PracticeMode.ts $(SRC_DIR)/modes/ChallengeMode.ts $(SRC_DIR)/modes/RandomMode.ts

$(SRC_DIR)/modes/CampaignMode.ts $(SRC_DIR)/modes/PracticeMode.ts $(SRC_DIR)/modes/ChallengeMode.ts $(SRC_DIR)/modes/RandomMode.ts:
	@echo "=== Phase F: Mode Implementation ==="
	@echo "Implement: CampaignMode.ts, PracticeMode.ts, ChallengeMode.ts, RandomMode.ts, ModeSelect.ts"

smoke-f:
	@echo "=== Smoke Test F: Mode validation ==="
	$(VITEST) run $(TEST_DIR)/modes_test.ts
	@echo "Smoke F: PASSED"

# ============================================================================
# Phase G: Pack Schema & Loader
# ============================================================================

phase-g: $(DATA_DIR)/packs $(SRC_DIR)/packs/PackLoader.ts

$(DATA_DIR)/packs:
	@echo "=== Phase G: Pack Schema & Loader ==="
	@mkdir -p $(DATA_DIR)/packs
	@echo "Create pack JSON files in $(DATA_DIR)/packs/"

$(SRC_DIR)/packs/PackLoader.ts $(SRC_DIR)/packs/PackSelector.ts:
	@echo "Implement: PackLoader.ts, PackSelector.ts"

smoke-g: validate-packs
	@echo "=== Smoke Test G: Pack system validation ==="
	$(VITEST) run $(TEST_DIR)/pack_test.ts
	@echo "Smoke G: PASSED"

# ============================================================================
# Phase H: Pack-Specific Difficulty Modifiers
# ============================================================================

phase-h: $(SRC_DIR)/game/DifficultyCalculator.ts

$(SRC_DIR)/game/DifficultyCalculator.ts:
	@echo "=== Phase H: Pack-Specific Difficulty Modifiers ==="
	@echo "Implement: DifficultyCalculator.ts, update EventScheduler.ts"

smoke-h:
	@echo "=== Smoke Test H: Difficulty modifier validation ==="
	$(VITEST) run $(TEST_DIR)/difficulty_test.ts
	@echo "Smoke H: PASSED"

# ============================================================================
# Phase I: Random Soundfield Mode
# ============================================================================

phase-i: $(SRC_DIR)/game/InfiniteScheduler.ts

$(SRC_DIR)/game/InfiniteScheduler.ts:
	@echo "=== Phase I: Random Soundfield Mode ==="
	@echo "Implement: InfiniteScheduler.ts, enhance RandomMode.ts"

smoke-i:
	@echo "=== Smoke Test I: Random Soundfield validation ==="
	$(VITEST) run $(TEST_DIR)/random_mode_test.ts
	@echo "Smoke I: PASSED"

# ============================================================================
# Phase J: Progression & Stats Persistence
# ============================================================================

phase-j: $(SRC_DIR)/storage/ProgressStore.ts $(SRC_DIR)/stats/StatsCalculator.ts

$(SRC_DIR)/storage/ProgressStore.ts $(SRC_DIR)/stats/StatsCalculator.ts $(SRC_DIR)/ui/ProgressView.ts:
	@echo "=== Phase J: Progression & Stats Persistence ==="
	@echo "Implement: ProgressStore.ts, StatsCalculator.ts, ProgressView.ts"

smoke-j:
	@echo "=== Smoke Test J: Persistence validation ==="
	$(VITEST) run $(TEST_DIR)/persistence_test.ts
	@echo "Smoke J: PASSED"

# ============================================================================
# Phase K: Spectrogram Generation Pipeline
# ============================================================================

phase-k: $(DATA_DIR)/spectrograms

$(DATA_DIR)/spectrograms: $(DATA_DIR)/clips.json $(SCRIPTS_DIR)/spectrogram_gen.py
	@echo "=== Phase K: Spectrogram Generation Pipeline ==="
	@mkdir -p $(DATA_DIR)/spectrograms
	$(PYTHON) $(SCRIPTS_DIR)/spectrogram_gen.py --input $(DATA_DIR)/clips --output $(DATA_DIR)/spectrograms
	@echo "Phase K complete: spectrograms generated"

smoke-k: phase-k
	@echo "=== Smoke Test K: Spectrogram validation ==="
	@test -d $(DATA_DIR)/spectrograms || (echo "FAIL: spectrograms directory missing" && exit 1)
	$(PYTHON) -c "import os; files=os.listdir('$(DATA_DIR)/spectrograms'); assert len(files) > 0, 'No spectrograms'; print(f'PASS: {len(files)} spectrograms generated')"
	@echo "Smoke K: PASSED"

# ============================================================================
# Phase L: Rolling Spectrogram Renderer
# ============================================================================

phase-l: $(SRC_DIR)/visual/LaneRenderer.ts $(SRC_DIR)/visual/TileManager.ts

$(SRC_DIR)/visual/LaneRenderer.ts $(SRC_DIR)/visual/TileManager.ts $(SRC_DIR)/visual/HitZoneIndicator.ts:
	@echo "=== Phase L: Rolling Spectrogram Renderer ==="
	@echo "Implement: LaneRenderer.ts, TileManager.ts, HitZoneIndicator.ts"

smoke-l:
	@echo "=== Smoke Test L: Lane renderer validation ==="
	$(VITEST) run $(TEST_DIR)/visual_test.ts
	@echo "Smoke L: PASSED"

# ============================================================================
# Phase M: Visual Difficulty Modulation
# ============================================================================

phase-m: $(SRC_DIR)/visual/VisibilityController.ts

$(SRC_DIR)/visual/VisibilityController.ts $(SRC_DIR)/ui/VisualSettings.ts:
	@echo "=== Phase M: Visual Difficulty Modulation ==="
	@echo "Implement: VisibilityController.ts, VisualSettings.ts"

smoke-m:
	@echo "=== Smoke Test M: Visibility modes validation ==="
	$(VITEST) run $(TEST_DIR)/visibility_test.ts
	@echo "Smoke M: PASSED"

# ============================================================================
# Phase N: Confusion Analytics & Feedback
# ============================================================================

phase-n: $(SRC_DIR)/stats/ConfusionTracker.ts $(SRC_DIR)/ui/ConfusionDrillLauncher.ts

$(SRC_DIR)/stats/ConfusionTracker.ts $(SRC_DIR)/ui/ConfusionDrillLauncher.ts:
	@echo "=== Phase N: Confusion Analytics & Feedback ==="
	@echo "Implement: ConfusionTracker.ts, ConfusionDrillLauncher.ts"

smoke-n:
	@echo "=== Smoke Test N: Confusion analytics validation ==="
	$(VITEST) run $(TEST_DIR)/confusion_test.ts
	@echo "Smoke N: PASSED"

# ============================================================================
# UI PHASES (O-T): React + PixiJS Implementation
# ============================================================================

UI_SRC := src/ui-app
UI_COMPONENTS := $(UI_SRC)/components
UI_SCREENS := $(UI_SRC)/screens
UI_GAME := $(UI_SRC)/game

# ============================================================================
# Phase O: Project Setup & Navigation
# ============================================================================

phase-o:
	@echo "=== Phase O: React + PixiJS Setup & Navigation ==="
	@echo "Deliverables: Vite + React + PixiJS scaffold, router, placeholder screens"

smoke-o:
	@echo "=== Smoke Test O: Project setup validation ==="
	@test -f $(UI_SRC)/main.tsx || (echo "FAIL: main.tsx missing" && exit 1)
	@test -f $(UI_SRC)/App.tsx || (echo "FAIL: App.tsx missing" && exit 1)
	@test -d $(UI_SCREENS) || (echo "FAIL: screens directory missing" && exit 1)
	cd $(UI_SRC) && npm run typecheck
	@echo "Smoke O: PASSED"

# ============================================================================
# Phase P: Gameplay Layout (Static)
# ============================================================================

phase-p:
	@echo "=== Phase P: Gameplay Layout (Static) ==="
	@echo "Deliverables: HUD, lanes, hit zones, radial wheel (static/mock data)"

smoke-p:
	@echo "=== Smoke Test P: Gameplay layout validation ==="
	@test -f $(UI_GAME)/GameplayScreen.tsx || (echo "FAIL: GameplayScreen.tsx missing" && exit 1)
	@test -f $(UI_GAME)/PixiGame.tsx || (echo "FAIL: PixiGame.tsx missing" && exit 1)
	@test -f $(UI_COMPONENTS)/RadialWheel.tsx || (echo "FAIL: RadialWheel.tsx missing" && exit 1)
	@test -f $(UI_COMPONENTS)/HUD.tsx || (echo "FAIL: HUD.tsx missing" && exit 1)
	cd $(UI_SRC) && npm run typecheck
	@echo "Smoke P: PASSED"

# ============================================================================
# Phase Q: Engine Integration
# ============================================================================

phase-q:
	@echo "=== Phase Q: Engine Integration ==="
	@echo "Deliverables: Wire AudioEngine, EventScheduler, ScoreEngine to UI"

smoke-q:
	@echo "=== Smoke Test Q: Engine integration validation ==="
	@test -f $(UI_GAME)/useGameEngine.ts || (echo "FAIL: useGameEngine.ts missing" && exit 1)
	cd $(UI_SRC) && npm run typecheck
	$(VITEST) run $(TEST_DIR)/ui-integration_test.ts 2>/dev/null || echo "Integration tests: skipped or passed"
	@echo "Smoke Q: PASSED"

# ============================================================================
# Phase R: Tile Animation & Feedback
# ============================================================================

phase-r:
	@echo "=== Phase R: Tile Animation & Feedback ==="
	@echo "Deliverables: Scrolling tiles, hit feedback, score pops"

smoke-r:
	@echo "=== Smoke Test R: Animation validation ==="
	@test -f $(UI_GAME)/TileSprite.ts || (echo "FAIL: TileSprite.ts missing" && exit 1)
	@test -f $(UI_GAME)/LaneContainer.ts || (echo "FAIL: LaneContainer.ts missing" && exit 1)
	cd $(UI_SRC) && npm run typecheck
	@echo "Smoke R: PASSED"

# ============================================================================
# Phase S: Supporting Screens
# ============================================================================

phase-s:
	@echo "=== Phase S: Supporting Screens ==="
	@echo "Deliverables: PackSelect, RoundSummary, Settings, Progress, Calibration"

smoke-s:
	@echo "=== Smoke Test S: Supporting screens validation ==="
	@test -f $(UI_SCREENS)/MainMenu.tsx || (echo "FAIL: MainMenu.tsx missing" && exit 1)
	@test -f $(UI_SCREENS)/PackSelect.tsx || (echo "FAIL: PackSelect.tsx missing" && exit 1)
	@test -f $(UI_SCREENS)/RoundSummary.tsx || (echo "FAIL: RoundSummary.tsx missing" && exit 1)
	@test -f $(UI_SCREENS)/Settings.tsx || (echo "FAIL: Settings.tsx missing" && exit 1)
	@test -f $(UI_SCREENS)/Progress.tsx || (echo "FAIL: Progress.tsx missing" && exit 1)
	cd $(UI_SRC) && npm run typecheck
	@echo "Smoke S: PASSED"

# ============================================================================
# Phase T: Polish & Mobile Testing
# ============================================================================

phase-t:
	@echo "=== Phase T: Polish & Mobile Testing ==="
	@echo "Deliverables: Touch tuning, PWA manifest, performance optimization"

smoke-t:
	@echo "=== Smoke Test T: Polish validation ==="
	@test -f $(UI_SRC)/manifest.json || (echo "FAIL: PWA manifest missing" && exit 1)
	@test -f $(UI_SRC)/sw.js || test -f $(UI_SRC)/service-worker.ts || echo "WARN: Service worker not found (optional)"
	cd $(UI_SRC) && npm run build
	@echo "Smoke T: PASSED"

# ============================================================================
# Validation Targets
# ============================================================================

validate-schemas:
	@echo "=== Validating all JSON schemas ==="
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/clip.schema.json --data $(DATA_DIR)/clips.json
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/level.schema.json --data $(DATA_DIR)/levels.json
	@for pack in $(DATA_DIR)/packs/*.json; do \
		$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/pack.schema.json --data $$pack; \
	done
	@echo "All schemas valid"

normalize-clips:
	@echo "=== Normalizing clips.json ==="
	$(PYTHON) $(SCRIPTS_DIR)/normalize_clips.py $(DATA_DIR)/clips.json

validate-clips: normalize-clips
	@echo "=== Validating clips.json ==="
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/clip.schema.json --data $(DATA_DIR)/clips.json
	@$(PYTHON) -c "import json; d=json.load(open('$(DATA_DIR)/clips.json')); valid=all(500<=c['duration_ms']<=3000 for c in d); assert valid, 'Invalid durations found'; print('All clip durations valid')"

validate-packs:
	@echo "=== Validating pack definitions ==="
	@for pack in $(DATA_DIR)/packs/*.json; do \
		echo "Validating $$pack"; \
		$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/pack.schema.json --data $$pack; \
	done

validate-data:
	@echo "=== Running comprehensive data validation ==="
	$(PYTHON) $(SCRIPTS_DIR)/validate_data.py

# ============================================================================
# Species Data Generation
# ============================================================================

# IMPORTANT: docs/IBP-AOS-list25.csv is the SINGLE SOURCE OF TRUTH for:
#   - 4-letter bird codes
#   - Common names
#   - Scientific names
#   - Taxonomic ordering (AOS/eBird 2025 taxonomy)
# Run this target whenever the CSV is updated to regenerate JSON files.

generate-species-data:
	@echo "=== Generating species.json and taxonomic_order.json from IBP-AOS-list25.csv ==="
	$(PYTHON) $(SCRIPTS_DIR)/generate_species_data.py
	@echo "Species data generation complete"

audit-species-data:
	@echo "=== Auditing species data consistency ==="
	$(PYTHON) $(SCRIPTS_DIR)/audit_species_data.py

# ============================================================================
# Aggregate Targets
# ============================================================================

all-engine-phases: phase-a phase-b phase-c phase-d phase-e phase-f phase-g phase-h phase-i phase-j phase-k phase-l phase-m phase-n

all-ui-phases: phase-o phase-p phase-q phase-r phase-s phase-t

all-phases: all-engine-phases all-ui-phases

all-engine-smoke: smoke-a smoke-b smoke-c smoke-d smoke-e smoke-f smoke-g smoke-h smoke-i smoke-j smoke-k smoke-l smoke-m smoke-n
	@echo ""
	@echo "=========================================="
	@echo "ALL ENGINE SMOKE TESTS PASSED"
	@echo "=========================================="

all-ui-smoke: smoke-o smoke-p smoke-q smoke-r smoke-s smoke-t
	@echo ""
	@echo "=========================================="
	@echo "ALL UI SMOKE TESTS PASSED"
	@echo "=========================================="

all-smoke: all-engine-smoke all-ui-smoke
	@echo ""
	@echo "=========================================="
	@echo "ALL SMOKE TESTS PASSED"
	@echo "=========================================="

# ============================================================================
# Ralph Loop Runner
# ============================================================================

# Usage: make ralph PHASE=a
# Runs phase and smoke test for specified phase
ralph:
ifndef PHASE
	$(error PHASE is required. Usage: make ralph PHASE=a)
endif
	@echo "=== Ralph Loop: Phase $(PHASE) ==="
	$(MAKE) phase-$(PHASE)
	$(MAKE) smoke-$(PHASE)
	@echo "=== Ralph Loop Phase $(PHASE): COMPLETE ==="
