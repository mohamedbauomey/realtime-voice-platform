import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testArabicTTS() {
  console.log('Testing Arabic TTS\n');
  console.log('=' .repeat(50));
  
  const testPhrases = [
    { text: 'Hello, how are you?', lang: 'English' },
    { text: 'مرحبا، كيف حالك؟', lang: 'Arabic' },
    { text: 'أنا بخير، شكرا لك', lang: 'Arabic' },
    { text: 'إزيك؟ عامل إيه؟', lang: 'Egyptian' },
    { text: 'تمام الحمد لله', lang: 'Egyptian' },
    { text: '\u202Bالسلام عليكم ورحمة الله\u202C', lang: 'Arabic with RTL' }
  ];
  
  for (const phrase of testPhrases) {
    console.log(`\nTesting ${phrase.lang}: "${phrase.text}"`);
    
    try {
      // Test with different voices
      const voices = ['alloy', 'nova'];
      
      for (const voice of voices) {
        const response = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: voice,
          input: phrase.text,
          speed: 0.9,
          response_format: 'mp3'
        });
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const filename = `test-${phrase.lang.toLowerCase().replace(' ', '-')}-${voice}.mp3`;
        await fs.writeFile(filename, buffer);
        
        console.log(`  ✅ ${voice}: Generated ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('Arabic TTS Test Complete');
  console.log('\nNote: Check the generated MP3 files to verify:');
  console.log('1. Arabic text is pronounced correctly (not reversed)');
  console.log('2. Egyptian dialect sounds natural');
  console.log('3. RTL marks don\'t affect pronunciation');
}

testArabicTTS().catch(console.error);