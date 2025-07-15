import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { BaseMessage, type AIMessage } from "@langchain/core/messages";
import { ALL_TOOLS_LIST, setCurrentUserId } from "./tools.js";
import { createLLM, printCostInfo, getCurrentProvider } from "./config/llm.js";
import { config } from "dotenv";

config();

// Print cost information on startup
printCostInfo();

// Add userId to the graph state
const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>(),
});

// Use the new LLM configuration
const llm = createLLM();

const toolNode = new ToolNode(ALL_TOOLS_LIST);

const callModel = async (state: typeof GraphAnnotation.State) => {
  const { messages, userId } = state;

  const systemMessage = {
    role: "system",
    content:
      "You are a comprehensive AI assistant specializing in the CrossFi blockchain ecosystem. You have access to wallet operations, gamification features, and comprehensive ecosystem analytics. " +
      
      "\n🔧 WALLET & TRANSACTION TOOLS:\n" +
      "• get_wallet_info - Gets information about the user's wallet (address, chain ID, creation date)\n" +
      "• get_wallet_for_operations - Gets wallet info for blockchain operations (includes private key access)\n" +
      "• get_balance - Gets the balance of the user's wallet\n" +
      "• send_transaction - Sends a transaction from the user's wallet to another address (awards points for successful transactions)\n" +
      "• get_transaction_history - Gets transaction history for the user's wallet\n" +
      
      "\n🎮 GAMIFICATION TOOLS:\n" +
      "• get_user_stats - Gets the user's gamification stats (points, rank, achievements)\n" +
      "• get_leaderboard - Gets the global leaderboard showing top users by points\n" +
      "• set_username - Set or update the user's public username (3-20 chars, alphanumeric or underscores, must be unique)\n" +
      
      "\n💳 PAYMENT LINK TOOLS:\n" +
      "• create_global_payment_link - Creates a global payment link for the user\n" +
      "• create_payment_links - Creates a fixed payment link for a specified amount on the blockchain\n" +
      "• pay_fixed_payment_link - Pays a fixed payment link using the link ID\n" +
      "• contribute_to_global_payment_link - Contribute to an existing global payment link\n" +
      "• check_payment_link_status - Check the status of any payment link\n" +
      
      "\n📊 CROSSFI ECOSYSTEM INSIGHTS (CRYPTO ASSISTANT):\n" +
      "• get_crossfi_network_stats - Real-time CrossFi network statistics (block height, network health, performance)\n" +
      "• get_crossfi_ecosystem_insights - Comprehensive ecosystem analysis (network + transaction analytics + market data)\n" +
      "• get_crossfi_transaction_analytics - Detailed transaction pattern analysis and network activity metrics\n" +
      "• get_crossfi_market_data - XFI token market data including price, volume, and market cap (when available)\n" +
      "• get_crossfi_defi_metrics - DeFi ecosystem metrics including TVL, active protocols, and yield opportunities\n" +
      "• get_crossfi_ecosystem_summary - Executive summary of the entire CrossFi ecosystem with opportunities and risks\n" +
      
      "\n🎯 CRYPTO ASSISTANT CAPABILITIES:\n" +
      "You are now equipped to provide comprehensive CrossFi ecosystem insights including:\n" +
      "- Network performance and health monitoring\n" +
      "- Transaction analytics and on-chain activity\n" +
      "- Market data and price analysis\n" +
      "- DeFi protocol tracking and opportunities\n" +
      "- Ecosystem growth metrics and trends\n" +
      "- Investment insights and risk assessment\n" +
      
      "\n💡 INTERACTION GUIDELINES:\n" +
      "• Be conversational and explain what you're doing\n" +
      "• When users ask about CrossFi ecosystem, market trends, or network status, use the crypto assistant tools\n" +
      "• For payment links, provide clickable URLs that others can use to pay them\n" +
      "• Format transaction hashes and addresses in a user-friendly way\n" +
      "• Proactively offer ecosystem insights when relevant to user queries\n" +
      "• Present data with emojis and clear formatting for better readability\n" +
      "• If the user is not logged in, ask them to login to the app to use the tools\n" +
      "• Use markdown to format the response\n" +
      "• IMPORTANT: When tools return JSON responses, parse them and present the information in a user-friendly format\n" +
      "• Do NOT try to call functions on tool responses - just present the information directly\n" +
      
      "\nYou're an expert in both technical blockchain operations AND market analysis - help users understand the CrossFi ecosystem comprehensively!",
  };

  try {
    const llmWithTools = llm.bindTools(ALL_TOOLS_LIST);
    const result = await llmWithTools.invoke([systemMessage, ...messages]);
    return { messages: result, userId };
  } catch (error: any) {
    console.error('LLM Error:', error);
    
    // Check if this is a rate limit error
    if (error.message?.includes('Rate limit') || error.message?.includes('429') || error.message?.includes('500648')) {
      // Return a helpful fallback response
      const fallbackMessage = {
        role: "ai",
        content: `I apologize, but I'm currently experiencing high demand and can't process your request right now. 

**What you can do:**
• Try again in a few minutes
• Check your wallet balance or transaction history using the app's built-in features
• Visit the CrossFi dashboard for real-time network information

**Available Features (even when AI is busy):**
• View your wallet balance and transaction history
• Create and manage payment links
• Check the leaderboard and your gamification stats
• Monitor DCA orders and swap tokens

I'll be back to help you with more complex tasks soon! 🚀`
      };
      
      return { messages: [fallbackMessage], userId };
    }
    
    // For other errors, re-throw to be handled by the server
    throw error;
  }
};

const shouldContinue = (state: typeof GraphAnnotation.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // Cast since `tool_calls` does not exist on `BaseMessage`
  const messageCastAI = lastMessage as AIMessage;
  if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
    return END;
  }

  return "tools";
};

// Custom tool node that sets user context
const customToolNode = async (state: typeof GraphAnnotation.State) => {
  const { messages, userId } = state;
  
  // Set the current user ID for tools to access
  setCurrentUserId(userId);
  
  // Execute tools
  const result = await toolNode.invoke(messages);
  
  // Debug: Log the result to see what's happening
  console.log('Tool execution result:', JSON.stringify(result, null, 2));
  
  return { messages: result, userId };
};

const workflow = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", customToolNode)
  .addEdge(START, "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END]);

export const graph = workflow.compile(); 