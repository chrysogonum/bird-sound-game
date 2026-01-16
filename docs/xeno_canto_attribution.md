# Xeno-canto Attribution Requirements

## Legal Requirements
Per Xeno-canto's Terms of Service, all recordings **must** include:
1. **Recordist name** - the person who made the recording
2. **License type** - the Creative Commons license
3. **XC catalogue number** - the unique recording ID (e.g., XC316302)

## Implementation

### Schema (schemas/clip.schema.json)
Added `recordist` field (optional string):
```json
"recordist": {
  "type": ["string", "null"],
  "description": "Name of the person who recorded the audio (required for Xeno-canto attribution)"
}
```

### Audio Ingestion Pipeline (scripts/audio_ingest.py:513)
The Xeno-canto API response includes a `rec` field with the recordist name.
This is now automatically captured during ingestion:
```python
processed_files.append({
    # ... other fields ...
    'recordist': rec.get('rec'),
    # ... other fields ...
})
```

### Audio Tagging (scripts/audio_tagger.py:172,191)
The tagger reads recordist info from the ingest manifest and includes it in clips.json:
```python
recordist = manifest_info.get('recordist')
clip = {
    # ... other fields ...
    'recordist': recordist
}
```

### UI Display (src/ui-app/screens/PackSelect.tsx:672,707)
The Bird Reference section displays attribution as:
```
XC316302  [★ SIGNATURE] [Song] [Xeno-canto - Sue Riffe]
```

### Backfilling Existing Data (scripts/add_recordists.py)
Script to fetch recordist names for existing Xeno-canto clips:
```bash
python3 scripts/add_recordists.py
```

This queries the Xeno-canto API using the `source_id` field and updates `clips.json` with recordist names.

## Workflow for New Recordings

1. **Ingest audio** from Xeno-canto:
   ```bash
   python3 scripts/audio_ingest.py --output data/clips --species "Species Name" --max-per-species 3
   ```
   - Automatically fetches recordist name from API
   - Saves to `.ingest_manifest.json`

2. **Tag clips**:
   ```bash
   python3 scripts/audio_tagger.py --input data/clips --output data/clips.json
   ```
   - Reads recordist from manifest
   - Includes in final clips.json

3. **Generate spectrograms** (if needed):
   ```bash
   python3 scripts/spectrogram_gen.py
   ```

The recordist name will automatically appear in the Bird Reference UI.

## Notes

- **Cornell recordings**: Currently don't have individual recordist attribution. Could be added if Cornell provides this metadata.
- **Peter Repetti recordings**: Set source to "user_recording" and recordist to "Peter Repetti" (or null)
- **Demo clips**: No recordist needed (synthetic audio)

## Credits Screen

For a comprehensive credits list, you could add a dedicated Credits screen that lists all unique recordists:

```typescript
// Get unique recordists from clips.json
const recordists = [...new Set(clips
  .filter(c => c.source === 'xenocanto' && c.recordist)
  .map(c => c.recordist)
)].sort();
```

This would create a scrolling list like:
```
Xeno-canto Contributors:
- AUDEVARD Aurélien
- Bob Planqué
- Sue Riffe
- Stanislas Wroza
[... and 100+ more ...]
```
