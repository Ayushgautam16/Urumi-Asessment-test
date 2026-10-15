import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WooCommerceClient } from './wc-client.js';

dotenv.config();

const PORT = process.env.PORT || 8000;
const WC_URL = process.env.WC_URL || 'http://woocommerce-store.mcp-system.svc.cluster.local';
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY || '';
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || '';

const wcClient = new WooCommerceClient({
  baseUrl: WC_URL,
  consumerKey: WC_CONSUMER_KEY,
  consumerSecret: WC_CONSUMER_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());

// Maintain active transports mapped by sessionId
const transports = new Map<string, SSEServerTransport>();

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'woocommerce-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_products',
          description: 'List products from WooCommerce store with optional filtering by status, search keyword, and pagination.',
          inputSchema: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search string to filter products by title or description.',
              },
              per_page: {
                type: 'number',
                description: 'Number of products to return (default: 10, max: 100).',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (default: 1).',
              },
              status: {
                type: 'string',
                enum: ['any', 'draft', 'pending', 'private', 'publish'],
                description: 'Filter products by publication status (default: publish).',
              },
            },
          },
        },
        {
          name: 'create_product',
          description: 'Create a new product in the WooCommerce catalog.',
          inputSchema: {
            type: 'object',
            required: ['name', 'regular_price'],
            properties: {
              name: {
                type: 'string',
                description: 'Product name/title.',
              },
              regular_price: {
                type: 'string',
                description: 'Product price as a decimal string (e.g. "49.99" or "199").',
              },
              description: {
                type: 'string',
                description: 'Detailed product description.',
              },
              short_description: {
                type: 'string',
                description: 'Brief product summary.',
              },
              stock_quantity: {
                type: 'number',
                description: 'Initial stock inventory count.',
              },
              status: {
                type: 'string',
                enum: ['publish', 'draft', 'pending'],
                description: 'Product status (default: publish).',
              },
            },
          },
        },
        {
          name: 'list_orders',
          description: 'List orders placed in the WooCommerce store with optional status and date filters.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'],
                description: 'Filter by order status (default: any).',
              },
              per_page: {
                type: 'number',
                description: 'Number of orders to retrieve (default: 10).',
              },
              page: {
                type: 'number',
                description: 'Page number (default: 1).',
              },
              after: {
                type: 'string',
                description: 'ISO-8601 date string to filter orders created after this date (e.g. 2026-10-15T00:00:00Z).',
              },
              before: {
                type: 'string',
                description: 'ISO-8601 date string to filter orders created before this date.',
              },
            },
          },
        },
        {
          name: 'get_order',
          description: 'Get complete details of a specific WooCommerce order by ID, including customer, address, payment, and line items.',
          inputSchema: {
            type: 'object',
            required: ['order_id'],
            properties: {
              order_id: {
                type: ['number', 'string'],
                description: 'The unique numeric ID of the WooCommerce order.',
              },
            },
          },
        },
        {
          name: 'update_order_status',
          description: 'Update the processing status of an existing WooCommerce order.',
          inputSchema: {
            type: 'object',
            required: ['order_id', 'status'],
            properties: {
              order_id: {
                type: ['number', 'string'],
                description: 'The order ID to update.',
              },
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'],
                description: 'The new order status.',
              },
            },
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = args || {};

    try {
      let resultData: any;

      switch (name) {
        case 'list_products': {
          resultData = await wcClient.listProducts({
            search: toolArgs.search as string | undefined,
            per_page: toolArgs.per_page ? Number(toolArgs.per_page) : 10,
            page: toolArgs.page ? Number(toolArgs.page) : 1,
            status: (toolArgs.status as string) || 'publish',
          });
          break;
        }

        case 'create_product': {
          if (!toolArgs.name || toolArgs.regular_price === undefined) {
            throw new Error('create_product requires "name" and "regular_price".');
          }
          resultData = await wcClient.createProduct({
            name: String(toolArgs.name),
            regular_price: String(toolArgs.regular_price),
            description: toolArgs.description ? String(toolArgs.description) : undefined,
            short_description: toolArgs.short_description ? String(toolArgs.short_description) : undefined,
            stock_quantity: toolArgs.stock_quantity !== undefined ? Number(toolArgs.stock_quantity) : undefined,
            status: (toolArgs.status as string) || 'publish',
          });
          break;
        }

        case 'list_orders': {
          resultData = await wcClient.listOrders({
            status: toolArgs.status ? String(toolArgs.status) : undefined,
            per_page: toolArgs.per_page ? Number(toolArgs.per_page) : 10,
            page: toolArgs.page ? Number(toolArgs.page) : 1,
            after: toolArgs.after ? String(toolArgs.after) : undefined,
            before: toolArgs.before ? String(toolArgs.before) : undefined,
          });
          break;
        }

        case 'get_order': {
          if (!toolArgs.order_id) {
            throw new Error('get_order requires "order_id".');
          }
          resultData = await wcClient.getOrder(toolArgs.order_id as string | number);
          break;
        }

        case 'update_order_status': {
          if (!toolArgs.order_id || !toolArgs.status) {
            throw new Error('update_order_status requires "order_id" and "status".');
          }
          resultData = await wcClient.updateOrderStatus(
            toolArgs.order_id as string | number,
            String(toolArgs.status)
          );
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
            text: `Error executing tool '${name}': ${err.message}`,
          },
        ],
      };
    }
  });

  return server;
}

// Health check endpoint for Kubernetes liveness & readiness probes
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'woocommerce-mcp-server',
    time: new Date().toISOString(),
  });
});

// SSE endpoint (Streamable HTTP)
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
    console.error('Error in /sse transport connection:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE stream' });
    }
  }
});

// Messages POST endpoint (Client to Server JSON-RPC)
app.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: `Session '${sessionId}' not found or closed` });
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err: any) {
    console.error(`Error handling post message for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing message' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`WooCommerce MCP Server listening on port ${PORT}`);
  console.log(`Streamable HTTP SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.log(`Target WooCommerce URL: ${WC_URL}`);
});
