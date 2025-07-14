# Ollama Integration Guide for LangGraph

## Installation

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows - Download from https://ollama.ai/download
```

### 2. Install Required Models
```bash
# Recommended models for tool calling
ollama pull llama3.1:8b          # Good balance of performance/speed
ollama pull llama3.1:70b         # Better performance, slower
ollama pull qwen2.5:7b           # Excellent for coding tasks
ollama pull mistral:7b           # Alternative option

# Start Ollama server
ollama serve
```

### 3. Install LangChain Ollama Package
```bash
npm install @langchain/ollama
# or
pnpm add @langchain/ollama
```

## Implementation

### 1. Update Environment Variables
```env
# Add to your .env file
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
USE_LOCAL_LLM=true
```

### 2. Create Ollama LLM Wrapper

```typescript
// backend/src/config/ollama.ts
import { ChatOllama } from "@langchain/ollama";

export const createOllamaLLM = (model: string = "llama3.1:8b") => {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: model,
    temperature: 0.1,
    // Enable tool calling
    format: "json" // For structured outputs
  });
};

// For tool calling specifically
export const createOllamaToolLLM = () => {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434", 
    model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    temperature: 0,
    // Important for tool calling
    format: "json"
  });
};
```

### 3. Update Your LangGraph Configuration

```typescript
// backend/src/index.ts
import { createOllamaLLM, createOllamaToolLLM } from "./config/ollama.js";
import { ChatOpenAI } from "@langchain/openai";

// Choose LLM based on environment
const createLLM = () => {
  if (process.env.USE_LOCAL_LLM === "true") {
    console.log("Using local Ollama model:", process.env.OLLAMA_MODEL);
    return createOllamaLLM();
  } else {
    console.log("Using OpenAI model");
    return new ChatOpenAI({
      model: "gpt-4",
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }
};

// Update your graph creation
const llm = createLLM();
const llmWithTools = llm.bindTools(ALL_TOOLS_LIST);
```

### 4. Handle Tool Calling Differences

```typescript
// backend/src/utils/toolCalling.ts
import { AIMessage } from "@langchain/core/messages";

export const handleToolCalling = async (message: AIMessage, llm: any) => {
  // Ollama tool calling might need different handling
  if (process.env.USE_LOCAL_LLM === "true") {
    // Handle Ollama-specific tool calling format
    return await handleOllamaToolCalls(message);
  } else {
    // Standard OpenAI tool calling
    return await handleOpenAIToolCalls(message);
  }
};

const handleOllamaToolCalls = async (message: AIMessage) => {
  // Ollama might return tools in a different format
  // You may need to parse JSON responses manually
  try {
    const content = message.content;
    if (typeof content === 'string') {
      const parsed = JSON.parse(content);
      if (parsed.tool_calls) {
        // Process tool calls
        return parsed.tool_calls;
      }
    }
  } catch (error) {
    console.log("No tool calls found in message");
  }
  return [];
};
```

## Alternative: Using Groq (Cloud but Cheaper)

### 1. Install Groq Package
```bash
npm install @langchain/groq
```

### 2. Groq Configuration
```typescript
// backend/src/config/groq.ts
import { ChatGroq } from "@langchain/groq";

export const createGroqLLM = () => {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-70b-versatile", // or "mixtral-8x7b-32768"
    temperature: 0.1,
    maxTokens: 4096,
  });
};
```

### 3. Environment Variables
```env
GROQ_API_KEY=your_groq_api_key_here
USE_GROQ=true
```

## Cost Comparison

### OpenAI GPT-4
- **Input**: ~$30/1M tokens
- **Output**: ~$60/1M tokens
- **Monthly cost for moderate usage**: $200-500

### Ollama (Local)
- **Cost**: Only hardware/electricity
- **One-time setup**: ~$0-500 (depending on hardware)
- **Monthly cost**: ~$10-30 in electricity

### Groq
- **Cost**: ~$0.59/1M tokens (input/output)
- **Monthly cost for moderate usage**: $20-50
- **Speed**: 10x faster than OpenAI

## Hardware Requirements

### For Ollama
- **7B models**: 8GB RAM minimum, 16GB recommended
- **13B models**: 16GB RAM minimum, 32GB recommended  
- **70B models**: 64GB RAM or GPU with 48GB+ VRAM

### Recommended Setup
```bash
# For development (7B model)
ollama pull llama3.1:8b

# For production (if you have the hardware)
ollama pull llama3.1:70b
```

## Implementation Steps

1. **Start with Groq** (easiest migration, immediate cost savings)
2. **Test Ollama locally** with 7B model for development
3. **Benchmark performance** against your use cases
4. **Scale up** to larger models if needed
5. **Deploy Ollama** to production server if satisfied

## Model Recommendations by Use Case

### For Tool Calling & Code Generation
1. **Qwen2.5:7b** - Excellent for coding tasks
2. **Llama3.1:8b** - Good all-around performance
3. **CodeLlama:13b** - Specialized for code

### For General Chat
1. **Llama3.1:8b** - Best balance
2. **Mistral:7b** - Good alternative
3. **Gemma2:9b** - Google's offering

Would you like me to help you implement any of these solutions? I can start with the Ollama integration or help you set up Groq as an immediate cost-saving measure. 