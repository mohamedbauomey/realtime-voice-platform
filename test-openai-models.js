import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const testModels = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-16k',
  'gpt-4',
  'gpt-4-0125-preview',
  'gpt-4-1106-preview',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini'
];

console.log('Testing OpenAI Model Access\n');
console.log('=' .repeat(50));

for (const model of testModels) {
  try {
    console.log(`\nTesting: ${model}`);
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hi' }],
      max_tokens: 5
    });
    
    console.log(`✅ ${model} - Working`);
    console.log(`   Response: ${completion.choices[0].message.content}`);
  } catch (error) {
    if (error.status === 404) {
      console.log(`❌ ${model} - Not Available`);
    } else if (error.status === 401) {
      console.log(`❌ ${model} - Authentication Failed`);
    } else {
      console.log(`❌ ${model} - Error: ${error.message}`);
    }
  }
}

console.log('\n' + '=' .repeat(50));
console.log('Test Complete');
process.exit(0);