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

// Helper function for call system prompts
function getCallSystemPrompt(language: string = 'english'): string {
  const prompts = {
    english: `You are a natural conversational AI assistant in a voice call. 
              Speak naturally as if on the phone. Keep responses concise and conversational.
              Allow for interruptions and maintain context throughout the call.`,
    arabic: `أنت مساعد صوتي ذكي في مكالمة هاتفية. 
             تحدث بشكل طبيعي كما لو كنت في مكالمة حقيقية. 
             اجعل ردودك قصيرة ومحادثة طبيعية.`,
    mixed: `You are a multilingual voice assistant in a call. 
            Detect the language and respond naturally in the same language.
            Keep responses conversational and allow for interruptions.`
  };
  return prompts[language] || prompts.english;
}

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
  
  // Serve AI Voice Call interface
  app.get('/call', async (request, reply) => {
    reply.type('text/html');
    const fs = await import('fs/promises');
    const html = await fs.readFile('src/web/realtime-call.html', 'utf-8');
    return html;
  });

  // Serve NEW Voice Assistant interface
  app.get('/assistant', async (request, reply) => {
    reply.type('text/html');
    const fs = await import('fs/promises');
    const html = await fs.readFile('src/web/voice-assistant.html', 'utf-8');
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
            <!-- AI Voice Call (NEW) -->
            <a href="/call" class="block bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition border border-white/20 ring-2 ring-yellow-500">
                <div class="text-3xl mb-3">📞</div>
                <h2 class="text-2xl font-bold mb-2">AI Voice Call (NEWEST)</h2>
                <p class="text-gray-300">Real phone call experience</p>
                <div class="mt-4 text-sm text-gray-400">
                    • Continuous conversation<br>
                    • Voice interruption<br>
                    • Noise cancellation
                </div>
            </a>
            
            <!-- Real-Time Voice -->
            <a href="/realtime" class="block bg-white/10 backdrop-blur-lg rounded-xl p-6 hover:bg-white/20 transition border border-white/20">
                <div class="text-3xl mb-3">🚀</div>
                <h2 class="text-2xl font-bold mb-2">Real-Time Voice</h2>
                <p class="text-gray-300">ChatGPT-like voice experience</p>
                <div class="mt-4 text-sm text-gray-400">
                    • Push-to-talk<br>
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
    
    // Handle voice call mode
    let callAgent = null;
    let callActive = false;
    let audioChunks = [];
    let lastAudioTime = Date.now();
    let processingTimer = null;
    
    // Function to process accumulated audio
    const processAccumulatedAudio = async () => {
      if (audioChunks.length === 0 || !callAgent) {
        console.log('No audio to process or no agent');
        return;
      }
      
      console.log(`Processing ${audioChunks.length} audio chunks`);
      
      // Combine all audio chunks
      const totalSize = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
      console.log(`Total audio size: ${totalSize} bytes`);
      
      const combinedBuffer = new ArrayBuffer(totalSize);
      const uint8Array = new Uint8Array(combinedBuffer);
      let offset = 0;
      
      for (const chunk of audioChunks) {
        uint8Array.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      // Clear the buffer
      audioChunks = [];
      
      // Process the combined audio
      try {
        console.log('Sending to agent for processing...');
        await callAgent.processAudioFile(combinedBuffer);
      } catch (error) {
        console.error('Error processing audio:', error);
        socket.emit('call-error', { message: 'Audio processing failed' });
      }
    };
    
    socket.on('start-call', (settings) => {
      console.log('Starting voice call for', socket.id);
      callActive = true;
      audioChunks = [];
      lastAudioTime = Date.now();
      
      // Create or update agent for continuous conversation
      if (!callAgent) {
        const config = {
          llmProvider: settings.llmProvider || 'openai',
          llmModel: settings.llmModel || 'gpt-4o-mini',
          ttsVoice: settings.voice || 'nova',
          ttsSpeed: 1.0,
          streamResponse: true,
          temperature: 0.7,
          systemPrompt: getCallSystemPrompt(settings.language)
        };
        
        callAgent = new RealtimeStreamingAgent(config);
        
        // Setup event listeners for call
        callAgent.on('transcript', (data) => {
          socket.emit('call-response', { 
            type: 'transcript',
            text: typeof data === 'string' ? data : data.text
          });
        });
        
        callAgent.on('response', (data) => {
          socket.emit('call-response', { 
            type: 'response',
            text: typeof data === 'string' ? data : data.text
          });
        });
        
        callAgent.on('audio', (audioData) => {
          const base64 = Buffer.from(audioData).toString('base64');
          socket.emit('call-response', { 
            type: 'audio',
            audio: 'data:audio/mpeg;base64,' + base64
          });
        });
        
        callAgent.on('error', (error) => {
          socket.emit('call-error', { 
            message: error.message || 'Call error'
          });
        });
      }
    });
    
    socket.on('call-audio', async (data) => {
      if (!callActive || !callAgent) {
        console.log('Call not active or no agent, ignoring audio');
        return;
      }
      
      try {
        // Process continuous audio stream
        const { audio, settings } = data;
        
        // Convert base64 to buffer
        let audioBuffer;
        if (typeof audio === 'string' && audio.startsWith('data:')) {
          const base64Data = audio.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          audioBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } else {
          audioBuffer = audio;
        }
        
        console.log(`Received audio chunk: ${audioBuffer.byteLength} bytes`);
        
        // Add to buffer
        audioChunks.push(audioBuffer);
        lastAudioTime = Date.now();
        
        // Clear any existing timer
        if (processingTimer) {
          clearTimeout(processingTimer);
        }
        
        // Set timer to process after 500ms of silence
        processingTimer = setTimeout(() => {
          console.log('Silence detected, processing audio...');
          processAccumulatedAudio();
        }, 500);
        
      } catch (error) {
        console.error('Call audio error:', error);
        socket.emit('call-error', { message: error.message });
      }
    });
    
    socket.on('interrupt-ai', () => {
      if (callAgent) {
        // Clear pending audio
        audioChunks = [];
        if (processingTimer) {
          clearTimeout(processingTimer);
        }
        
        // Stop current AI response
        callAgent.interrupt();
        socket.emit('call-response', { 
          type: 'interrupted',
          text: 'AI interrupted'
        });
      }
    });
    
    socket.on('end-call', () => {
      callActive = false;
      audioChunks = [];
      if (processingTimer) {
        clearTimeout(processingTimer);
      }
      
      if (callAgent) {
        callAgent.clearHistory();
        socket.emit('call-response', { 
          type: 'ended',
          text: 'Call ended'
        });
      }
    });
    
    socket.on('update-settings', (settings) => {
      if (callAgent) {
        callAgent.updateConfig({
          ttsSpeed: settings.speed || 1.0,
          temperature: settings.temperature || 0.7,
          systemPrompt: getCallSystemPrompt(settings.language)
        });
      }
    });
    
    socket.on('interrupt-ai', () => {
      console.log('AI interrupted by user', socket.id);
      // Stop current TTS generation if in progress
      // This would need implementation in the agent
    });
    
    socket.on('end-call', () => {
      console.log('Ending call for', socket.id);
      callActive = false;
      
      if (callAgent) {
        callAgent.clearHistory();
        callAgent.removeAllListeners();
        callAgent = null;
      }
    });
    
    socket.on('update-settings', (settings) => {
      if (callAgent) {
        callAgent.updateConfig({
          llmProvider: settings.llmProvider,
          llmModel: settings.llmModel,
          ttsVoice: settings.voice,
          systemPrompt: getCallSystemPrompt(settings.language)
        });
      }
    });
    
    // Helper function for call prompts
    function getCallSystemPrompt(language) {
      if (language === 'ar') {
        return 'أنت مساعد صوتي في مكالمة هاتفية. تحدث بشكل طبيعي ومختصر. استخدم عبارات قصيرة. رد بالعربية.';
      } else if (language === 'multi') {
        return 'You are a voice assistant in a phone call. Speak naturally and concisely. Use short phrases. Respond in the language spoken to you.';
      } else {
        return 'You are a friendly voice assistant in a phone call. Speak naturally like in a real conversation. Keep responses brief and conversational. Allow for back-and-forth dialogue.';
      }
    }
    
    // NEW: Voice Assistant handlers (simplified approach like ChatGPT)
    let assistantAgent = null;
    let assistantActive = false;

    socket.on('voice-assistant-start', () => {
      console.log('Voice assistant started for', socket.id);
      assistantActive = true;

      // Create agent if not exists
      if (!assistantAgent) {
        assistantAgent = new RealtimeStreamingAgent({
          llmProvider: 'openai',
          llmModel: 'gpt-4o-mini',
          ttsVoice: 'nova',
          ttsSpeed: 1.0,
          streamResponse: false, // Don't stream for simplicity
          systemPrompt: 'You are a helpful voice assistant like ChatGPT. Keep responses concise and conversational. Be friendly and natural.'
        });

        // Setup event listeners
        assistantAgent.on('transcript', (data) => {
          socket.emit('voice-assistant-response', {
            type: 'transcript',
            text: data.text || data
          });
        });

        assistantAgent.on('response', (data) => {
          socket.emit('voice-assistant-response', {
            type: 'response',
            text: data.text || data
          });
        });

        assistantAgent.on('audio', (audioData) => {
          const base64 = Buffer.from(audioData).toString('base64');
          socket.emit('voice-assistant-response', {
            type: 'audio',
            audio: 'data:audio/mpeg;base64,' + base64
          });
        });

        assistantAgent.on('error', (error) => {
          console.error('Assistant error:', error);
          socket.emit('voice-assistant-error', {
            message: error.message || 'Processing error'
          });
        });
      }
    });

    socket.on('voice-assistant-audio', async (data) => {
      if (!assistantActive || !assistantAgent) {
        console.log('Assistant not active');
        return;
      }

      try {
        console.log('Processing voice assistant audio...');
        
        // Notify client we're processing
        socket.emit('voice-assistant-response', { type: 'thinking' });

        // Convert base64 to buffer
        const base64Data = data.audio.split(',')[1];
        const audioBuffer = Buffer.from(base64Data, 'base64');
        const arrayBuffer = audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        );

        console.log('Audio buffer size:', arrayBuffer.byteLength);

        // Process the audio
        await assistantAgent.processAudioFile(arrayBuffer);
        
        // Notify client we're ready for more
        socket.emit('voice-assistant-response', { type: 'ready' });

      } catch (error) {
        console.error('Voice assistant error:', error);
        socket.emit('voice-assistant-error', {
          message: 'Failed to process audio'
        });
      }
    });

    socket.on('voice-assistant-stop', () => {
      console.log('Voice assistant stopped for', socket.id);
      assistantActive = false;
      
      if (assistantAgent) {
        assistantAgent.interrupt();
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log('Voice client disconnected:', socket.id);
      activeAgents.delete(socket.id);
      
      // Clean up call agent
      if (callAgent) {
        callAgent.clearHistory();
        callAgent.removeAllListeners();
        callAgent = null;
      }

      // Clean up assistant agent
      if (assistantAgent) {
        assistantAgent.clearHistory();
        assistantAgent.removeAllListeners();
        assistantAgent = null;
      }
      
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