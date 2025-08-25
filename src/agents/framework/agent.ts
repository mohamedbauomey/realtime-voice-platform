import { EventEmitter } from 'events';
import OpenAI from 'openai';
import WebSocket from 'ws';
import { io, Socket } from 'socket.io-client';

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  sttProvider: 'openai' | 'deepgram';
  ttsProvider: 'openai' | 'elevenlabs';
}

export class VoiceAgent extends EventEmitter {
  private openai: OpenAI;
  private socket: Socket | null = null;
  private sttWs: WebSocket | null = null;
  private config: AgentConfig;
  private conversationHistory: any[] = [];
  private isProcessing = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async joinRoom(roomId: string) {
    // Connect to room as an agent participant
    this.socket = io('http://localhost:8080');
    
    this.socket.emit('join-room', {
      roomId,
      name: this.config.name,
      isAgent: true
    });

    this.socket.on('audio-data', async (data: any) => {
      await this.processAudio(data.audio);
    });

    this.socket.on('participant-joined', (data: any) => {
      console.log('Participant joined:', data);
    });

    this.socket.on('participant-left', (data: any) => {
      console.log('Participant left:', data);
    });
  }

  private async processAudio(audioData: ArrayBuffer) {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      
      // 1. Speech to Text
      const transcript = await this.speechToText(audioData);
      if (!transcript) return;
      
      console.log('User said:', transcript);
      
      // 2. Generate Response
      const response = await this.generateResponse(transcript);
      console.log('Agent response:', response);
      
      // 3. Text to Speech
      const audioResponse = await this.textToSpeech(response);
      
      // 4. Send audio back
      this.emit('audio-response', audioResponse);
      if (this.socket) {
        this.socket.emit('audio-response', audioResponse);
      }
      
    } catch (error) {
      console.error('Agent processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async speechToText(audioData: ArrayBuffer): Promise<string | null> {
    if (this.config.sttProvider === 'openai') {
      // Use OpenAI Whisper
      const blob = new Blob([audioData], { type: 'audio/webm' });
      const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
      const response = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1'
      });
      return response.text;
    } else {
      // Use Deepgram
      return this.deepgramSTT(audioData);
    }
  }

  private async deepgramSTT(audioData: ArrayBuffer): Promise<string | null> {
    // Implement Deepgram streaming STT
    const ws = new WebSocket('wss://api.deepgram.com/v1/listen', {
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
      }
    });

    return new Promise((resolve) => {
      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.channel?.alternatives?.[0]?.transcript) {
          resolve(response.channel.alternatives[0].transcript);
          ws.close();
        }
      });

      ws.on('open', () => {
        ws.send(audioData);
      });

      ws.on('error', (error) => {
        console.error('Deepgram error:', error);
        resolve(null);
      });
    });
  }

  private async generateResponse(input: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: input });
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        ...this.conversationHistory
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const assistantMessage = response.choices[0].message.content!;
    this.conversationHistory.push({ role: 'assistant', content: assistantMessage });
    
    // Keep history limited
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return assistantMessage;
  }

  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    if (this.config.ttsProvider === 'openai') {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: this.config.voice,
        input: text
      });
      
      return response.arrayBuffer();
    } else {
      // Use ElevenLabs
      return this.elevenLabsTTS(text);
    }
  }

  private async elevenLabsTTS(text: string): Promise<ArrayBuffer> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    return response.arrayBuffer();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.sttWs) {
      this.sttWs.close();
      this.sttWs = null;
    }
  }
}

// Example agent creation
export function createCustomerServiceAgent() {
  return new VoiceAgent({
    name: 'Customer Service Agent',
    systemPrompt: `You are a helpful customer service agent. Be polite, 
                   professional, and try to resolve customer issues efficiently. 
                   Keep responses concise and under 2 sentences.`,
    voice: 'nova',
    sttProvider: 'openai',
    ttsProvider: 'openai'
  });
}

export function createSalesAgent() {
  return new VoiceAgent({
    name: 'Sales Assistant',
    systemPrompt: `You are a friendly sales assistant. Help customers find 
                   products, answer questions about features and pricing. 
                   Be enthusiastic but not pushy. Keep responses brief.`,
    voice: 'alloy',
    sttProvider: 'openai',
    ttsProvider: 'openai'
  });
}

export function createTechnicalSupportAgent() {
  return new VoiceAgent({
    name: 'Tech Support',
    systemPrompt: `You are a technical support specialist. Help users 
                   troubleshoot issues, provide clear step-by-step instructions.
                   Be patient and thorough. Keep each response under 3 sentences.`,
    voice: 'echo',
    sttProvider: 'openai',
    ttsProvider: 'openai'
  });
}