// Type definitions for MediaSoup
export interface Worker {
  close(): void;
  on(event: string, listener: Function): void;
}

export interface Router {
  close(): void;
}

export interface Transport {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  close(): void;
}

export interface Producer {
  id: string;
  close(): void;
}

export interface Consumer {
  id: string;
  rtpParameters: any;
  close(): void;
}