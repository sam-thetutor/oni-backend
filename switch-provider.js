#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🤖 LLM Provider Switch Script');
console.log('==============================');

// Read current .env file
const envPath = path.join(__dirname, '.env');
let envContent = '';

try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ Could not read .env file');
  process.exit(1);
}

// Find current provider
const currentProviderMatch = envContent.match(/LLM_PROVIDER=(\w+)/);
const currentProvider = currentProviderMatch ? currentProviderMatch[1] : 'groq';
console.log(`Current provider: ${currentProvider}`);

console.log('\nAvailable providers:');
console.log('1. groq (cheapest, fast)');
console.log('2. openai (most reliable, expensive)');
console.log('3. ollama (local, free)');

// Get user input
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nEnter provider number (1-3): ', (choice) => {
  let newProvider = '';
  
  switch (choice) {
    case '1':
      newProvider = 'groq';
      break;
    case '2':
      newProvider = 'openai';
      break;
    case '3':
      newProvider = 'ollama';
      break;
    default:
      console.log('❌ Invalid choice. No changes made.');
      rl.close();
      return;
  }
  
  // Update .env file
  const updatedContent = envContent.replace(
    /LLM_PROVIDER=\w+/,
    `LLM_PROVIDER=${newProvider}`
  );
  
  try {
    fs.writeFileSync(envPath, updatedContent);
    console.log(`✅ Switched to ${newProvider.toUpperCase()}`);
    
    if (newProvider === 'groq') {
      console.log('💡 Make sure you have GROQ_API_KEY set in your .env file');
    } else if (newProvider === 'openai') {
      console.log('💡 Make sure you have OPENAI_API_KEY set in your .env file');
    } else if (newProvider === 'ollama') {
      console.log('💡 Make sure Ollama is running locally (ollama serve)');
    }
    
    console.log('\n🔄 Restart your backend to apply changes:');
    console.log('   cd backend && npm run dev');
    
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
  }
  
  rl.close();
}); 