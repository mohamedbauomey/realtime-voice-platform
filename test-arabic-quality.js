import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testArabicQuality() {
  console.log('Testing Enhanced Arabic Voice Quality\n');
  console.log('=' .repeat(50));
  
  // Test different voices and settings
  const tests = [
    {
      text: 'مرحباً، كيف حالك اليوم؟',
      voice: 'nova',
      speed: 0.75,
      label: 'Arabic - Nova Slow'
    },
    {
      text: 'إزيك؟ عامل إيه؟ تمام الحمد لله',
      voice: 'nova',
      speed: 0.8,
      label: 'Egyptian - Nova'
    },
    {
      text: 'أهلاً وسهلاً، تشرفنا بمعرفتك',
      voice: 'shimmer',
      speed: 0.75,
      label: 'Arabic - Shimmer'
    },
    {
      text: 'السلام عليكم ورحمة الله وبركاته',
      voice: 'onyx',
      speed: 0.75,
      label: 'Arabic - Onyx Male'
    },
    {
      text: 'يللا بينا، خلاص كده، مفيش وقت',
      voice: 'echo',
      speed: 0.8,
      label: 'Egyptian - Echo'
    }
  ];
  
  console.log('Testing voices and speeds for Arabic quality\n');
  
  for (const test of tests) {
    console.log(`Testing: ${test.label}`);
    console.log(`Text: "${test.text}"`);
    console.log(`Voice: ${test.voice}, Speed: ${test.speed}`);
    
    try {
      // Test with HD model
      const hdResponse = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: test.voice,
        input: test.text,
        speed: test.speed,
        response_format: 'opus'
      });
      
      const hdBuffer = Buffer.from(await hdResponse.arrayBuffer());
      const hdFilename = `arabic-${test.voice}-hd-${test.speed}.opus`;
      await fs.writeFile(hdFilename, hdBuffer);
      console.log(`  ✅ HD: ${hdFilename} (${(hdBuffer.length / 1024).toFixed(1)} KB)`);
      
      // Test with standard model for comparison
      const stdResponse = await openai.audio.speech.create({
        model: 'tts-1',
        voice: test.voice,
        input: test.text,
        speed: test.speed,
        response_format: 'mp3'
      });
      
      const stdBuffer = Buffer.from(await stdResponse.arrayBuffer());
      const stdFilename = `arabic-${test.voice}-std-${test.speed}.mp3`;
      await fs.writeFile(stdFilename, stdBuffer);
      console.log(`  ✅ Standard: ${stdFilename} (${(stdBuffer.length / 1024).toFixed(1)} KB)`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log();
  }
  
  console.log('=' .repeat(50));
  console.log('\nVoice Quality Recommendations:');
  console.log('1. Nova (0.75 speed) - Best for formal Arabic');
  console.log('2. Nova (0.8 speed) - Good for Egyptian dialect');
  console.log('3. Shimmer - Softer, good for female Arabic voice');
  console.log('4. Onyx - Deep male voice for Arabic');
  console.log('5. HD model - Much better quality than standard');
  console.log('6. Opus format - Better compression and quality');
  console.log('\nListen to the files to compare quality!');
}

testArabicQuality().catch(console.error);