# Canonical Flags - Critical Data Integrity Documentation

## Overview

The `canonical` flag in `clips.json` is the **most important piece of curated data** in ChipNotes. Each species should have exactly **one canonical clip** marked as its "signature" sound.

## Why Canonical Flags Are Critical

### 1. Essential for Gameplay
- **Level 1 (Introduction)**: Uses ONLY canonical clips to introduce each species
- Without canonical flags, Level 1 breaks or shows random clips
- Players' first impression of each species comes from the canonical clip

### 2. Essential for UI
- **Bird Reference**: Displays canonical clips with special "signature" indicators
- Helps users quickly identify the best representative sound for each species
- Visual marker (⭐ or similar) distinguishes canonical from other clips

### 3. Irreplaceable Human Judgment
- Canonical selection requires listening to all clips for a species
- Choosing the clearest, most representative vocalization
- Considering audio quality, background noise, typical vocalization pattern
- **Cannot be auto-generated** - requires human expertise

### 4. Hundreds of Hours of Work
- 86+ species × ~5-10 clips each = 500+ audio clips reviewed
- Each canonical decision represents careful listening and comparison
- Losing this data means re-reviewing hundreds of clips

## When Canonical Flags Are At Risk

### High-Risk Operations

1. **Taxonomy Migrations** (HIGHEST RISK)
   - Renaming species codes (e.g., AMGO → AGOL)
   - Renaming clip IDs to match new codes
   - **Historical incident**: January 2026 migration lost all 86 canonicals

2. **Bulk clips.json Transformations**
   - Filtering/subsetting clips
   - Regenerating from scratch
   - Merging data from multiple sources
   - Any script that rebuilds the JSON structure

3. **Data Import/Export**
   - Importing clips from external sources
   - Exporting subsets for testing
   - Converting formats

4. **Manual Editing**
   - Find/replace operations in text editor
   - Accidentally deleting entries
   - Copy/paste errors

## Protection Mechanisms

### 1. Pre-Commit Git Hook

Located at `.git/hooks/pre-commit`, this hook automatically:
- Counts canonical flags in staged clips.json
- Compares to HEAD count
- **BLOCKS commit** if canonical count decreased
- Alerts developer to investigate before allowing commit

### 2. Documentation Warnings

Critical warnings placed in:
- **CLAUDE.md** (main project guidance)
- **.claude/commands/add-bird.md** (species addition workflow)
- **This file** (comprehensive documentation)

### 3. Validation Commands

Before ANY clips.json modification:
```bash
# Record the baseline
python3 -c "import json; print(sum(1 for c in json.load(open('data/clips.json')) if c.get('canonical')))"
```

After modification:
```bash
# Verify it hasn't dropped
python3 -c "import json; print(sum(1 for c in json.load(open('data/clips.json')) if c.get('canonical')))"
```

### 4. Git History Safety Net

All canonical flag changes are tracked in git:
```bash
# Check recent clips.json changes
git log --oneline data/clips.json | head -20

# Count canonicals in any commit
git show COMMIT_HASH:data/clips.json | python3 -c "import json, sys; print(sum(1 for c in json.load(sys.stdin) if c.get('canonical')))"
```

## Recovery Procedures

### If Canonical Flags Are Lost

**STOP IMMEDIATELY - Do not commit!**

1. **Check git history** to find last good state:
   ```bash
   # Search for commits that changed canonicals
   git log --all --oneline --grep="canonical" | head -20

   # Check canonical count in recent commits
   for i in {1..10}; do
     count=$(git show HEAD~$i:data/clips.json | python3 -c "import json, sys; print(sum(1 for c in json.load(sys.stdin) if c.get('canonical')))")
     echo "HEAD~$i: $count canonicals"
   done
   ```

2. **Extract canonical mappings** from last good commit:
   ```bash
   # Example: Extract from 3 commits ago
   git show HEAD~3:data/clips.json | python3 -c "
   import json, sys
   clips = json.load(sys.stdin)
   canonical_map = {}
   for clip in clips:
       if clip.get('canonical'):
           canonical_map[clip['species_code']] = {
               'clip_id': clip['clip_id'],
               'source_id': clip.get('source_id'),
               'quality': clip.get('quality_score')
           }

   with open('/tmp/canonical_backup.json', 'w') as f:
       json.dump(canonical_map, f, indent=2)

   print(f'Saved {len(canonical_map)} canonical mappings to /tmp/canonical_backup.json')
   "
   ```

3. **Restore canonical flags** to current clips.json:
   ```python
   import json

   # Load backup mappings
   with open('/tmp/canonical_backup.json') as f:
       canonical_map = json.load(f)

   # Load current clips
   with open('data/clips.json') as f:
       current_clips = json.load(f)

   # Clear all canonical flags
   for clip in current_clips:
       clip['canonical'] = False

   # Restore by matching source_id (most reliable)
   restored = 0
   for species, data in canonical_map.items():
       for clip in current_clips:
           if (clip['species_code'] == species and
               clip.get('source_id') == data['source_id']):
               clip['canonical'] = True
               restored += 1
               break

   print(f'Restored {restored} canonical flags')

   # Save
   with open('data/clips.json', 'w') as f:
       json.dump(current_clips, f, indent=2)
   ```

4. **Verify restoration**:
   ```bash
   python3 -c "import json; print(sum(1 for c in json.load(open('data/clips.json')) if c.get('canonical')))"
   ```

### Real-World Example: January 2026 Recovery

See commit `4cb08eb` for a complete recovery procedure:
- Taxonomy migration lost all 86 canonical flags
- Recovery extracted mappings from pre-migration commit
- Matched clips by source_id where possible
- Smart-matched remaining by species + quality score
- 100% recovery achieved

## Best Practices

### For Script Developers

1. **Never assume canonical flags will be preserved** through transformations
2. **Explicitly copy canonical flags** when creating new clip entries
3. **Test canonical preservation** in all bulk operations
4. **Document canonical handling** in script comments

### For Manual Editors

1. **Use the review tool** (scripts/review_clips.py) for canonical changes
2. **Never manually edit** canonical flags in text editor
3. **Always commit after** review tool changes (it validates canonical uniqueness)

### For Workflow Designers

1. **Make canonical selection** a required step in species addition workflow
2. **Validate canonical presence** before deploying to production
3. **Include canonical status** in clip audit reports

## Monitoring

### Regular Audits

Run monthly to ensure canonical integrity:
```bash
# Count canonicals per species
python3 -c "
import json
from collections import defaultdict

clips = json.load(open('data/clips.json'))
canonical_by_species = defaultdict(int)

for clip in clips:
    if clip.get('canonical'):
        canonical_by_species[clip['species_code']] += 1

# Check for problems
multi_canonical = {sp: count for sp, count in canonical_by_species.items() if count > 1}
total_species = len(set(c['species_code'] for c in clips))
species_with_canonical = len(canonical_by_species)

print(f'Total species: {total_species}')
print(f'Species with canonical: {species_with_canonical}')
print(f'Species missing canonical: {total_species - species_with_canonical}')

if multi_canonical:
    print(f'\n⚠️  Species with multiple canonicals (ERROR):')
    for sp, count in multi_canonical.items():
        print(f'  {sp}: {count} canonicals')
"
```

Expected output:
- Total species: ~92
- Species with canonical: 86-92
- Species missing canonical: 0-6 (acceptable for newly added species)
- Multiple canonicals: **NONE** (this is an error)

## Questions & Answers

**Q: Can I auto-generate canonical flags from highest quality clips?**
A: No. Quality score alone doesn't determine the best representative clip. Human judgment is required.

**Q: What if I'm adding a new species - when do I set canonical?**
A: Set canonical during the review step (Step 4 in add-bird workflow). Use the review tool's "Set Canonical" button.

**Q: Can a species have multiple canonical clips?**
A: No. Exactly one canonical per species. The review tool enforces this constraint.

**Q: What if I delete a canonical clip?**
A: The review tool will prompt you to select a new canonical before allowing the deletion.

**Q: How do I change which clip is canonical?**
A: Use the review tool. Click "Set Canonical" on the new clip; the old canonical flag automatically clears.

## Summary

**Remember:**
- Canonical flags = hundreds of hours of irreplaceable human curation
- Essential for gameplay (Level 1) and UI (Bird Reference)
- Protected by git hooks, but **manual vigilance still required**
- If lost, recover from git history immediately
- **When in doubt, check canonical count before and after ANY operation**

**The golden rule:** If you're modifying clips.json and don't explicitly handle canonical flags, you're probably breaking something.
