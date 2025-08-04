#!/usr/bin/env node

import { config } from 'dotenv';
import { getCurrentProvider, getAvailableModels } from './dist/config/llm.js';

config();

console.log('🔄 LLM Provider Switcher\n');

const currentProvider = getCurrentProvider();
console.log(`Current provider: ${currentProvider.toUpperCase()}`);

console.log('\n📋 Available Providers:');
console.log('1. OpenAI (Best function calling support)');
console.log('2. Groq (Cost-effective, limited function calling)');
console.log('3. Ollama (Local, requires setup)\n');

console.log('🔧 To switch providers, set the LLM_PROVIDER environment variable:');
console.log('');
console.log('For OpenAI (Recommended for function calling):');
console.log('export LLM_PROVIDER=openai');
console.log('export OPENAI_API_KEY=your_openai_api_key');
console.log('');
console.log('For Groq (Limited function calling):');
console.log('export LLM_PROVIDER=groq');
console.log('export GROQ_API_KEY=your_groq_api_key');
console.log('export GROQ_MODEL=mixtral-8x7b-32768');
console.log('');
console.log('For Ollama (Local):');
console.log('export LLM_PROVIDER=ollama');
console.log('export OLLAMA_MODEL=llama3.1:8b');
console.log('');

console.log('⚠️  IMPORTANT: Groq models have limited function calling support.');
console.log('   If you\'re experiencing issues with tool execution, switch to OpenAI.');
console.log('');

const availableModels = getAvailableModels(currentProvider);
console.log(`📱 Available models for ${currentProvider}:`);
availableModels.forEach(model => console.log(`   - ${model}`)); 