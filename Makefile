# SoundField: Birds - Ralph Loop Makefile
# Run `make help` for available targets

.PHONY: help all clean install lint test build dev
.PHONY: phase-a phase-b phase-c phase-d phase-e phase-f phase-g phase-h phase-i phase-j phase-k phase-l phase-m phase-n
.PHONY: smoke-a smoke-b smoke-c smoke-d smoke-e smoke-f smoke-g smoke-h smoke-i smoke-j smoke-k smoke-l smoke-m smoke-n
.PHONY: validate-schemas validate-clips validate-packs

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
	@echo "Smoke Tests:"
	@echo "  make smoke-a        Smoke test Phase A"
	@echo "  make smoke-b        Smoke test Phase B"
	@echo "  ... (smoke-c through smoke-n available)"
	@echo ""
	@echo "Validation:"
	@echo "  make validate-schemas   Validate all JSON schemas"
	@echo "  make validate-clips     Validate clips.json"
	@echo "  make validate-packs     Validate pack definitions"

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

validate-clips:
	@echo "=== Validating clips.json ==="
	$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/clip.schema.json --data $(DATA_DIR)/clips.json
	$(PYTHON) -c "import json; d=json.load(open('$(DATA_DIR)/clips.json')); [assert 500<=c['duration_ms']<=3000 for c in d]; print('All clip durations valid')"

validate-packs:
	@echo "=== Validating pack definitions ==="
	@for pack in $(DATA_DIR)/packs/*.json; do \
		echo "Validating $$pack"; \
		$(PYTHON) $(SCRIPTS_DIR)/validate_schema.py --schema schemas/pack.schema.json --data $$pack; \
	done

# ============================================================================
# Aggregate Targets
# ============================================================================

all-phases: phase-a phase-b phase-c phase-d phase-e phase-f phase-g phase-h phase-i phase-j phase-k phase-l phase-m phase-n

all-smoke: smoke-a smoke-b smoke-c smoke-d smoke-e smoke-f smoke-g smoke-h smoke-i smoke-j smoke-k smoke-l smoke-m smoke-n
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
