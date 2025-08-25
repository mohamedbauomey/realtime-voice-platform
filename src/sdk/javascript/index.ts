import { io, Socket } from 'socket.io-client';

// Browser API type definitions for Node.js environment
declare global {
  var MediaStream: any;
  var RTCPeerConnection: any;
  var AudioContext: any;
  var AudioWorkletNode: any;
  var navigator: any;
  var Audio: any;
  var RTCStatsReport: any;
  var window: any;
}

export class VoiceClient {
  private socket: Socket | null = null;
  private localStream: any | null = null;
  private peerConnection: any | null = null;
  private audioContext: any;
  private audioWorklet: any | null = null;
  private metricsInterval: any = null;
  private currentMetrics = {
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    bitrate: 0
  };

  constructor(private serverUrl: string = 'http://localhost:8080') {
    // Only create AudioContext in browser environment
    if (typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
    }
  }

  async connect(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        auth: { token }
      });

      this.socket.on('connect', () => {
        console.log('Connected to voice server');
        this.startMetricsCollection();
        resolve(true);
      });

      this.socket.on('error', (error: any) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.setupEventHandlers();
    });
  }

  async joinRoom(roomId: string, userName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to server'));
        return;
      }

      this.socket.emit('join-room', {
        roomId,
        name: userName
      });

      this.socket.once('joined-room', (data: any) => {
        console.log('Joined room:', data);
        resolve(data);
      });

      this.socket.once('error', (error: any) => {
        reject(error);
      });
    });
  }

  async enableMicrophone(): Promise<void> {
    try {
      if (typeof navigator === 'undefined') {
        throw new Error('This method requires a browser environment');
      }
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      // Setup WebRTC
      if (typeof RTCPeerConnection === 'undefined') {
        throw new Error('RTCPeerConnection not available');
      }
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:localhost:3478',
            username: 'user',
            credential: 'pass'
          }
        ]
      });

      // Add audio track
      const audioTrack = this.localStream.getAudioTracks()[0];
      this.peerConnection.addTrack(audioTrack, this.localStream);

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event: any) => {
        if (event.candidate && this.socket) {
          this.socket.emit('ice-candidate', event.candidate);
        }
      };

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to server
      if (this.socket) {
        this.socket.emit('publish-audio', {
          sdp: offer.sdp,
          codec: {
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2
          }
        });
      }

      console.log('Microphone enabled');
    } catch (error) {
      console.error('Failed to enable microphone:', error);
      throw error;
    }
  }

  muteMicrophone() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = false;
      });
    }
  }

  unmuteMicrophone() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = true;
      });
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('participant-joined', (data: any) => {
      console.log('Participant joined:', data);
      this.emit('participant-joined', data);
    });

    this.socket.on('participant-left', (data: any) => {
      console.log('Participant left:', data);
      this.emit('participant-left', data);
    });

    this.socket.on('audio-published', async (data: any) => {
      // Subscribe to new audio stream
      await this.subscribeToAudio(data.producerId);
    });

    this.socket.on('publish-success', (data: any) => {
      console.log('Audio published successfully:', data);
      this.emit('publish-success', data);
    });
  }

  private async subscribeToAudio(producerId: string) {
    if (!this.socket) return;

    this.socket.emit('subscribe-audio', { producerId });

    this.socket.once('subscribe-success', async (data: any) => {
      // Setup consumer peer connection
      if (typeof RTCPeerConnection === 'undefined') {
        return;
      }
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      pc.ontrack = (event: any) => {
        console.log('Received remote audio track');
        if (typeof Audio !== 'undefined' && typeof MediaStream !== 'undefined') {
          const audio = new Audio();
          audio.srcObject = new MediaStream([event.track]);
          audio.play();
        }
        this.emit('remote-audio', { producerId, track: event.track });
      };

      await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket?.emit('subscribe-answer', {
        consumerId: data.consumerId,
        sdp: answer.sdp
      });
    });
  }

  disconnect() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  getAudioLevel(): number {
    if (!this.localStream) return 0;
    
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return 0;

    // Create analyzer
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average level
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;
    
    return (average / 255) * 100; // Convert to percentage
  }

  private async startMetricsCollection() {
    this.metricsInterval = setInterval(async () => {
      if (this.peerConnection) {
        const stats = await this.peerConnection.getStats();
        this.updateMetrics(stats);
      }
    }, 1000);
  }

  private updateMetrics(stats: any) {
    stats.forEach((report: any) => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        this.currentMetrics.jitter = (report as any).jitter * 1000; // Convert to ms
        this.currentMetrics.packetLoss = (report as any).packetsLost || 0;
      }
      if (report.type === 'candidate-pair' && (report as any).state === 'succeeded') {
        this.currentMetrics.latency = (report as any).currentRoundTripTime * 1000; // Convert to ms
      }
    });
  }

  async getMetrics() {
    return { ...this.currentMetrics };
  }

  // Event emitter functionality
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

// Export for browser usage
if (typeof window !== 'undefined' && window) {
  (window as any).VoiceClient = VoiceClient;
}