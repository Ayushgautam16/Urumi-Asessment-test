import React, { useState, useEffect } from 'react';
import {
  Server,
  Wrench,
  Key,
  FileText,
  MessageSquare,
  ExternalLink,
  Shield,
  Plus,
  Trash2,
  Power,
  RefreshCw,
  Copy,
  Check,
  Send,
  AlertTriangle,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';

interface UpstreamServer {
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

interface Tool {
  name: string;
  originalName: string;
  serverSlug: string;
  serverName: string;
  description?: string;
  inputSchema: any;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'member';
}

interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

interface AuditLog {
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    tool: string;
    arguments: any;
    result: any;
    durationMs: number;
  }>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'servers' | 'tools' | 'keys' | 'audit' | 'chat'>('servers');
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Active simulated logged-in user
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-admin-a',
    username: 'User A (Admin)',
    email: 'admin@urumi.local',
    role: 'admin',
  });

  // Modal states
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerAuthType, setNewServerAuthType] = useState<'none' | 'bearer' | 'header'>('none');
  const [newServerToken, setNewServerToken] = useState('');
  const [serverError, setServerError] = useState('');

  // Key creation modal
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Payload viewer modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your Team MCP Assistant. I can interact directly with your WooCommerce store, currency exchange, and shipping tools. Try asking: "Create a product named Studio Headphones priced at $199" or "What orders came in today?"',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  // Data fetching
  const fetchData = async () => {
    try {
      const [sRes, tRes, uRes, kRes, aRes] = await Promise.all([
        fetch('/api/servers').then((r) => r.json()).catch(() => []),
        fetch('/api/tools').then((r) => r.json()).catch(() => []),
        fetch('/api/users').then((r) => r.json()).catch(() => []),
        fetch('/api/keys').then((r) => r.json()).catch(() => []),
        fetch('/api/audit-logs').then((r) => r.json()).catch(() => []),
      ]);
      setServers(Array.isArray(sRes) ? sRes : []);
      setTools(Array.isArray(tRes) ? tRes : []);
      setUsers(Array.isArray(uRes) ? uRes : []);
      setKeys(Array.isArray(kRes) ? kRes : []);
      setAuditLogs(Array.isArray(aRes) ? aRes : []);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Server actions
  const handleToggleServer = async (id: string) => {
    await fetch(`/api/servers/${id}/toggle`, { method: 'POST' });
    fetchData();
  };

  const handleDeleteServer = async (id: string) => {
    if (confirm('Are you sure you want to remove this upstream server?')) {
      await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServerName,
          url: newServerUrl,
          authType: newServerAuthType,
          authSecretToken: newServerToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Failed to add server');
        return;
      }
      setIsAddServerOpen(false);
      setNewServerName('');
      setNewServerUrl('');
      setNewServerToken('');
      fetchData();
    } catch (err: any) {
      setServerError(err.message);
    }
  };

  // API Key actions
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: keyName || `${currentUser.username} Key`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedKey(data.apiKey);
        setKeyName('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (confirm('Revoke this key immediately? External clients using it will be rejected.')) {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  // Chat action
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatSending) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: chatInput,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatSending(true);

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history,
          userId: currentUser.id,
        }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.response || 'No response from agent.',
        toolCalls: data.toolCalls,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      fetchData(); // Refresh audit logs immediately
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Error invoking agent: ${err.message}`,
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(18, 24, 38, 0.85)',
          backdropFilter: 'blur(16px)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
            }}
          >
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.01em' }}>Team MCP Gateway</h1>
              <span className="badge badge-connected">Kubernetes Live</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>WooCommerce Store & Unified Upstream Tooling</p>
          </div>
        </div>

        {/* User Context & External Store Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <UserIcon size={14} color="#94a3b8" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Identity:</span>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const found = users.find((u) => u.id === e.target.value);
                if (found) setCurrentUser(found);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#121826', color: '#fff' }}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <a
            href="http://woo.local.test"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12.5px', padding: '7px 12px' }}
          >
            <span>Storefront</span>
            <ExternalLink size={13} />
          </a>
          <a
            href="http://woo.local.test/wp-admin"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12.5px', padding: '7px 12px' }}
          >
            <span>WP Admin</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Main Content & Navigation Tabs */}
      <div style={{ maxWidth: '1380px', width: '100%', margin: '0 auto', padding: '24px 20px', flex: 1 }}>
        {/* Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Active Upstreams</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800 }}>
                {servers.filter((s) => s.enabled && s.status === 'connected').length} / {servers.length}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--success)' }}>Operational</span>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Aggregated Tools</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800 }}>{tools.length}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ready across cluster</span>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Tool Calls Logged</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800 }}>{auditLogs.length}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In audit store</span>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Gateway MCP Endpoint</span>
            <div style={{ marginTop: '8px' }}>
              <code style={{ fontSize: '11px', color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                /mcp/sse
              </code>
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('servers')}
            className={`btn ${activeTab === 'servers' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Server size={15} />
            <span>MCP Servers ({servers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`btn ${activeTab === 'tools' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Wrench size={15} />
            <span>Tools Explorer ({tools.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <MessageSquare size={15} />
            <span>AI Chat Agent</span>
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`btn ${activeTab === 'keys' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Key size={15} />
            <span>API Keys & Team</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <FileText size={15} />
            <span>Audit Log ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab: Servers Management */}
        {activeTab === 'servers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Upstream MCP Servers</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  All servers registered below are aggregated into a single gateway MCP endpoint. Upstream credentials are held securely in the cluster.
                </p>
              </div>
              <button onClick={() => setIsAddServerOpen(true)} className="btn btn-primary">
                <Plus size={16} />
                <span>Add MCP Server</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              {servers.map((s) => (
                <div key={s.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{s.name}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          Prefix: {s.slug}__*
                        </span>
                      </div>
                      <span className={`badge badge-${s.status}`}>
                        <span className={`pulse-dot ${s.status === 'connected' ? 'green' : s.status === 'disabled' ? 'yellow' : 'red'}`} />
                        {s.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>Streamable HTTP URL</span>
                      <code style={{ fontSize: '12px', color: '#cbd5e1', wordBreak: 'break-all' }}>{s.url}</code>
                    </div>

                    {s.lastError && (
                      <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={14} color="#f87171" />
                        <span style={{ fontSize: '12px', color: '#f87171' }}>{s.lastError}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      <div>
                        <span style={{ color: 'var(--text-dim)' }}>Tools: </span>
                        <strong>{s.toolsCount}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-dim)' }}>Auth: </span>
                        <strong>{s.authType}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                    <button
                      onClick={() => handleToggleServer(s.id)}
                      className={`btn ${s.enabled ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ flex: 1, fontSize: '12.5px' }}
                    >
                      <Power size={13} />
                      <span>{s.enabled ? 'Disable' : 'Enable'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteServer(s.id)}
                      className="btn btn-danger"
                      style={{ fontSize: '12.5px', padding: '7px 10px' }}
                      title="Remove Server"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Tools Explorer */}
        {activeTab === 'tools' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Aggregated Tools Explorer</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                These {tools.length} tools are currently unified and reachable via the gateway. Tool collision scheme: <code>&lt;server_slug&gt;__&lt;tool_name&gt;</code>.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
              {tools.map((t) => (
                <div key={t.name} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t.serverName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {t.originalName}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8', marginBottom: '8px' }}>
                    {t.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
                    {t.description?.replace(/\[From [^\]]+\]\s*/, '')}
                  </p>

                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Input Parameters</span>
                    <pre style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#a5b4fc', overflowX: 'auto', maxHeight: '140px' }}>
                      {JSON.stringify(t.inputSchema?.properties || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Chat Agent */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '680px' }} className="glass-panel">
            {/* Chat header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} color="#818cf8" />
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>In-Dashboard AI Chat Agent</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Acting as: <strong>{currentUser.username}</strong> ({currentUser.role})
                  </span>
                </div>
              </div>
              <span className="badge badge-connected">Google Gemini + Tool Loop</span>
            </div>

            {/* Chat Message List */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                  }}
                >
                  <div
                    style={{
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' : 'rgba(255, 255, 255, 0.05)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13.5px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Render executed tool calls if present */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {msg.toolCalls.map((tc, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '11.5px',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#818cf8', fontWeight: 600 }}>
                            <span>Invoked: {tc.tool}</span>
                            <span>{tc.durationMs}ms</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Args: {JSON.stringify(tc.arguments)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isChatSending && (
                <div style={{ alignSelf: 'flex-start', color: 'var(--text-dim)', fontSize: '12px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={13} className="spin" />
                  <span>Agent is selecting tools and querying upstreams...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Ask to create a product, check orders, convert prices, or calculate shipping..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
              <button type="submit" disabled={isChatSending} className="btn btn-primary">
                <Send size={15} />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab: Keys & Team */}
        {activeTab === 'keys' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Team API Keys & Access</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Members can configure Claude Code, Cursor, or MCP Inspector using their personal gateway key. Keys are stored hashed with SHA-256.
                </p>
              </div>
              <button onClick={() => setIsCreateKeyOpen(true)} className="btn btn-primary">
                <Plus size={16} />
                <span>Generate API Key</span>
              </button>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Name / Owner</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Key Prefix</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Created</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const owner = users.find((u) => u.id === k.userId);
                    return (
                      <tr key={k.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <strong>{k.name}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)' }}>
                            {owner?.username || k.userId}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', color: '#818cf8' }}>
                          {k.keyPrefix}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-dim)' }}>
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {k.revokedAt ? (
                            <span className="badge badge-unreachable">REVOKED</span>
                          ) : (
                            <span className="badge badge-connected">ACTIVE</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          {!k.revokedAt && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="btn btn-danger"
                              style={{ fontSize: '12px', padding: '5px 10px' }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Audit Log */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Cluster Audit Log</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Every tool call made through the gateway is attributed to the user with latency, timestamp, and outcome.
                </p>
              </div>
              <button onClick={fetchData} className="btn btn-secondary">
                <RefreshCw size={14} />
                <span>Refresh Logs</span>
              </button>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Time</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>User</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Server & Tool</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Latency</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Source</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No tool calls recorded yet. Execute a command in Chat or via an external MCP client.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 18px', color: 'var(--text-dim)', fontSize: '12px' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <strong>{log.username}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)' }}>
                            {log.userRole}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{log.toolName}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)' }}>
                            {log.serverName}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
                          {log.durationMs}ms
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: '12px' }}>
                          <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: '4px' }}>
                            {log.clientSource}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          {log.success ? (
                            <span className="badge badge-connected">SUCCESS</span>
                          ) : (
                            <span className="badge badge-unreachable">FAILED</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Upstream Server */}
      {isAddServerOpen && (
        <div className="modal-overlay" onClick={() => setIsAddServerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Register Upstream MCP Server</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Connect a new Streamable HTTP MCP server into the unified gateway.
              </p>
            </div>
            <form onSubmit={handleAddServer} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {serverError && (
                <div style={{ background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12.5px' }}>
                  {serverError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' }}>Server Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Analytics MCP Server"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' }}>Streamable HTTP SSE Endpoint</label>
                <input
                  type="url"
                  required
                  placeholder="http://analytics-mcp.mcp-system.svc.cluster.local:8000/sse"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' }}>Authentication</label>
                <select
                  value={newServerAuthType}
                  onChange={(e: any) => setNewServerAuthType(e.target.value)}
                  style={{ width: '100%', background: '#121826', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
                >
                  <option value="none">None (Internal Unauthenticated)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="header">Custom Header</option>
                </select>
              </div>

              {newServerAuthType !== 'none' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' }}>Secret Credential Token</label>
                  <input
                    type="password"
                    placeholder="Credential is stored server-side only"
                    value={newServerToken}
                    onChange={(e) => setNewServerToken(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsAddServerOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Key */}
      {isCreateKeyOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateKeyOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Generate Personal API Key</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Issuing key for <strong>{currentUser.username}</strong>
              </p>
            </div>

            {generatedKey ? (
              <div style={{ padding: '20px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>Key Generated Successfully!</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Copy this key now. For your security, it will not be displayed again.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedKey}
                    style={{ flex: 1, background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: '#818cf8', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="btn btn-primary"
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setGeneratedKey(null);
                      setIsCreateKeyOpen(false);
                    }}
                    className="btn btn-secondary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' }}>Key Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Cursor IDE Key"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setIsCreateKeyOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Generate
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Audit Log Payload Inspector */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Tool Call Inspection</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  ID: {selectedLog.id}
                </span>
              </div>
              <span className={`badge badge-${selectedLog.success ? 'connected' : 'unreachable'}`}>
                {selectedLog.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>
            <div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Invoked Tool</span>
                <code style={{ fontSize: '13px', color: '#38bdf8' }}>{selectedLog.toolName}</code>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Parameters</span>
                <pre style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#a5b4fc', overflowX: 'auto' }}>
                  {JSON.stringify(selectedLog.params || {}, null, 2)}
                </pre>
              </div>
              {selectedLog.error && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', color: '#f87171', display: 'block', marginBottom: '4px' }}>Error Details</span>
                  <div style={{ background: 'var(--danger-glow)', padding: '10px', borderRadius: 'var(--radius-sm)', color: '#f87171', fontSize: '12px' }}>
                    {selectedLog.error}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
