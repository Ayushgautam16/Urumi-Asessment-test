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

const PORT = process.env.PORT || 8002;
const app = express();
app.use(cors());
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'logistics-shipping-mcp',
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
          name: 'calculate_shipping_rates',
          description: 'Calculate shipping costs and available transit tiers (Standard, Express, Priority) based on parcel weight and destination.',
          inputSchema: {
            type: 'object',
            required: ['weight_kg', 'destination_country'],
            properties: {
              weight_kg: {
                type: 'number',
                description: 'Parcel weight in kilograms.',
              },
              destination_country: {
                type: 'string',
                description: '2-letter country code (e.g. US, DE, GB, IN, CA).',
              },
              destination_city: {
                type: 'string',
                description: 'Destination city name.',
              },
            },
          },
        },
        {
          name: 'track_shipment',
          description: 'Lookup tracking information and transit checkpoints for a package by tracking number.',
          inputSchema: {
            type: 'object',
            required: ['tracking_number'],
            properties: {
              tracking_number: {
                type: 'string',
                description: 'Carrier tracking code (e.g. TRK-849201).',
              },
            },
          },
        },
        {
          name: 'estimate_delivery',
          description: 'Calculate estimated delivery date range based on origin, destination, and selected shipping tier.',
          inputSchema: {
            type: 'object',
            required: ['destination_country'],
            properties: {
              origin_country: {
                type: 'string',
                description: 'Dispatch origin country (default: US).',
              },
              destination_country: {
                type: 'string',
                description: 'Destination country code (e.g. US, FR, IN).',
              },
              tier: {
                type: 'string',
                enum: ['standard', 'express', 'priority'],
                description: 'Service level (default: standard).',
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
        case 'calculate_shipping_rates': {
          const weight = Math.max(0.1, Number(toolArgs.weight_kg) || 1.0);
          const country = String(toolArgs.destination_country || 'US').toUpperCase();
          const city = toolArgs.destination_city ? String(toolArgs.destination_city) : 'Metropolitan Area';

          const isDomestic = country === 'US';
          const baseRate = isDomestic ? 5.50 : 18.00;
          const perKgRate = isDomestic ? 2.50 : 7.20;

          const standardPrice = Math.round((baseRate + (weight * perKgRate)) * 100) / 100;
          const expressPrice = Math.round((standardPrice * 1.75) * 100) / 100;
          const priorityPrice = Math.round((standardPrice * 2.80) * 100) / 100;

          resultData = {
            destination: { country, city },
            weight_kg: weight,
            rates: [
              {
                tier: 'Standard Ground',
                carrier: 'DHL / USPS',
                price: standardPrice,
                currency: 'USD',
                estimated_days: isDomestic ? '3-5 business days' : '7-12 business days',
              },
              {
                tier: 'Express Air',
                carrier: 'FedEx Express',
                price: expressPrice,
                currency: 'USD',
                estimated_days: isDomestic ? '2 business days' : '3-5 business days',
              },
              {
                tier: 'Priority Overnight',
                carrier: 'UPS Priority',
                price: priorityPrice,
                currency: 'USD',
                estimated_days: isDomestic ? 'Next business day' : '1-2 business days',
              },
            ],
          };
          break;
        }

        case 'track_shipment': {
          const trk = String(toolArgs.tracking_number || 'TRK-DEFAULT');
          const now = new Date();
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

          resultData = {
            tracking_number: trk,
            carrier: 'Global Express Logistics',
            status: 'In Transit',
            origin: 'San Francisco, CA, US',
            destination: 'Customer Delivery Address',
            estimated_delivery: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
            checkpoints: [
              {
                time: yesterday.toISOString(),
                location: 'San Francisco Regional Sort Facility',
                status: 'Package departed origin fulfillment center',
              },
              {
                time: now.toISOString(),
                location: 'National Logistics Hub',
                status: 'Processed through sorting facility - on schedule',
              },
            ],
          };
          break;
        }

        case 'estimate_delivery': {
          const origin = String(toolArgs.origin_country || 'US').toUpperCase();
          const destination = String(toolArgs.destination_country || 'US').toUpperCase();
          const tier = String(toolArgs.tier || 'standard').toLowerCase();

          const isDomestic = origin === destination;
          let days = 4;
          if (tier === 'priority') days = isDomestic ? 1 : 2;
          else if (tier === 'express') days = isDomestic ? 2 : 4;
          else days = isDomestic ? 4 : 10;

          const estDate = new Date();
          estDate.setDate(estDate.getDate() + days);

          resultData = {
            origin,
            destination,
            service_tier: tier,
            transit_business_days: days,
            estimated_arrival_date: estDate.toISOString().split('T')[0],
            confidence: '95%',
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
            text: `Error executing logistics tool '${name}': ${err.message}`,
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
    service: 'logistics-shipping-mcp',
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
    console.error('Error in logistics /sse:', err);
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
    console.error(`Error in logistics /messages for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing message' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Logistics Shipping MCP Server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
});
