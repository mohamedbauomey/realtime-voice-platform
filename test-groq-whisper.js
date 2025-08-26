import Groq from 'groq-sdk';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function testGroqWhisper() {
  console.log('Testing Groq Whisper API\n');
  console.log('=' .repeat(50));
  
  try {
    // Create a simple test audio file
    const sampleRate = 16000;
    const duration = 2;
    const numSamples = sampleRate * duration;
    
    // Generate WAV header
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + numSamples * 2, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(sampleRate * 2, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(numSamples * 2, 40);
    
    // Generate test audio
    const audioData = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 1000;
      audioData.writeInt16LE(value, i * 2);
    }
    
    const wavFile = Buffer.concat([wavHeader, audioData]);
    
    console.log('Testing Groq Whisper Large v3');
    
    // Try Groq audio transcription
    const blob = new Blob([wavFile], { type: 'audio/wav' });
    const file = new File([blob], 'test.wav', { type: 'audio/wav' });
    
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3',
      language: 'en',
      temperature: 0.2
    });
    
    console.log('✅ Groq Whisper works!');
    console.log('Transcript:', transcription.text);
    
  } catch (error) {
    console.log('❌ Groq Whisper error:', error.message);
    console.log('\nNote: Groq may not provide Whisper API access');
    console.log('Alternative: Use OpenAI Whisper-1 model');
  }
  
  console.log('\n' + '=' .repeat(50));
}

testGroqWhisper().catch(console.error);