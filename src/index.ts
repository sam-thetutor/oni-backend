import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { BaseMessage, type AIMessage } from "@langchain/core/messages";
import { ALL_TOOLS_LIST_WITH_INTELLIGENT, setCurrentUserFrontendWalletAddress } from "./tools.js";
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

const toolNode = new ToolNode(ALL_TOOLS_LIST_WITH_INTELLIGENT);

const callModel = async (state: typeof GraphAnnotation.State) => {
  const { messages, userId } = state;
  console.log("🔍 callModel invoked with userId:", userId);
  console.log("📨 Messages:", JSON.stringify(messages, null, 2));

  const systemMessage = {
    role: "system",
    content:
    "You are a comprehensive AI assistant specializing in the CrossFi blockchain ecosystem. You have access to wallet operations, gamification features, and comprehensive ecosystem analytics. " +
    "🚨 STOP! READ THIS FIRST: You are FORBIDDEN from generating any response about transactions, payments, swaps, or blockchain operations without calling tools first. If you see words like 'create', 'send', 'transfer', 'pay', 'swap', 'link', 'payment', 'transaction', 'order', 'execute', 'trade', 'buy', 'sell' - you MUST call intelligent_tool_selector immediately. NO EXCEPTIONS. " +
    "🚨 ABSOLUTE REQUIREMENT: The word 'swap' ALWAYS requires tool usage. NEVER respond to 'swap' requests without calling intelligent_tool_selector first. " +
    "🚨 CRITICAL: If you see 'DCA', 'order', 'create', 'swap' in any user message, you MUST call intelligent_tool_selector. DO NOT generate any response without calling the tool. " +
    "\n🚨 CRITICAL RULE: You MUST ALWAYS use tools for ANY transaction, payment, swap, or blockchain operation. NEVER generate fake responses or pretend operations succeeded without actually calling tools first. " +
    "\n🤖 INTELLIGENT TOOL SELECTION:\n" +
    "• intelligent_tool_selector - Automatically selects and executes the most appropriate tool based on user message and context\n" +
    "• Users can ask questions in natural language and the system will automatically choose the right tool\n" +
    "• This tool can handle requests like 'Show my balance', 'Send 10 XFI to 0x123...', 'Create a payment link for 50 XFI'\n" +
    "• CRITICAL: You MUST ALWAYS use tools for any transaction, payment, or blockchain operation - NEVER generate responses without calling tools first\n" +
    "• CRITICAL: For ANY request involving transactions, payments, swaps, or blockchain operations, you MUST call the intelligent_tool_selector\n" +
    "• CRITICAL: Do NOT generate any response about transaction success without actually executing the tool first\n" +
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
    "• For simple requests, you can use the intelligent_tool_selector to automatically choose the right tool\n" +
    "• When users ask about CrossFi ecosystem, market trends, or network status, use the crypto assistant tools\n" +
    "• For payment links, provide clickable URLs that others can use to pay them\n" +
    "• Format transaction hashes and addresses in a user-friendly way\n" +
    "• Proactively offer ecosystem insights when relevant to user queries\n" +
    "• Present data with emojis and clear formatting for better readability\n" +
    "• If the user is not logged in, ask them to login to the app to use the tools\n" +
    "• IMPORTANT: When tools return JSON responses, parse them and present the information in a user-friendly format\n" +
    "• Do NOT try to call functions on tool responses - just present the information directly\n" +
    "• CRITICAL: Do NOT format tool responses as markdown - present them as plain text with emojis and clear structure\n" +
    "• CRITICAL: NEVER generate fake transaction hashes, payment links, or blockchain data - only return real results from actual blockchain operations\n" +
    "• CRITICAL: If a transaction fails or you're unsure about the result, be honest about the uncertainty - do NOT pretend it succeeded\n" +
    "• CRITICAL: Always verify that operations actually completed before reporting success - do NOT assume success\n" +
    "• CRITICAL: NEVER make up or hallucinate data about CrossFi ecosystem - ALWAYS use the crypto assistant tools to get real data\n" +
    "• CRITICAL: When users ask about CrossFi network stats, ecosystem insights, or market data, you MUST call the appropriate crypto assistant tool\n" +
    "• CRITICAL: Do NOT provide fake numbers, prices, or statistics - only use real data from the tools\n" +
    "\n🔒 MANDATORY TOOL USAGE:\n" +
    "• ANY request to 'send', 'transfer', 'pay', 'swap', 'create payment link', 'execute', 'trade' MUST use tools\n" +
    "• ANY request involving blockchain transactions MUST use tools\n" +
    "• ANY request for wallet operations MUST use tools\n" +
    "• ANY request for payment links MUST use tools\n" +
    "• ANY request for DCA orders MUST use tools\n" +
    "• ANY request containing 'swap', 'DCA', 'order', 'create' MUST use tools\n" +
    "• NEVER respond to these requests without calling tools first\n" +
    "• NEVER generate fake order IDs, transaction hashes, or success messages\n" +
    "• AFTER successfully creating a DCA order, provide a clear summary and STOP calling additional tools\n" +
    "• If a tool fails with 'User wallet not found', provide helpful guidance instead of retrying\n" +
    "• When a DCA order is successfully created, present the order details clearly and do NOT try to check order status\n" +
    "• If you see a successful DCA order creation response, provide a user-friendly summary and end the conversation\n" +
    "• CRITICAL: After creating a DCA order successfully, you MUST provide a summary and STOP. Do NOT call any more tools.\n" +
    "• CRITICAL: If the last tool result contains 'DCA order created successfully', provide a summary and END the conversation.\n" +
    "\nYou're an expert in both technical blockchain operations AND market analysis - help users understand the CrossFi ecosystem comprehensively using ONLY real data from the tools!",
};

  try {
    console.log("🤖 Binding tools to LLM...");
    const llmWithTools = llm.bindTools(ALL_TOOLS_LIST_WITH_INTELLIGENT);
    console.log("✅ Tools bound successfully");
    
    console.log("🚀 Invoking LLM with tools...");
    const result = await llmWithTools.invoke([systemMessage, ...messages]);
    console.log("📤 LLM Response:", JSON.stringify(result, null, 2));
    
    // Check if the response contains tool calls
    const resultMessages = Array.isArray(result) ? result : [result];
    const lastMessage = resultMessages[resultMessages.length - 1];
    
    // Get user message for validation
    const userMessage = String(messages[messages.length - 1]?.content || "");
    
    // Check if user requested an action but AI didn't call tools
    const actionKeywords = ['swap', 'send', 'create', 'transfer', 'pay', 'order', 'dca', 'execute', 'trade'];
    const requestedAction = actionKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
    
    // Prevent infinite loop - don't force tool call if the message is already a tool result
    const isAlreadyToolResult = userMessage.includes('✅ **Tool Executed**') || userMessage.includes('"success":true');
    
    // Check if a DCA order was successfully created recently
    const recentMessages = messages.slice(-5);
    const dcaOrderCreated = recentMessages.some(msg => 
      msg._getType() === "tool" && 
      msg.content && 
      String(msg.content).includes("DCA order created successfully")
    );
    
    if (dcaOrderCreated) {
      console.log("🎯 DCA order was created successfully - forcing summary response");
      const summaryMessage = {
        role: "ai",
        content: `🎉 **DCA Order Created Successfully!**

Your automated trading order has been set up and is now active. The order will automatically execute when the market conditions are met.

**What happens next:**
• Your order is now monitoring the market
• It will execute automatically when the trigger price is reached
• You can check your order status anytime
• The order will expire if not executed within the specified time

**Need help?**
• Check your order status in the app
• View your transaction history
• Contact support if you have questions

Your DCA order is ready to go! 🚀`
      };
      return { messages: [summaryMessage], userId };
    }
    
    if (requestedAction && !isAlreadyToolResult && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
      console.log("🚨 Action requested but no tools called - forcing tool execution");
      
      // Force tool call
      const forcedToolCall = {
        role: "ai",
        content: "I need to execute this operation properly. Let me call the appropriate tool.",
        tool_calls: [{
          id: `forced_tool_call_${Date.now()}`,
          name: "intelligent_tool_selector",
          args: { 
            userMessage: userMessage,
            context: "User requested action that requires tool execution"
          }
        }]
      };
      
      console.log("🔧 Forced tool call:", JSON.stringify(forcedToolCall.tool_calls, null, 2));
      return { messages: [forcedToolCall], userId };
    }
    
    if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      console.log("🔧 Tool calls detected:", JSON.stringify(lastMessage.tool_calls, null, 2));
    } else {
      console.log("❌ No tool calls in response");
    }
    
    // Filter out fake responses (responses that look like they succeeded without calling tools)
    const responseContent = String(lastMessage?.content || "");
    const fakeResponsePatterns = [
      /Order ID: 0x[a-f0-9-]+/i,
      /Transaction completed successfully!/i,
      /🎯.*Created Successfully!/i,
      /✅.*Successfully!/i
    ];
    
    const hasFakePatterns = fakeResponsePatterns.some(pattern => pattern.test(responseContent));
    
    // Only force tool execution if it's not already a tool result and not a fake response
    const isFakeResponseToolResult = userMessage.includes('✅ **Tool Executed**') || userMessage.includes('"success":true');
    
    if (hasFakePatterns && !isFakeResponseToolResult && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
      console.log("🚨 Detected fake success response - forcing tool execution");
      
      const correctedResponse = {
        role: "ai",
        content: "I need to execute this operation properly. Let me call the appropriate tool to handle your request.",
        tool_calls: [{
          id: `corrected_tool_call_${Date.now()}`,
          name: "intelligent_tool_selector",
          args: { 
            userMessage: userMessage,
            context: "Correcting fake response with real tool execution"
          }
        }]
      };
      
      return { messages: [correctedResponse], userId };
    }
    
    return { messages: [lastMessage], userId };
  } catch (error: any) {
    console.error("❌ LLM Error:", error);
    console.error("❌ Error details:", JSON.stringify(error, null, 2));

    // Check if this is a rate limit error
    if (
      error.message?.includes("Rate limit") ||
      error.message?.includes("429") ||
      error.message?.includes("500648")
    ) {
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

I'll be back to help you with more complex tasks soon! 🚀`,
      };

      return { messages: [fallbackMessage], userId };
    }

    // Check if this is a tool use failed error (AI trying to format responses incorrectly)
    if (
      error.message?.includes("tool_use_failed") ||
      error.message?.includes("Failed to call a function")
    ) {
      console.log(
        "Tool use failed - AI tried to format response incorrectly, providing honest fallback"
      );

      // Extract the tool result from the error message if possible
      const toolResultMatch = error.message.match(
        /failed_generation":"([^"]+)"/
      );
      if (toolResultMatch) {
        const toolResult = toolResultMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"');

        // Return the tool result as a simple message
        const fallbackMessage = {
          role: "ai",
          content: `⚠️ Response Formatting Issue

${toolResult}

The operation may have been processed, but I had trouble formatting the response properly. Please check your transaction history or wallet balance to confirm if the operation was actually completed.`,
        };

        return { messages: [fallbackMessage], userId };
      }

      // Generic fallback for tool use errors
      const fallbackMessage = {
        role: "ai",
        content: `⚠️ Operation Status Uncertain

I encountered an issue while processing your request. The operation may or may not have been completed successfully. 

**To verify:**
• Check your transaction history
• Verify your wallet balance
• Look for any pending transactions

**If the operation didn't complete:**
• Try your request again
• Contact support if the issue persists

I apologize for the uncertainty - it's better to be honest about potential issues than to provide false confirmation.`,
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

  // Check if a DCA order was successfully created recently
  const recentMessages = messages.slice(-10);
  for (const msg of recentMessages) {
    if (msg._getType() === "tool" && msg.content) {
      const content = String(msg.content);
      if (content.includes("DCA order created successfully") || content.includes("✅ DCA order created successfully")) {
        console.log("🛑 DCA order created successfully - stopping conversation");
        return END;
      }
    }
  }

  // Check for infinite loop patterns
  const toolCallCounts: Record<string, number> = {};
  
  for (const msg of recentMessages) {
    if (msg._getType() === "ai" && (msg as AIMessage).tool_calls) {
      for (const toolCall of (msg as AIMessage).tool_calls) {
        const toolName = toolCall.name;
        toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
      }
    }
  }
  
  // If any tool has been called more than 4 times in recent messages, stop the loop
  for (const [toolName, count] of Object.entries(toolCallCounts)) {
    if (count > 4) {
      console.log(`🛑 Stopping infinite loop: ${toolName} called ${count} times`);
      return END;
    }
  }

  return "tools";
};

// Custom tool node that sets user context
const customToolNode = async (state: typeof GraphAnnotation.State) => {
  const { messages, userId } = state;
  console.log("customToolNode invoked with messages:", JSON.stringify(messages, null, 2), "userId:", userId);
  // Set the current user ID for tools to access
      setCurrentUserFrontendWalletAddress(userId);

  // Execute tools
  const result = await toolNode.invoke(messages);

  // Debug: Log the result to see what's happening
  console.log("Tool execution result:", JSON.stringify(result, null, 2));

  return { messages: result, userId };
};

const workflow = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", customToolNode)
  .addEdge(START, "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END]);

export const graph = workflow.compile();
