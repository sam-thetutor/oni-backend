import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import toolSelectionService from "../services/toolSelection.js";
export class IntelligentTool extends StructuredTool {
    name = "intelligent_tool_selector";
    description = "Intelligently selects and executes the most appropriate tool based on user message and context. This tool analyzes the user's request and automatically chooses the best tool to handle it.";
    schema = z.object({
        userMessage: z.string().describe("The user's message or request"),
        context: z.string().optional().describe("Additional context about the user's request")
    });
    tools = new Map();
    constructor(toolsList = []) {
        super();
        this.initializeTools(toolsList);
    }
    initializeTools(toolsList) {
        toolsList.forEach(tool => {
            this.tools.set(tool.name, tool);
        });
    }
    async _call(input) {
        try {
            const { userMessage, context } = input;
            console.log(`🤖 Intelligent Tool Selection - Message: "${userMessage}"`);
            const selection = await toolSelectionService.selectTool(userMessage, context);
            console.log(`🎯 Selected Tool: ${selection.selectedTool} (Confidence: ${selection.confidence})`);
            console.log(`💭 Reasoning: ${selection.reasoning}`);
            if (selection.confidence < 0.3) {
                return `I'm not confident about which tool to use for your request: "${userMessage}". Could you please be more specific about what you'd like to do? For example:
- "Show my wallet balance"
- "Send 10 XFI to 0x123..."
- "Create a payment link for 50 XFI"
- "Show my transaction history"`;
            }
            const selectedTool = this.tools.get(selection.selectedTool);
            if (!selectedTool) {
                return `Sorry, I couldn't find the tool "${selection.selectedTool}" to handle your request. Please try rephrasing your request.`;
            }
            console.log(`⚡ Executing tool: ${selection.selectedTool} with parameters:`, selection.parameters);
            const result = await selectedTool._call(selection.parameters);
            return `✅ **Tool Executed**: ${selection.selectedTool}\n\n${result}`;
        }
        catch (error) {
            console.error("Intelligent tool selection error:", error);
            return `❌ **Error**: I encountered an issue while processing your request: "${input.userMessage}". Please try rephrasing your request or contact support if the problem persists.`;
        }
    }
}
//# sourceMappingURL=intelligentTool.js.map