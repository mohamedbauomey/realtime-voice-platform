import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

// Actually working models (tested)
export const AVAILABLE_MODELS = {
  openai: {
    'gpt-4o': 'GPT-4o (Latest)',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4 (Stable)', 
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-3.5-turbo-16k': 'GPT-3.5 16K'
  },
  groq: {
    'llama3-70b-8192': 'Llama 3 70B (Best)',
    'llama3-8b-8192': 'Llama 3 8B (Fast)',
    'llama-3.1-8b-instant': 'Llama 3.1 Instant (Fastest)',
    'gemma2-9b-it': 'Gemma 2 9B (Balanced)'
  }
};

export const STT_MODELS = {
  openai: {
    'whisper-1': 'Whisper (OpenAI)'
  },
  groq: {
    'whisper-large-v3': 'Whisper Large v3 (Groq)'
  }
};

export interface StreamingVoiceConfig {
  llmProvider: 'openai' | 'groq';
  llmModel: string;
  sttProvider: 'openai' | 'groq';
  sttModel: string;
  ttsVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  ttsSpeed: number;
  streamResponse: boolean;
  temperature: number;
  systemPrompt?: string;
}

export class RealtimeStreamingAgent extends EventEmitter {
  private openai: OpenAI;
  private groq: Groq;
  private config: StreamingVoiceConfig;
  private conversationHistory: any[] = [];
  private isProcessing = false;
  private audioBuffer: Float32Array[] = [];
  private silenceTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<StreamingVoiceConfig> = {}) {
    super();
    
    this.config = {
      llmProvider: config.llmProvider || 'groq',  // Use provided or default to Groq
      llmModel: config.llmModel || 'llama3-8b-8192',
      sttProvider: 'openai',  // OpenAI Whisper is more reliable
      sttModel: 'whisper-1',
      ttsVoice: 'nova',
      ttsSpeed: 1.0,
      streamResponse: true,
      temperature: 0.7,
      systemPrompt: 'You are a helpful voice assistant. Keep responses concise and natural for voice conversation.',
      ...config
    };

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  /**
   * Process continuous audio stream with VAD
   */
  async processContinuousAudio(audioChunk: Float32Array) {
    // Add to buffer
    this.audioBuffer.push(audioChunk);
    
    // Detect silence (simple energy-based VAD)
    const energy = this.calculateEnergy(audioChunk);
    
    if (energy > 0.01) {  // Speaking
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else {  // Silence
      if (!this.silenceTimer && this.audioBuffer.length > 0) {
        this.silenceTimer = setTimeout(() => {
          this.processBufferedAudio();
        }, 1000);  // Process after 1 second of silence
      }
    }
  }

  private calculateEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  private async processBufferedAudio() {
    if (this.isProcessing || this.audioBuffer.length === 0) return;
    
    this.isProcessing = true;
    const audio = this.mergeAudioBuffers(this.audioBuffer);
    this.audioBuffer = [];
    
    try {
      // Convert to format suitable for STT
      const audioData = this.float32ToWav(audio);
      
      // Step 1: STT
      const transcript = await this.speechToText(audioData);
      if (!transcript) {
        this.isProcessing = false;
        return;
      }
      
      this.emit('transcript', transcript);
      
      // Step 2: Stream LLM response
      if (this.config.streamResponse) {
        await this.streamLLMResponse(transcript);
      } else {
        const response = await this.getLLMResponse(transcript);
        this.emit('response', response);
        await this.streamTTS(response);
      }
      
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private mergeAudioBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    
    return result;
  }

  private float32ToWav(buffer: Float32Array): ArrayBuffer {
    // Simple WAV encoding
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  }

  /**
   * Speech to Text with provider selection
   */
  private async speechToText(audioData: ArrayBuffer): Promise<string | null> {
    try {
      console.log(`Using ${this.config.sttProvider} STT, audio size: ${audioData.byteLength} bytes`);
      
      if (this.config.sttProvider === 'groq') {
        // Groq Whisper (if available)
        return await this.groqSTT(audioData);
      } else {
        // OpenAI Whisper
        return await this.openaiSTT(audioData);
      }
    } catch (error) {
      console.error('STT Error:', error);
      this.emit('error', { message: 'Speech recognition failed. Please try again.' });
      return null;
    }
  }

  private async openaiSTT(audioData: ArrayBuffer): Promise<string> {
    // OpenAI supports webm, mp3, mp4, mpeg, mpga, m4a, wav, webm
    const blob = new Blob([audioData], { type: 'audio/webm' });
    const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
    
    const response = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      temperature: 0.2,
      prompt: 'Voice assistant conversation.'
    });
    
    return response.text.trim();
  }

  private async groqSTT(audioData: ArrayBuffer): Promise<string> {
    // Groq Whisper API (if they provide it)
    // For now, fallback to OpenAI
    console.log('Groq STT not yet available, using OpenAI');
    return this.openaiSTT(audioData);
  }

  /**
   * Stream LLM response for low latency
   */
  private async streamLLMResponse(input: string) {
    this.conversationHistory.push({ role: 'user', content: input });
    
    if (this.config.llmProvider === 'groq') {
      await this.streamGroqResponse();
    } else {
      await this.streamOpenAIResponse();
    }
  }

  private async streamOpenAIResponse() {
    const stream = await this.openai.chat.completions.create({
      model: this.config.llmModel,
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...this.conversationHistory
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
      stream: true
    });
    
    let fullResponse = '';
    let buffer = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      buffer += content;
      
      // Emit partial responses for UI updates
      this.emit('partial', content);
      
      // Stream TTS when we have a sentence
      if (buffer.match(/[.!?]\s/)) {
        await this.streamTTS(buffer);
        buffer = '';
      }
    }
    
    // Process remaining buffer
    if (buffer) {
      await this.streamTTS(buffer);
    }
    
    this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    this.emit('response', fullResponse);
  }

  private async streamGroqResponse() {
    const stream = await this.groq.chat.completions.create({
      model: this.config.llmModel,
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...this.conversationHistory
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
      stream: true
    });
    
    let fullResponse = '';
    let buffer = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      buffer += content;
      
      this.emit('partial', content);
      
      // Stream TTS when we have a sentence
      if (buffer.match(/[.!?]\s/)) {
        await this.streamTTS(buffer);
        buffer = '';
      }
    }
    
    if (buffer) {
      await this.streamTTS(buffer);
    }
    
    this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    this.emit('response', fullResponse);
  }

  /**
   * Get non-streaming LLM response
   */
  private async getLLMResponse(input: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: input });
    
    let response: string;
    
    if (this.config.llmProvider === 'groq') {
      const completion = await this.groq.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.conversationHistory
        ],
        temperature: this.config.temperature,
        max_tokens: 150
      });
      response = completion.choices[0].message.content || '';
    } else {
      const completion = await this.openai.chat.completions.create({
        model: this.config.llmModel,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.conversationHistory
        ],
        temperature: this.config.temperature,
        max_tokens: 150
      });
      response = completion.choices[0].message.content || '';
    }
    
    this.conversationHistory.push({ role: 'assistant', content: response });
    
    // Keep history limited
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
    
    return response;
  }

  /**
   * Stream TTS for immediate playback
   */
  private async streamTTS(text: string) {
    if (!text.trim()) return;
    
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',  // Use tts-1 for lower latency
        voice: this.config.ttsVoice,
        input: text,
        speed: this.config.ttsSpeed
      });
      
      const audioData = await response.arrayBuffer();
      this.emit('audio', audioData, text);
    } catch (error) {
      console.error('TTS Error:', error);
    }
  }

  /**
   * Process a complete audio file (for non-streaming)
   */
  async processAudioFile(audioData: ArrayBuffer): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing, skipping...');
      return;
    }
    
    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      console.log('Processing audio file, size:', audioData.byteLength, 'bytes');
      
      // STT
      const sttStart = Date.now();
      const transcript = await this.speechToText(audioData);
      const sttTime = Date.now() - sttStart;
      
      if (!transcript || transcript.trim() === '') {
        console.log('No transcript detected');
        this.emit('error', { message: 'No speech detected. Please speak clearly.' });
        this.isProcessing = false;
        return;
      }
      
      console.log('Transcript:', transcript)
      
      this.emit('transcript', { text: transcript, time: sttTime });
      
      // LLM
      const llmStart = Date.now();
      const response = await this.getLLMResponse(transcript);
      const llmTime = Date.now() - llmStart;
      
      this.emit('response', { text: response, time: llmTime });
      
      // TTS
      const ttsStart = Date.now();
      await this.streamTTS(response);
      const ttsTime = Date.now() - ttsStart;
      
      const totalTime = Date.now() - startTime;
      
      this.emit('complete', {
        transcript,
        response,
        times: {
          stt: sttTime,
          llm: llmTime,
          tts: ttsTime,
          total: totalTime
        }
      });
      
    } catch (error) {
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingVoiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      ...this.config,
      historyLength: this.conversationHistory.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.audioBuffer = [];
  }
}

// Factory functions for quick setup
export function createRealtimeAssistant(config: Partial<StreamingVoiceConfig> = {}) {
  return new RealtimeStreamingAgent({
    llmProvider: 'groq',
    llmModel: 'llama3-8b-8192',
    streamResponse: true,
    ttsSpeed: 1.0,
    ...config
  });
}

export function createHighQualityAssistant(config: Partial<StreamingVoiceConfig> = {}) {
  return new RealtimeStreamingAgent({
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    streamResponse: true,
    ttsSpeed: 1.0,
    ...config
  });
}

export function createFastAssistant(config: Partial<StreamingVoiceConfig> = {}) {
  return new RealtimeStreamingAgent({
    llmProvider: 'groq',
    llmModel: 'llama-3.1-8b-instant',
    streamResponse: true,
    ttsSpeed: 1.2,
    ...config
  });
}