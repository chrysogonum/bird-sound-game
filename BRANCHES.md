# Branch Strategy

This document tracks active development branches and their purposes.

## Active Branches

### `main` (Production)
- **Status**: Stable, deployed to production
- **Current Version**: v3.13
- **URL**: https://chrysogonum.github.io/bird-sound-game/
- **Description**: Production-ready code. Only merge fully tested, complete features here.
- **Protected**: Do NOT commit experimental work directly to main

### `feature/nz-birds` (Experimental)
- **Status**: Active development, experimental
- **Created**: January 16, 2026
- **Purpose**: Test feasibility of adding New Zealand bird species
- **Goal**: Add 10-60 NZ birds using DOC (Department of Conservation NZ) audio
- **Isolation**: Completely isolated from production - safe to experiment
- **See**: `docs/nz-birds-plan.md` for detailed roadmap

**Why isolated?**
- New audio source (DOC NZ vs Cornell/Xeno-canto)
- Untested file formats and quality
- Need icon artwork for 10+ new species
- Māori names/cultural considerations
- Don't want to contaminate production if this fails

**Merge Strategy:**
- Test thoroughly on this branch first
- Only merge to `main` when confident and complete
- Can delete this branch if experiment fails

## Branch Workflow

### Working on NZ Birds
```bash
git checkout feature/nz-birds
npm run dev  # Test NZ content locally
```

### Switching Back to Production Work
```bash
git checkout main
npm run dev  # NZ changes invisible
```

### If NZ Birds Succeed
```bash
git checkout main
git merge feature/nz-birds
npm run deploy
```

### If NZ Birds Fail
```bash
git checkout main
git branch -D feature/nz-birds  # Delete branch, no trace
```

## Pending Work (Not Yet Branched)

### Macaulay Library Eastern Birds
- **Status**: Waiting for audio files from Macaulay Library
- **Species**: ~20 additional eastern US species
- **Icons Ready**: ACFL, EAPH, EWPE, WEVI (partial)
- **Strategy**: Will add to `main` once files arrive (proven source, low risk)

### Location-Based Packs (Future)
- **Status**: Idea/planning phase
- **See**: location_feature_idea.txt
- **Concept**: Generate packs by region (e.g., "New Jersey birds")
- **Data Source**: eBird API for range data
- **Timeline**: TBD

## Deployment Safety

### Before Deploying to Production
1. ✅ Validate data: `make validate-data`
2. ✅ Run tests: `npm run test`
3. ✅ Check branch: `git branch` (should be on `main`)
4. ✅ Visual QA: Test game in browser
5. ✅ Audio QA: Spot-check canonical clips
6. 🚀 Deploy: `npm run deploy`

### Emergency Rollback
If a deployment breaks production:
```bash
git log --oneline -10  # Find last good commit
git revert <bad-commit-hash>
npm run deploy
```
