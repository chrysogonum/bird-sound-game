/**
 * Pack system types for ChipNotes!
 */

/** Vocalization weights for a pack */
export interface VocalizationWeights {
  song: number;
  call: number;
}

/** Pack definition from JSON */
export interface PackDefinition {
  pack_id: string;
  display_name: string;
  description: string;
  species: string[];
  vocalization_weights: VocalizationWeights;
  overlap_multiplier?: number;
  tempo_multiplier?: number;
  seasonal_context?: string | null;
}

/** Loaded pack with defaults applied */
export interface Pack {
  packId: string;
  displayName: string;
  description: string;
  species: string[];
  vocalizationWeights: VocalizationWeights;
  overlapMultiplier: number;
  tempoMultiplier: number;
  seasonalContext: string | null;
}

/** Pack validation error */
export interface PackValidationError {
  packId: string;
  field: string;
  message: string;
}

/** Pack validation result */
export interface PackValidationResult {
  valid: boolean;
  errors: PackValidationError[];
}

/** Pack selection callback */
export type PackSelectCallback = (pack: Pack) => void;

/** Pack info for display */
export interface PackInfo {
  pack: Pack;
  speciesCount: number;
  unlocked: boolean;
}
