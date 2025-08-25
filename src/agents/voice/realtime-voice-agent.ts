import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

// Working models as of testing
const WORKING_MODELS = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  groq: ['llama3-8b-8192', 'llama3-70b-8192', 'llama-3.1-8b-instant', 'gemma2-9b-it']
};

export interface VoiceAgentConfig {
  name: string;
  systemPrompt: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  llmProvider: 'openai' | 'groq' | 'mixed';  // mixed uses Groq for speed, OpenAI for quality
  sttProvider: 'openai' | 'browser';  // browser uses Web Speech API
  model?: string;
  temperature?: number;
  streamResponse?: boolean;
}

export class RealtimeVoiceAgent extends EventEmitter {
  private openai: OpenAI;
  private groq: Groq;
  private config: VoiceAgentConfig;
  private conversationHistory: any[] = [];
  private isProcessing = false;
  private audioQueue: ArrayBuffer[] = [];

  constructor(config: VoiceAgentConfig) {
    super();
    this.config = {
      temperature: 0.7,
      streamResponse: true,
      ...config
    };

    // Initialize clients
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    // Set default models
    if (!this.config.model) {
      if (this.config.llmProvider === 'openai') {
        this.config.model = 'gpt-3.5-turbo';
      } else {
        this.config.model = 'llama3-70b-8192'; // Best working Groq model
      }
    }
  }

  /**
   * Process audio input in real-time
   */
  async processAudioStream(audioData: ArrayBuffer): Promise<void> {
    if (this.isProcessing) {
      // Queue audio if already processing
      this.audioQueue.push(audioData);
      return;
    }

    try {
      this.isProcessing = true;
      this.emit('processing-start');

      // Step 1: Speech to Text
      const transcript = await this.speechToText(audioData);
      if (!transcript) {
        this.isProcessing = false;
        return;
      }

      this.emit('transcript', transcript);
      console.log(`[STT] User said: "${transcript}"`);

      // Step 2: Generate LLM Response
      const response = await this.generateResponse(transcript);
      this.emit('response', response);
      console.log(`[LLM] Response: "${response}"`);

      // Step 3: Text to Speech
      const audioResponse = await this.textToSpeech(response);
      this.emit('audio', audioResponse);

      // Process queued audio if any
      if (this.audioQueue.length > 0) {
        const nextAudio = this.audioQueue.shift();
        if (nextAudio) {
          setTimeout(() => this.processAudioStream(nextAudio), 100);
        }
      }

    } catch (error) {
      console.error('Voice processing error:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
      this.emit('processing-end');
    }
  }

  /**
   * Speech to Text using OpenAI Whisper
   */
  private async speechToText(audioData: ArrayBuffer): Promise<string | null> {
    try {
      // Convert ArrayBuffer to Blob to File
      const blob = new Blob([audioData], { type: 'audio/webm' });
      const file = new File([blob], 'audio.webm', { type: 'audio/webm' });

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'en',
        temperature: 0.2
      });

      return response.text.trim();
    } catch (error) {
      console.error('STT Error:', error);
      return null;
    }
  }

  /**
   * Generate response using selected LLM
   */
  private async generateResponse(input: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: input });

    let response: string;

    if (this.config.llmProvider === 'groq' || 
        (this.config.llmProvider === 'mixed' && input.length < 50)) {
      // Use Groq for speed
      response = await this.generateGroqResponse();
    } else {
      // Use OpenAI for quality
      response = await this.generateOpenAIResponse();
    }

    this.conversationHistory.push({ role: 'assistant', content: response });

    // Keep history limited
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return response;
  }

  private async generateOpenAIResponse(): Promise<string> {
    // Always use an OpenAI model regardless of config when calling OpenAI
    const openaiModel = WORKING_MODELS.openai.includes(this.config.model || '') 
      ? this.config.model 
      : 'gpt-3.5-turbo';
    
    const completion = await this.openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...this.conversationHistory
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
      stream: false
    });

    return completion.choices[0].message.content || '';
  }

  private async generateGroqResponse(): Promise<string> {
    // Always use a Groq model regardless of config when calling Groq
    const groqModel = WORKING_MODELS.groq.includes(this.config.model || '') 
      ? this.config.model 
      : 'llama3-70b-8192';
    
    const completion = await this.groq.chat.completions.create({
      model: groqModel,
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...this.conversationHistory
      ],
      temperature: this.config.temperature,
      max_tokens: 150,
      stream: false
    });

    return completion.choices[0].message.content || '';
  }

  /**
   * Text to Speech using OpenAI
   */
  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',  // or 'tts-1-hd' for higher quality
      voice: this.config.voice,
      input: text,
      speed: 1.0
    });

    return response.arrayBuffer();
  }

  /**
   * Process text input (for testing without audio)
   */
  async processText(text: string): Promise<{
    response: string;
    audio?: ArrayBuffer;
  }> {
    const response = await this.generateResponse(text);
    const audio = await this.textToSpeech(response);
    return { response, audio };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      ...this.config,
      historyLength: this.conversationHistory.length,
      isProcessing: this.isProcessing,
      queuedAudio: this.audioQueue.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VoiceAgentConfig>) {
    this.config = { ...this.config, ...updates };
    
    // Validate model is working
    if (updates.model) {
      const provider = this.config.llmProvider === 'mixed' ? 'openai' : this.config.llmProvider;
      if (!WORKING_MODELS[provider].includes(updates.model)) {
        console.warn(`Model ${updates.model} may not be available. Using default.`);
        this.config.model = WORKING_MODELS[provider][0];
      }
    }
  }
}

// Pre-configured voice agents
export function createVoiceAssistant(provider: 'openai' | 'groq' | 'mixed' = 'mixed') {
  return new RealtimeVoiceAgent({
    name: 'Voice Assistant',
    systemPrompt: `You are a helpful voice assistant. Keep responses concise and natural for spoken conversation. 
                   Be friendly and conversational. Limit responses to 2-3 sentences.`,
    voice: 'nova',
    llmProvider: provider,
    sttProvider: 'openai',
    model: provider === 'groq' ? 'llama3-70b-8192' : 'gpt-3.5-turbo'
  });
}

export function createFastVoiceAgent() {
  return new RealtimeVoiceAgent({
    name: 'Fast Voice Agent',
    systemPrompt: `You are a quick-response voice assistant. Give brief, direct answers. 
                   Maximum 1-2 sentences per response.`,
    voice: 'echo',
    llmProvider: 'groq',
    sttProvider: 'openai',
    model: 'llama-3.1-8b-instant',  // Fastest Groq model
    temperature: 0.5
  });
}

export function createSmartVoiceAgent() {
  return new RealtimeVoiceAgent({
    name: 'Smart Voice Agent',
    systemPrompt: `You are an intelligent voice assistant capable of complex reasoning. 
                   Provide thoughtful, accurate responses while keeping them conversational.`,
    voice: 'alloy',
    llmProvider: 'openai',
    sttProvider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7
  });
}

export function createCreativeVoiceAgent() {
  return new RealtimeVoiceAgent({
    name: 'Creative Voice Agent',
    systemPrompt: `You are a creative and imaginative voice assistant. 
                   Be playful, use metaphors, and think outside the box.`,
    voice: 'shimmer',
    llmProvider: 'openai',
    sttProvider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.9
  });
}

export function createMultilingualAgent() {
  return new RealtimeVoiceAgent({
    name: 'Multilingual Assistant',
    systemPrompt: `You are a multilingual voice assistant. Detect the user's language and respond in the same language. 
                   If unsure, ask for clarification. Keep responses natural and conversational.`,
    voice: 'nova',
    llmProvider: 'mixed',
    sttProvider: 'openai',
    temperature: 0.6
  });
}