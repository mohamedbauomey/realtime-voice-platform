// Test available Groq models
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function testModels() {
  const models = [
    'llama3-8b-8192',
    'llama3-70b-8192', 
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'llama-3.2-1b-preview',
    'llama-3.2-3b-preview',
    'mixtral-8x7b-32768',
    'gemma-7b-it',
    'gemma2-9b-it'
  ];

  console.log('Testing Groq models...\n');

  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      });
      console.log(`✅ ${model} - Working`);
    } catch (error) {
      console.log(`❌ ${model} - ${error.message.split('\n')[0]}`);
    }
  }
}

testModels();