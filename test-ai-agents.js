import { 
  createCustomerServiceAgent,
  createSalesAgent,
  createTechnicalSupportAgent,
  createCreativeAgent,
  createDataAnalystAgent
} from './src/agents/framework/enhanced-agent.js';

console.log('🤖 Testing AI Agents with OpenAI and Groq\n');
console.log('=' .repeat(50));

async function testAgents() {
  // Test 1: OpenAI GPT-4 Customer Service
  console.log('\n1️⃣ Testing OpenAI Customer Service Agent');
  const openaiAgent = createCustomerServiceAgent('openai');
  
  const response1 = await openaiAgent.askQuestion(
    "My order hasn't arrived yet and it's been 2 weeks. What should I do?"
  );
  console.log('   Response:', response1);
  console.log('   Stats:', openaiAgent.getStats());
  
  // Test 2: Groq Sales Agent
  console.log('\n2️⃣ Testing Groq Sales Agent (Llama 3)');
  const groqSales = createSalesAgent('groq');
  
  const response2 = await groqSales.askQuestion(
    "I'm looking for a laptop for programming. What do you recommend?"
  );
  console.log('   Response:', response2);
  console.log('   Stats:', groqSales.getStats());
  
  // Test 3: Groq Technical Support (Mixtral)
  console.log('\n3️⃣ Testing Groq Tech Support (Mixtral)');
  const groqTech = createTechnicalSupportAgent('groq');
  
  const response3 = await groqTech.askQuestion(
    "My computer is running very slowly. How can I fix it?"
  );
  console.log('   Response:', response3);
  console.log('   Stats:', groqTech.getStats());
  
  // Test 4: OpenAI Creative Agent
  console.log('\n4️⃣ Testing OpenAI Creative Agent');
  const creativeAgent = createCreativeAgent('openai');
  
  const response4 = await creativeAgent.askQuestion(
    "Give me a creative name for a voice AI platform"
  );
  console.log('   Response:', response4);
  console.log('   Stats:', creativeAgent.getStats());
  
  // Test 5: Groq Data Analyst (Llama 3 70B)
  console.log('\n5️⃣ Testing Groq Data Analyst (Llama 3 70B)');
  const dataAgent = createDataAnalystAgent('groq');
  
  const response5 = await dataAgent.askQuestion(
    "Our sales increased 40% last quarter. What insights can you provide?"
  );
  console.log('   Response:', response5);
  console.log('   Stats:', dataAgent.getStats());
  
  // Test room joining
  console.log('\n6️⃣ Testing Agent Room Joining');
  const roomAgent = createCustomerServiceAgent('openai');
  
  roomAgent.on('joined', (data) => {
    console.log('   Agent joined room:', data);
  });
  
  roomAgent.on('message-sent', (message) => {
    console.log('   Agent sent message:', message);
  });
  
  await roomAgent.joinRoom('test-ai-room');
  
  // Wait a bit for connection
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Clean up
  openaiAgent.disconnect();
  groqSales.disconnect();
  groqTech.disconnect();
  creativeAgent.disconnect();
  dataAgent.disconnect();
  roomAgent.disconnect();
  
  console.log('\n✅ All AI agent tests completed!');
  console.log('=' .repeat(50));
}

// Performance comparison
async function comparePerformance() {
  console.log('\n⚡ Performance Comparison: OpenAI vs Groq');
  console.log('=' .repeat(50));
  
  const question = "Explain quantum computing in simple terms";
  
  // Test OpenAI
  console.log('\nTesting OpenAI GPT-4...');
  const openaiStart = Date.now();
  const openaiAgent = createTechnicalSupportAgent('openai');
  const openaiResponse = await openaiAgent.askQuestion(question);
  const openaiTime = Date.now() - openaiStart;
  
  // Test Groq
  console.log('Testing Groq Mixtral...');
  const groqStart = Date.now();
  const groqAgent = createTechnicalSupportAgent('groq');
  const groqResponse = await groqAgent.askQuestion(question);
  const groqTime = Date.now() - groqStart;
  
  console.log('\n📊 Results:');
  console.log(`OpenAI GPT-4: ${openaiTime}ms`);
  console.log(`Groq Mixtral: ${groqTime}ms`);
  console.log(`\nSpeed difference: ${groqTime < openaiTime ? 'Groq' : 'OpenAI'} is ${Math.abs(openaiTime - groqTime)}ms faster`);
  
  console.log('\nOpenAI Response:', openaiResponse.substring(0, 100) + '...');
  console.log('Groq Response:', groqResponse.substring(0, 100) + '...');
  
  openaiAgent.disconnect();
  groqAgent.disconnect();
}

// Run tests
(async () => {
  try {
    await testAgents();
    await comparePerformance();
    
    console.log('\n🎉 All tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Make sure your API keys are valid in .env file');
    process.exit(1);
  }
})();