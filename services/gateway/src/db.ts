import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UpstreamServer {
  id: string;
  name: string;
  slug: string;
  url: string;
  authType: 'none' | 'bearer' | 'header';
  authHeaderName?: string;
  authSecretToken?: string;
  status: 'connected' | 'unreachable' | 'disabled';
  lastError?: string;
  lastCheckedAt?: string;
  toolsCount: number;
  enabled: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  userRole: string;
  serverName: string;
  toolName: string;
  params: any;
  durationMs: number;
  success: boolean;
  error?: string;
  clientSource: 'chat_agent' | 'external_client';
}

interface DatabaseSchema {
  servers: UpstreamServer[];
  users: User[];
  apiKeys: ApiKey[];
  auditLogs: AuditLogEntry[];
}

export class Database {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(storageDir?: string) {
    const dir = storageDir || process.env.DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, 'gateway-data.json');
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, reinitializing:', err);
      }
    }

    const initialData: DatabaseSchema = {
      servers: [
        {
          id: 'srv-wc-1',
          name: 'WooCommerce Store MCP',
          slug: 'woocommerce',
          url: process.env.WC_MCP_URL || 'http://woocommerce-mcp.mcp-system.svc.cluster.local:8000/sse',
          authType: 'none',
          status: 'connected',
          toolsCount: 5,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-curr-2',
          name: 'Currency & Forex MCP',
          slug: 'currency',
          url: process.env.CURRENCY_MCP_URL || 'http://upstream-currency.mcp-system.svc.cluster.local:8001/sse',
          authType: 'none',
          status: 'connected',
          toolsCount: 3,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'srv-inv-3',
          name: 'Logistics & Shipping MCP',
          slug: 'inventory',
          url: process.env.INVENTORY_MCP_URL || 'http://upstream-inventory.mcp-system.svc.cluster.local:8002/sse',
          authType: 'none',
          status: 'connected',
          toolsCount: 3,
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ],
      users: [
        {
          id: 'usr-admin-a',
          username: 'User A (Admin)',
          email: 'admin@urumi.local',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-member-b',
          username: 'User B (Member)',
          email: 'member_b@urumi.local',
          role: 'member',
          createdAt: new Date().toISOString(),
        },
      ],
      apiKeys: [],
      auditLogs: [],
    };

    // Pre-seed API key for User B so external client works smoothly out of the box
    const demoKeyRaw = 'mcp_gw_member_b_test_token_2026';
    const demoKeyHashed = crypto.createHash('sha256').update(demoKeyRaw).digest('hex');
    initialData.apiKeys.push({
      id: 'key-demo-b',
      userId: 'usr-member-b',
      name: 'Default User B Key',
      keyPrefix: 'mcp_gw_member_b...',
      hashedKey: demoKeyHashed,
      createdAt: new Date().toISOString(),
    });

    this.saveDirect(initialData);
    return initialData;
  }

  private saveDirect(data: DatabaseSchema) {
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  private save() {
    this.saveDirect(this.data);
  }

  // --- Servers ---
  getServers(): UpstreamServer[] {
    return this.data.servers;
  }

  getServerById(id: string): UpstreamServer | undefined {
    return this.data.servers.find((s) => s.id === id);
  }

  addServer(server: Omit<UpstreamServer, 'id' | 'createdAt'>): UpstreamServer {
    const newServer: UpstreamServer = {
      ...server,
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.data.servers.push(newServer);
    this.save();
    return newServer;
  }

  updateServer(id: string, updates: Partial<UpstreamServer>): UpstreamServer {
    const idx = this.data.servers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Server with id '${id}' not found`);
    this.data.servers[idx] = { ...this.data.servers[idx], ...updates };
    this.save();
    return this.data.servers[idx];
  }

  deleteServer(id: string): boolean {
    const initialLen = this.data.servers.length;
    this.data.servers = this.data.servers.filter((s) => s.id !== id);
    if (this.data.servers.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Users ---
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  addUser(username: string, email: string, role: 'admin' | 'member'): User {
    const user: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      username,
      email,
      role,
      createdAt: new Date().toISOString(),
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  // --- API Keys ---
  createApiKey(userId: string, name: string): { key: string; apiKeyRecord: ApiKey } {
    const user = this.getUserById(userId);
    if (!user) throw new Error(`User with id '${userId}' not found`);

    const rawToken = `mcp_gw_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawToken).digest('hex');
    const keyPrefix = `${rawToken.substring(0, 10)}...`;

    const apiKeyRecord: ApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name,
      keyPrefix,
      hashedKey,
      createdAt: new Date().toISOString(),
    };

    this.data.apiKeys.push(apiKeyRecord);
    this.save();
    return { key: rawToken, apiKeyRecord };
  }

  getApiKeys(userId?: string): ApiKey[] {
    if (userId) {
      return this.data.apiKeys.filter((k) => k.userId === userId);
    }
    return this.data.apiKeys;
  }

  validateApiKey(token: string): { valid: boolean; user?: User; apiKey?: ApiKey } {
    if (!token) return { valid: false };
    const hashedKey = crypto.createHash('sha256').update(token).digest('hex');
    const key = this.data.apiKeys.find((k) => k.hashedKey === hashedKey);
    if (!key || key.revokedAt) {
      return { valid: false };
    }
    const user = this.getUserById(key.userId);
    if (!user) return { valid: false };

    key.lastUsedAt = new Date().toISOString();
    this.save();
    return { valid: true, user, apiKey: key };
  }

  revokeApiKey(id: string): boolean {
    const key = this.data.apiKeys.find((k) => k.id === id);
    if (key && !key.revokedAt) {
      key.revokedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  // --- Audit Logs ---
  addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const record: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    // Keep most recent 2000 logs in memory/storage
    this.data.auditLogs.unshift(record);
    if (this.data.auditLogs.length > 2000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 2000);
    }
    this.save();
    return record;
  }

  getAuditLogs(filters?: {
    userId?: string;
    serverName?: string;
    toolName?: string;
    success?: boolean;
    limit?: number;
  }): AuditLogEntry[] {
    let logs = this.data.auditLogs;
    if (filters?.userId) logs = logs.filter((l) => l.userId === filters.userId);
    if (filters?.serverName) logs = logs.filter((l) => l.serverName.toLowerCase().includes(filters.serverName!.toLowerCase()));
    if (filters?.toolName) logs = logs.filter((l) => l.toolName.toLowerCase().includes(filters.toolName!.toLowerCase()));
    if (filters?.success !== undefined) logs = logs.filter((l) => l.success === filters.success);
    const limit = filters?.limit || 100;
    return logs.slice(0, limit);
  }
}

export const db = new Database();
