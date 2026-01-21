# Data Validation & Quality Assurance

This document explains the bomb-proof data validation system for clips.json.

## The Problem

Cornell clips historically used different field names (`species_name`, `quality: 'A'`) than Xeno-Canto clips (`common_name`, `quality_score: 5`), causing runtime errors in the UI.

## The Solution: Multi-Layer Defense

### Layer 1: Source Correctness

**File:** `scripts/cornell_ingest.py`

The ingestion script now outputs correct field names from the start:
- ✅ Uses `common_name` instead of `species_name`
- ✅ Outputs schema-compliant JSON

### Layer 2: Automatic Normalization

**File:** `scripts/normalize_clips.py`

A universal normalizer that auto-fixes common issues:
- Copies `species_name` → `common_name` (legacy Cornell clips)
- Converts `quality: 'A'` → `quality_score: 5`
- Normalizes `vocalization_type` ("alarm call" → "call", "drum" → "call")
- Generates missing `clip_id` and `source_id` fields
- Sets default boolean values

**Usage:**
```bash
# Run manually
python3 scripts/normalize_clips.py data/clips.json

# Dry-run to preview changes
python3 scripts/normalize_clips.py data/clips.json --dry-run

# Automatic via Make
make normalize-clips
```

### Layer 3: Schema Validation

**File:** `schemas/clip.schema.json`

JSON Schema enforces required fields and types:
- Required: `clip_id`, `species_code`, `common_name`, `vocalization_type`, `duration_ms`, `quality_score`, `source`, `source_id`, `file_path`
- Validates: types, enums, constraints
- Allows: legacy fields for backward compatibility

**Usage:**
```bash
make validate-clips  # Runs normalize-clips first, then validates
```

### Layer 4: Pre-Commit Hook

**File:** `.githooks/pre-commit`

Automatically validates clips.json before allowing git commits.

**Install:**
```bash
git config core.hooksPath .githooks
```

Now any attempt to commit invalid clips.json will be blocked:
```
→ Validating clips.json before commit...
✗ clips.json validation FAILED
Run 'make validate-clips' to see errors
Commit aborted.
```

### Layer 5: Makefile Integration

**File:** `Makefile`

The `validate-clips` target automatically runs normalization before validation:

```bash
make validate-clips
# 1. Runs normalize-clips
# 2. Runs schema validation
# 3. Validates duration constraints
```

## Workflow for Adding New Clips

### From Cornell Source

```bash
# 1. Ingest (now outputs correct fields)
python3 scripts/cornell_ingest.py --input ~/cornell_audio --output data/candidates_cornell --clips-json data/clips.json

# 2. Merge clips safely
# ⚠️ DEPRECATED: python3 scripts/audio_tagger.py (overwrites clips.json!)
python3 scripts/merge_candidates.py data/candidates_cornell

# 3. Validate (normalizes + validates)
make validate-clips

# 4. Commit (pre-commit hook validates again)
git add data/clips.json
git commit -m "Add new Cornell clips"
```

### From Xeno-Canto

```bash
# 1. Ingest
python3 scripts/audio_ingest.py --output data/candidates_{CODE} --species "Species Name" --max-per-species 5

# 2. Copy WAV files and merge metadata
cp data/candidates_{CODE}/*.wav data/clips/
python3 scripts/merge_candidates.py data/candidates_{CODE}

# 3. Validate
make validate-clips

# 4. Commit
git add data/clips.json
git commit -m "Add new Xeno-Canto clips"
```

## Why This Is Bomb-Proof

1. **Prevention at Source**: Ingestion scripts output correct format
2. **Auto-Healing**: Normalizer fixes legacy/inconsistent data
3. **Schema Enforcement**: Validation catches missing/invalid fields
4. **Git Safety**: Pre-commit hook prevents bad data from being committed
5. **Continuous Integration**: Validation runs on every commit

## Maintenance

### When Adding New Ingestion Sources

1. Update `scripts/normalize_clips.py` with new field mappings if needed
2. Ensure new source outputs schema-compliant JSON
3. Test with `make validate-clips`

### When Changing Schema

1. Update `schemas/clip.schema.json`
2. Update `scripts/normalize_clips.py` if new normalizations needed
3. Run `make validate-clips` on existing data
4. Fix any validation errors

## Summary

You can't break it anymore because:
- ✅ Ingestion scripts output correct format
- ✅ Normalizer auto-fixes common issues
- ✅ Schema validation catches errors
- ✅ Pre-commit hook blocks bad commits
- ✅ `make validate-clips` runs full validation pipeline

**The bomb is defused.** 💣🛡️
