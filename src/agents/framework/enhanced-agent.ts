import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { io, Socket } from 'socket.io-client';
import * as dotenv from 'dotenv';

dotenv.config();

export interface EnhancedAgentConfig {
  name: string;
  systemPrompt: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  llmProvider: 'openai' | 'groq';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class EnhancedVoiceAgent extends EventEmitter {
  private openai: OpenAI;
  private groq: Groq;
  private socket: Socket | null = null;
  private config: EnhancedAgentConfig;
  private conversationHistory: any[] = [];
  private isProcessing = false;

  constructor(config: EnhancedAgentConfig) {
    super();
    this.config = {
      temperature: 0.7,
      maxTokens: 150,
      ...config
    };
    
    // Initialize LLM clients
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    // Set default models if not specified
    if (!this.config.model) {
      this.config.model = this.config.llmProvider === 'openai' 
        ? 'gpt-4-turbo-preview'
        : 'llama3-8b-8192';  // Using available Groq model
    }
  }

  async joinRoom(roomId: string, serverUrl: string = 'http://localhost:8080') {
    console.log(`[${this.config.name}] Joining room ${roomId}...`);
    
    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      console.log(`[${this.config.name}] Connected to server`);
      
      this.socket!.emit('join-room', {
        roomId,
        name: this.config.name + ' (AI Agent)',
        isAgent: true
      });
    });

    this.socket.on('joined-room', (data) => {
      console.log(`[${this.config.name}] Successfully joined room:`, data.roomId);
      this.emit('joined', data);
    });

    this.socket.on('participant-joined', async (data) => {
      console.log(`[${this.config.name}] New participant:`, data.name);
      
      // Greet new participants
      const greeting = await this.generateResponse(
        `A new person named ${data.name} just joined. Greet them briefly and warmly.`
      );
      
      this.broadcastMessage(greeting);
    });

    this.socket.on('message', async (data) => {
      if (!data.isAgent) {  // Don't respond to other agents
        await this.processMessage(data.text, data.name);
      }
    });

    this.socket.on('disconnect', () => {
      console.log(`[${this.config.name}] Disconnected from server`);
    });
  }

  private async processMessage(text: string, userName: string) {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      
      console.log(`[${this.config.name}] Processing: "${text}" from ${userName}`);
      
      // Generate response using selected LLM
      const response = await this.generateResponse(
        `${userName} says: ${text}`
      );
      
      console.log(`[${this.config.name}] Response: "${response}"`);
      
      // Broadcast response
      this.broadcastMessage(response);
      
      // Convert to speech if OpenAI
      if (this.config.llmProvider === 'openai') {
        const audio = await this.textToSpeech(response);
        this.emit('audio-response', audio);
      }
      
    } catch (error) {
      console.error(`[${this.config.name}] Processing error:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async generateResponse(input: string): Promise<string> {
    this.conversationHistory.push({ role: 'user', content: input });
    
    let response: string;
    
    if (this.config.llmProvider === 'openai') {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.conversationHistory
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });
      
      response = completion.choices[0].message.content!;
      
    } else {
      // Use Groq
      const completion = await this.groq.chat.completions.create({
        model: this.config.model!,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.conversationHistory
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      });
      
      response = completion.choices[0].message.content!;
    }
    
    this.conversationHistory.push({ role: 'assistant', content: response });
    
    // Keep history limited
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    return response;
  }

  private async textToSpeech(text: string): Promise<ArrayBuffer> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: this.config.voice,
      input: text
    });
    
    return response.arrayBuffer();
  }

  private broadcastMessage(message: string) {
    if (this.socket) {
      this.socket.emit('agent-message', {
        text: message,
        agentName: this.config.name,
        timestamp: new Date().toISOString()
      });
    }
    
    this.emit('message-sent', message);
  }

  async askQuestion(question: string): Promise<string> {
    // Direct question-answer without joining a room
    return this.generateResponse(question);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.conversationHistory = [];
  }

  getStats() {
    return {
      name: this.config.name,
      provider: this.config.llmProvider,
      model: this.config.model,
      historyLength: this.conversationHistory.length,
      isProcessing: this.isProcessing
    };
  }
}

// Pre-configured agent templates
export function createCustomerServiceAgent(llmProvider: 'openai' | 'groq' = 'openai') {
  return new EnhancedVoiceAgent({
    name: 'Customer Service Agent',
    systemPrompt: `You are a helpful and professional customer service agent. 
                   Be polite, empathetic, and solution-focused.
                   Keep responses concise (under 2 sentences).
                   Always try to resolve issues efficiently.`,
    voice: 'nova',
    llmProvider,
    temperature: 0.6
  });
}

export function createSalesAgent(llmProvider: 'openai' | 'groq' = 'groq') {
  return new EnhancedVoiceAgent({
    name: 'Sales Assistant',
    systemPrompt: `You are a friendly and knowledgeable sales assistant.
                   Help customers find products and answer questions.
                   Be enthusiastic but not pushy.
                   Keep responses brief and informative.`,
    voice: 'alloy',
    llmProvider,
    model: llmProvider === 'groq' ? 'llama3-8b-8192' : 'gpt-4-turbo-preview'
  });
}

export function createTechnicalSupportAgent(llmProvider: 'openai' | 'groq' = 'groq') {
  return new EnhancedVoiceAgent({
    name: 'Tech Support',
    systemPrompt: `You are a technical support specialist.
                   Help users troubleshoot issues with clear, step-by-step instructions.
                   Be patient and thorough.
                   Ask clarifying questions when needed.
                   Keep each response under 3 sentences.`,
    voice: 'echo',
    llmProvider,
    model: llmProvider === 'groq' ? 'llama3-8b-8192' : 'gpt-4-turbo-preview'
  });
}

export function createCreativeAgent(llmProvider: 'openai' | 'groq' = 'openai') {
  return new EnhancedVoiceAgent({
    name: 'Creative Assistant',
    systemPrompt: `You are a creative and imaginative assistant.
                   Help with brainstorming, writing, and creative projects.
                   Be inspiring and think outside the box.
                   Offer unique perspectives and ideas.`,
    voice: 'shimmer',
    llmProvider,
    temperature: 0.9,
    maxTokens: 200
  });
}

export function createDataAnalystAgent(llmProvider: 'openai' | 'groq' = 'groq') {
  return new EnhancedVoiceAgent({
    name: 'Data Analyst',
    systemPrompt: `You are a data analyst expert.
                   Help interpret data, explain trends, and provide insights.
                   Be precise with numbers and statistics.
                   Suggest actionable recommendations based on data.`,
    voice: 'onyx',
    llmProvider,
    model: llmProvider === 'groq' ? 'llama3-8b-8192' : 'gpt-4-turbo-preview',
    temperature: 0.3  // Lower temperature for more precise responses
  });
}