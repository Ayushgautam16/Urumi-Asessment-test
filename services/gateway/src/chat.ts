import axios from 'axios';
import { aggregator, AggregatedTool } from './aggregator.js';
import { db, User } from './db.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolExecutionRecord {
  tool: string;
  arguments: any;
  result: any;
  error?: string;
  durationMs: number;
}


export class ChatAgent {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  async runConversation(
    userMessage: string,
    history: ChatMessage[],
    user: User
  ): Promise<{ response: string; toolCalls: ToolExecutionRecord[] }> {
    const executedTools: ToolExecutionRecord[] = [];
    const availableTools = aggregator.getAggregatedTools();

    // If no Gemini key is provided, provide a graceful fallback simulator
    if (!this.apiKey) {
      return this.handleFallbackWithoutKey(userMessage, availableTools, user, executedTools);
    }

    try {
      return await this.runGeminiLoop(userMessage, history, availableTools, user, executedTools);
    } catch (err: any) {
      console.error('Gemini API call failed, falling back to local heuristic execution:', err.message);
      return this.handleFallbackWithoutKey(userMessage, availableTools, user, executedTools);
    }
  }

  private async runGeminiLoop(
    userMessage: string,
    history: ChatMessage[],
    availableTools: AggregatedTool[],
    user: User,
    executedTools: ToolExecutionRecord[]
  ): Promise<{ response: string; toolCalls: ToolExecutionRecord[] }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Convert MCP tools to Gemini function declarations
    // Gemini schema requires type to be uppercase or standard JSON schema without complex keywords
    const functionDeclarations = availableTools.map((t) => ({
      name: t.name.replace(/[^a-zA-Z0-9_]/g, '_'), // ensure valid identifier
      description: t.description || `Tool for ${t.name}`,
      parameters: this.sanitizeSchemaForGemini(t.inputSchema),
    }));

    // Map sanitized name back to actual namespaced name
    const sanitizedToActualName = new Map<string, string>();
    availableTools.forEach((t) => {
      const sanitized = t.name.replace(/[^a-zA-Z0-9_]/g, '_');
      sanitizedToActualName.set(sanitized, t.name);
    });

    const systemInstruction = {
      parts: [
        {
          text: `You are an intelligent store management and team operations assistant for a WooCommerce platform.
You have access to tools from connected MCP servers:
- WooCommerce tools: list products, create products, list orders, get order details, update status.
- Currency tools: exchange rates, currency conversion, price localization.
- Logistics tools: shipping calculations, parcel tracking, delivery estimation.

Current logged-in user: ${user.username} (Role: ${user.role}).
Always use the tools whenever the user requests actions like viewing products, creating items, checking orders, converting currency, or calculating shipping.
When formatting prices, mention both the original and converted amounts if relevant.`,
        },
      ],
    };

    // Format conversation history
    const contents: any[] = [];
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Tool calling multi-turn loop (max 4 turns)
    for (let turn = 0; turn < 4; turn++) {
      const requestBody: any = {
        contents,
        systemInstruction,
      };

      if (functionDeclarations.length > 0) {
        requestBody.tools = [{ functionDeclarations }];
      }

      const response = await axios.post(url, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      const candidate = response.data?.candidates?.[0];
      if (!candidate) {
        throw new Error('No candidate returned from Gemini API');
      }

      const modelParts = candidate.content?.parts || [];
      contents.push(candidate.content);

      // Check for function calls
      const functionCallPart = modelParts.find((p: any) => p.functionCall);

      if (!functionCallPart) {
        // Model provided final text answer
        const textParts = modelParts.filter((p: any) => p.text).map((p: any) => p.text).join('\n');
        return {
          response: textParts || 'Task completed successfully.',
          toolCalls: executedTools,
        };
      }

      // Execute function call
      const { name, args } = functionCallPart.functionCall;
      const actualToolName = sanitizedToActualName.get(name) || name;

      const startTime = Date.now();
      let toolResult: any;
      let toolError: string | undefined;

      try {
        toolResult = await aggregator.executeTool(actualToolName, args || {}, user, 'chat_agent');
      } catch (err: any) {
        toolError = err.message;
        toolResult = { error: err.message };
      }

      const durationMs = Date.now() - startTime;
      executedTools.push({
        tool: actualToolName,
        arguments: args,
        result: toolResult,
        error: toolError,
        durationMs,
      });

      // Provide function response back to model
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name,
              response: { content: toolResult },
            },
          },
        ],
      });
    }

    return {
      response: 'I executed the required actions but reached maximum conversational turns.',
      toolCalls: executedTools,
    };
  }

  private sanitizeSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return { type: 'OBJECT', properties: {} };
    }
    const copy = JSON.parse(JSON.stringify(schema));
    // Clean up unsupported keywords
    delete copy.$schema;
    delete copy.additionalProperties;
    return copy;
  }

  // Graceful heuristic engine for local development / testing without live LLM quota
  private async handleFallbackWithoutKey(
    userMessage: string,
    tools: AggregatedTool[],
    user: User,
    executedTools: ToolExecutionRecord[]
  ): Promise<{ response: string; toolCalls: ToolExecutionRecord[] }> {
    const lower = userMessage.toLowerCase();

    // 1. Create product pattern
    if (lower.includes('create') && lower.includes('product')) {
      const tool = tools.find((t) => t.name.includes('create_product'));
      if (tool) {
        const nameMatch = userMessage.match(/named? ['"]?([^'"]+)['"]?/i) || userMessage.match(/product (?:called |named )?([A-Za-z0-9 ]+?)(?: priced| with|\.|$)/i);
        const priceMatch = userMessage.match(/\$?([0-9]+(?:\.[0-9]{2})?)/);
        const name = nameMatch ? nameMatch[1].trim() : 'Studio Noise-Canceling Headphones';
        const price = priceMatch ? priceMatch[1] : '199';

        const startTime = Date.now();
        const result = await aggregator.executeTool(tool.name, { name, regular_price: price, stock_quantity: 25 }, user, 'chat_agent');
        executedTools.push({
          tool: tool.name,
          arguments: { name, regular_price: price, stock_quantity: 25 },
          result,
          durationMs: Date.now() - startTime,
        });

        return {
          response: `I've successfully created the product **${name}** priced at **$${price}** in your WooCommerce store! It is now published and live on the storefront.`,
          toolCalls: executedTools,
        };
      }
    }

    // 2. Orders list pattern
    if (lower.includes('order')) {
      const tool = tools.find((t) => t.name.includes('list_orders'));
      if (tool) {
        const startTime = Date.now();
        const result = await aggregator.executeTool(tool.name, { per_page: 10 }, user, 'chat_agent');
        executedTools.push({
          tool: tool.name,
          arguments: { per_page: 10 },
          result,
          durationMs: Date.now() - startTime,
        });

        const orders = JSON.parse(result.content[0].text);
        if (orders.length === 0) {
          return {
            response: `I checked the WooCommerce store and found no orders placed today yet.`,
            toolCalls: executedTools,
          };
        }






        const summary = orders.map((o: any) => `• **Order #${o.id}** (${o.status}) - Customer: ${o.customer_name}, Total: **$${o.total}** (${o.items_count} items)`).join('\n');
        return {
          response: `Here are the orders from the WooCommerce store:\n\n${summary}`,
          toolCalls: executedTools,
        };
      }
      
    }

    // 3. Products list pattern
    if (lower.includes('product') || lower.includes('catalog') || lower.includes('inventory')) {
      const tool = tools.find((t) => t.name.includes('list_products'));
      if (tool) {
        const startTime = Date.now();
        const result = await aggregator.executeTool(tool.name, {}, user, 'chat_agent');
        executedTools.push({
          tool: tool.name,
          arguments: {},
          result,
          durationMs: Date.now() - startTime,
        });
        const prods = JSON.parse(result.content[0].text);
        const summary = prods.map((p: any) => `• **${p.name}** - Price: **$${p.price || p.regular_price}** (Stock: ${p.stock_quantity ?? 'In Stock'})`).join('\n');
        return {
          response: `Here are the current products in your catalog:\n\n${summary}`,
          toolCalls: executedTools,
        };
      }
    }

    // 4. Currency conversion pattern
    if (lower.includes('convert') || lower.includes('eur') || lower.includes('currency')) {
      const tool = tools.find((t) => t.name.includes('convert_currency'));
      if (tool) {
        const amountMatch = userMessage.match(/([0-9]+(?:\.[0-9]{2})?)/);
        const amount = amountMatch ? Number(amountMatch[1]) : 199;
        const startTime = Date.now();
        const result = await aggregator.executeTool(tool.name, { amount, from: 'USD', to: 'EUR' }, user, 'chat_agent');
        executedTools.push({
          tool: tool.name,
          arguments: { amount, from: 'USD', to: 'EUR' },
          result,
          durationMs: Date.now() - startTime,
        });
        const data = JSON.parse(result.content[0].text);
        return {
          response: `**${amount} USD** converts to **${data.converted_amount} EUR** (Exchange rate: ${data.exchange_rate}).`,
          toolCalls: executedTools,
        };
      }
    }

    return {
      response: `I'm connected to the Team MCP Gateway! I have access to ${tools.length} tools across WooCommerce, Currency, and Logistics. You can ask me to create products, check orders, convert prices, or calculate shipping rates.`,
      toolCalls: executedTools,
    };
  }
}

export const chatAgent = new ChatAgent();
