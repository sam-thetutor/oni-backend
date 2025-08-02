import { config } from 'dotenv';
import toolSelectionService from './dist/services/toolSelection.js';

config();

async function testIntelligentToolSelection() {
  console.log('🧪 Testing Intelligent Tool Selection Service...\n');

  const testMessages = [
    "What's my wallet balance?",
    "Show my wallet address",
    "Send 10 XFI to 0x1234567890abcdef",
    "Create a payment link for 50 XFI",
    "Show my transaction history",
    "What's the price of XFI?",
    "Create a DCA order to buy XFI when price drops below $0.05",
    "Show my payment links",
    "Get a swap quote for 100 XFI to USDC"
  ];

  for (const message of testMessages) {
    console.log(`📝 Testing: "${message}"`);
    
    try {
      const result = await toolSelectionService.selectTool(message);
      
      console.log(`✅ Selected Tool: ${result.selectedTool}`);
      console.log(`🎯 Confidence: ${result.confidence}`);
      console.log(`💭 Reasoning: ${result.reasoning}`);
      console.log(`🔧 Parameters:`, result.parameters);
      console.log('---\n');
      
    } catch (error) {
      console.error(`❌ Error for "${message}":`, error.message);
      console.log('---\n');
    }
  }

  console.log('🏁 Test completed!');
}

testIntelligentToolSelection(); 