import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { config } from 'dotenv';

config();

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  examples: string[];
}

interface ToolSelectionResult {
  selectedTool: string;
  confidence: number;
  parameters: Record<string, any>;
  reasoning: string;
}

interface GroqToolSelectionResponse {
  selectedTool: string;
  confidence: number;
  parameters: Record<string, any>;
  reasoning: string;
}

class ToolSelectionService {
  private groq: ChatGroq;
  private tools: ToolDefinition[] = [
    {
      name: "get_balance",
      description: "Get the current balance of XFI tokens in the user's wallet",
      parameters: [],
      examples: [
        "What's my balance?",
        "Show me my wallet balance",
        "How much XFI do I have?",
        "Check my token holdings",
        "What's my XFI balance?"
      ]
    },
    {
      name: "get_wallet_info",
      description: "Get the user's wallet address and basic wallet information",
      parameters: [],
      examples: [
        "Show my wallet address",
        "What's my wallet address?",
        "Display my wallet info",
        "Show my wallet details",
        "What's my address?"
      ]
    },
    {
      name: "send_transaction",
      description: "Send XFI tokens to another wallet address",
      parameters: [
        { name: "amount", type: "number", required: true, description: "Amount of XFI to send" },
        { name: "to", type: "string", required: true, description: "Destination wallet address" }
      ],
      examples: [
        "Send 10 XFI to 0x123...",
        "Transfer 5 XFI to wallet address",
        "Send tokens to this address",
        "Send XFI to 0xabc..."
      ]
    },
    {
      name: "get_transaction_history",
      description: "Get a list of recent transactions for the user's wallet",
      parameters: [
        { name: "limit", type: "number", required: false, description: "Number of transactions to return (default: 10)" }
      ],
      examples: [
        "Show my transaction history",
        "Get my recent transactions",
        "Display transaction history",
        "Show my wallet transactions",
        "What are my recent transactions?"
      ]
    },
    {
      name: "get_wallet_summary",
      description: "Get a comprehensive summary of the user's wallet including balances, transaction history, and statistics",
      parameters: [],
      examples: [
        "Show my wallet summary",
        "Give me a wallet overview",
        "Display wallet statistics",
        "Show my wallet stats",
        "Wallet summary"
      ]
    },
    {
      name: "create_payment_link",
      description: "Create a payment link for receiving payments. Supports fixed amounts and flexible amounts (global links)",
      parameters: [
        { name: "type", type: "string", required: true, description: "Type of payment link: 'fixed' or 'global'" },
        { name: "amount", type: "number", required: false, description: "Amount for fixed payment links" },
        { name: "title", type: "string", required: false, description: "Title for the payment link" },
        { name: "description", type: "string", required: false, description: "Description for the payment link" }
      ],
      examples: [
        "Create a payment link for 50 XFI",
        "Make a global payment link for donations",
        "Create a fixed payment link",
        "Set up a payment link for 100 XFI",
        "Create payment link"
      ]
    },
    {
      name: "get_payment_link",
      description: "Get information about a payment link including status, amount, and payment history",
      parameters: [
        { name: "linkId", type: "string", required: false, description: "Specific payment link ID to check" }
      ],
      examples: [
        "Show my payment links",
        "Check payment link status",
        "Get payment link info",
        "Show payment link details",
        "Payment link status"
      ]
    },
    {
      name: "get_user_payment_links",
      description: "Get all payment links created by a user",
      parameters: [],
      examples: [
        "Show all my payment links",
        "List my payment links",
        "Get my payment links",
        "Display all payment links",
        "My payment links"
      ]
    },
    {
      name: "get_payment_link_stats",
      description: "Get statistics about a user's payment links including totals and summaries",
      parameters: [],
      examples: [
        "Show payment link statistics",
        "Get payment link stats",
        "Payment link summary",
        "Show payment link analytics",
        "Payment link stats"
      ]
    },
    {
      name: "swap_tokens",
      description: "Swap tokens using the CrossFi swap functionality",
      parameters: [
        { name: "fromToken", type: "string", required: true, description: "Token to swap from (e.g., 'XFI', 'USDC')" },
        { name: "toToken", type: "string", required: true, description: "Token to swap to (e.g., 'XFI', 'USDC')" },
        { name: "amount", type: "number", required: true, description: "Amount to swap" }
      ],
      examples: [
        "Swap 10 XFI to USDC",
        "Convert XFI to USDC",
        "Swap tokens",
        "Exchange XFI for USDC",
        "Swap 5 USDC to XFI"
      ]
    },
    {
      name: "get_token_price",
      description: "Get the current price of a specific token",
      parameters: [
        { name: "token", type: "string", required: true, description: "Token symbol (e.g., 'XFI', 'USDC')" }
      ],
      examples: [
        "What's the price of XFI?",
        "Get XFI price",
        "Show USDC price",
        "Token price",
        "Price of XFI"
      ]
    },
    {
      name: "create_dca_order",
      description: "Create a Dollar Cost Averaging (DCA) order for automated token purchases",
      parameters: [
        { name: "fromToken", type: "string", required: true, description: "Token to spend (e.g., 'XFI')" },
        { name: "toToken", type: "string", required: true, description: "Token to buy (e.g., 'USDC')" },
        { name: "amount", type: "number", required: true, description: "Amount to spend per order" },
        { name: "triggerPrice", type: "number", required: true, description: "Price trigger for the order" },
        { name: "triggerType", type: "string", required: true, description: "Trigger type: 'above' or 'below'" }
      ],
      examples: [
        "Create DCA order",
        "Set up automated buying",
        "Create recurring order",
        "DCA order for XFI",
        "Automated token purchase"
      ]
    },
    {
      name: "get_dca_orders",
      description: "Get all DCA orders for the user",
      parameters: [],
      examples: [
        "Show my DCA orders",
        "Get DCA orders",
        "List DCA orders",
        "My automated orders",
        "DCA orders"
      ]
    }
  ];

  constructor() {
    this.groq = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.1,
      maxTokens: 500
    });
  }

  async selectTool(userMessage: string, context?: any): Promise<ToolSelectionResult> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(userMessage, context);

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ];

      const response = await this.groq.invoke(messages);

      const content = response.content;
      if (!content || typeof content !== 'string') {
        throw new Error("No response from Groq");
      }

      // Parse the JSON response
      const parsedResponse = this.parseGroqResponse(content);
      
      // Validate the selected tool exists
      const toolExists = this.tools.find(tool => tool.name === parsedResponse.selectedTool);
      if (!toolExists) {
        throw new Error(`Selected tool '${parsedResponse.selectedTool}' not found`);
      }

      return {
        selectedTool: parsedResponse.selectedTool,
        confidence: parsedResponse.confidence,
        parameters: parsedResponse.parameters || {},
        reasoning: parsedResponse.reasoning
      };

    } catch (error) {
      console.error("Groq tool selection error:", error);
      
      // Fallback to simple keyword matching
      return this.fallbackToolSelection(userMessage);
    }
  }

  private buildSystemPrompt(): string {
    const toolsDescription = this.tools.map(tool => {
      const params = tool.parameters.length > 0 
        ? `\n  Parameters: ${tool.parameters.map(p => `${p.name} (${p.type}${p.required ? ', required' : ''})`).join(', ')}`
        : '\n  Parameters: None';
      
      const examples = tool.examples.length > 0 
        ? `\n  Examples: ${tool.examples.join(', ')}`
        : '';

      return `- ${tool.name}: ${tool.description}${params}${examples}`;
    }).join('\n');

    return `You are a tool selection assistant for the CrossFi DeFi platform. Your job is to analyze user messages and select the most appropriate tool to handle their request.

Available tools:
${toolsDescription}

Instructions:
1. Analyze the user's message carefully
2. Select the most appropriate tool from the list above
3. Extract any relevant parameters from the message
4. Provide a confidence score (0.0 to 1.0)
5. Explain your reasoning

Response format (JSON only):
{
  "selectedTool": "tool_name",
  "confidence": 0.95,
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "reasoning": "Brief explanation of why this tool was selected"
}

Important:
- Only return valid JSON
- Use exact tool names from the list
- Set confidence to 0.0 if no tool matches
- Extract parameters only if they're clearly mentioned in the message
- Be conservative with parameter extraction - only include what's explicitly stated
- Consider the context of CrossFi DeFi operations`;
  }

  private buildUserPrompt(userMessage: string, context?: any): string {
    let prompt = `User message: "${userMessage}"`;

    if (context) {
      prompt += `\n\nContext: ${JSON.stringify(context)}`;
    }

    prompt += `\n\nPlease select the appropriate tool and respond with JSON only.`;
    return prompt;
  }

  private parseGroqResponse(content: string): GroqToolSelectionResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.selectedTool || typeof parsed.selectedTool !== 'string') {
        throw new Error("Invalid selectedTool in response");
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error("Invalid confidence score in response");
      }

      return {
        selectedTool: parsed.selectedTool,
        confidence: parsed.confidence,
        parameters: parsed.parameters || {},
        reasoning: parsed.reasoning || "No reasoning provided"
      };

    } catch (error) {
      console.error("Failed to parse Groq response:", error);
      throw new Error(`Failed to parse Groq response: ${error}`);
    }
  }

  private fallbackToolSelection(userMessage: string): ToolSelectionResult {
    const lowerMessage = userMessage.toLowerCase();
    
    // Simple keyword matching as fallback
    if (lowerMessage.includes('balance') || lowerMessage.includes('xfi')) {
      return {
        selectedTool: "get_balance",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected balance/XFI keywords"
      };
    }
    
    if (lowerMessage.includes('wallet') && lowerMessage.includes('info')) {
      return {
        selectedTool: "get_wallet_info",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected wallet info keywords"
      };
    }
    
    if (lowerMessage.includes('send') && lowerMessage.includes('xfi')) {
      return {
        selectedTool: "send_transaction",
        confidence: 0.6,
        parameters: {},
        reasoning: "Fallback: Detected send XFI keywords"
      };
    }
    
    if (lowerMessage.includes('transaction') && lowerMessage.includes('history')) {
      return {
        selectedTool: "get_transaction_history",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected transaction history keywords"
      };
    }
    
    if (lowerMessage.includes('summary') || lowerMessage.includes('overview')) {
      return {
        selectedTool: "get_wallet_summary",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected summary/overview keywords"
      };
    }
    
    if (lowerMessage.includes('create') && lowerMessage.includes('payment link')) {
      return {
        selectedTool: "create_payment_link",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected create payment link keywords"
      };
    }
    
    if (lowerMessage.includes('payment link') && lowerMessage.includes('stats')) {
      return {
        selectedTool: "get_payment_link_stats",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected payment link stats keywords"
      };
    }
    
    if (lowerMessage.includes('payment link')) {
      return {
        selectedTool: "get_payment_link",
        confidence: 0.6,
        parameters: {},
        reasoning: "Fallback: Detected payment link keywords"
      };
    }

    if (lowerMessage.includes('swap') || lowerMessage.includes('exchange')) {
      return {
        selectedTool: "swap_tokens",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected swap/exchange keywords"
      };
    }

    if (lowerMessage.includes('price')) {
      return {
        selectedTool: "get_token_price",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected price keywords"
      };
    }

    if (lowerMessage.includes('dca') || lowerMessage.includes('automated')) {
      return {
        selectedTool: "create_dca_order",
        confidence: 0.7,
        parameters: {},
        reasoning: "Fallback: Detected DCA/automated keywords"
      };
    }

    // Default response
    return {
      selectedTool: "get_balance",
      confidence: 0.0,
      parameters: {},
      reasoning: "Fallback: No specific tool detected, defaulting to balance check"
    };
  }

  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.tools.find(tool => tool.name === toolName);
  }

  getAllTools(): ToolDefinition[] {
    return this.tools;
  }
}

export default new ToolSelectionService(); 