import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testAudioFormat() {
  console.log('Testing Audio Format Compatibility\n');
  console.log('=' .repeat(50));
  
  // Create a simple test audio file (silence)
  const sampleRate = 16000;
  const duration = 2; // 2 seconds
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
  
  // Generate silence (with a tiny bit of noise to ensure detection)
  const audioData = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    // Add small sine wave at 440Hz (A note)
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 1000;
    audioData.writeInt16LE(value, i * 2);
  }
  
  const wavFile = Buffer.concat([wavHeader, audioData]);
  
  // Test with WAV
  console.log('\n1️⃣ Testing WAV format');
  try {
    const wavBlob = new Blob([wavFile], { type: 'audio/wav' });
    const wavFileObj = new File([wavBlob], 'test.wav', { type: 'audio/wav' });
    
    const result = await openai.audio.transcriptions.create({
      file: wavFileObj,
      model: 'whisper-1',
      language: 'en'
    });
    
    console.log('   ✅ WAV format works');
    console.log('   Transcript:', result.text || '(silence detected)');
  } catch (error) {
    console.log('   ❌ WAV format failed:', error.message);
  }
  
  // Test with WebM (what browser sends)
  console.log('\n2️⃣ Testing WebM format (browser default)');
  console.log('   Note: WebM requires actual audio file');
  
  // For WebM, we need to test with actual recorded audio
  // since we can't easily generate WebM format
  console.log('   ⚠️  Please test in browser with actual recording');
  
  console.log('\n3️⃣ Recommended approach:');
  console.log('   - Browser records in WebM with Opus codec');
  console.log('   - Send as Blob with type audio/webm');
  console.log('   - OpenAI Whisper accepts WebM directly');
  
  console.log('\n' + '=' .repeat(50));
  console.log('Test Complete');
}

testAudioFormat().catch(console.error);