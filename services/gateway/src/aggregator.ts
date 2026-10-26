import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { db, UpstreamServer, User } from './db.js';

export interface AggregatedTool {
  name: string;
  originalName: string;
  serverSlug: string;
  serverName: string;
  description?: string;
  inputSchema: any;
}

export const ADMIN_ONLY_TOOLS = new Set([
  'woocommerce__create_product',
  'woocommerce__update_order_status',
]);

export function isToolAllowedForUser(toolName: string, user?: User): boolean {
  if (!user || user.role === 'admin') return true;
  return !ADMIN_ONLY_TOOLS.has(toolName);
}

export class McpAggregator {
  private clients = new Map<string, { client: Client; transport: SSEClientTransport }>();
  private toolCache = new Map<string, AggregatedTool[]>();
  private toolRouting = new Map<string, { serverId: string; originalToolName: string }>();

  async initialize() {
    await this.refreshAllServers();
    // Background health check & discovery loop every 30 seconds
    setInterval(() => {
      this.refreshAllServers().catch((err) => console.error('Error refreshing upstreams:', err));
    }, 30000);
  }

  async refreshAllServers() {
    const servers = db.getServers();
    for (const server of servers) {
      if (server.enabled) {
        await this.syncServer(server);
      } else {
        this.disconnectServer(server.id);
        this.toolCache.delete(server.id);
      }
    }
    this.rebuildRoutingMap();
  }

  async syncServer(server: UpstreamServer) {
    try {
      // Connect with 10-second timeout
      const client = await this.getOrConnectClient(server);
      const listPromise = client.listTools();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout listing tools (10s limit exceeded)')), 10000)
      );

      const result: any = await Promise.race([listPromise, timeoutPromise]);
      const rawTools = result?.tools || [];

      const namespacedTools: AggregatedTool[] = rawTools.map((t: any) => ({
        name: `${server.slug}__${t.name}`,
        originalName: t.name,
        serverSlug: server.slug,
        serverName: server.name,
        description: `[From ${server.name}] ${t.description || ''}`,
        inputSchema: t.inputSchema,
      }));

      this.toolCache.set(server.id, namespacedTools);
      db.updateServer(server.id, {
        status: 'connected',
        toolsCount: namespacedTools.length,
        lastError: undefined,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn(`Upstream server '${server.name}' unreachable: ${err.message}`);
      this.disconnectServer(server.id);
      this.toolCache.delete(server.id);

      db.updateServer(server.id, {
        status: 'unreachable',
        toolsCount: 0,
        lastError: err.message,
        lastCheckedAt: new Date().toISOString(),
      });
    }
  }

  private disconnectServer(serverId: string) {
    const entry = this.clients.get(serverId);
    if (entry) {
      try {
        entry.transport.close();
      } catch (_) {}
      this.clients.delete(serverId);
    }
  }

  private async getOrConnectClient(server: UpstreamServer): Promise<Client> {
    const existing = this.clients.get(server.id);
    if (existing) {
      return existing.client;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Team-MCP-Gateway/1.0',
    };

    if (server.authType === 'bearer' && server.authSecretToken) {
      headers['Authorization'] = `Bearer ${server.authSecretToken}`;
    } else if (server.authType === 'header' && server.authHeaderName && server.authSecretToken) {
      headers[server.authHeaderName] = server.authSecretToken;
    }

    const url = new URL(server.url);
    const transport = new SSEClientTransport(url, {
      requestInit: {
        headers,
      },
    });

    const client = new Client(
      {
        name: 'team-mcp-gateway-aggregator',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout to upstream (10s exceeded)')), 10000)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    this.clients.set(server.id, { client, transport });
    return client;
  }

  private rebuildRoutingMap() {
    this.toolRouting.clear();
    for (const [serverId, tools] of this.toolCache.entries()) {
      for (const t of tools) {
        this.toolRouting.set(t.name, {
          serverId,
          originalToolName: t.originalName,
        });
      }
    }
  }

  getAggregatedTools(user?: User): AggregatedTool[] {
    const tools: AggregatedTool[] = [];
    for (const list of this.toolCache.values()) {
      tools.push(...list);
    }

    // Built-in meta-tool: search and discover tools when many upstreams exist
    tools.push({
      name: 'gateway__search_tools',
      originalName: 'search_tools',
      serverSlug: 'gateway',
      serverName: 'Team MCP Gateway',
      description: '[From Gateway] Search available tools across all connected servers by keyword or intent when many tools exist.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keyword to search tool names and descriptions (e.g. order, currency, shipping, product)',
          },
        },
        required: ['query'],
      },
    });

    if (user && user.role !== 'admin') {
      return tools.filter((t) => isToolAllowedForUser(t.name, user));
    }

    return tools;
  }

  async executeTool(
    namespacedToolName: string,
    args: any,
    user: User,
    clientSource: 'chat_agent' | 'external_client'
  ): Promise<any> {
    const startTime = Date.now();

    // 1. Check meta-tool: gateway__search_tools
    if (namespacedToolName === 'gateway__search_tools') {
      const q = String(args?.query || '').toLowerCase();
      const allTools = this.getAggregatedTools(user).filter((t) => t.name !== 'gateway__search_tools');
      const matches = allTools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
      const durationMs = Date.now() - startTime;
      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: 'gateway',
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: true,
        clientSource,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query: q,
                matchedCount: matches.length,
                tools: matches.map((m) => ({
                  name: m.name,
                  server: m.serverName,
                  description: m.description,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // 2. Role-based permission enforcement (Admin vs Member)
    if (!isToolAllowedForUser(namespacedToolName, user)) {
      const durationMs = Date.now() - startTime;
      const deniedMsg = `Permission denied: Tool '${namespacedToolName}' requires admin privileges.`;
      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: 'gateway',
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: false,
        error: deniedMsg,
        clientSource,
      });
      throw new Error(deniedMsg);
    }

    const route = this.toolRouting.get(namespacedToolName);

    if (!route) {
      const durationMs = Date.now() - startTime;
      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: 'unknown',
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: false,
        error: `Tool '${namespacedToolName}' not found or upstream server is disabled/unreachable.`,
        clientSource,
      });
      throw new Error(`Tool '${namespacedToolName}' is not registered or currently unreachable.`);
    }

    const server = db.getServerById(route.serverId);
    if (!server || !server.enabled) {
      const durationMs = Date.now() - startTime;
      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: server?.name || 'unknown',
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: false,
        error: 'Upstream server is disabled.',
        clientSource,
      });
      throw new Error(`Upstream server '${server?.name}' is currently disabled.`);
    }

    try {
      const client = await this.getOrConnectClient(server);

      // Execute tool with 10-second timeout
      const callPromise = client.callTool({
        name: route.originalToolName,
        arguments: args,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after 10000ms on upstream '${server.name}'`)), 10000)
      );

      const result = await Promise.race([callPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: server.name,
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: true,
        clientSource,
      });

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      db.addAuditLog({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        serverName: server.name,
        toolName: namespacedToolName,
        params: args,
        durationMs,
        success: false,
        error: err.message,
        clientSource,
      });
      throw err;
    }
  }
}

export const aggregator = new McpAggregator();
