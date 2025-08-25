# Real-Time Voice Platform

A production-ready voice communication platform with ultra-low latency, AI voice agents, and comprehensive SDKs.

## Features

- **Ultra-Low Latency**: <50ms end-to-end latency
- **AI Voice Agents**: Integrated conversational AI with <500ms response time
- **High Quality**: MOS score >4.0 with Opus codec at 48kHz
- **Scalable**: Support for 100+ concurrent participants per room
- **Recording**: Full conversation recording and playback
- **Real-time Transcription**: Live speech-to-text
- **Multiple SDKs**: JavaScript, Python, React components
- **Admin Dashboard**: Monitor rooms, participants, and metrics
- **Developer Portal**: API keys, usage tracking, documentation

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd realtime-voice-platform
```

2. Run setup script
```bash
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

3. Start the platform
```bash
npm run dev
```

4. Access the dashboard
```
http://localhost:8080
```

### Manual Setup

1. Install dependencies
```bash
npm install
```

2. Start infrastructure services
```bash
docker-compose -f infrastructure/docker/docker-compose.local.yml up -d
```

3. Setup database
```bash
npx prisma migrate dev
npx prisma db seed
```

4. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

5. Build and start
```bash
npm run build
npm run start
```

## Usage

### JavaScript SDK

```javascript
import { VoiceClient } from '@platform/sdk-javascript';

const client = new VoiceClient('http://localhost:8080');

// Connect
await client.connect('your-api-key');

// Join room
await client.joinRoom('room-123', 'John Doe');

// Enable microphone
await client.enableMicrophone();

// Get metrics
const metrics = await client.getMetrics();
console.log('MOS Score:', metrics.mos);
```

### Creating an AI Agent

```javascript
import { VoiceAgent } from '@platform/agents';

const agent = new VoiceAgent({
  name: 'Support Agent',
  systemPrompt: 'You are a helpful customer support agent.',
  voice: 'nova',
  sttProvider: 'openai',
  ttsProvider: 'openai'
});

await agent.joinRoom('support-room');
```

## API Endpoints

### Rooms
- `POST /api/v1/rooms` - Create room
- `GET /api/v1/rooms` - List rooms
- `GET /api/v1/rooms/:id` - Get room details
- `DELETE /api/v1/rooms/:id` - Delete room

### Users
- `POST /api/v1/users/register` - Register user
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users/usage` - Get usage statistics

### Recordings
- `GET /api/v1/recordings` - List recordings
- `GET /api/v1/recordings/:id` - Get recording
- `POST /api/v1/recordings/start` - Start recording
- `POST /api/v1/recordings/stop` - Stop recording

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ Voice Server│────▶│   MediaSoup │
│   Client    │     │  (Socket.io)│     │     SFU     │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
              ┌─────▼─────┐   ┌─────▼─────┐
              │   Redis   │   │ PostgreSQL │
              │  PubSub   │   │  Database  │
              └───────────┘   └────────────┘
```

## Testing

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:load       # Load testing
```

### Test coverage
```bash
npm run test:coverage
```

## Performance Metrics

- **Latency**: <50ms (same region)
- **Packet Loss Tolerance**: Up to 20%
- **Audio Quality**: MOS >4.0
- **Concurrent Users**: 100+ per room
- **AI Response Time**: <500ms

## Development

### Project Structure
```
src/
├── core/           # Core audio engine
├── services/       # Voice server, room manager
├── agents/         # AI agent framework
├── api/           # REST API
├── web/           # Dashboard
├── sdk/           # Client SDKs
└── shared/        # Shared utilities
```

### Environment Variables
```env
# Server
PORT=8080
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# AI Services
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...

# Security
JWT_SECRET=...
```

## Troubleshooting

### Common Issues

1. **Cannot connect to server**
   - Check if services are running: `docker ps`
   - Check logs: `docker logs voice-server`

2. **Audio not working**
   - Ensure microphone permissions are granted
   - Check browser console for errors
   - Verify TURN server is running

3. **High latency**
   - Check network connection
   - Verify services are running locally
   - Monitor CPU usage

4. **Database connection failed**
   - Ensure PostgreSQL is running: `docker ps`
   - Check connection string in .env
   - Run migrations: `npx prisma migrate dev`

## Monitoring

### Local Metrics Dashboard
```bash
# Start metrics collection
npm run metrics:start

# View dashboard
open http://localhost:9090
```

### Key Metrics to Monitor
- Active rooms and participants
- Average MOS score
- End-to-end latency
- Packet loss rate
- CPU and memory usage

## License

MIT

## Support

For issues and questions, please check the documentation or create an issue in the repository.# realtime-voice-platform
