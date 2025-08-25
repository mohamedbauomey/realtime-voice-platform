import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import * as dotenv from 'dotenv';
import { 
  createVoiceAssistant,
  createFastVoiceAgent,
  createSmartVoiceAgent,
  createCreativeVoiceAgent,
  RealtimeVoiceAgent
} from '../../agents/voice/realtime-voice-agent.js';
import {
  RealtimeStreamingAgent,
  createRealtimeAssistant,
  AVAILABLE_MODELS
} from '../../agents/voice/realtime-streaming-agent.js';

dotenv.config();

export async function startVoiceServer() {
  const app = Fastify();
  
  // Register plugins
  await app.register(cors, { origin: true });

  // Health check
  app.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      groq: !!process.env.GROQ_API_KEY
    }
  }));

  // Serve voice chat interfaces
  app.get('/voice', async (request, reply) => {
    reply.type('text/html');
    const fs = await import('fs/promises');
    const html = await fs.readFile('src/web/voice-chat.html', 'utf-8');
    return html;
  });
  
  // Serve new real-time voice interface
  app.get('/realtime', async (request, reply) => {
    reply.type('text/html');
    const fs = await import('fs/promises');
    const html = await fs.readFile('src/web/realtime-voice.html', 'utf-8');
    return html;
  });

  // Home page with links
  app.get('/', async (request, reply) => {
    reply.type('text/html');
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-Time Voice Platform</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen text-white">
    <div class="container mx-auto p-8 max-w-4xl">
        <h1 class="text-5xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            🎙️ Real-Time Voice Platform
        </h1>
        
        <div class="grid gap-6 md:grid-cols-2">
            <!-- Real-Time Voice (New) -->
            <a href="/realtime" class="block bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition border border-white/20 ring-2 ring-green-500">
                <div class="text-3xl mb-3">🚀</div>
                <h2 class="text-2xl font-bold mb-2">Real-Time Voice (NEW)</h2>
                <p class="text-gray-300">ChatGPT-like voice experience</p>
                <div class="mt-4 text-sm text-gray-400">
                    • Ultra-low latency<br>
                    • Model selection<br>
                    • Streaming responses
                </div>
            </a>
            
            <!-- Voice Chat -->
            <a href="/voice" class="block bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition border border-white/20">
                <div class="text-3xl mb-3">🎤</div>
                <h2 class="text-2xl font-bold mb-2">Voice Chat</h2>
                <p class="text-gray-300">Real-time voice conversation with AI assistants</p>
                <div class="mt-4 text-sm text-gray-400">
                    • OpenAI Whisper STT<br>
                    • GPT-4 & Groq Llama<br>
                    • OpenAI TTS voices
                </div>
            </a>

            <!-- Text Chat -->
            <a href="/ai-demo" class="block bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition border border-white/20">
                <div class="text-3xl mb-3">💬</div>
                <h2 class="text-2xl font-bold mb-2">Text Chat</h2>
                <p class="text-gray-300">Type to chat with multiple AI models</p>
                <div class="mt-4 text-sm text-gray-400">
                    • Multiple AI agents<br>
                    • Model comparison<br>
                    • Performance metrics
                </div>
            </a>

            <!-- API Status -->
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div class="text-3xl mb-3">📊</div>
                <h2 class="text-2xl font-bold mb-2">API Status</h2>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span>OpenAI API:</span>
                        <span class="${process.env.OPENAI_API_KEY ? 'text-green-400' : 'text-red-400'}">${process.env.OPENAI_API_KEY ? '✅ Connected' : '❌ Not configured'}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Groq API:</span>
                        <span class="${process.env.GROQ_API_KEY ? 'text-green-400' : 'text-red-400'}">${process.env.GROQ_API_KEY ? '✅ Connected' : '❌ Not configured'}</span>
                    </div>
                </div>
            </div>

            <!-- Documentation -->
            <div class="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div class="text-3xl mb-3">📚</div>
                <h2 class="text-2xl font-bold mb-2">Features</h2>
                <ul class="text-sm text-gray-300 space-y-1">
                    <li>✨ Real-time voice processing</li>
                    <li>🎯 Multiple AI personalities</li>
                    <li>⚡ Ultra-fast Groq responses</li>
                    <li>🎨 Creative & smart modes</li>
                    <li>🔄 Hybrid routing</li>
                </ul>
            </div>
        </div>

        <div class="mt-8 text-center text-gray-400">
            <p>Platform running on port 8080</p>
            <p class="text-sm mt-2">WebSocket: ws://localhost:8080</p>
        </div>
    </div>
</body>
</html>`;
  });

  // Start server
  const port = parseInt(process.env.PORT || '8080');
  await app.listen({ port, host: '0.0.0.0' });
  
  // Setup Socket.IO for real-time voice
  const io = new Server(app.server as any, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 10e6  // 10MB for audio data
  });

  // Store active agents per socket
  const activeAgents = new Map<string, RealtimeVoiceAgent>();
  const streamingAgents = new Map<string, RealtimeStreamingAgent>();

  io.on('connection', (socket) => {
    console.log('Voice client connected:', socket.id);
    
    // Select assistant type
    socket.on('select-assistant', (data) => {
      const { type, voice } = data;
      console.log(`Client ${socket.id} selected ${type} assistant with ${voice} voice`);
      
      // Clean up existing agent
      if (activeAgents.has(socket.id)) {
        const oldAgent = activeAgents.get(socket.id);
        oldAgent?.clearHistory();
      }
      
      // Create new agent based on type
      let agent: RealtimeVoiceAgent;
      switch(type) {
        case 'fast':
          agent = createFastVoiceAgent();
          break;
        case 'smart':
          agent = createSmartVoiceAgent();
          break;
        case 'creative':
          agent = createCreativeVoiceAgent();
          break;
        case 'mixed':
          agent = createVoiceAssistant('mixed');
          break;
        default:
          agent = createVoiceAssistant('openai');
      }
      
      // Update voice if specified
      if (voice) {
        agent.updateConfig({ voice: voice as any });
      }
      
      activeAgents.set(socket.id, agent);
      socket.emit('assistant-ready', { type, voice });
    });

    // Process voice audio
    socket.on('process-voice', async (data) => {
      const { audio, timestamp } = data;
      const agent = activeAgents.get(socket.id);
      
      if (!agent) {
        socket.emit('voice-error', { message: 'Please select an assistant first' });
        return;
      }
      
      console.log(`Processing voice from ${socket.id}...`);
      const startTime = Date.now();
      
      try {
        // Convert base64 to ArrayBuffer if needed
        let audioBuffer: ArrayBuffer;
        if (typeof audio === 'string') {
          const binaryString = atob(audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioBuffer = bytes.buffer;
        } else {
          audioBuffer = audio;
        }
        
        // Process through voice agent
        const sttStart = Date.now();
        await agent.processAudioStream(audioBuffer);
        
        // Set up event listeners for this processing
        agent.once('transcript', (transcript) => {
          const sttTime = Date.now() - sttStart;
          socket.emit('voice-transcript', { 
            text: transcript,
            sttTime
          });
        });
        
        agent.once('response', (response) => {
          const llmTime = Date.now() - sttStart;
          console.log(`LLM response for ${socket.id}: ${response}`);
        });
        
        agent.once('audio', async (audioResponse) => {
          const totalTime = Date.now() - startTime;
          
          // Convert ArrayBuffer to base64 for transmission
          const buffer = Buffer.from(audioResponse);
          const base64Audio = buffer.toString('base64');
          
          socket.emit('voice-response', {
            audio: base64Audio,
            text: agent.getConfig().historyLength > 0 ? 'Response generated' : '',
            llmTime: Date.now() - sttStart - 1000, // Approximate
            ttsTime: 500, // Approximate
            totalTime
          });
          
          console.log(`Voice processing complete for ${socket.id} in ${totalTime}ms`);
        });
        
        agent.once('error', (error) => {
          console.error(`Voice processing error for ${socket.id}:`, error);
          socket.emit('voice-error', { 
            message: error.message || 'Processing failed'
          });
        });
        
      } catch (error) {
        console.error('Voice processing error:', error);
        socket.emit('voice-error', { 
          message: error.message || 'Failed to process voice'
        });
      }
    });

    // Process text (for testing)
    socket.on('process-text', async (data) => {
      const { text, assistant } = data;
      const agent = activeAgents.get(socket.id);
      
      if (!agent) {
        socket.emit('voice-error', { message: 'Please select an assistant first' });
        return;
      }
      
      try {
        const startTime = Date.now();
        const result = await agent.processText(text);
        const totalTime = Date.now() - startTime;
        
        // Convert audio to base64
        const buffer = Buffer.from(result.audio);
        const base64Audio = buffer.toString('base64');
        
        socket.emit('voice-response', {
          text: result.response,
          audio: base64Audio,
          totalTime
        });
      } catch (error) {
        socket.emit('voice-error', { 
          message: error.message || 'Failed to process text'
        });
      }
    });

    // Clear conversation history
    socket.on('clear-history', () => {
      const agent = activeAgents.get(socket.id);
      if (agent) {
        agent.clearHistory();
        console.log(`Cleared history for ${socket.id}`);
      }
    });

    // Process real-time voice with streaming
    socket.on('process-realtime-voice', async (data) => {
      const { audio, config, timestamp } = data;
      
      console.log(`Processing real-time voice from ${socket.id} with ${config.llmProvider}/${config.llmModel}`);
      
      // Send immediate acknowledgment
      socket.emit('voice-processing', { 
        type: 'status',
        text: 'Audio received, processing...'
      });
      
      // Get or create streaming agent
      let agent = streamingAgents.get(socket.id);
      if (!agent) {
        agent = new RealtimeStreamingAgent(config);
        streamingAgents.set(socket.id, agent);
        
        // Set up event listeners
        agent.on('transcript', (data) => {
          socket.emit('voice-processing', { 
            type: 'transcript',
            text: data.text || data,
            time: data.time || 0
          });
        });
        
        agent.on('partial', (text) => {
          socket.emit('voice-processing', { 
            type: 'partial',
            text
          });
        });
        
        agent.on('response', (data) => {
          socket.emit('voice-processing', { 
            type: 'response',
            text: data.text || data,
            time: data.time || 0
          });
        });
        
        agent.on('audio', (audioData, text) => {
          const base64 = Buffer.from(audioData).toString('base64');
          socket.emit('voice-processing', { 
            type: 'audio',
            audio: 'data:audio/mpeg;base64,' + base64,
            text,
            time: 500
          });
        });
        
        agent.on('complete', (data) => {
          socket.emit('voice-processing', { 
            type: 'complete',
            totalTime: data.times.total,
            times: data.times
          });
        });
        
        agent.on('error', (error) => {
          socket.emit('error', { 
            message: error.message || 'Processing failed'
          });
        });
      } else {
        // Update config if changed
        agent.updateConfig(config);
      }
      
      // Process audio
      try {
        // Convert from base64 if needed
        let audioBuffer;
        if (typeof audio === 'string' && audio.startsWith('data:')) {
          // Extract the base64 data and convert to Buffer
          const base64Data = audio.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          console.log(`Audio received: ${buffer.length} bytes, format: ${audio.substring(5, 30)}`);
          
          // Convert Buffer to ArrayBuffer for the agent
          audioBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } else if (Buffer.isBuffer(audio)) {
          audioBuffer = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength);
        } else {
          audioBuffer = audio;
        }
        
        console.log(`Processing audio buffer: ${audioBuffer.byteLength} bytes`);
        await agent.processAudioFile(audioBuffer);
      } catch (error) {
        console.error('Real-time processing error:', error);
        socket.emit('error', { message: error.message });
      }
    });
    
    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log('Voice client disconnected:', socket.id);
      activeAgents.delete(socket.id);
      
      const streamAgent = streamingAgents.get(socket.id);
      if (streamAgent) {
        streamAgent.clearHistory();
        streamAgent.removeAllListeners();
        streamingAgents.delete(socket.id);
      }
    });
  });

  console.log(`
🎤 Voice Server Ready!
=====================
🌐 Dashboard: http://localhost:${port}
🚀 Real-Time Voice: http://localhost:${port}/realtime (NEW!)
🎙️ Voice Chat: http://localhost:${port}/voice
💬 Text Chat: http://localhost:${port}/ai-demo
💚 Health: http://localhost:${port}/health
🔌 WebSocket: ws://localhost:${port}

Available Models:
- OpenAI: GPT-4, GPT-3.5
- Groq: Llama3-70B, Llama3-8B, Gemma2-9B

Voice Features:
✅ Real-time STT (Whisper)
✅ Multiple AI personalities
✅ TTS with 6 voices
✅ Continuous conversation mode
✅ Performance metrics
  `);
  
  return app;
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startVoiceServer().catch(console.error);
}