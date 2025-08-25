import * as mediasoup from 'mediasoup';
import type { Worker, Router, Transport, Producer, Consumer } from './types.js';

export class MediaService {
  private workers: Worker[] = [];
  private routers: Map<string, Router> = new Map();
  private transports: Map<string, Transport> = new Map();
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private currentWorkerIdx = 0;

  constructor() {
    this.initializeWorkers();
  }

  private async initializeWorkers() {
    const numWorkers = 4; // Use 4 CPU cores
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
      });

      worker.on('died', () => {
        console.error('MediaSoup worker died!');
        process.exit(1);
      });

      this.workers.push(worker);
    }
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.currentWorkerIdx];
    this.currentWorkerIdx = (this.currentWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  async createRouter(roomId: string): Promise<Router> {
    const worker = this.getNextWorker();
    
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
          parameters: {
            'minptime': 10,
            'useinbandfec': 1,
            'usedtx': 1
          }
        }
      ]
    });

    this.routers.set(roomId, router);
    return router;
  }

  async createTransport(participantId: string): Promise<any> {
    const roomId = this.getRoomIdForParticipant(participantId);
    let router = this.routers.get(roomId);
    
    if (!router) {
      router = await this.createRouter(roomId);
    }

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000
    });

    this.transports.set(participantId, transport);

    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      }
    };
  }

  async createProducer(participantId: string, sdp: string, codec: any): Promise<any> {
    const transport = this.transports.get(participantId);
    if (!transport) throw new Error('Transport not found');

    const producer = await (transport as any).produce({
      kind: 'audio',
      rtpParameters: codec
    });

    this.producers.set(participantId, producer);
    
    return { id: producer.id };
  }

  async createConsumer(participantId: string, producerId: string): Promise<any> {
    const transport = this.transports.get(participantId);
    if (!transport) throw new Error('Transport not found');

    const producer = Array.from(this.producers.values())
      .find(p => p.id === producerId);
    if (!producer) throw new Error('Producer not found');

    const consumer = await (transport as any).consume({
      producerId: producer.id,
      rtpCapabilities: (transport as any).rtpCapabilities,
      paused: false
    });

    this.consumers.set(`${participantId}-${producerId}`, consumer);

    return {
      id: consumer.id,
      sdp: consumer.rtpParameters
    };
  }

  async cleanup(participantId: string) {
    // Clean up transport
    const transport = this.transports.get(participantId);
    if (transport) {
      transport.close();
      this.transports.delete(participantId);
    }

    // Clean up producer
    const producer = this.producers.get(participantId);
    if (producer) {
      producer.close();
      this.producers.delete(participantId);
    }

    // Clean up consumers
    for (const [key, consumer] of this.consumers.entries()) {
      if (key.startsWith(participantId)) {
        consumer.close();
        this.consumers.delete(key);
      }
    }
  }

  private getRoomIdForParticipant(participantId: string): string {
    // In production, get this from database
    return 'default-room';
  }
}