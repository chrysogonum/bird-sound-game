/**
 * CalibrationFlow - Headphone and L/R calibration for ChipNotes!
 *
 * Provides:
 * - Headphone check prompt
 * - Left/right audio test tones
 * - User confirmation flow
 * - Optional latency calibration
 */

import type { CalibrationStep, CalibrationResult, CalibrationCallback } from './types.js';
import { UI_COLORS } from './types.js';

/** Test tone frequencies */
const TONE_FREQUENCIES = {
  LEFT: 440,   // A4
  RIGHT: 523,  // C5
} as const;

/** Test tone duration in ms */
const TONE_DURATION_MS = 500;

/** Calibration configuration */
export interface CalibrationConfig {
  onComplete?: CalibrationCallback;
  skipIntro?: boolean;
}

/**
 * CalibrationFlow handles the headphone/audio calibration process.
 */
export class CalibrationFlow {
  private audioContext: AudioContext | null = null;
  private currentStep: CalibrationStep = 'intro';
  private leftConfirmed: boolean = false;
  private rightConfirmed: boolean = false;
  private isPlaying: boolean = false;
  private onComplete: CalibrationCallback | null;
  private readonly skipIntro: boolean;

  constructor(config: CalibrationConfig = {}) {
    this.onComplete = config.onComplete ?? null;
    this.skipIntro = config.skipIntro ?? false;
  }

  /**
   * Initializes the audio context. Should be called after user gesture.
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Starts the calibration flow.
   */
  start(): void {
    this.leftConfirmed = false;
    this.rightConfirmed = false;
    this.currentStep = this.skipIntro ? 'left' : 'intro';
  }

  /**
   * Gets the current calibration step.
   */
  getStep(): CalibrationStep {
    return this.currentStep;
  }

  /**
   * Advances to the next step.
   */
  nextStep(): void {
    switch (this.currentStep) {
      case 'intro':
        this.currentStep = 'left';
        break;
      case 'left':
        this.currentStep = 'right';
        break;
      case 'right':
        this.currentStep = 'confirm';
        break;
      case 'confirm':
        this.currentStep = 'complete';
        this.completeCalibration();
        break;
      case 'complete':
        // Already complete
        break;
    }
  }

  /**
   * Plays the test tone for the current step.
   */
  async playTestTone(): Promise<void> {
    if (!this.audioContext || this.isPlaying) return;

    await this.initialize();

    const channel = this.currentStep === 'left' ? 'left' : 'right';
    await this.playTone(channel);
  }

  /**
   * Plays a test tone in the specified channel.
   */
  async playTone(channel: 'left' | 'right'): Promise<void> {
    if (!this.audioContext || this.isPlaying) return;

    this.isPlaying = true;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const pannerNode = this.audioContext.createStereoPanner();

    // Set frequency based on channel
    oscillator.frequency.setValueAtTime(
      channel === 'left' ? TONE_FREQUENCIES.LEFT : TONE_FREQUENCIES.RIGHT,
      this.audioContext.currentTime
    );
    oscillator.type = 'sine';

    // Pan hard left or right
    pannerNode.pan.setValueAtTime(channel === 'left' ? -1 : 1, this.audioContext.currentTime);

    // Envelope for smooth start/stop
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + TONE_DURATION_MS / 1000);

    // Connect audio graph
    oscillator.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.audioContext.destination);

    // Play
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + TONE_DURATION_MS / 1000);

    // Wait for completion
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        this.isPlaying = false;
        resolve();
      }, TONE_DURATION_MS);
    });
  }

  /**
   * Confirms that the left audio was heard correctly.
   */
  confirmLeft(): void {
    this.leftConfirmed = true;
    if (this.currentStep === 'left') {
      this.nextStep();
    }
  }

  /**
   * Confirms that the right audio was heard correctly.
   */
  confirmRight(): void {
    this.rightConfirmed = true;
    if (this.currentStep === 'right') {
      this.nextStep();
    }
  }

  /**
   * Checks if left audio has been confirmed.
   */
  isLeftConfirmed(): boolean {
    return this.leftConfirmed;
  }

  /**
   * Checks if right audio has been confirmed.
   */
  isRightConfirmed(): boolean {
    return this.rightConfirmed;
  }

  /**
   * Checks if calibration is complete.
   */
  isComplete(): boolean {
    return this.currentStep === 'complete';
  }

  /**
   * Checks if a tone is currently playing.
   */
  isPlayingTone(): boolean {
    return this.isPlaying;
  }

  /**
   * Gets the calibration result.
   */
  getResult(): CalibrationResult {
    return {
      leftConfirmed: this.leftConfirmed,
      rightConfirmed: this.rightConfirmed,
      completed: this.currentStep === 'complete',
    };
  }

  /**
   * Gets the current step instructions.
   */
  getStepInstructions(): string {
    switch (this.currentStep) {
      case 'intro':
        return 'Please put on your headphones for the best experience.';
      case 'left':
        return 'Tap "Play" to hear a tone in your LEFT ear.';
      case 'right':
        return 'Tap "Play" to hear a tone in your RIGHT ear.';
      case 'confirm':
        return 'Did you hear the tones correctly in each ear?';
      case 'complete':
        return 'Calibration complete! You\'re ready to play.';
    }
  }

  /**
   * Gets the primary button label for the current step.
   */
  getButtonLabel(): string {
    switch (this.currentStep) {
      case 'intro':
        return 'Continue';
      case 'left':
      case 'right':
        return 'Play Tone';
      case 'confirm':
        return 'Confirm';
      case 'complete':
        return 'Start Game';
    }
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    step: CalibrationStep;
    instructions: string;
    buttonLabel: string;
    leftConfirmed: boolean;
    rightConfirmed: boolean;
    isPlaying: boolean;
    isComplete: boolean;
    colors: typeof UI_COLORS;
  } {
    return {
      step: this.currentStep,
      instructions: this.getStepInstructions(),
      buttonLabel: this.getButtonLabel(),
      leftConfirmed: this.leftConfirmed,
      rightConfirmed: this.rightConfirmed,
      isPlaying: this.isPlaying,
      isComplete: this.isComplete(),
      colors: UI_COLORS,
    };
  }

  /**
   * Sets the completion callback.
   */
  setOnComplete(callback: CalibrationCallback | null): void {
    this.onComplete = callback;
  }

  /**
   * Completes the calibration and triggers callback.
   */
  private completeCalibration(): void {
    const result = this.getResult();
    this.onComplete?.(result);
  }

  /**
   * Resets the calibration flow.
   */
  reset(): void {
    this.leftConfirmed = false;
    this.rightConfirmed = false;
    this.currentStep = 'intro';
    this.isPlaying = false;
  }

  /**
   * Disposes of audio resources.
   */
  async dispose(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Handles the primary button action for the current step.
   */
  async handleButtonPress(): Promise<void> {
    switch (this.currentStep) {
      case 'intro':
        await this.initialize();
        this.nextStep();
        break;
      case 'left':
        await this.playTestTone();
        break;
      case 'right':
        await this.playTestTone();
        break;
      case 'confirm':
        this.nextStep();
        break;
      case 'complete':
        // No action needed
        break;
    }
  }

  /**
   * Handles the confirmation button for left/right steps.
   */
  handleConfirmation(confirmed: boolean): void {
    if (this.currentStep === 'left') {
      if (confirmed) {
        this.confirmLeft();
      } else {
        // Replay if not confirmed
      }
    } else if (this.currentStep === 'right') {
      if (confirmed) {
        this.confirmRight();
      } else {
        // Replay if not confirmed
      }
    }
  }
}
