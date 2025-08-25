import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { 
  createCustomerServiceAgent,
  createSalesAgent,
  createTechnicalSupportAgent,
  createCreativeAgent,
  createDataAnalystAgent
} from '../../agents/framework/enhanced-agent.js';

dotenv.config();

const prisma = new PrismaClient();

export async function startServer() {
  const app = Fastify();
  
  // Register plugins
  await app.register(cors, { origin: true });

  // Health check
  app.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString()
  }));

  // API Routes
  app.get('/api/v1/rooms', async () => {
    const rooms = await prisma.room.findMany({
      include: { participants: true }
    });
    return { rooms };
  });

  app.post('/api/v1/rooms', async (request: any) => {
    const { name, maxParticipants = 10 } = request.body || {};
    const room = await prisma.room.create({
      data: { 
        name: name || 'Default Room',
        maxParticipants,
        userId: 'demo-user'
      }
    });
    return { room };
  });

  app.post('/api/v1/users/register', async (request: any) => {
    const { email, name } = request.body || {};
    const user = await prisma.user.create({
      data: { 
        email: email || `user${Date.now()}@example.com`,
        name: name || 'User'
      }
    });
    return { user, apiKey: user.apiKey };
  });

  // Serve AI demo page
  app.get('/ai-demo', async (request, reply) => {
    reply.type('text/html');
    const fs = await import('fs/promises');
    const html = await fs.readFile('src/web/ai-demo.html', 'utf-8');
    return html;
  });

  // Serve dashboard
  app.get('/', async (request, reply) => {
    reply.type('text/html');
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Platform Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.socket.io/4.6.0/socket.io.min.js"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Voice Platform Dashboard</h1>
        
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4">Platform Status</h2>
            <div class="text-green-600 font-semibold">✅ Server is running</div>
            <div class="mt-4 space-y-2">
                <div>API: <code class="bg-gray-100 px-2 py-1 rounded">http://localhost:8080/api/v1</code></div>
                <div>Health: <code class="bg-gray-100 px-2 py-1 rounded">http://localhost:8080/health</code></div>
            </div>
        </div>

        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4">Quick Actions</h2>
            <div class="space-y-4">
                <button onclick="testConnection()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                    Test WebSocket Connection
                </button>
                <button onclick="createRoom()" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                    Create Test Room
                </button>
            </div>
            <div id="result" class="mt-4"></div>
        </div>

        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">Test Credentials</h2>
            <div class="space-y-2 font-mono text-sm">
                <div>Demo User: demo@example.com</div>
                <div>API Key: Check console after seeding</div>
            </div>
        </div>
    </div>

    <script>
        async function testConnection() {
            const socket = io('http://localhost:8080');
            socket.on('connect', () => {
                document.getElementById('result').innerHTML = 
                    '<div class="text-green-600">✅ WebSocket connected successfully</div>';
                socket.disconnect();
            });
            socket.on('connect_error', () => {
                document.getElementById('result').innerHTML = 
                    '<div class="text-red-600">❌ WebSocket connection failed</div>';
            });
        }

        async function createRoom() {
            try {
                const response = await fetch('/api/v1/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test Room ' + Date.now() })
                });
                const data = await response.json();
                document.getElementById('result').innerHTML = 
                    '<div class="text-green-600">✅ Room created: ' + data.room.id + '</div>';
            } catch (error) {
                document.getElementById('result').innerHTML = 
                    '<div class="text-red-600">❌ Failed to create room</div>';
            }
        }
    </script>
</body>
</html>`;
  });

  // Start server
  const port = parseInt(process.env.PORT || '8080');
  await app.listen({ port, host: '0.0.0.0' });
  
  // Setup Socket.IO
  const io = new Server(app.server as any, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-room', async (data) => {
      const { roomId, name } = data;
      socket.join(roomId);
      socket.emit('joined-room', { participantId: socket.id, roomId });
      socket.to(roomId).emit('participant-joined', { name });
      console.log(`${name} joined room ${roomId}`);
    });

    // Handle AI agent queries
    socket.on('agent-query', async (data) => {
      const { agent, message, llmChoice } = data;
      console.log(`AI Query: ${agent} (${llmChoice}): ${message}`);
      
      try {
        let aiAgent;
        const startTime = Date.now();
        
        // Select agent based on request
        switch(agent) {
          case 'customer-openai':
            aiAgent = createCustomerServiceAgent('openai');
            break;
          case 'sales-groq':
            aiAgent = createSalesAgent('groq');
            break;
          case 'tech-groq':
            aiAgent = createTechnicalSupportAgent('groq');
            break;
          case 'creative-openai':
            aiAgent = createCreativeAgent('openai');
            break;
          case 'data-groq':
            aiAgent = createDataAnalystAgent('groq');
            break;
          case 'general':
            aiAgent = llmChoice === 'openai' 
              ? createCustomerServiceAgent('openai')
              : createTechnicalSupportAgent('groq');
            break;
          default:
            aiAgent = createCustomerServiceAgent('openai');
        }
        
        // Get response from AI
        const response = await aiAgent.askQuestion(message);
        const responseTime = Date.now() - startTime;
        const stats = aiAgent.getStats();
        
        // Send response back
        socket.emit('agent-response', {
          text: response,
          agentName: stats.name,
          provider: stats.provider,
          model: stats.model,
          responseTime
        });
        
        // Clean up
        aiAgent.disconnect();
        
        console.log(`AI Response (${responseTime}ms): ${response.substring(0, 100)}...`);
      } catch (error) {
        console.error('AI Agent error:', error);
        socket.emit('agent-response', {
          text: 'Sorry, I encountered an error. Please check the API keys are configured correctly.',
          agentName: 'System',
          provider: 'Error',
          model: 'Error'
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  console.log(`🚀 Voice server running on http://localhost:${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log(`🔌 WebSocket ready on ws://localhost:${port}`);
  
  return app;
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(console.error);
}