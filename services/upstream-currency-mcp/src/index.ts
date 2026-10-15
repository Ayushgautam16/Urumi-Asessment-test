import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

const PORT = process.env.PORT || 8001;
const app = express();
app.use(cors());
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

// Base reference rates pegged to USD
const RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 153.25,
  CAD: 1.38,
  INR: 84.10,
  AUD: 1.52,
  CHF: 0.88,
  CNY: 7.24,
  SGD: 1.32,
};

function convert(amount: number, from: string, to: string): { converted: number; rate: number } {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (!RATES_TO_USD[f]) throw new Error(`Unsupported source currency: ${from}`);
  if (!RATES_TO_USD[t]) throw new Error(`Unsupported target currency: ${to}`);

  // convert from -> USD -> to
  const amountInUsd = amount / RATES_TO_USD[f];
  const rate = RATES_TO_USD[t] / RATES_TO_USD[f];
  const converted = amountInUsd * RATES_TO_USD[t];
  return {
    converted: Math.round(converted * 100) / 100,
    rate: Math.round(rate * 10000) / 10000,
  };
}

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'currency-exchange-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'convert_currency',
          description: 'Convert any monetary amount between international currencies (USD, EUR, GBP, JPY, CAD, INR, AUD, CHF, CNY, SGD).',
          inputSchema: {
            type: 'object',
            required: ['amount', 'from', 'to'],
            properties: {
              amount: {
                type: 'number',
                description: 'The numeric amount to convert.',
              },
              from: {
                type: 'string',
                description: 'The 3-letter currency code to convert from (e.g. USD).',
              },
              to: {
                type: 'string',
                description: 'The 3-letter currency code to convert to (e.g. EUR, INR, GBP).',
              },
            },
          },
        },
        {
          name: 'get_exchange_rates',
          description: 'Get current exchange rates for a base currency against all major world currencies.',
          inputSchema: {
            type: 'object',
            properties: {
              base: {
                type: 'string',
                description: 'Base currency code (default: USD).',
              },
            },
          },
        },
        {
          name: 'format_price_localized',
          description: 'Format a numeric amount with standard localized currency symbols and formatting.',
          inputSchema: {
            type: 'object',
            required: ['amount', 'currency'],
            properties: {
              amount: {
                type: 'number',
                description: 'The monetary amount.',
              },
              currency: {
                type: 'string',
                description: 'The 3-letter currency code (e.g. EUR, USD, INR).',
              },
              locale: {
                type: 'string',
                description: 'Optional locale code (e.g. en-US, de-DE, en-GB).',
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      let resultData: any;

      switch (name) {
        case 'convert_currency': {
          const amount = Number(toolArgs.amount);
          const from = String(toolArgs.from || 'USD').toUpperCase();
          const to = String(toolArgs.to || 'EUR').toUpperCase();
          const { converted, rate } = convert(amount, from, to);
          resultData = {
            original_amount: amount,
            from,
            to,
            exchange_rate: rate,
            converted_amount: converted,
            formatted: `${converted} ${to}`,
            timestamp: new Date().toISOString(),
          };
          break;
        }

        case 'get_exchange_rates': {
          const base = String(toolArgs.base || 'USD').toUpperCase();
          if (!RATES_TO_USD[base]) {
            throw new Error(`Unsupported base currency: ${base}`);
          }
          const rates: Record<string, number> = {};
          const baseToUsd = RATES_TO_USD[base];
          for (const [cur, val] of Object.entries(RATES_TO_USD)) {
            rates[cur] = Math.round((val / baseToUsd) * 10000) / 10000;
          }
          resultData = {
            base,
            date: new Date().toISOString().split('T')[0],
            rates,
          };
          break;
        }

        case 'format_price_localized': {
          const amount = Number(toolArgs.amount);
          const currency = String(toolArgs.currency || 'USD').toUpperCase();
          const locale = toolArgs.locale ? String(toolArgs.locale) : 'en-US';
          const formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
          }).format(amount);
          resultData = {
            amount,
            currency,
            locale,
            formatted,
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(resultData, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing currency tool '${name}': ${err.message}`,
          },
        ],
      };
    }
  });

  return server;
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'currency-exchange-mcp',
    time: new Date().toISOString(),
  });
});

app.get('/sse', async (_req: Request, res: Response) => {
  try {
    const transport = new SSEServerTransport('/messages', res);
    const server = createMcpServer();
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    transport.onclose = () => {
      transports.delete(sessionId);
    };

    await server.connect(transport);
  } catch (err: any) {
    console.error('Error in currency /sse:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: `Session '${sessionId}' not found` });
    return;
  }
  try {
    await transport.handlePostMessage(req, res);
  } catch (err: any) {
    console.error(`Error in currency /messages for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing message' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Currency MCP Server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
});
