/**
 * FeedbackRenderer - Immediate visual/audio feedback for ChipNotes!
 *
 * Provides immediate feedback to players after each input:
 * - Visual flash on correct (green glow)
 * - Visual shake on incorrect (red shake)
 * - Score increment display
 * - Optional audio confirmation tones
 */

import type { FeedbackEvent, FeedbackType, ScoreBreakdown } from './types.js';

/** Feedback animation configuration */
export interface FeedbackConfig {
  /** Duration of flash animation in ms */
  flashDurationMs?: number;
  /** Duration of shake animation in ms */
  shakeDurationMs?: number;
  /** Duration of score popup in ms */
  scorePopupDurationMs?: number;
  /** Whether to play audio feedback */
  audioEnabled?: boolean;
}

/** Visual feedback state */
export interface VisualFeedbackState {
  /** Current feedback type being displayed */
  type: FeedbackType | null;
  /** Score being displayed */
  score: number;
  /** Whether animation is active */
  isAnimating: boolean;
  /** Animation progress (0-1) */
  progress: number;
  /** CSS class for styling */
  cssClass: string;
}

/** Feedback listener callback */
export type FeedbackListener = (state: VisualFeedbackState) => void;

/** Default configuration */
const DEFAULT_CONFIG: Required<FeedbackConfig> = {
  flashDurationMs: 300,
  shakeDurationMs: 400,
  scorePopupDurationMs: 800,
  audioEnabled: true,
};

/**
 * FeedbackRenderer manages visual and audio feedback for player inputs.
 */
export class FeedbackRenderer {
  private readonly config: Required<FeedbackConfig>;
  private readonly listeners: Set<FeedbackListener> = new Set();
  private currentState: VisualFeedbackState;
  private animationTimer: ReturnType<typeof setTimeout> | null = null;

  /** Audio context for feedback tones (lazy initialized) */
  private audioContext: AudioContext | null = null;

  constructor(config: FeedbackConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentState = this.createIdleState();
  }

  /**
   * Creates an idle (no feedback) state.
   */
  private createIdleState(): VisualFeedbackState {
    return {
      type: null,
      score: 0,
      isAnimating: false,
      progress: 0,
      cssClass: '',
    };
  }

  /**
   * Shows feedback for a scoring result.
   * @param event The feedback event to display
   */
  showFeedback(event: FeedbackEvent): void {
    // Cancel any existing animation
    this.cancelAnimation();

    // Determine animation properties based on feedback type
    const cssClass = this.getCssClass(event.type);
    const duration = this.getDuration(event.type);

    // Update state
    this.currentState = {
      type: event.type,
      score: event.score,
      isAnimating: true,
      progress: 0,
      cssClass,
    };

    // Notify listeners
    this.notifyListeners();

    // Play audio feedback
    if (this.config.audioEnabled) {
      this.playFeedbackTone(event.type);
    }

    // Start animation timer
    this.startAnimation(duration);
  }

  /**
   * Shows feedback directly from a score breakdown.
   */
  showFeedbackFromBreakdown(breakdown: ScoreBreakdown): void {
    const type = this.determineFeedbackType(breakdown);
    this.showFeedback({
      type,
      score: breakdown.totalPoints,
      breakdown,
    });
  }

  /**
   * Determines feedback type from breakdown.
   */
  private determineFeedbackType(breakdown: ScoreBreakdown): FeedbackType {
    if (breakdown.totalPoints === 100) return 'perfect';
    if (breakdown.speciesCorrect && breakdown.channelCorrect) return 'good';
    if (breakdown.totalPoints > 0) return 'partial';
    return 'miss';
  }

  /**
   * Gets CSS class for feedback type.
   */
  getCssClass(type: FeedbackType): string {
    switch (type) {
      case 'perfect':
        return 'feedback-perfect feedback-flash-gold';
      case 'good':
        return 'feedback-good feedback-flash-green';
      case 'partial':
        return 'feedback-partial feedback-flash-yellow';
      case 'miss':
        return 'feedback-miss feedback-shake-red';
    }
  }

  /**
   * Gets animation duration for feedback type.
   */
  private getDuration(type: FeedbackType): number {
    if (type === 'miss') {
      return this.config.shakeDurationMs;
    }
    return this.config.flashDurationMs;
  }

  /**
   * Starts the animation timer.
   */
  private startAnimation(duration: number): void {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      this.currentState = {
        ...this.currentState,
        progress,
        isAnimating: progress < 1,
      };

      this.notifyListeners();

      if (progress < 1) {
        this.animationTimer = setTimeout(animate, 16); // ~60fps
      } else {
        this.animationTimer = setTimeout(() => {
          this.currentState = this.createIdleState();
          this.notifyListeners();
        }, this.config.scorePopupDurationMs - duration);
      }
    };

    animate();
  }

  /**
   * Cancels any running animation.
   */
  private cancelAnimation(): void {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * Plays a feedback tone.
   */
  private playFeedbackTone(type: FeedbackType): void {
    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContext();
      } catch {
        // Audio not available
        return;
      }
    }

    const ctx = this.audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Set tone based on feedback type
    const { frequency, duration } = this.getToneParams(type);
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = 'sine';

    // Quick envelope
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }

  /**
   * Gets tone parameters for feedback type.
   */
  private getToneParams(type: FeedbackType): { frequency: number; duration: number } {
    switch (type) {
      case 'perfect':
        return { frequency: 880, duration: 0.15 }; // A5, bright
      case 'good':
        return { frequency: 660, duration: 0.12 }; // E5
      case 'partial':
        return { frequency: 440, duration: 0.1 }; // A4
      case 'miss':
        return { frequency: 220, duration: 0.2 }; // A3, low
    }
  }

  /**
   * Gets the current visual state.
   */
  getState(): VisualFeedbackState {
    return { ...this.currentState };
  }

  /**
   * Checks if currently showing feedback.
   */
  isShowingFeedback(): boolean {
    return this.currentState.type !== null;
  }

  /**
   * Adds a feedback listener.
   */
  addListener(listener: FeedbackListener): void {
    this.listeners.add(listener);
  }

  /**
   * Removes a feedback listener.
   */
  removeListener(listener: FeedbackListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Enables or disables audio feedback.
   */
  setAudioEnabled(enabled: boolean): void {
    (this.config as FeedbackConfig).audioEnabled = enabled;
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    this.cancelAnimation();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.listeners.clear();
  }

  /**
   * Notifies all listeners of state change.
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
