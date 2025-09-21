'use client';

// Sound system for MineBoy device
export class SoundManager {
  private static instance: SoundManager;
  private enabled: boolean = true;
  private audioContext: AudioContext | null = null;
  
  // Audio elements
  private buttonSound: HTMLAudioElement | null = null;
  private confirmSound: HTMLAudioElement | null = null;
  private miningSound: HTMLAudioElement | null = null;
  
  // Pre-loaded audio pool for instant playback
  private buttonSoundPool: HTMLAudioElement[] = [];
  private confirmSoundPool: HTMLAudioElement[] = [];
  private currentButtonIndex = 0;
  private currentConfirmIndex = 0;
  
  private constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSounds();
    }
  }
  
  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }
  
  private initializeSounds() {
    // Create audio elements
    this.buttonSound = new Audio('/sounds/back_style_2_001.wav');
    this.confirmSound = new Audio('/sounds/confirm_style_1_001.wav');
    this.miningSound = new Audio('/sounds/Robot Beep Boop.wav');
    
    // Configure audio
    [this.buttonSound, this.confirmSound, this.miningSound].forEach(audio => {
      if (audio) {
        audio.preload = 'auto';
        audio.volume = 0.7;
        // Force immediate loading
        audio.load();
      }
    });
    
    // Mining sound should loop
    if (this.miningSound) {
      this.miningSound.loop = true;
    }
    
    // Preload all sounds immediately
    this.preloadSounds();
  }
  
  private preloadSounds() {
    // Create a pool of pre-loaded button sounds
    for (let i = 0; i < 5; i++) {
      const audio = new Audio('/sounds/back_style_2_001.wav');
      audio.preload = 'auto';
      audio.volume = 0.7;
      this.buttonSoundPool.push(audio);
    }
    
    // Create a pool of pre-loaded confirm sounds
    for (let i = 0; i < 3; i++) {
      const audio = new Audio('/sounds/confirm_style_1_001.wav');
      audio.preload = 'auto';
      audio.volume = 0.7;
      this.confirmSoundPool.push(audio);
    }
    
    // Force load all sounds
    [...this.buttonSoundPool, ...this.confirmSoundPool, this.miningSound].forEach(audio => {
      if (audio) {
        audio.load();
      }
    });
  }
  
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('mineboy-sound-enabled', enabled.toString());
  }
  
  public isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mineboy-sound-enabled');
      return stored ? stored === 'true' : true;
    }
    return this.enabled;
  }
  
  public playButtonSound() {
    if (!this.enabled) return;
    
    try {
      // Use pre-loaded audio from pool
      if (this.buttonSoundPool.length > 0) {
        const audio = this.buttonSoundPool[this.currentButtonIndex];
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
        this.currentButtonIndex = (this.currentButtonIndex + 1) % this.buttonSoundPool.length;
      } else {
        // Fallback to main audio element
        if (this.buttonSound) {
          this.buttonSound.currentTime = 0;
          this.buttonSound.play().catch(() => {
            // Ignore autoplay errors
          });
        }
      }
    } catch (error) {
      console.warn('Button sound failed:', error);
    }
  }
  
  public playConfirmSound() {
    if (!this.enabled) return;
    
    try {
      // Use pre-loaded audio from pool
      if (this.confirmSoundPool.length > 0) {
        const audio = this.confirmSoundPool[this.currentConfirmIndex];
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
        this.currentConfirmIndex = (this.currentConfirmIndex + 1) % this.confirmSoundPool.length;
      } else {
        // Fallback to main audio element
        if (this.confirmSound) {
          this.confirmSound.currentTime = 0;
          this.confirmSound.play().catch(() => {
            // Ignore autoplay errors
          });
        }
      }
    } catch (error) {
      console.warn('Confirm sound failed:', error);
    }
  }
  
  public startMiningSound() {
    if (!this.enabled || !this.miningSound) return;
    
    try {
      this.miningSound.currentTime = 0;
      this.miningSound.play().catch(() => {
        // Ignore autoplay errors
      });
    } catch (error) {
      console.warn('Mining sound failed:', error);
    }
  }
  
  public stopMiningSound() {
    if (this.miningSound) {
      this.miningSound.pause();
      this.miningSound.currentTime = 0;
    }
  }
  
  public playHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(50);
          break;
        case 'medium':
          navigator.vibrate(100);
          break;
        case 'heavy':
          navigator.vibrate([100, 50, 100]);
          break;
      }
    }
  }
}

// Convenience functions
export const soundManager = SoundManager.getInstance();

export const playButtonSound = () => {
  soundManager.playButtonSound();
  soundManager.playHapticFeedback('light');
};

export const playConfirmSound = () => {
  soundManager.playConfirmSound();
  soundManager.playHapticFeedback('medium');
};

export const startMiningSound = () => {
  soundManager.startMiningSound();
};

export const stopMiningSound = () => {
  soundManager.stopMiningSound();
};
