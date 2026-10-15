import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { db, User } from './db.js';
import { aggregator } from './aggregator.js';
import { chatAgent } from './chat.js';
import { validateUpstreamUrl } from './ssrf.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

// Maintain active client-gateway SSE sessions
interface GatewaySession {
  transport: SSEServerTransport;
  user: User;
}
const gatewaySessions = new Map<string, GatewaySession>();

// Authenticate API key helper
function authenticateRequest(req: Request): { authenticated: boolean; user?: User; error?: string } {
  let token: string | undefined;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query.apiKey && typeof req.query.apiKey === 'string') {
    token = req.query.apiKey.trim();
  }

  if (!token) {
    return { authenticated: false, error: 'Missing API key. Provide "Authorization: Bearer <key>" or "?apiKey=<key>".' };
  }

  const result = db.validateApiKey(token);
  if (!result.valid || !result.user) {
    return { authenticated: false, error: 'Invalid or revoked API key.' };
  }

  return { authenticated: true, user: result.user };
}

// -------------------------------------------------------------
// MCP Gateway Endpoints (Streamable HTTP for External Clients)
// -------------------------------------------------------------

function createGatewayMcpServer(user: User): Server {
  const server = new Server(
    {
      name: 'urumi-team-mcp-gateway',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const aggregated = aggregator.getAggregatedTools();
    return {
      tools: aggregated.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await aggregator.executeTool(name, args || {}, user, 'external_client');
      return result;
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Gateway error calling '${name}': ${err.message}`,
          },
        ],
      };
    }
  });

  return server;
}

app.get('/mcp/sse', async (req: Request, res: Response) => {
  const auth = authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    res.status(401).json({ error: auth.error || 'Unauthorized' });
    return;
  }

  try {
    const transport = new SSEServerTransport('/mcp/messages', res);
    const mcpServer = createGatewayMcpServer(auth.user);
    const sessionId = transport.sessionId;

    gatewaySessions.set(sessionId, { transport, user: auth.user });

    transport.onclose = () => {
      gatewaySessions.delete(sessionId);
    };

    await mcpServer.connect(transport);
  } catch (err: any) {
    console.error('Error in Gateway /mcp/sse:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish MCP gateway SSE session' });
    }
  }
});

app.post('/mcp/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const session = gatewaySessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: `Session '${sessionId}' not found or closed.` });
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (err: any) {
    console.error(`Error in /mcp/messages for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing MCP message' });
    }
  }
});

// -------------------------------------------------------------
// Management REST API (For React Dashboard)
// -------------------------------------------------------------

// Health check for Kubernetes probes
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    gateway: 'urumi-team-mcp-gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Upstream Servers CRUD
app.get('/api/servers', (_req: Request, res: Response) => {
  // Strip sensitive credentials from client responses!
  const sanitized = db.getServers().map((s) => ({
    ...s,
    authSecretToken: s.authSecretToken ? '********' : undefined,
  }));
  res.json(sanitized);
});

app.post('/api/servers', async (req: Request, res: Response) => {
  const { name, slug, url, authType, authHeaderName, authSecretToken } = req.body;

  if (!name || !url) {
    res.status(400).json({ error: 'Server name and URL are required.' });
    return;
  }

  // SSRF Protection check
  const ssrf = validateUpstreamUrl(url);
  if (!ssrf.valid) {
    res.status(400).json({ error: `SSRF Guard Rejected: ${ssrf.reason}` });
    return;
  }

  const safeSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]/g, '_');

  const newServer = db.addServer({
    name,
    slug: safeSlug,
    url,
    authType: authType || 'none',
    authHeaderName,
    authSecretToken,
    status: 'connected',
    toolsCount: 0,
    enabled: true,
  });

  // Sync tools immediately
  await aggregator.syncServer(newServer);

  res.status(201).json({
    ...newServer,
    authSecretToken: newServer.authSecretToken ? '********' : undefined,
  });
});

app.put('/api/servers/:id', async (req: Request, res: Response) => {
  const serverId = String(req.params.id);
  const updates = req.body;

  if (updates.url) {
    const ssrf = validateUpstreamUrl(updates.url);
    if (!ssrf.valid) {
      res.status(400).json({ error: `SSRF Guard Rejected: ${ssrf.reason}` });
      return;
    }
  }

  try {
    const updated = db.updateServer(serverId, updates);
    if (updated.enabled) {
      await aggregator.syncServer(updated);
    }
    res.json({
      ...updated,
      authSecretToken: updated.authSecretToken ? '********' : undefined,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/servers/:id/toggle', async (req: Request, res: Response) => {
  const serverId = String(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  const updated = db.updateServer(serverId, {
    enabled: !server.enabled,
    status: !server.enabled ? 'connected' : 'disabled',
  });

  await aggregator.refreshAllServers();

  res.json({
    ...updated,
    authSecretToken: updated.authSecretToken ? '********' : undefined,
  });
});

app.delete('/api/servers/:id', async (req: Request, res: Response) => {
  const serverId = String(req.params.id);
  const success = db.deleteServer(serverId);
  if (!success) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }
  await aggregator.refreshAllServers();
  res.json({ message: 'Server removed successfully' });
});

// Tools Listing
app.get('/api/tools', (_req: Request, res: Response) => {
  const tools = aggregator.getAggregatedTools();
  res.json(tools);
});

// Users
app.get('/api/users', (_req: Request, res: Response) => {
  res.json(db.getUsers());
});

app.post('/api/users', (req: Request, res: Response) => {
  const { username, email, role } = req.body;
  if (!username || !email) {
    res.status(400).json({ error: 'Username and email are required' });
    return;
  }
  const user = db.addUser(username, email, role || 'member');
  res.status(201).json(user);
});

// API Keys
app.get('/api/keys', (req: Request, res: Response) => {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const keys = db.getApiKeys(userId).map((k) => ({
    id: k.id,
    userId: k.userId,
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt,
    revokedAt: k.revokedAt,
    lastUsedAt: k.lastUsedAt,
  }));
  res.json(keys);
});

app.post('/api/keys', (req: Request, res: Response) => {
  const { userId, name } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  try {
    const { key, apiKeyRecord } = db.createApiKey(userId, name || 'Gateway Key');
    res.status(201).json({
      apiKey: key, // Returned ONCE upon creation
      record: {
        id: apiKeyRecord.id,
        userId: apiKeyRecord.userId,
        name: apiKeyRecord.name,
        keyPrefix: apiKeyRecord.keyPrefix,
        createdAt: apiKeyRecord.createdAt,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/keys/:id', (req: Request, res: Response) => {
  const keyId = String(req.params.id);
  const revoked = db.revokeApiKey(keyId);
  if (!revoked) {
    res.status(404).json({ error: 'Key not found or already revoked' });
    return;
  }
  res.json({ message: 'API key revoked successfully' });
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const { userId, serverName, toolName, success, limit } = req.query;
  const logs = db.getAuditLogs({
    userId: userId ? String(userId) : undefined,
    serverName: serverName ? String(serverName) : undefined,
    toolName: toolName ? String(toolName) : undefined,
    success: success !== undefined ? String(success) === 'true' : undefined,
    limit: limit ? Number(limit) : 100,
  });
  res.json(logs);
});

// Chat Agent API
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history, userId } = req.body;
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const targetUserId = userId || 'usr-admin-a';
  const user = db.getUserById(targetUserId);
  if (!user) {
    res.status(404).json({ error: 'User context not found' });
    return;
  }

  try {
    const result = await chatAgent.runConversation(message, history || [], user);
    res.json(result);
  } catch (err: any) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Internal chat agent error' });
  }
});

// Initialize aggregator and start listening
aggregator.initialize().then(() => {
  app.listen(PORT, () => {
    console.log(`Team MCP Gateway running on port ${PORT}`);
    console.log(`MCP SSE endpoint: http://0.0.0.0:${PORT}/mcp/sse`);
    console.log(`REST API endpoint: http://0.0.0.0:${PORT}/api`);
  });
});
