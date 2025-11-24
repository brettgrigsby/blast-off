/**
 * SoundManager - Centralized sound management system
 *
 * Handles:
 * - Loading audio files
 * - Playing match sounds based on boost count
 * - Muting/unmuting audio
 * - Audio context unlocking (browser autoplay policy)
 * - Background mode (prevents sounds when game is in background)
 */
export class SoundManager {
  private scene: Phaser.Scene
  private isBackgroundMode: boolean = false
  private isMuted: boolean = false
  private hasSetupInteractionListeners: boolean = false

  // Sound URLs
  private static readonly SOUND_URLS = {
    match_1: 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/match_1-dB63L3FhkSb0nJ3VCH3vSnD3pU0Nl0.wav?odCG',
    match_2: 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/match_2-FdLMyA6tIxK3CjpFjDDq0dDkfbLbIn.wav?hwLy',
    match_3: 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/match_3-Oe0bWYcnQhmaGKBEcnuQIE12LJfHqS.wav?fEEx',
    match_4: 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/match_4-BH7DKySoYngpk72ZsNcFVaudup8Gwm.wav?bKID',
    match_5: 'https://remix.gg/blob/f02f9e30-e415-4b1e-b090-0f0c19d9fd25/match_5-2PYuGoqww3tw5ZqwQAcKo41Uf1fsdf.wav?au2c',
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Load all audio files
   * Call this from the preload method of your scene
   */
  public loadAudio(): void {
    Object.entries(SoundManager.SOUND_URLS).forEach(([key, url]) => {
      this.scene.load.audio(key, url)
    })
  }

  /**
   * Initialize the sound manager
   * Call this from the create method of your scene
   * Sets up user interaction listeners to unlock audio
   */
  public initialize(): void {
    this.setupInteractionListeners()
    this.ensureUnlocked()
  }

  /**
   * Play match sound based on boost count
   * @param boostCount The current boost count (0 for new match, 1+ for subsequent matches)
   */
  public playMatchSound(boostCount: number): void {
    // Don't play sounds in background mode
    if (this.isBackgroundMode) return

    // Don't play if muted
    if (this.isMuted) return

    // Map boost count to sound key (0->match_1, 1->match_2, ..., 4+->match_5)
    const soundIndex = Math.min(boostCount + 1, 5)
    const soundKey = `match_${soundIndex}`

    // Play the sound if it exists
    if (this.scene.sound && this.scene.cache.audio.exists(soundKey)) {
      this.scene.sound.play(soundKey)
    }
  }

  /**
   * Mute all sounds
   */
  public mute(): void {
    console.log('SoundManager.mute() called')
    this.isMuted = true
    if (this.scene.sound) {
      this.scene.sound.setMute(true)
      console.log('Phaser sound muted')
    }
  }

  /**
   * Unmute all sounds and ensure audio context is unlocked
   */
  public unmute(): void {
    console.log('SoundManager.unmute() called')
    this.isMuted = false
    if (this.scene.sound) {
      this.scene.sound.setMute(false)
      this.ensureUnlocked()
      console.log('Phaser sound unmuted')
    }
  }

  /**
   * Set whether the game is in background mode
   * When in background mode, sounds will not play
   * @param enabled true to enable background mode, false to disable
   */
  public setBackgroundMode(enabled: boolean): void {
    this.isBackgroundMode = enabled
  }

  /**
   * Ensure audio context is unlocked
   * Handles browser autoplay policy restrictions
   */
  public ensureUnlocked(): void {
    if (this.scene.sound && this.scene.sound.locked) {
      this.scene.sound.unlock()
    }
  }

  /**
   * Handle user interaction to unlock audio
   * This is called automatically on first user interaction
   */
  public handleUserInteraction(): void {
    this.ensureUnlocked()

    // After first interaction, we can remove the listeners to avoid overhead
    this.removeInteractionListeners()
  }

  /**
   * Set up event listeners for user interaction to unlock audio
   * This ensures audio works on first interaction with the game
   */
  private setupInteractionListeners(): void {
    if (this.hasSetupInteractionListeners) return

    const handler = () => this.handleUserInteraction()

    // Listen for various user interaction events
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('touchstart', handler, { once: true })
    document.addEventListener('keydown', handler, { once: true })

    this.hasSetupInteractionListeners = true
  }

  /**
   * Remove interaction listeners (called after first interaction)
   */
  private removeInteractionListeners(): void {
    // Event listeners with { once: true } are automatically removed
    // This method is here for clarity and potential future use
  }

  /**
   * Get current mute state
   * @returns true if muted, false otherwise
   */
  public isSoundMuted(): boolean {
    return this.isMuted
  }

  /**
   * Get current background mode state
   * @returns true if in background mode, false otherwise
   */
  public isInBackgroundMode(): boolean {
    return this.isBackgroundMode
  }
}
