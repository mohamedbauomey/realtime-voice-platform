// Test complete voice pipeline
import { 
  createVoiceAssistant,
  createFastVoiceAgent,
  createSmartVoiceAgent
} from './src/agents/voice/realtime-voice-agent.js';

console.log('🎤 Testing Complete Voice Pipeline\n');
console.log('=' .repeat(50));

async function testVoicePipeline() {
  console.log('\n1️⃣ Testing OpenAI Voice Pipeline');
  console.log('   STT (Whisper) → GPT-4 → TTS');
  
  const openaiAgent = createSmartVoiceAgent();
  
  try {
    const startTime = Date.now();
    
    // Test text processing (simulates STT → LLM → TTS)
    const result = await openaiAgent.processText("What's the weather like today?");
    
    const totalTime = Date.now() - startTime;
    
    console.log('   ✅ Response:', result.response);
    console.log('   ⏱️ Total time:', totalTime + 'ms');
    console.log('   🔊 Audio generated:', result.audio ? 'Yes (' + (result.audio.byteLength / 1024).toFixed(1) + ' KB)' : 'No');
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  console.log('\n2️⃣ Testing Groq Voice Pipeline');
  console.log('   STT (Whisper) → Llama3 → TTS');
  
  const groqAgent = createFastVoiceAgent();
  
  try {
    const startTime = Date.now();
    
    // Test text processing
    const result = await groqAgent.processText("Tell me a quick joke");
    
    const totalTime = Date.now() - startTime;
    
    console.log('   ✅ Response:', result.response);
    console.log('   ⏱️ Total time:', totalTime + 'ms');
    console.log('   🔊 Audio generated:', result.audio ? 'Yes (' + (result.audio.byteLength / 1024).toFixed(1) + ' KB)' : 'No');
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  console.log('\n3️⃣ Testing Mixed Mode Pipeline');
  console.log('   Smart routing between OpenAI and Groq');
  
  const mixedAgent = createVoiceAssistant('mixed');
  
  try {
    // Test short query (should use Groq)
    console.log('\n   Short query (Groq):');
    let startTime = Date.now();
    let result = await mixedAgent.processText("Hi");
    console.log('   Response:', result.response);
    console.log('   Time:', (Date.now() - startTime) + 'ms');
    
    // Test long query (should use OpenAI)
    console.log('\n   Complex query (OpenAI):');
    startTime = Date.now();
    result = await mixedAgent.processText("Can you explain the process of photosynthesis and why it's important for life on Earth?");
    console.log('   Response:', result.response.substring(0, 100) + '...');
    console.log('   Time:', (Date.now() - startTime) + 'ms');
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  console.log('\n4️⃣ Testing Voice Configuration');
  
  const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const testAgent = createVoiceAssistant('openai');
  
  for (const voice of voices.slice(0, 3)) { // Test first 3 voices
    testAgent.updateConfig({ voice: voice });
    console.log(`\n   Testing ${voice} voice:`);
    
    try {
      const result = await testAgent.processText(`Hello, I'm speaking with the ${voice} voice`);
      console.log('   ✅ Audio size:', (result.audio.byteLength / 1024).toFixed(1) + ' KB');
    } catch (error) {
      console.log('   ❌ Failed:', error.message);
    }
  }
  
  console.log('\n5️⃣ Performance Comparison');
  console.log('=' .repeat(50));
  
  const query = "What is artificial intelligence?";
  
  // OpenAI timing
  console.log('\n   OpenAI GPT-4:');
  let start = Date.now();
  const openaiResult = await createSmartVoiceAgent().processText(query);
  const openaiTime = Date.now() - start;
  console.log('   Time:', openaiTime + 'ms');
  console.log('   Response length:', openaiResult.response.length + ' chars');
  
  // Groq timing
  console.log('\n   Groq Llama3:');
  start = Date.now();
  const groqResult = await createFastVoiceAgent().processText(query);
  const groqTime = Date.now() - start;
  console.log('   Time:', groqTime + 'ms');
  console.log('   Response length:', groqResult.response.length + ' chars');
  
  console.log('\n   📊 Results:');
  console.log('   Speed winner:', groqTime < openaiTime ? 'Groq ⚡' : 'OpenAI 🧠');
  console.log('   Speed difference:', Math.abs(openaiTime - groqTime) + 'ms');
  
  console.log('\n✅ Voice Pipeline Tests Complete!');
  console.log('=' .repeat(50));
}

testVoicePipeline().catch(console.error);