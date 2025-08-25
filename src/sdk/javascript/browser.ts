// Browser-specific SDK implementation
export {}; // Make this a module

declare global {
  interface Window {
    VoiceClient: any;
  }
}

// This file is for browser-specific code
// The main SDK will be in index.ts for Node.js environments