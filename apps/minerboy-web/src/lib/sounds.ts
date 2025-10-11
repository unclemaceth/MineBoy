'use client';

// Sound system for MineBoy device
export class SoundManager {
  private static instance: SoundManager;
  private enabled: boolean = true;
  private buttonSoundsEnabled: boolean = true;
  private claimSoundsEnabled: boolean = true;
  private failSoundsEnabled: boolean = true;
  private miningSoundsEnabled: boolean = true;
  private audioContext: AudioContext | null = null;
  
  // Audio elements
  private buttonSound: HTMLAudioElement | null = null;
  private confirmSound: HTMLAudioElement | null = null;
  private failSound: HTMLAudioElement | null = null;
  
  // Pre-loaded audio pool for instant playback
  private buttonSoundPool: HTMLAudioElement[] = [];
  private confirmSoundPool: HTMLAudioElement[] = [];
  private failSoundPool: HTMLAudioElement[] = [];
  private miningSoundPool: Map<string, HTMLAudioElement> = new Map(); // Device ID -> mining sound
  private currentButtonIndex = 0;
  private currentConfirmIndex = 0;
  private currentFailIndex = 0;
  
  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadSettings();
      this.initializeSounds();
    }
  }
  
  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }
  
  private loadSettings() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mineboy-sound-enabled');
      this.enabled = stored ? stored === 'true' : true;
      
      const buttonStored = localStorage.getItem('mineboy-button-sounds-enabled');
      this.buttonSoundsEnabled = buttonStored ? buttonStored === 'true' : true;
      
      const claimStored = localStorage.getItem('mineboy-claim-sounds-enabled');
      this.claimSoundsEnabled = claimStored ? claimStored === 'true' : true;
      
      const failStored = localStorage.getItem('mineboy-fail-sounds-enabled');
      this.failSoundsEnabled = failStored ? failStored === 'true' : true;
      
      const miningStored = localStorage.getItem('mineboy-mining-sounds-enabled');
      this.miningSoundsEnabled = miningStored ? miningStored === 'true' : true;
    }
  }
  
  private initializeSounds() {
    // Create audio elements
    this.buttonSound = new Audio('/sounds/back_style_2_001.wav');
    this.confirmSound = new Audio('/sounds/confirm_style_1_001.wav');
    this.failSound = new Audio('/sounds/Sequence_07.wav');
    
    // Configure audio
    [this.buttonSound, this.confirmSound, this.failSound].forEach(audio => {
      if (audio) {
        audio.preload = 'auto';
        audio.volume = 0.7;
        // Force immediate loading
        audio.load();
      }
    });
    
    // Mining sounds are created per-device on demand
    
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
    
    // Create a pool of pre-loaded fail sounds
    for (let i = 0; i < 3; i++) {
      const audio = new Audio('/sounds/Sequence_07.wav');
      audio.preload = 'auto';
      audio.volume = 0.7;
      this.failSoundPool.push(audio);
    }
    
    // Force load all sounds
    [...this.buttonSoundPool, ...this.confirmSoundPool, ...this.failSoundPool].forEach(audio => {
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
  
  public setButtonSoundsEnabled(enabled: boolean) {
    this.buttonSoundsEnabled = enabled;
    localStorage.setItem('mineboy-button-sounds-enabled', enabled.toString());
  }
  
  public isButtonSoundsEnabled(): boolean {
    return this.buttonSoundsEnabled;
  }
  
  public setClaimSoundsEnabled(enabled: boolean) {
    this.claimSoundsEnabled = enabled;
    localStorage.setItem('mineboy-claim-sounds-enabled', enabled.toString());
  }
  
  public isClaimSoundsEnabled(): boolean {
    return this.claimSoundsEnabled;
  }
  
  public setFailSoundsEnabled(enabled: boolean) {
    this.failSoundsEnabled = enabled;
    localStorage.setItem('mineboy-fail-sounds-enabled', enabled.toString());
  }
  
  public isFailSoundsEnabled(): boolean {
    return this.failSoundsEnabled;
  }
  
  public setMiningSoundsEnabled(enabled: boolean) {
    this.miningSoundsEnabled = enabled;
    localStorage.setItem('mineboy-mining-sounds-enabled', enabled.toString());
  }
  
  public isMiningSoundsEnabled(): boolean {
    return this.miningSoundsEnabled;
  }
  
  public playButtonSound() {
    if (!this.enabled || !this.buttonSoundsEnabled) return;
    
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
    if (!this.enabled || !this.claimSoundsEnabled) return;
    
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
  
  public playFailSound() {
    if (!this.enabled || !this.failSoundsEnabled) return;
    
    try {
      // Use pre-loaded audio from pool
      if (this.failSoundPool.length > 0) {
        const audio = this.failSoundPool[this.currentFailIndex];
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
        this.currentFailIndex = (this.currentFailIndex + 1) % this.failSoundPool.length;
      } else {
        // Fallback to main audio element
        if (this.failSound) {
          this.failSound.currentTime = 0;
          this.failSound.play().catch(() => {
            // Ignore autoplay errors
          });
        }
      }
    } catch (error) {
      console.warn('Fail sound failed:', error);
    }
  }
  
  public startMiningSound(deviceId: string) {
    if (!this.enabled || !this.miningSoundsEnabled) return;
    
    try {
      // Check if this device already has a mining sound
      let audio = this.miningSoundPool.get(deviceId);
      
      // If not, create a new one for this device
      if (!audio) {
        audio = new Audio('/sounds/Robot Beep Boop.wav');
        audio.preload = 'auto';
        audio.volume = 0.525; // 75% of 0.7 = quieter mining sound
        audio.loop = true;
        audio.load();
        this.miningSoundPool.set(deviceId, audio);
      }
      
      // Start playing (if not already playing)
      if (audio.paused) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    } catch (error) {
      console.warn('Mining sound failed:', error);
    }
  }
  
  public stopMiningSound(deviceId: string) {
    const audio = this.miningSoundPool.get(deviceId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
  
  public stopAllMiningSounds() {
    // Helper to stop all mining sounds (e.g., when toggling sound settings)
    this.miningSoundPool.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
  
}

// Convenience functions
export const soundManager = SoundManager.getInstance();

export const playButtonSound = () => {
  soundManager.playButtonSound();
};

export const playConfirmSound = () => {
  soundManager.playConfirmSound();
};

export const playFailSound = () => {
  soundManager.playFailSound();
};

export const startMiningSound = (deviceId: string) => {
  soundManager.startMiningSound(deviceId);
};

export const stopMiningSound = (deviceId: string) => {
  soundManager.stopMiningSound(deviceId);
};

export const stopAllMiningSounds = () => {
  soundManager.stopAllMiningSounds();
};
