import { EventEmitter } from 'events';

/**
 * Voice Activity Detection (VAD) for automatic recording control
 * Detects speech in audio streams to start/stop recording automatically
 */
export class VoiceActivityDetector extends EventEmitter {
  private energyThreshold: number;
  private silenceThreshold: number;
  private silenceTimeout: number;
  private speechTimeout: number;
  private silenceTimer: NodeJS.Timeout | null = null;
  private speechTimer: NodeJS.Timeout | null = null;
  private isSpeaking: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private bufferLength: number = 0;
  private dataArray: Uint8Array | null = null;
  private smoothingFactor: number = 0.8;
  private previousEnergy: number = 0;
  private noiseFloor: number = 0;
  private calibrationSamples: number[] = [];
  private isCalibrating: boolean = false;

  constructor(config: VadConfig = {}) {
    super();
    
    this.energyThreshold = config.energyThreshold || 0.02;
    this.silenceThreshold = config.silenceThreshold || 0.01;
    this.silenceTimeout = config.silenceTimeout || 1500; // 1.5 seconds of silence
    this.speechTimeout = config.speechTimeout || 300; // 300ms to start speaking
  }

  /**
   * Initialize VAD with audio context
   */
  async initialize(stream: MediaStream): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create analyser node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Connect stream to analyser
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    // Start calibration
    await this.calibrate();
    
    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Calibrate noise floor
   */
  private async calibrate(): Promise<void> {
    this.isCalibrating = true;
    this.calibrationSamples = [];
    
    return new Promise((resolve) => {
      const calibrationDuration = 1000; // 1 second
      const sampleInterval = 50; // Sample every 50ms
      
      const intervalId = setInterval(() => {
        if (this.analyser && this.dataArray) {
          this.analyser.getByteFrequencyData(this.dataArray);
          const energy = this.calculateEnergy(this.dataArray);
          this.calibrationSamples.push(energy);
        }
      }, sampleInterval);
      
      setTimeout(() => {
        clearInterval(intervalId);
        this.calculateNoiseFloor();
        this.isCalibrating = false;
        resolve();
      }, calibrationDuration);
    });
  }

  /**
   * Calculate noise floor from calibration samples
   */
  private calculateNoiseFloor(): void {
    if (this.calibrationSamples.length === 0) return;
    
    // Sort samples and take 75th percentile as noise floor
    const sorted = [...this.calibrationSamples].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.75);
    this.noiseFloor = sorted[index];
    
    // Adjust thresholds based on noise floor
    this.energyThreshold = Math.max(this.noiseFloor * 2, 0.02);
    this.silenceThreshold = Math.max(this.noiseFloor * 1.5, 0.01);
    
    this.emit('calibrated', {
      noiseFloor: this.noiseFloor,
      energyThreshold: this.energyThreshold,
      silenceThreshold: this.silenceThreshold
    });
  }

  /**
   * Start monitoring audio levels
   */
  private startMonitoring(): void {
    const monitor = () => {
      if (!this.analyser || !this.dataArray || this.isCalibrating) {
        requestAnimationFrame(monitor);
        return;
      }
      
      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate energy in speech frequency range (300-3400 Hz)
      const energy = this.calculateSpeechEnergy(this.dataArray);
      
      // Smooth energy with exponential moving average
      const smoothedEnergy = this.smoothingFactor * this.previousEnergy + 
                           (1 - this.smoothingFactor) * energy;
      this.previousEnergy = smoothedEnergy;
      
      // Emit energy level for visualization
      this.emit('energy', {
        raw: energy,
        smoothed: smoothedEnergy,
        threshold: this.energyThreshold,
        isSpeaking: this.isSpeaking
      });
      
      // Detect speech state changes
      this.detectSpeech(smoothedEnergy);
      
      requestAnimationFrame(monitor);
    };
    
    monitor();
  }

  /**
   * Calculate energy from frequency data
   */
  private calculateEnergy(data: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += (data[i] / 255) ** 2;
    }
    return Math.sqrt(sum / data.length);
  }

  /**
   * Calculate energy in speech frequency range
   */
  private calculateSpeechEnergy(data: Uint8Array): number {
    if (!this.audioContext) return 0;
    
    // Calculate bin range for speech frequencies (300-3400 Hz)
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (this.analyser?.fftSize || 2048);
    const minBin = Math.floor(300 / binSize);
    const maxBin = Math.ceil(3400 / binSize);
    
    let sum = 0;
    let count = 0;
    
    for (let i = minBin; i < Math.min(maxBin, data.length); i++) {
      sum += (data[i] / 255) ** 2;
      count++;
    }
    
    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  /**
   * Detect speech based on energy levels
   */
  private detectSpeech(energy: number): void {
    if (energy > this.energyThreshold) {
      // Energy above threshold - potential speech
      if (!this.isSpeaking) {
        // Clear silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        
        // Start speech timer if not already started
        if (!this.speechTimer) {
          this.speechTimer = setTimeout(() => {
            this.isSpeaking = true;
            this.emit('speechStart');
            this.speechTimer = null;
          }, this.speechTimeout);
        }
      }
    } else if (energy < this.silenceThreshold) {
      // Energy below threshold - silence
      if (this.isSpeaking) {
        // Clear speech timer
        if (this.speechTimer) {
          clearTimeout(this.speechTimer);
          this.speechTimer = null;
        }
        
        // Start silence timer if not already started
        if (!this.silenceTimer) {
          this.silenceTimer = setTimeout(() => {
            this.isSpeaking = false;
            this.emit('speechEnd');
            this.silenceTimer = null;
          }, this.silenceTimeout);
        }
      } else {
        // Still silent, clear speech timer if exists
        if (this.speechTimer) {
          clearTimeout(this.speechTimer);
          this.speechTimer = null;
        }
      }
    }
  }

  /**
   * Update VAD configuration
   */
  updateConfig(config: Partial<VadConfig>): void {
    if (config.energyThreshold !== undefined) {
      this.energyThreshold = config.energyThreshold;
    }
    if (config.silenceThreshold !== undefined) {
      this.silenceThreshold = config.silenceThreshold;
    }
    if (config.silenceTimeout !== undefined) {
      this.silenceTimeout = config.silenceTimeout;
    }
    if (config.speechTimeout !== undefined) {
      this.speechTimeout = config.speechTimeout;
    }
    
    this.emit('configUpdated', this.getConfig());
  }

  /**
   * Get current configuration
   */
  getConfig(): VadConfig {
    return {
      energyThreshold: this.energyThreshold,
      silenceThreshold: this.silenceThreshold,
      silenceTimeout: this.silenceTimeout,
      speechTimeout: this.speechTimeout,
      noiseFloor: this.noiseFloor
    };
  }

  /**
   * Reset VAD state
   */
  reset(): void {
    this.isSpeaking = false;
    this.previousEnergy = 0;
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    
    this.emit('reset');
  }

  /**
   * Destroy VAD and cleanup resources
   */
  destroy(): void {
    this.reset();
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.dataArray = null;
    this.calibrationSamples = [];
    
    this.emit('destroyed');
    this.removeAllListeners();
  }

  /**
   * Get current speech state
   */
  isSpeechActive(): boolean {
    return this.isSpeaking;
  }

  /**
   * Force speech start (manual override)
   */
  forceStart(): void {
    this.isSpeaking = true;
    this.emit('speechStart');
  }

  /**
   * Force speech end (manual override)
   */
  forceStop(): void {
    this.isSpeaking = false;
    this.emit('speechEnd');
  }
}

export interface VadConfig {
  energyThreshold?: number;
  silenceThreshold?: number;
  silenceTimeout?: number;
  speechTimeout?: number;
  noiseFloor?: number;
}

// Factory function for easy setup
export function createVAD(config?: VadConfig): VoiceActivityDetector {
  return new VoiceActivityDetector(config);
}

// Preset configurations
export const VAD_PRESETS = {
  sensitive: {
    energyThreshold: 0.015,
    silenceThreshold: 0.008,
    silenceTimeout: 1000,
    speechTimeout: 200
  },
  normal: {
    energyThreshold: 0.02,
    silenceThreshold: 0.01,
    silenceTimeout: 1500,
    speechTimeout: 300
  },
  relaxed: {
    energyThreshold: 0.03,
    silenceThreshold: 0.015,
    silenceTimeout: 2000,
    speechTimeout: 500
  },
  noisy: {
    energyThreshold: 0.04,
    silenceThreshold: 0.02,
    silenceTimeout: 2500,
    speechTimeout: 600
  }
};