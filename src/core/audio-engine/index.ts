import { OpusEncoder } from '@discordjs/opus';
import { EventEmitter } from 'events';

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  frameSize: number;
  bitrate: number;
}

export class AudioEngine extends EventEmitter {
  private encoder: OpusEncoder;
  private decoder: OpusEncoder; // Using OpusEncoder for both encode/decode
  private config: AudioConfig;
  private vad: VoiceActivityDetector;
  private metrics: AudioMetrics;

  constructor(config: AudioConfig) {
    super();
    this.config = config;
    this.encoder = new OpusEncoder(config.sampleRate, config.channels);
    this.decoder = new OpusEncoder(config.sampleRate, config.channels);
    this.vad = new VoiceActivityDetector();
    this.metrics = new AudioMetrics();
    
    this.encoder.setBitrate(config.bitrate);
    // this.encoder.setFEC(true);
    // this.encoder.setPacketLossPercentage(10);
  }

  processInput(pcmData: Int16Array): Buffer | null {
    // Apply noise suppression
    const processed = this.applyNoiseSuppression(pcmData);
    
    // Voice activity detection
    const isSpeech = this.vad.process(processed);
    if (!isSpeech) return null; // DTX
    
    // Convert Int16Array to Buffer for encoding
    const buffer = Buffer.from(processed.buffer);
    
    // Encode to Opus
    const encoded = this.encoder.encode(buffer);
    
    // Update metrics
    this.metrics.recordInput(processed.length);
    
    return encoded;
  }

  processOutput(opusData: Buffer): Int16Array {
    // Decode Opus - simplified for now
    // In production, you'd use a proper decoder
    const decoded = new Int16Array(opusData.length * 2);
    
    // Update metrics
    this.metrics.recordOutput(decoded.length);
    
    return decoded;
  }

  private applyNoiseSuppression(data: Int16Array): Int16Array {
    // Simple noise gate implementation
    const threshold = 100;
    return data.map(sample => Math.abs(sample) < threshold ? 0 : sample);
  }

  getMetrics() {
    return this.metrics.calculate();
  }
}

class VoiceActivityDetector {
  private threshold = 0.01;
  private speechFrames = 0;
  private silenceFrames = 0;

  process(data: Int16Array): boolean {
    const energy = this.calculateEnergy(data);
    
    if (energy > this.threshold) {
      this.speechFrames++;
      this.silenceFrames = 0;
      return this.speechFrames > 3; // Require 3 frames of speech
    } else {
      this.silenceFrames++;
      this.speechFrames = 0;
      return this.silenceFrames < 10; // Continue for 10 frames after speech
    }
  }

  private calculateEnergy(data: Int16Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    return sum / data.length / 32768;
  }
}

class AudioMetrics {
  private inputBytes = 0;
  private outputBytes = 0;
  private startTime = Date.now();

  recordInput(bytes: number) {
    this.inputBytes += bytes;
  }

  recordOutput(bytes: number) {
    this.outputBytes += bytes;
  }

  calculate() {
    const duration = (Date.now() - this.startTime) / 1000;
    return {
      inputBitrate: (this.inputBytes * 8) / duration,
      outputBitrate: (this.outputBytes * 8) / duration,
      duration
    };
  }
}