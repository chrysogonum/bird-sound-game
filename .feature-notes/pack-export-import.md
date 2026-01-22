# Feature: Pack Export/Import

**Branch:** `feature/pack-export-import`
**Status:** Work in Progress
**Target Version:** v3.51
**Last Updated:** 2026-01-22

## Overview

Add ability to export and import custom bird packs as `.chipnotes.json` files, allowing users to:
- Save packs to their device
- Share packs with friends
- Back up carefully curated bird lists

## Implementation Status

### ✅ Completed

1. **Export Functionality** (`handleExportPack`)
   - Exports pack as `.chipnotes.json` file with metadata
   - Includes: name, species list, version, timestamps
   - File naming: sanitized pack name + `.chipnotes.json` extension

2. **Import Functionality** (`handleImportPack`)
   - Comprehensive validation:
     - File extension check (.chipnotes.json or .json)
     - JSON format validation
     - Required fields validation (name, species array)
     - Species code validation against available species
     - Pack limit enforcement (max 10 saved packs)
   - Informative error messages for invalid data
   - Automatic filtering of unrecognized species codes

3. **Web Share API Integration**
   - Attempts to use Web Share API first (native share sheet)
   - Gracefully falls back to download if unavailable
   - **Important:** Web Share API requires HTTPS for file sharing

4. **UI Components**
   - Export button (blue) next to each pack's Delete button
   - Import button (green, 📥 icon) above saved packs list
   - iOS-specific download instructions for HTTP fallback

### ⚠️ Known Issues

1. **Web Share API Not Working on Local Dev (HTTP)**
   - Console shows: `Share API available: false`
   - Root cause: Web Share API requires HTTPS for file sharing
   - Local dev uses HTTP (`http://192.168.1.205:3000`)
   - **Will work on production** (chipnotes.app uses HTTPS)

2. **iOS Download UX on HTTP**
   - Download triggers file preview screen
   - User must tap "More..." → "Save to Files" → Choose location
   - Alert added to guide users through this process
   - **Will be replaced by native share sheet on HTTPS**

### 🔄 Next Steps

**Before merging to main:**

1. **Test on HTTPS**
   - Deploy feature branch to production or staging
   - Verify Web Share API shows native iOS share sheet
   - Test export → share → save to Files flow

2. **Test Import Flow**
   - Export a pack
   - Delete it from the app
   - Import the .chipnotes.json file
   - Verify all species restored correctly

3. **Cross-Platform Testing**
   - iOS Safari (primary target)
   - Android Chrome (if possible)
   - Desktop browsers (Firefox, Chrome, Safari)

4. **Edge Cases to Test**
   - Import file with invalid species codes
   - Import when already at 10-pack limit
   - Import file with malformed JSON
   - Import very large packs (50+ species)

5. **Polish (Optional)**
   - Add success message after successful export
   - Consider adding pack description field for exports
   - Add created/modified timestamps to UI

## Technical Notes

### File Format

```json
{
  "name": "Pack Name",
  "species": ["AMRO", "NOCA", "BCCH"],
  "created": "2026-01-22T...",
  "version": 1,
  "exportedFrom": "ChipNotes!",
  "exportDate": "2026-01-22T..."
}
```

### Code Changes

**File modified:** `src/ui-app/screens/CustomPackBuilder.tsx`

**Functions added:**
- `handleExportPack(pack: SavedPack)` - Lines 502-564
- `handleImportPack(event: ChangeEvent<HTMLInputElement>)` - Lines 566-629

**UI additions:**
- Import button with file input - Lines ~690-716
- Export button for each pack - Lines ~784-811

### Web Share API Reference

- Requires HTTPS for file sharing
- Browser support: iOS Safari 15+, Android Chrome 89+
- Fallback: Traditional download with `<a download>`
- Detection: `navigator.share && navigator.canShare({ files: [...] })`

## Resuming Work

**To continue development:**

```bash
git checkout feature/pack-export-import
# Make changes
git commit -am "Description of changes"
git push
```

**To test on HTTPS:**
1. Temporarily merge into main OR
2. Deploy feature branch to a test environment OR
3. Use ngrok/similar to create HTTPS tunnel for local dev

**To merge when ready:**

```bash
git checkout main
git merge feature/pack-export-import
# Update version to v3.51 in MainMenu.tsx and Help.tsx
git push
cd src/ui-app && npm run deploy
```

## Open Questions

1. Should we add a "Share" button separate from "Export"?
2. Should packs include additional metadata (description, author, date)?
3. Should we support importing multiple packs at once?
4. Should we add a "Browse Community Packs" feature later?

---

**Remember:** The main blocker is testing on HTTPS. Everything else is implemented and ready to test!
