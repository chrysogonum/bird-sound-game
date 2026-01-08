/**
 * Pack Tests for Phase G
 *
 * Validates:
 * - Load "common_se_birds" Pack → 30+ species available
 * - Load "spring_warblers" Pack → 6 warbler species, 90% songs
 * - Pack modifiers (overlap_multiplier, tempo_multiplier) applied to Level
 * - Invalid Pack JSON fails validation with clear error
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PackLoader } from '../src/packs/PackLoader.js';
import { PackSelector } from '../src/packs/PackSelector.js';
import type { PackDefinition, Pack } from '../src/packs/types.js';

// Test pack definitions
const COMMON_SE_BIRDS: PackDefinition = {
  pack_id: 'common_se_birds',
  display_name: 'Common SE Birds',
  description: 'Ultra-common birds of the southeastern United States.',
  species: [
    'NOCA', 'BLJA', 'CARW', 'AMCR', 'TUTI', 'EABL', 'MODO', 'AMRO',
    'RBWO', 'DOWO', 'HAWO', 'PIWO', 'YSFL', 'BCCH', 'WBNU', 'BGGN',
    'CACH', 'EATO', 'CHSP', 'SOSP', 'FISP', 'WTSP', 'SAVS', 'NOMO',
    'BHCO', 'COGR', 'RWBL', 'EAME', 'HOFI', 'AMGO', 'HOSP',
  ],
  vocalization_weights: { song: 0.6, call: 0.4 },
  overlap_multiplier: 1.0,
  tempo_multiplier: 1.0,
  seasonal_context: null,
};

const SPRING_WARBLERS: PackDefinition = {
  pack_id: 'spring_warblers',
  display_name: 'Spring Warblers',
  description: 'Song-heavy warbler pack featuring confusable species.',
  species: ['YRWA', 'PIWA', 'NOPA', 'COYE', 'PRAW', 'BTBW'],
  vocalization_weights: { song: 0.9, call: 0.1 },
  overlap_multiplier: 1.3,
  tempo_multiplier: 1.2,
  seasonal_context: 'spring',
};

const SPARROWS: PackDefinition = {
  pack_id: 'sparrows',
  display_name: 'Sparrows',
  description: 'Short chips and subtle differences.',
  species: ['SOSP', 'CHSP', 'FISP', 'WTSP', 'SAVS', 'SWSP'],
  vocalization_weights: { song: 0.2, call: 0.8 },
  overlap_multiplier: 1.0,
  tempo_multiplier: 1.1,
  seasonal_context: null,
};

describe('PackLoader', () => {
  let loader: PackLoader;

  beforeEach(() => {
    loader = new PackLoader();
  });

  describe('loading packs', () => {
    it('should load common_se_birds with 30+ species', () => {
      const pack = loader.loadPack(COMMON_SE_BIRDS);

      expect(pack.packId).toBe('common_se_birds');
      expect(pack.species.length).toBeGreaterThanOrEqual(30);
      expect(pack.displayName).toBe('Common SE Birds');
    });

    it('should load spring_warblers with 6 species and 90% songs', () => {
      const pack = loader.loadPack(SPRING_WARBLERS);

      expect(pack.packId).toBe('spring_warblers');
      expect(pack.species.length).toBe(6);
      expect(pack.vocalizationWeights.song).toBe(0.9);
      expect(pack.vocalizationWeights.call).toBe(0.1);
    });

    it('should load multiple packs', () => {
      const packs = loader.loadPacks([COMMON_SE_BIRDS, SPRING_WARBLERS, SPARROWS]);

      expect(packs.length).toBe(3);
      expect(loader.getPackIds()).toContain('common_se_birds');
      expect(loader.getPackIds()).toContain('spring_warblers');
      expect(loader.getPackIds()).toContain('sparrows');
    });

    it('should cache loaded packs', () => {
      loader.loadPack(COMMON_SE_BIRDS);

      expect(loader.hasPack('common_se_birds')).toBe(true);
      expect(loader.getPack('common_se_birds')).not.toBeNull();
    });

    it('should apply default values', () => {
      const minimalPack: PackDefinition = {
        pack_id: 'minimal',
        display_name: 'Minimal Pack',
        description: 'A minimal pack for testing',
        species: ['NOCA'],
        vocalization_weights: { song: 0.5, call: 0.5 },
      };

      const pack = loader.loadPack(minimalPack);

      expect(pack.overlapMultiplier).toBe(1.0);
      expect(pack.tempoMultiplier).toBe(1.0);
      expect(pack.seasonalContext).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate valid pack', () => {
      const result = loader.validate(COMMON_SE_BIRDS);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject pack with missing pack_id', () => {
      const invalid = { ...COMMON_SE_BIRDS, pack_id: '' } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'pack_id')).toBe(true);
    });

    it('should reject pack with invalid pack_id format', () => {
      const invalid = { ...COMMON_SE_BIRDS, pack_id: 'Invalid-Pack' } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'pack_id')).toBe(true);
    });

    it('should reject pack with empty species array', () => {
      const invalid = { ...COMMON_SE_BIRDS, species: [] } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'species')).toBe(true);
    });

    it('should reject pack with invalid species codes', () => {
      const invalid = { ...COMMON_SE_BIRDS, species: ['NOCA', 'invalid'] } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('invalid'))).toBe(true);
    });

    it('should reject pack with duplicate species', () => {
      const invalid = { ...COMMON_SE_BIRDS, species: ['NOCA', 'NOCA', 'BLJA'] } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
    });

    it('should reject pack with out-of-range multiplier', () => {
      const invalid = { ...COMMON_SE_BIRDS, overlap_multiplier: 5.0 } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'overlap_multiplier')).toBe(true);
    });

    it('should reject pack with out-of-range vocalization weight', () => {
      const invalid = {
        ...COMMON_SE_BIRDS,
        vocalization_weights: { song: 1.5, call: 0.5 },
      } as PackDefinition;
      const result = loader.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes('vocalization_weights'))).toBe(true);
    });

    it('should throw error when loading invalid pack', () => {
      const invalid = { ...COMMON_SE_BIRDS, pack_id: '' } as PackDefinition;

      expect(() => loader.loadPack(invalid)).toThrow();
    });
  });

  describe('modifiers', () => {
    it('should apply overlap multiplier', () => {
      loader.loadPack(SPRING_WARBLERS); // overlap_multiplier: 1.3

      const baseOverlap = 0.2;
      const modified = loader.applyOverlapMultiplier(baseOverlap, 'spring_warblers');

      expect(modified).toBe(0.26); // 0.2 * 1.3
    });

    it('should apply tempo multiplier to gap', () => {
      loader.loadPack(SPRING_WARBLERS); // tempo_multiplier: 1.2

      const baseGap = 2000;
      const modified = loader.applyTempoMultiplier(baseGap, 'spring_warblers');

      expect(modified).toBeCloseTo(1666.67, 0); // 2000 / 1.2
    });

    it('should cap overlap at 1.0', () => {
      loader.loadPack(SPRING_WARBLERS); // overlap_multiplier: 1.3

      const baseOverlap = 0.9;
      const modified = loader.applyOverlapMultiplier(baseOverlap, 'spring_warblers');

      expect(modified).toBe(1.0); // Capped at 1.0
    });

    it('should return base value for unknown pack', () => {
      const baseOverlap = 0.2;
      const modified = loader.applyOverlapMultiplier(baseOverlap, 'unknown');

      expect(modified).toBe(0.2);
    });
  });

  describe('vocalization weights', () => {
    it('should get vocalization weights', () => {
      loader.loadPack(SPRING_WARBLERS);

      const weights = loader.getVocalizationWeights('spring_warblers');

      expect(weights).not.toBeNull();
      expect(weights?.song).toBe(0.9);
      expect(weights?.call).toBe(0.1);
    });

    it('should filter by vocalization type based on weights', () => {
      loader.loadPack(SPRING_WARBLERS); // 90% songs

      // With low random value, songs should be included
      expect(loader.shouldIncludeVocalization('song', 'spring_warblers', 0.1)).toBe(true);

      // With high random value, songs might not be included
      expect(loader.shouldIncludeVocalization('song', 'spring_warblers', 0.95)).toBe(false);
    });
  });

  describe('pack retrieval', () => {
    beforeEach(() => {
      loader.loadPacks([COMMON_SE_BIRDS, SPRING_WARBLERS]);
    });

    it('should get all packs', () => {
      const packs = loader.getAllPacks();
      expect(packs.length).toBe(2);
    });

    it('should get pack species', () => {
      const species = loader.getPackSpecies('spring_warblers');
      expect(species.length).toBe(6);
      expect(species).toContain('YRWA');
    });

    it('should get species count', () => {
      expect(loader.getPackSpeciesCount('common_se_birds')).toBeGreaterThanOrEqual(30);
      expect(loader.getPackSpeciesCount('spring_warblers')).toBe(6);
    });

    it('should return null for unknown pack', () => {
      expect(loader.getPack('unknown')).toBeNull();
    });

    it('should clear all packs', () => {
      loader.clear();
      expect(loader.getAllPacks().length).toBe(0);
    });
  });
});

describe('PackSelector', () => {
  let selector: PackSelector;
  let testPacks: Pack[];

  beforeEach(() => {
    const loader = new PackLoader();
    testPacks = loader.loadPacks([COMMON_SE_BIRDS, SPRING_WARBLERS, SPARROWS]);
    selector = new PackSelector({ packs: testPacks });
  });

  describe('pack listing', () => {
    it('should list all packs', () => {
      const packs = selector.getPacks();
      expect(packs.length).toBe(3);
    });

    it('should get pack info', () => {
      const info = selector.getPackInfo('spring_warblers');

      expect(info).not.toBeNull();
      expect(info?.pack.packId).toBe('spring_warblers');
      expect(info?.speciesCount).toBe(6);
      expect(info?.unlocked).toBe(true);
    });

    it('should have all packs unlocked by default', () => {
      const packs = selector.getPacks();
      expect(packs.every((p) => p.unlocked)).toBe(true);
    });
  });

  describe('selection', () => {
    it('should select unlocked pack', () => {
      const result = selector.selectPack('spring_warblers');

      expect(result).toBe(true);
      expect(selector.getSelectedPackId()).toBe('spring_warblers');
    });

    it('should get selected pack', () => {
      selector.selectPack('spring_warblers');
      const pack = selector.getSelectedPack();

      expect(pack).not.toBeNull();
      expect(pack?.packId).toBe('spring_warblers');
    });

    it('should not select unknown pack', () => {
      const result = selector.selectPack('unknown');

      expect(result).toBe(false);
      expect(selector.getSelectedPackId()).toBeNull();
    });

    it('should not select locked pack', () => {
      selector.lockPack('spring_warblers');
      const result = selector.selectPack('spring_warblers');

      expect(result).toBe(false);
    });

    it('should clear selection', () => {
      selector.selectPack('spring_warblers');
      selector.clearSelection();

      expect(selector.getSelectedPackId()).toBeNull();
    });

    it('should get selected pack species', () => {
      selector.selectPack('spring_warblers');
      const species = selector.getSelectedPackSpecies();

      expect(species.length).toBe(6);
      expect(species).toContain('YRWA');
    });
  });

  describe('locking', () => {
    it('should lock and unlock packs', () => {
      expect(selector.isPackUnlocked('sparrows')).toBe(true);

      selector.lockPack('sparrows');
      expect(selector.isPackUnlocked('sparrows')).toBe(false);

      selector.unlockPack('sparrows');
      expect(selector.isPackUnlocked('sparrows')).toBe(true);
    });

    it('should start with specified unlocked packs', () => {
      const restricted = new PackSelector({
        packs: testPacks,
        unlockedPacks: ['common_se_birds'],
      });

      expect(restricted.isPackUnlocked('common_se_birds')).toBe(true);
      expect(restricted.isPackUnlocked('spring_warblers')).toBe(false);
    });

    it('should get unlocked pack IDs', () => {
      selector.lockPack('sparrows');
      const unlocked = selector.getUnlockedPackIds();

      expect(unlocked).toContain('common_se_birds');
      expect(unlocked).toContain('spring_warblers');
      expect(unlocked).not.toContain('sparrows');
    });
  });

  describe('visibility', () => {
    it('should toggle visibility', () => {
      expect(selector.isVisible()).toBe(false);

      selector.show();
      expect(selector.isVisible()).toBe(true);

      selector.hide();
      expect(selector.isVisible()).toBe(false);
    });
  });

  describe('filtering', () => {
    it('should filter by seasonal context', () => {
      const springPacks = selector.getPacksBySeason('spring');

      expect(springPacks.length).toBe(1);
      expect(springPacks[0].pack.packId).toBe('spring_warblers');
    });

    it('should sort by species count', () => {
      const sorted = selector.getPacksBySpeciesCount(true);

      expect(sorted[0].speciesCount).toBeLessThanOrEqual(sorted[1].speciesCount);
    });
  });
});

describe('Phase G Smoke Tests', () => {
  it('Smoke 1: Load spring_warblers Pack → wheel shows only warbler species', () => {
    const loader = new PackLoader();
    const pack = loader.loadPack(SPRING_WARBLERS);

    // Pack should have exactly 6 warbler species
    expect(pack.species.length).toBe(6);

    // All species should be warbler codes
    const warblerCodes = ['YRWA', 'PIWA', 'NOPA', 'COYE', 'PRAW', 'BTBW'];
    expect(pack.species.every((s) => warblerCodes.includes(s))).toBe(true);

    // Create selector and verify species
    const selector = new PackSelector({ packs: [pack] });
    selector.selectPack('spring_warblers');

    const selectedSpecies = selector.getSelectedPackSpecies();
    expect(selectedSpecies.length).toBe(6);
    expect(selectedSpecies).toEqual(expect.arrayContaining(warblerCodes));
  });

  it('Smoke 2: Apply 1.3x overlap_multiplier → more frequent overlaps than base Level', () => {
    const loader = new PackLoader();
    loader.loadPack(SPRING_WARBLERS); // Has 1.3x overlap_multiplier

    // Base level overlap probability
    const baseLevelOverlap = 0.2;

    // Apply pack modifier
    const modifiedOverlap = loader.applyOverlapMultiplier(baseLevelOverlap, 'spring_warblers');

    // Modified should be higher than base
    expect(modifiedOverlap).toBeGreaterThan(baseLevelOverlap);

    // Should be exactly 1.3x the base (0.2 * 1.3 = 0.26)
    expect(modifiedOverlap).toBeCloseTo(0.26, 2);

    // Verify the multiplier value
    const pack = loader.getPack('spring_warblers');
    expect(pack?.overlapMultiplier).toBe(1.3);
  });

  it('Smoke 3: Invalid Pack JSON fails validation with clear error', () => {
    const loader = new PackLoader();

    // Invalid pack with bad species code
    const invalidPack: PackDefinition = {
      pack_id: 'invalid_pack',
      display_name: 'Invalid Pack',
      description: 'This pack has errors',
      species: ['NOCA', 'invalid_code'],
      vocalization_weights: { song: 0.5, call: 0.5 },
    };

    const result = loader.validate(invalidPack);

    // Should be invalid
    expect(result.valid).toBe(false);

    // Should have clear error messages
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('invalid');

    // Should throw on load
    expect(() => loader.loadPack(invalidPack)).toThrow(/Invalid pack/);
  });

  it('Smoke 4: Load common_se_birds with 30+ species', () => {
    const loader = new PackLoader();
    const pack = loader.loadPack(COMMON_SE_BIRDS);

    expect(pack.species.length).toBeGreaterThanOrEqual(30);
    expect(pack.packId).toBe('common_se_birds');
  });
});
