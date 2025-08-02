import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { config } from "dotenv";

config();

// LLM Provider Types
export type LLMProvider = "openai" | "groq" | "ollama";

// Get current provider from environment
export const getCurrentProvider = (): LLMProvider => {
  const provider = process.env.LLM_PROVIDER?.toLowerCase() as LLMProvider;
  
  if (provider && ["openai", "groq", "ollama"].includes(provider)) {
    return provider;
  }
  
  // Default fallback
  return "openai";
};

// Create LLM instance based on provider
export const createLLM = () => {
  const provider = getCurrentProvider();
  
  console.log(`🤖 Initializing LLM Provider: ${provider.toUpperCase()}`);
  
  switch (provider) {
    case "groq":
      return createGroqLLM();
    case "ollama":
      return createOllamaLLM();
    case "openai":
    default:
      return createOpenAILLM();
  }
};

// OpenAI LLM Configuration
const createOpenAILLM = () => {
  const model = process.env.OPENAI_MODEL || "gpt-4";
  console.log(`📱 Using OpenAI model: ${model}`);
  
  return new ChatOpenAI({
    model: model,
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
};

// Groq LLM Configuration (Cost-effective cloud option)
const createGroqLLM = () => {
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  console.log(`⚡ Using Groq model: ${model}`);
  
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required when using Groq provider");
  }
  
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: model,
    temperature: 0,
    maxTokens:1024,
    maxRetries: 3,
    timeout: 30000,
  });
};

// Ollama LLM Configuration (Local option)
const createOllamaLLM = () => {
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  
  console.log(`🏠 Using Ollama model: ${model} at ${baseUrl}`);
  
  return new ChatOllama({
    baseUrl: baseUrl,
    model: model,
    temperature: 0,
    // Note: Tool calling with Ollama may require special handling
  });
};

// Cost estimation helper
export const getCostEstimate = (provider: LLMProvider) => {
  switch (provider) {
    case "openai":
      return {
        provider: "OpenAI",
        inputCost: "$30/1M tokens",
        outputCost: "$60/1M tokens",
        monthlyEstimate: "$200-500"
      };
    case "groq":
      return {
        provider: "Groq",
        inputCost: "$0.59/1M tokens",
        outputCost: "$0.59/1M tokens", 
        monthlyEstimate: "$20-50"
      };
    case "ollama":
      return {
        provider: "Ollama (Local)",
        inputCost: "$0 (electricity only)",
        outputCost: "$0 (electricity only)",
        monthlyEstimate: "$10-30 electricity"
      };
  }
};

// Print cost information on startup
export const printCostInfo = () => {
  const provider = getCurrentProvider();
  const costInfo = getCostEstimate(provider);
  
  console.log("💰 Cost Estimate:");
  console.log(`   Provider: ${costInfo.provider}`);
  console.log(`   Input: ${costInfo.inputCost}`);
  console.log(`   Output: ${costInfo.outputCost}`);
  console.log(`   Monthly: ${costInfo.monthlyEstimate}`);
  console.log("");
};

// Available models by provider
export const getAvailableModels = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "openai":
      return ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"];
    case "groq":
      return [
        "llama-3.1-8b-instant", 
        "gemma2-9b-it"
      ];
    case "ollama":
      return [
        "llama3.1:8b",
        "llama3.1:70b",
        "qwen2.5:7b",
        "mistral:7b",
        "codellama:13b"
      ];
    default:
      return [];
  }
}; 