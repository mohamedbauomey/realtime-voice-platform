// Simple test to verify AI agents are working
import { createCustomerServiceAgent, createSalesAgent } from './src/agents/framework/enhanced-agent.js';

console.log('🧪 Quick AI Agent Test\n');

async function quickTest() {
  try {
    // Test OpenAI
    console.log('Testing OpenAI GPT-4...');
    const openaiAgent = createCustomerServiceAgent('openai');
    const response1 = await openaiAgent.askQuestion("Hello, how are you?");
    console.log('✅ OpenAI Response:', response1);
    openaiAgent.disconnect();
    
    // Test Groq
    console.log('\nTesting Groq Llama 3.1...');
    const groqAgent = createSalesAgent('groq');
    const response2 = await groqAgent.askQuestion("What's your best product?");
    console.log('✅ Groq Response:', response2);
    groqAgent.disconnect();
    
    console.log('\n🎉 Both AI providers are working!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nPlease check:');
    console.log('1. API keys are set in .env file');
    console.log('2. OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set ✓' : 'Missing ✗');
    console.log('3. GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set ✓' : 'Missing ✗');
  }
}

quickTest();