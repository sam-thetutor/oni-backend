import { ToolNode } from "@langchain/langgraph/prebuilt";
import { Annotation, END, START, StateGraph, MessagesAnnotation, } from "@langchain/langgraph";
import { ALL_TOOLS_LIST, setCurrentUserFrontendWalletAddress } from "./tools.js";
import { createLLM, printCostInfo } from "./config/llm.js";
import { config } from "dotenv";
config();
printCostInfo();
const GraphAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    userId: Annotation(),
});
const llm = createLLM();
const toolNode = new ToolNode(ALL_TOOLS_LIST);
const callModel = async (state) => {
    const { messages, userId } = state;
    console.log("🔍 callModel invoked with userId:", userId);
    console.log("📨 Messages:", JSON.stringify(messages, null, 2));
    const systemMessage = {
        role: "system",
        content: "You are a CrossFi blockchain AI assistant. Execute ONLY the specific task requested.\n" +
            "🚨 CRITICAL: NEVER put function calls in your content - use tool_calls mechanism instead.\n" +
            "🚨 CRITICAL: NEVER generate fake responses in content - ALWAYS use tools for real operations.\n" +
            "🚨 CRITICAL: If you need to create, swap, or perform any action - use the appropriate tool.\n" +
            "🚨 CRITICAL: For payment links - if no amount specified, use create_global_payment_link with empty args {}. If amount specified, use create_payment_links with amount like '10 XFI'.\n" +
            "\n🔧 KEY TOOLS:\n" +
            "• get_balance - Get wallet balance\n" +
            "• execute_swap - Execute token swaps (USDC↔XFI, etc.)\n" +
            "• get_swap_quote - Get swap estimates\n" +
            "• send_transaction - Send XFI transactions\n" +
            "• If the user does not specify the amount when creating a payment link - create a global payment link by default\n" +
            "• create_global_payment_link - DEFAULT: Create global payment link for donations (use when no amount specified)\n" +
            "• create_payment_links - Create fixed payment link with specific amount (use only when amount is specified)\n" +
            "• get_user_stats - Get gamification stats\n" +
            "• get_crossfi_network_stats - Get network data\n" +
            "\n🔒 STRICT RULES:\n" +
            "• Execute ONLY the requested task - do NOT call additional tools\n" +
            "• If user says 'swap' → call ONLY execute_swap, then STOP\n" +
            "• If user asks for 'quote' → call ONLY get_swap_quote, then STOP\n" +
            "• If user asks for 'balance' → call ONLY get_balance, then STOP\n" +
            "• If user asks for 'network stats' → call ONLY get_crossfi_network_stats, then STOP\n" +
            "• If user asks for 'payment link' without amount → call ONLY create_global_payment_link with empty args {}, then STOP\n" +
            "• If user asks for 'global payment link' or 'donations' → call ONLY create_global_payment_link with empty args {}, then STOP\n" +
            "• If user asks for 'fixed payment link' with specific amount → call ONLY create_payment_links with amount like '10 XFI', then STOP\n" +
            "• If user asks for 'payment link for X XFI' → call ONLY create_payment_links with amount like 'X XFI', then STOP\n" +
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
        const resultMessages = Array.isArray(result) ? result : [result];
        const lastMessage = resultMessages[resultMessages.length - 1];
        if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            console.log("🔧 Tool calls detected:", JSON.stringify(lastMessage.tool_calls, null, 2));
        }
        else {
            console.log("❌ No tool calls in response");
        }
        return { messages: [lastMessage], userId };
    }
    catch (error) {
        console.error("❌ LLM Error:", error);
        console.error("❌ Error details:", JSON.stringify(error, null, 2));
        if (error.message?.includes("Rate limit") ||
            error.message?.includes("429") ||
            error.message?.includes("500648")) {
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
        if (error.message?.includes("tool_use_failed") ||
            error.message?.includes("Failed to call a function")) {
            console.log("Tool use failed - providing simple fallback response");
            const fallbackMessage = {
                role: "ai",
                content: `⚠️ Operation Issue

I encountered an issue while processing your request. Please try again or rephrase your request. If the problem persists, contact support.`,
            };
            return { messages: [fallbackMessage], userId };
        }
        throw error;
    }
};
const shouldContinue = (state) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    const messageCastAI = lastMessage;
    if (messageCastAI._getType() !== "ai" || !messageCastAI.tool_calls?.length) {
        return END;
    }
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
    const recentToolMessages = recentMessages.filter(msg => msg._getType() === "tool");
    if (recentToolMessages.length > 0) {
        console.log("🛑 Tool executed - stopping conversation (single-task mode)");
        return END;
    }
    const toolCallCounts = {};
    for (const msg of recentMessages) {
        if (msg._getType() === "ai" && msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
                const toolName = toolCall.name;
                toolCallCounts[toolName] = (toolCallCounts[toolName] || 0) + 1;
            }
        }
    }
    for (const [toolName, count] of Object.entries(toolCallCounts)) {
        if (count > 2) {
            console.log(`🛑 Stopping infinite loop: ${toolName} called ${count} times`);
            return END;
        }
    }
    return "tools";
};
const customToolNode = async (state) => {
    const { messages, userId } = state;
    console.log("customToolNode invoked with messages:", JSON.stringify(messages, null, 2), "userId:", userId);
    setCurrentUserFrontendWalletAddress(userId);
    const result = await toolNode.invoke(messages);
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
//# sourceMappingURL=index.js.map