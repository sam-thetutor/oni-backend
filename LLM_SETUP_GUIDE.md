# LLM Provider Setup Guide

## Quick Start - Switch to Groq (Immediate 90% Cost Savings)

### 1. Get Groq API Key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up/login
3. Create an API key
4. Copy the key

### 2. Update Environment Variables
Add these to your `.env` file:
```env
# Switch to Groq for immediate cost savings
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile
```

### 3. Restart Backend
```bash
cd backend
npm run dev
# or
pnpm dev
```

**That's it! You'll see cost savings immediately.**

---

## Complete Environment Configuration

### Add to your backend/.env file:

```env
# LLM Provider Configuration
# Options: "openai", "groq", "ollama"
LLM_PROVIDER=groq

# OpenAI Configuration (current - expensive)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# Groq Configuration (RECOMMENDED - 90% cost savings)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile

# Ollama Configuration (LOCAL - 99% cost savings)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

---

## Cost Comparison

| Provider | Input Cost | Output Cost | Monthly Est. | Speed | Setup Time |
|----------|------------|-------------|--------------|-------|------------|
| **OpenAI** | $30/1M tokens | $60/1M tokens | $200-500 | Medium | 0 min |
| **Groq** ⭐ | $0.59/1M tokens | $0.59/1M tokens | $20-50 | Very Fast | 5 min |
| **Ollama** | $0 (electricity) | $0 (electricity) | $10-30 | Fast | 15 min |

⭐ **Recommended**: Start with Groq for immediate savings

---

## Setup Instructions

### Option 1: Groq (Recommended)

```bash
# 1. Get API key from console.groq.com
# 2. Add to .env:
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here

# 3. Restart backend
cd backend && pnpm dev
```

**Available Models:**
- `llama-3.1-70b-versatile` (best performance)
- `llama-3.1-8b-instant` (fastest)
- `mixtral-8x7b-32768` (good alternative)

### Option 2: Ollama (Local)

```bash
# 1. Install Ollama
brew install ollama  # macOS
# OR download from ollama.ai

# 2. Pull models
ollama pull llama3.1:8b        # Fast, good quality
ollama pull qwen2.5:7b         # Excellent for code
ollama pull llama3.1:70b       # Best quality (needs 64GB RAM)

# 3. Start Ollama server
ollama serve

# 4. Add to .env:
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.1:8b

# 5. Restart backend
cd backend && pnpm dev
```

**Hardware Requirements:**
- 7B models: 8GB RAM minimum
- 13B models: 16GB RAM minimum  
- 70B models: 64GB RAM or GPU

### Option 3: Keep OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4
```

---

## Model Recommendations

### For Your Use Case (Blockchain Tools + Chat)

1. **Groq + llama-3.1-70b-versatile** ⭐
   - Best balance of cost/performance
   - Excellent tool calling
   - 10x faster than OpenAI
   - 90% cost savings

2. **Ollama + qwen2.5:7b**
   - Best for development
   - Great with technical tasks
   - 99% cost savings
   - Works offline

3. **Groq + llama-3.1-8b-instant**
   - Fastest responses
   - Good for high-volume
   - Still 90% cheaper than OpenAI

---

## Testing Your Setup

1. Start your backend: `cd backend && pnpm dev`
2. Look for startup logs:
   ```
   🤖 Initializing LLM Provider: GROQ
   ⚡ Using Groq model: llama-3.1-70b-versatile
   💰 Cost Estimate:
      Provider: Groq
      Input: $0.59/1M tokens
      Output: $0.59/1M tokens
      Monthly: $20-50
   ```
3. Test with your frontend - ask the AI a question
4. Verify it responds correctly

---

## Troubleshooting

### Groq Issues
- **"API key invalid"**: Check key at console.groq.com
- **"Rate limited"**: Groq has generous limits, but check usage
- **"Model not found"**: Use: `llama-3.1-70b-versatile`

### Ollama Issues  
- **"Connection refused"**: Run `ollama serve`
- **"Model not found"**: Run `ollama pull llama3.1:8b`
- **"Out of memory"**: Try smaller model like `llama3.1:8b`

### Performance Issues
- **Slow responses**: Try `llama-3.1-8b-instant` with Groq
- **Poor quality**: Use `llama-3.1-70b-versatile` for better results
- **Tool calling problems**: Groq has excellent tool support

---

## Migration Path

### Week 1: Groq Testing
1. Switch to Groq
2. Test all your tools work
3. Monitor cost savings
4. Compare response quality

### Week 2: Ollama Testing (Optional)
1. Install Ollama locally
2. Test with development traffic
3. Compare performance vs Groq

### Week 3: Production Decision
1. Choose Groq for production (recommended)
2. Or Ollama if you have good hardware
3. Keep OpenAI as fallback if needed

---

## Expected Savings

If you're currently spending **$300/month** on OpenAI:

- **Switch to Groq**: ~$30/month (90% savings)
- **Switch to Ollama**: ~$15/month (95% savings)

**Annual savings**: $2,000-3,000 💰

---

## Next Steps

1. **Quick win**: Switch to Groq today (5 minutes)
2. **Test thoroughly**: Verify all your tools work
3. **Monitor usage**: Track costs in Groq console
4. **Consider Ollama**: For development or if you have good hardware

Need help? The implementation is already done - just update your `.env` file! 