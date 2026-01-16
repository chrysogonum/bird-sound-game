/**
 * Input system types for ChipNotes!
 */

import type { Channel } from '../audio/types.js';

/** Species icon configuration */
export interface SpeciesIcon {
  /** 4-letter species code */
  speciesCode: string;
  /** Display name */
  displayName: string;
  /** Icon image path or emoji */
  icon: string;
  /** Position angle in degrees (0-360) */
  angle: number;
}

/** Radial wheel configuration */
export interface WheelConfig {
  /** Species to display on the wheel */
  species: SpeciesIcon[];
  /** Wheel radius in pixels */
  radius?: number;
  /** Center X position */
  centerX?: number;
  /** Center Y position */
  centerY?: number;
}

/** Player input for an event */
export interface PlayerInput {
  /** Selected species code (null if no species selected) */
  speciesCode: string | null;
  /** Selected channel */
  channel: Channel;
  /** Timestamp when input was received (ms from round start) */
  timestampMs: number;
}

/** Input event from the radial wheel */
export interface SpeciesSelectionEvent {
  type: 'species_selection';
  speciesCode: string;
  timestampMs: number;
}

/** Input event from channel detection */
export interface ChannelSelectionEvent {
  type: 'channel_selection';
  channel: Channel;
  timestampMs: number;
}

/** Combined input event */
export type InputEvent = SpeciesSelectionEvent | ChannelSelectionEvent;

/** Input listener callback */
export type InputListener = (event: InputEvent) => void;
