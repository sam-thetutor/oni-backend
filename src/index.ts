import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  Annotation,
  END,
  START,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { BaseMessage, type AIMessage } from "@langchain/core/messages";
import { ALL_TOOLS_LIST, setCurrentUserFrontendWalletAddress } from "./tools.js";
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
  console.log("🔍 callModel invoked with userId:", userId);
  console.log("📨 Messages:", JSON.stringify(messages, null, 2));

    const systemMessage = {
    role: "system",
    content:
    "You are the user's personalized CrossFi AI Agent. Execute ONLY the specific task requested.\n" +
    "🚨 CRITICAL: NEVER put function calls in your content - use tool_calls mechanism instead.\n" +
    "🚨 CRITICAL: NEVER generate fake responses in content - ALWAYS use tools for real operations.\n" +
    "🚨 CRITICAL: If you need to create, swap, or perform any action - use the appropriate tool.\n" +
    "🚨 CRITICAL: For payment links - if no amount specified, use create_global_payment_link with empty args {}. If amount specified, use create_payment_links with amount like '10 XFI'.\n" +
    "🚨 CRITICAL: NEVER output <function=send_token> or similar in content - use tool_calls instead.\n" +
    "🚨 CRITICAL: NEVER output <function=delete_payment_link> or similar in content - use tool_calls instead.\n" +
    "🚨 CRITICAL: NEVER output <function=execute_swap> or similar in content - use tool_calls instead.\n" +
    "🚨 CRITICAL: NEVER put function calls in content field - ALWAYS use tool_calls array for ALL tools\n" +
    "\n🔧 KEY TOOLS:\n" +
    "• get_balance - Get wallet balance\n" +
    "• execute_swap - Execute token swaps (USDC↔XFI, etc.)\n" +
    "• get_swap_quote - Get swap estimates\n" +
    "• send_transaction - Send XFI transactions\n" +
    "• If the user does not specify the amount when creating a payment link - create a global payment link by default\n" +
    "• create_global_payment_link - DEFAULT: Create global payment link for donations (use when no amount specified)\n" +
    "• create_payment_links - Create fixed payment link with specific amount (use only when amount is specified)\n" +
    "• delete_payment_link - Permanently delete payment link by ID (use when user says 'delete payment link' or 'remove payment link')\n" +
    "• get_user_stats - Get gamification stats\n" +
    "• get_crossfi_network_stats - Get network data\n" +
    "• delete_dca_order - Permanently delete DCA order by ID (use when user says 'delete DCA order' or 'remove DCA order')\n" +
    "\n🔒 STRICT RULES:\n" +
    "• Execute ONLY the requested task - do NOT call additional tools\n" +
    "• If user says 'swap' → call ONLY execute_swap, then STOP\n" +
    "• If user asks for 'quote' → call ONLY get_swap_quote, then STOP\n" +
    "• If user asks for 'balance' → call ONLY get_balance with empty args {}, then STOP\n" +
    "• If user asks for 'network stats' → call ONLY get_crossfi_network_stats, then STOP\n" +
    "• If user asks for 'payment link' without amount → call ONLY create_global_payment_link with empty args {}, then STOP\n" +
    "• If user asks for 'global payment link' or 'donations' → call ONLY create_global_payment_link with empty args {}, then STOP\n" +
    "• If user asks for 'fixed payment link' with specific amount → call ONLY create_payment_links with amount like '10 XFI', then STOP\n" +
    "• If user asks for 'payment link for X XFI' → call ONLY create_payment_links with amount like 'X XFI', then STOP\n" +
    "• If user asks for 'delete payment link' or 'remove payment link' → call ONLY delete_payment_link with linkId, then STOP\n" +
    "• If user asks 'tell me about xfi' or 'what is xfi' → call ONLY xfi_market_data with empty args {}, then PRESENT the actual market data in your response\n" +
    "• NEVER call get_user_stats after xfi_market_data - only call ONE tool per request\n" +
    "• If user says 'hello', 'hi', 'hey', or simple greetings → respond with greeting and all the things you can help the user with, NO tool calls needed\n" +
    "• If user says 'swap' or 'exchange' tokens → call ONLY execute_swap with proper parameters, then STOP\n" +
    "• NEVER generate fake payment link IDs - use the actual tool to create real links\n" +
    "• NEVER say 'payment link created' without calling the tool first\n" +
    "• NEVER put function calls in content - use tool_calls mechanism\n" +
    "• NEVER call multiple tools unless explicitly requested\n" +
    "• NEVER fetch balance after swaps unless user asks\n" +
    "• NEVER get quotes after swaps unless user asks\n" +
    "• NEVER get network stats unless user asks\n" +
    "• Present the tool result and END the conversation\n" +
    "• Be direct and concise",
  };

  try {
    console.log("🤖 Binding tools to LLM...");
    const llmWithTools = llm.bindTools(ALL_TOOLS_LIST);
    console.log("✅ Tools bound successfully");
    
    console.log("🚀 Invoking LLM with tools...");
    const result = await llmWithTools.invoke([systemMessage, ...messages]);
    console.log("📤 LLM Response:", JSON.stringify(result, null, 2));
    
    // Check if the response contains tool calls
    const resultMessages = Array.isArray(result) ? result : [result];
    const lastMessage = resultMessages[resultMessages.length - 1];
    
    // Simple logging for tool calls
    if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      console.log("🔧 Tool calls detected:", JSON.stringify(lastMessage.tool_calls, null, 2));
    } else {
      console.log("❌ No tool calls in response");
    }
    
    // If this is a response after tool execution (no tool calls), ensure it has content
    if (lastMessage && 'tool_calls' in lastMessage && (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)) {
      // Check if the message has content, if not, add a fallback
      if (!lastMessage.content || lastMessage.content.trim() === '') {
        console.log("⚠️ Empty AI response after tool execution - adding fallback");
        const fallbackMessage = {
          ...lastMessage,
          content: "Here's the information you requested. If you need more details, please ask a specific question."
        };
        return { messages: [fallbackMessage], userId };
      }
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

    // Simple error handling for tool use failures
    if (
      error.message?.includes("tool_use_failed") ||
      error.message?.includes("Failed to call a function")
    ) {
      console.log("Tool use failed - providing simple fallback response");
      
      const fallbackMessage = {
        role: "ai",
        content: `⚠️ Operation Issue

I encountered an issue while processing your request. Please try again or rephrase your request. If the problem persists, contact support.`,
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

  // MODIFIED: Allow one more AI response after tool execution to format the result
  const recentToolMessages = recentMessages.filter(msg => msg._getType() === "tool");
  const recentAIMessages = recentMessages.filter(msg => msg._getType() === "ai");
  
  // If we have tool messages and the last AI message has no tool calls, allow it to respond
  if (recentToolMessages.length > 0 && recentAIMessages.length > 0) {
    const lastAIMessage = recentAIMessages[recentAIMessages.length - 1] as AIMessage;
    if (!lastAIMessage.tool_calls || lastAIMessage.tool_calls.length === 0) {
      console.log("🛑 Tool executed and AI formatted response - stopping conversation (single-task mode)");
      return END;
    }
  }

  // Check for infinite loop patterns (fallback)
  const toolCallCounts: Record<string, number> = {};
  
  for (const msg of recentMessages) {
    if (msg._getType() === "ai" && (msg as AIMessage).tool_calls) {
      for (const toolCall of (msg as AIMessage).tool_calls) {
        const toolName = toolCall.name;
        toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
      }
    }
  }
  
  // If any tool has been called more than 2 times in recent messages, stop the loop
  for (const [toolName, count] of Object.entries(toolCallCounts)) {
    if (count > 2) {
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
