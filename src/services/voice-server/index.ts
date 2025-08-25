import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { RoomManager } from './room-manager.js';
import { MediaService } from './media-service.js';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const prisma = new PrismaClient();
const redis = new (Redis as any)(process.env.REDIS_URL!);

export class VoiceServer {
  private app = Fastify({ logger: logger as any });
  private httpServer: any;
  private io!: Server;
  private roomManager: RoomManager;
  private mediaService: MediaService;

  constructor() {
    this.setupFastify();
    this.roomManager = new RoomManager(prisma, redis);
    this.mediaService = new MediaService();
  }

  private async setupFastify() {
    // Register plugins
    await this.app.register(cors, { origin: true });
    await this.app.register(jwt, { secret: process.env.JWT_SECRET! });
    await this.app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });

    // Health check
    this.app.get('/health', async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString()
    }));

    // API Routes
    this.app.register(this.setupRoutes, { prefix: '/api/v1' });
    
    // Setup HTTP server and Socket.IO
    // Wait for server to be created before setting up HTTP server
    this.setupSocketIO();
  }

  private setupSocketIO() {
    // Create HTTP server from Fastify instance
    this.httpServer = this.app.server;
    
    this.io = new Server(this.httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      logger.info({ socketId: socket.id }, 'Client connected');
      
      socket.on('join-room', async (data) => {
        await this.handleJoinRoom(socket, data);
      });

      socket.on('leave-room', async (data) => {
        await this.handleLeaveRoom(socket, data);
      });

      socket.on('publish-audio', async (data) => {
        await this.handlePublishAudio(socket, data);
      });

      socket.on('subscribe-audio', async (data) => {
        await this.handleSubscribeAudio(socket, data);
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Client disconnected');
        this.handleDisconnect(socket);
      });
    });
  }

  private async setupRoutes(app: any) {
    // Room management
    app.post('/rooms', async (request: any, reply: any) => {
      const { name, maxParticipants } = request.body;
      const userId = request.user?.id || 'demo-user';
      
      const room = await prisma.room.create({
        data: { name, maxParticipants, userId }
      });
      
      return { room };
    });

    app.get('/rooms', async (request: any, reply: any) => {
      const userId = request.user?.id || 'demo-user';
      const rooms = await prisma.room.findMany({
        where: { userId },
        include: { participants: true }
      });
      
      return { rooms };
    });

    app.get('/rooms/:id', async (request: any, reply: any) => {
      const { id } = request.params;
      const room = await prisma.room.findUnique({
        where: { id },
        include: {
          participants: true,
          metrics: {
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        }
      });
      
      return { room };
    });

    // User management
    app.post('/users/register', async (request: any, reply: any) => {
      const { email, name } = request.body;
      
      const user = await prisma.user.create({
        data: { email, name }
      });
      
      const token = app.jwt.sign({ id: user.id, email: user.email });
      
      return { user, token, apiKey: user.apiKey };
    });

    // Metrics
    app.get('/metrics/rooms/:id', async (request: any, reply: any) => {
      const { id } = request.params;
      const metrics = await prisma.roomMetrics.findMany({
        where: { roomId: id },
        orderBy: { timestamp: 'desc' },
        take: 100
      });
      
      return { metrics };
    });

    // Recordings
    app.get('/recordings', async (request: any, reply: any) => {
      const userId = request.user?.id || 'demo-user';
      const recordings = await prisma.recording.findMany({
        where: { userId },
        include: { room: true }
      });
      
      return { recordings };
    });
  }

  private async handleJoinRoom(socket: any, data: any) {
    const { roomId, userId, name } = data;
    
    try {
      // Check room capacity
      const room = await this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Create participant
      const participant = await prisma.participant.create({
        data: { roomId, userId, name }
      });

      // Join socket room
      socket.join(roomId);
      socket.data.participantId = participant.id;
      socket.data.roomId = roomId;

      // Setup media transport
      const transport = await this.mediaService.createTransport(participant.id);

      // Notify others
      socket.to(roomId).emit('participant-joined', {
        participantId: participant.id,
        name
      });

      socket.emit('joined-room', {
        participantId: participant.id,
        transport: transport.params
      });

      logger.info({ roomId, participantId: participant.id }, 'Participant joined room');
    } catch (error) {
      logger.error(error, 'Failed to join room');
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleLeaveRoom(socket: any, data: any) {
    const { participantId } = socket.data;
    
    if (participantId) {
      await prisma.participant.update({
        where: { id: participantId },
        data: { leftAt: new Date() }
      });

      socket.to(socket.data.roomId).emit('participant-left', {
        participantId
      });

      socket.leave(socket.data.roomId);
    }
  }

  private async handlePublishAudio(socket: any, data: any) {
    const { participantId, roomId } = socket.data;
    const { sdp, codec } = data;

    try {
      const producer = await this.mediaService.createProducer(
        participantId,
        sdp,
        codec
      );

      socket.to(roomId).emit('audio-published', {
        participantId,
        producerId: producer.id
      });

      socket.emit('publish-success', { producerId: producer.id });
    } catch (error) {
      logger.error(error, 'Failed to publish audio');
      socket.emit('error', { message: 'Failed to publish audio' });
    }
  }

  private async handleSubscribeAudio(socket: any, data: any) {
    const { producerId } = data;
    const { participantId } = socket.data;

    try {
      const consumer = await this.mediaService.createConsumer(
        participantId,
        producerId
      );

      socket.emit('subscribe-success', {
        consumerId: consumer.id,
        sdp: consumer.sdp
      });
    } catch (error) {
      logger.error(error, 'Failed to subscribe to audio');
      socket.emit('error', { message: 'Failed to subscribe' });
    }
  }

  private async handleDisconnect(socket: any) {
    const { participantId, roomId } = socket.data;
    
    if (participantId) {
      await prisma.participant.update({
        where: { id: participantId },
        data: { leftAt: new Date() }
      });

      socket.to(roomId).emit('participant-left', { participantId });
      
      await this.mediaService.cleanup(participantId);
    }
  }

  async start() {
    const port = parseInt(process.env.PORT || '8080');
    await this.app.listen({ port, host: '0.0.0.0' });
    logger.info(`Voice server running on port ${port}`);
  }

  async stop() {
    await this.app.close();
    await prisma.$disconnect();
    await redis.disconnect();
  }
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VoiceServer();
  server.start().catch(console.error);
  
  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}