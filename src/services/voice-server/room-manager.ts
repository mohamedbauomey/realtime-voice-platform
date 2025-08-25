import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

export class RoomManager {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  async getRoom(roomId: string) {
    // Check cache first
    const cached = await this.redis.get(`room:${roomId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { participants: true }
    });

    if (room) {
      // Cache for 5 minutes
      await this.redis.setex(`room:${roomId}`, 300, JSON.stringify(room));
    }

    return room;
  }

  async createRoom(userId: string, name: string, maxParticipants: number = 10) {
    const room = await this.prisma.room.create({
      data: {
        name,
        userId,
        maxParticipants
      }
    });

    // Publish room created event
    await this.redis.publish('room:created', JSON.stringify(room));

    return room;
  }

  async updateRoomMetrics(roomId: string, metrics: any) {
    await this.prisma.roomMetrics.create({
      data: {
        roomId,
        ...metrics
      }
    });

    // Update cache
    await this.redis.setex(`metrics:${roomId}`, 60, JSON.stringify(metrics));
  }

  async getRoomMetrics(roomId: string) {
    const cached = await this.redis.get(`metrics:${roomId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = await this.prisma.roomMetrics.findMany({
      where: { roomId },
      orderBy: { timestamp: 'desc' },
      take: 1
    });

    return metrics[0] || null;
  }

  async closeRoom(roomId: string) {
    await this.prisma.room.update({
      where: { id: roomId },
      data: { endedAt: new Date() }
    });

    // Clear cache
    await this.redis.del(`room:${roomId}`);
    await this.redis.del(`metrics:${roomId}`);

    // Publish room closed event
    await this.redis.publish('room:closed', roomId);
  }
}