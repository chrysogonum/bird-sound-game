/**
 * PackLoader - Load and validate Pack definitions for ChipNotes!
 *
 * Features:
 * - Load pack JSON files
 * - Validate against schema
 * - Apply default values
 * - Cache loaded packs
 */

import type {
  PackDefinition,
  Pack,
  PackValidationError,
  PackValidationResult,
  VocalizationWeights,
} from './types.js';

/** Default pack values */
const PACK_DEFAULTS = {
  overlapMultiplier: 1.0,
  tempoMultiplier: 1.0,
  seasonalContext: null,
} as const;

/** Validation constraints */
const CONSTRAINTS = {
  packIdPattern: /^[a-z_]+$/,
  // Accept 4-letter NA codes (NOCA) or eBird 6-char codes (nezbel1)
  speciesCodePattern: /^([A-Z]{4}|[a-z]{3,6}[0-9]?)$/,
  minSpecies: 1,
  minWeight: 0,
  maxWeight: 1,
  minMultiplier: 0.5,
  maxMultiplier: 2.0,
} as const;

/**
 * PackLoader handles loading and validation of pack definitions.
 */
export class PackLoader {
  private readonly packCache: Map<string, Pack> = new Map();
  private readonly packDefinitions: Map<string, PackDefinition> = new Map();

  /**
   * Loads a pack from a JSON definition.
   * @param definition The pack definition JSON
   * @returns The loaded pack, or throws on validation error
   */
  loadPack(definition: PackDefinition): Pack {
    // Validate the definition
    const validation = this.validate(definition);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Invalid pack "${definition.pack_id}": ${errorMessages}`);
    }

    // Convert to Pack with defaults
    const pack = this.definitionToPack(definition);

    // Cache the pack
    this.packCache.set(pack.packId, pack);
    this.packDefinitions.set(pack.packId, definition);

    return pack;
  }

  /**
   * Loads multiple packs from definitions.
   * @param definitions Array of pack definitions
   * @returns Array of loaded packs
   */
  loadPacks(definitions: PackDefinition[]): Pack[] {
    return definitions.map((def) => this.loadPack(def));
  }

  /**
   * Gets a loaded pack by ID.
   * @param packId The pack ID
   * @returns The pack, or null if not loaded
   */
  getPack(packId: string): Pack | null {
    return this.packCache.get(packId) ?? null;
  }

  /**
   * Gets all loaded packs.
   */
  getAllPacks(): Pack[] {
    return Array.from(this.packCache.values());
  }

  /**
   * Gets pack IDs.
   */
  getPackIds(): string[] {
    return Array.from(this.packCache.keys());
  }

  /**
   * Checks if a pack is loaded.
   */
  hasPack(packId: string): boolean {
    return this.packCache.has(packId);
  }

  /**
   * Gets the species list for a pack.
   */
  getPackSpecies(packId: string): string[] {
    const pack = this.packCache.get(packId);
    return pack ? [...pack.species] : [];
  }

  /**
   * Gets the species count for a pack.
   */
  getPackSpeciesCount(packId: string): number {
    const pack = this.packCache.get(packId);
    return pack ? pack.species.length : 0;
  }

  /**
   * Validates a pack definition.
   * @param definition The pack definition to validate
   * @returns Validation result with errors
   */
  validate(definition: PackDefinition): PackValidationResult {
    const errors: PackValidationError[] = [];
    const packId = definition.pack_id ?? 'unknown';

    // Validate pack_id
    if (!definition.pack_id) {
      errors.push({ packId, field: 'pack_id', message: 'Required field missing' });
    } else if (!CONSTRAINTS.packIdPattern.test(definition.pack_id)) {
      errors.push({ packId, field: 'pack_id', message: 'Must be lowercase letters and underscores only' });
    }

    // Validate display_name
    if (!definition.display_name || definition.display_name.trim() === '') {
      errors.push({ packId, field: 'display_name', message: 'Required field missing or empty' });
    }

    // Validate description
    if (definition.description === undefined) {
      errors.push({ packId, field: 'description', message: 'Required field missing' });
    }

    // Validate species
    if (!definition.species || !Array.isArray(definition.species)) {
      errors.push({ packId, field: 'species', message: 'Must be an array' });
    } else if (definition.species.length < CONSTRAINTS.minSpecies) {
      errors.push({ packId, field: 'species', message: `Must have at least ${CONSTRAINTS.minSpecies} species` });
    } else {
      // Validate each species code
      for (const code of definition.species) {
        if (!CONSTRAINTS.speciesCodePattern.test(code)) {
          errors.push({ packId, field: 'species', message: `Invalid species code: ${code}` });
        }
      }

      // Check for duplicates
      const uniqueSpecies = new Set(definition.species);
      if (uniqueSpecies.size !== definition.species.length) {
        errors.push({ packId, field: 'species', message: 'Duplicate species codes found' });
      }
    }

    // Validate vocalization_weights
    if (!definition.vocalization_weights) {
      errors.push({ packId, field: 'vocalization_weights', message: 'Required field missing' });
    } else {
      const weights = definition.vocalization_weights;
      if (typeof weights.song !== 'number' || weights.song < CONSTRAINTS.minWeight || weights.song > CONSTRAINTS.maxWeight) {
        errors.push({ packId, field: 'vocalization_weights.song', message: 'Must be a number between 0 and 1' });
      }
      if (typeof weights.call !== 'number' || weights.call < CONSTRAINTS.minWeight || weights.call > CONSTRAINTS.maxWeight) {
        errors.push({ packId, field: 'vocalization_weights.call', message: 'Must be a number between 0 and 1' });
      }
    }

    // Validate optional multipliers
    if (definition.overlap_multiplier !== undefined) {
      if (
        typeof definition.overlap_multiplier !== 'number' ||
        definition.overlap_multiplier < CONSTRAINTS.minMultiplier ||
        definition.overlap_multiplier > CONSTRAINTS.maxMultiplier
      ) {
        errors.push({ packId, field: 'overlap_multiplier', message: 'Must be a number between 0.5 and 2.0' });
      }
    }

    if (definition.tempo_multiplier !== undefined) {
      if (
        typeof definition.tempo_multiplier !== 'number' ||
        definition.tempo_multiplier < CONSTRAINTS.minMultiplier ||
        definition.tempo_multiplier > CONSTRAINTS.maxMultiplier
      ) {
        errors.push({ packId, field: 'tempo_multiplier', message: 'Must be a number between 0.5 and 2.0' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Converts a pack definition to a Pack with defaults applied.
   */
  private definitionToPack(definition: PackDefinition): Pack {
    return {
      packId: definition.pack_id,
      displayName: definition.display_name,
      description: definition.description,
      species: [...definition.species],
      vocalizationWeights: { ...definition.vocalization_weights },
      overlapMultiplier: definition.overlap_multiplier ?? PACK_DEFAULTS.overlapMultiplier,
      tempoMultiplier: definition.tempo_multiplier ?? PACK_DEFAULTS.tempoMultiplier,
      seasonalContext: definition.seasonal_context ?? PACK_DEFAULTS.seasonalContext,
    };
  }

  /**
   * Clears all loaded packs.
   */
  clear(): void {
    this.packCache.clear();
    this.packDefinitions.clear();
  }

  /**
   * Gets the original definition for a pack.
   */
  getDefinition(packId: string): PackDefinition | null {
    return this.packDefinitions.get(packId) ?? null;
  }

  /**
   * Applies pack modifiers to a base overlap probability.
   * @param baseOverlap Base overlap probability from level
   * @param packId Pack ID to apply modifiers from
   * @returns Modified overlap probability
   */
  applyOverlapMultiplier(baseOverlap: number, packId: string): number {
    const pack = this.packCache.get(packId);
    if (!pack) return baseOverlap;
    return Math.min(1, baseOverlap * pack.overlapMultiplier);
  }

  /**
   * Applies pack tempo modifier to event gaps.
   * @param baseGapMs Base gap in milliseconds
   * @param packId Pack ID to apply modifiers from
   * @returns Modified gap (smaller = faster tempo)
   */
  applyTempoMultiplier(baseGapMs: number, packId: string): number {
    const pack = this.packCache.get(packId);
    if (!pack) return baseGapMs;
    // Higher tempo multiplier = shorter gaps = more events
    return baseGapMs / pack.tempoMultiplier;
  }

  /**
   * Gets vocalization weights for a pack.
   */
  getVocalizationWeights(packId: string): VocalizationWeights | null {
    const pack = this.packCache.get(packId);
    return pack ? { ...pack.vocalizationWeights } : null;
  }

  /**
   * Determines if a clip should be included based on vocalization weights.
   * @param vocalizationType The clip's vocalization type
   * @param packId Pack ID to check weights
   * @param random Random number between 0 and 1
   * @returns True if the clip should be included
   */
  shouldIncludeVocalization(
    vocalizationType: 'song' | 'call',
    packId: string,
    random: number
  ): boolean {
    const weights = this.getVocalizationWeights(packId);
    if (!weights) return true;

    const weight = vocalizationType === 'song' ? weights.song : weights.call;
    const totalWeight = weights.song + weights.call;

    if (totalWeight === 0) return false;

    const normalizedWeight = weight / totalWeight;
    return random < normalizedWeight;
  }
}
