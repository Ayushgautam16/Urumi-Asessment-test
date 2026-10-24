import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  Code2,
  Clock,
  ShoppingBag,
  Coins,
  Truck,
  Box,
  SlidersHorizontal,
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
  timestamp?: string;
  toolCalls?: Array<{
    tool: string;
    arguments: any;
    result: any;
    durationMs: number;
  }>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'servers' | 'tools' | 'chat' | 'keys' | 'audit'>('servers');
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active simulated user identity
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

  // Audit log payload modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Tools filter & search
  const [toolSearch, setToolSearch] = useState('');
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [expandedToolSchema, setExpandedToolSchema] = useState<string | null>(null);

  // Audit filter & search
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Welcome to the Team MCP Platform. I am your cluster-connected AI Assistant running directly against your WooCommerce store and MCP upstreams.\n\nTry clicking one of the suggested prompts below or ask me to list products, check incoming orders, or calculate shipping.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [expandedToolPills, setExpandedToolPills] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Data fetching
  const fetchData = async () => {
    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
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
    showToast('Upstream server status updated');
    fetchData();
  };

  const handleDeleteServer = async (id: string) => {
    if (confirm('Are you sure you want to remove this upstream server?')) {
      await fetch(`/api/servers/${id}`, { method: 'DELETE' });
      showToast('Server removed from registry');
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
      showToast('New MCP server registered successfully');
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
        showToast('API Key generated');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (confirm('Revoke this key immediately? All client requests using it will be blocked.')) {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      showToast('API Key revoked');
      fetchData();
    }
  };

  // Chat action
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || isChatSending) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setChatInput('');
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCalls: data.toolCalls,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      fetchData();
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `⚠️ Error invoking agent: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Filtered tools
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
        t.description?.toLowerCase().includes(toolSearch.toLowerCase()) ||
        t.serverName.toLowerCase().includes(toolSearch.toLowerCase());
      const matchServer = selectedServerFilter === 'all' || t.serverSlug === selectedServerFilter;
      return matchSearch && matchServer;
    });
  }, [tools, toolSearch, selectedServerFilter]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        log.toolName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.username.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.serverName.toLowerCase().includes(auditSearch.toLowerCase());
      const matchStatus =
        auditStatusFilter === 'all' ||
        (auditStatusFilter === 'success' && log.success) ||
        (auditStatusFilter === 'failed' && !log.success);
      return matchSearch && matchStatus;
    });
  }, [auditLogs, auditSearch, auditStatusFilter]);

  const getServerIcon = (slug: string) => {
    if (slug.includes('woo')) return <ShoppingBag size={18} color="#a855f7" />;
    if (slug.includes('currency')) return <Coins size={18} color="#06b6d4" />;
    if (slug.includes('inventory')) return <Truck size={18} color="#10b981" />;
    return <Server size={18} color="#818cf8" />;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notice */}
      {toastMessage && (
        <div className="toast-notice">
          <CheckCircle2 size={16} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#f8fafc' }}>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(10, 13, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Brand & Cluster Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.45)',
              }}
            >
              <Shield size={19} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                  URUMI GATEWAY
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>v1.0-k8s</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot green" style={{ width: '6px', height: '6px' }} />
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Cluster: <code style={{ color: '#818cf8', fontFamily: 'var(--font-mono)' }}>kind-mcp-platform</code>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* User Identity Switcher & Store Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* User selector with role pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid var(--border-medium)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: currentUser.role === 'admin' ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {currentUser.role === 'admin' ? 'AD' : 'MB'}
            </div>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const found = users.find((u) => u.id === e.target.value);
                if (found) {
                  setCurrentUser(found);
                  showToast(`Switched active context to ${found.username}`);
                }
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
                  {u.username} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="btn btn-ghost"
            title="Refresh State"
            style={{ padding: '7px 10px' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          </button>

          <a
            href="http://woo.local.test"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <span>WooCommerce Store</span>
            <ExternalLink size={12} color="#94a3b8" />
          </a>

          <a
            href="http://woo.local.test/wp-admin"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <span>WP Admin</span>
            <ExternalLink size={12} color="#94a3b8" />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px 28px', flex: 1 }}>
        {/* KPI / Health Summary Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {/* Card 1 */}
          <div className="glass-panel" style={{ padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Upstream Servers
              </span>
              <Server size={15} color="#818cf8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                {servers.filter((s) => s.enabled && s.status === 'connected').length} / {servers.length}
              </span>
              <span className="badge badge-connected" style={{ fontSize: '11px' }}>
                <CheckCircle2 size={11} /> All Healthy
              </span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              Cluster internal endpoints isolated
            </span>
          </div>

          {/* Card 2 */}
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Aggregated Tools
              </span>
              <Wrench size={15} color="#06b6d4" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                {tools.length}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                Prefix namespaced
              </span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              WooCommerce + Currency + Logistics
            </span>
          </div>

          {/* Card 3 */}
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Audit Store
              </span>
              <Activity size={15} color="#10b981" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                {auditLogs.length}
              </span>
              <span className="badge badge-connected" style={{ fontSize: '11px' }}>
                100% Attributed
              </span>
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              Zero credential leakage to clients
            </span>
          </div>

          {/* Card 4: Gateway Endpoint with 1-click copy */}
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Streamable MCP SSE
              </span>
              <Terminal size={15} color="#a855f7" />
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <code
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: '#c084fc',
                  background: 'rgba(168, 85, 247, 0.1)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                /mcp/sse
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('http://dashboard.local.test/mcp/sse');
                  showToast('Gateway SSE URL copied to clipboard');
                }}
                className="btn btn-secondary"
                style={{ padding: '5px 8px', fontSize: '11px' }}
                title="Copy Full Gateway URL"
              >
                <Copy size={13} />
              </button>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', display: 'block' }}>
              Host: http://dashboard.local.test/mcp/sse
            </span>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.025)',
            padding: '6px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '24px',
            width: 'fit-content',
          }}
        >
          <button
            onClick={() => setActiveTab('servers')}
            className={`btn ${activeTab === 'servers' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px' }}
          >
            <Server size={14} />
            <span>Upstream Servers</span>
            <span className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
              {servers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`btn ${activeTab === 'tools' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px' }}
          >
            <Wrench size={14} />
            <span>Tools Registry</span>
            <span className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
              {tools.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px' }}
          >
            <Sparkles size={14} color={activeTab === 'chat' ? '#fff' : '#06b6d4'} />
            <span>AI Chat Agent</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`btn ${activeTab === 'keys' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px' }}
          >
            <Key size={14} />
            <span>API Keys & Team</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 14px' }}
          >
            <FileText size={14} />
            <span>Audit Logs</span>
            <span className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: UPSTREAM SERVERS */}
        {/* ========================================================================= */}
        {activeTab === 'servers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>Upstream MCP Servers</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Cluster-internal MCP upstreams speaking Streamable HTTP. The gateway isolates failures and enforces 5s timeouts.
                </p>
              </div>
              <button onClick={() => setIsAddServerOpen(true)} className="btn btn-primary">
                <Plus size={15} />
                <span>Register Upstream</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
              {servers.map((s) => (
                <div key={s.id} className="glass-panel interactive-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid var(--border-medium)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getServerIcon(s.slug)}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{s.name}</h3>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            namespace: <code>{s.slug}__*</code>
                          </span>
                        </div>
                      </div>
                      <span className={`badge badge-${s.status}`}>
                        <span className={`pulse-dot ${s.status === 'connected' ? 'green' : s.status === 'disabled' ? 'yellow' : 'red'}`} />
                        {s.status.toUpperCase()}
                      </span>
                    </div>

                    {/* URL box */}
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <code style={{ fontSize: '11.5px', color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                        {s.url}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(s.url);
                          showToast('Server URL copied');
                        }}
                        className="btn btn-ghost"
                        style={{ padding: '4px', height: 'auto' }}
                        title="Copy URL"
                      >
                        <Copy size={12} color="#64748b" />
                      </button>
                    </div>

                    {/* Error display if unreachable */}
                    {s.lastError && (
                      <div
                        style={{
                          background: 'var(--danger-bg)',
                          border: '1px solid var(--danger-border)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <AlertTriangle size={15} color="#f87171" />
                        <span style={{ fontSize: '12px', color: '#fca5a5' }}>{s.lastError}</span>
                      </div>
                    )}

                    {/* Metadata chips */}
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                      <span className="badge badge-neutral">
                        <Box size={12} /> {s.toolsCount} Tools
                      </span>
                      <span className="badge badge-neutral">
                        <Shield size={12} /> Auth: {s.authType}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <button
                      onClick={() => handleToggleServer(s.id)}
                      className={`btn ${s.enabled ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ flex: 1, fontSize: '12.5px' }}
                    >
                      <Power size={13} />
                      <span>{s.enabled ? 'Disable Server' : 'Enable Server'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteServer(s.id)}
                      className="btn btn-danger"
                      style={{ fontSize: '12.5px', padding: '8px 12px' }}
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

        {/* ========================================================================= */}
        {/* TAB 2: TOOLS REGISTRY EXPLORER */}
        {/* ========================================================================= */}
        {activeTab === 'tools' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Unified Tool Registry</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  All tools are namespaced as <code>&lt;server_slug&gt;__&lt;tool_name&gt;</code> to prevent collisions across multiple upstreams.
                </p>
              </div>

              {/* Filter and Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', minWidth: '260px' }}>
                  <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="text"
                    placeholder="Search tools or params..."
                    value={toolSearch}
                    onChange={(e) => setToolSearch(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '34px', fontSize: '13px', padding: '8px 12px 8px 34px' }}
                  />
                </div>

                <select
                  value={selectedServerFilter}
                  onChange={(e) => setSelectedServerFilter(e.target.value)}
                  className="input-field"
                  style={{ width: 'auto', fontSize: '12.5px', padding: '8px 12px', cursor: 'pointer' }}
                >
                  <option value="all">All Upstreams</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
              {filteredTools.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
                  <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No tools match your search criteria.</p>
                </div>
              ) : (
                filteredTools.map((t) => {
                  const isSchemaOpen = expandedToolSchema === t.name;
                  return (
                    <div key={t.name} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        {/* Source server pill */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 700, letterSpacing: '0.04em' }}>
                            {t.serverName.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            Original: {t.originalName}
                          </span>
                        </div>

                        {/* Monospace Tool Name */}
                        <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#818cf8', marginBottom: '8px' }}>
                          {t.name}
                        </h3>

                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                          {t.description?.replace(/\[From [^\]]+\]\s*/, '')}
                        </p>
                      </div>

                      {/* Schema Toggle Container */}
                      <div>
                        <button
                          onClick={() => setExpandedToolSchema(isSchemaOpen ? null : t.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '4px 0',
                            outline: 'none',
                          }}
                        >
                          {isSchemaOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>{isSchemaOpen ? 'Hide Input Schema' : 'Inspect Input Schema'}</span>
                        </button>

                        {isSchemaOpen && (
                          <div style={{ background: 'rgba(0, 0, 0, 0.45)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>JSON Schema</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(t.inputSchema || {}, null, 2));
                                  showToast('Schema copied');
                                }}
                                className="btn btn-ghost"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                              >
                                <Copy size={11} /> Copy
                              </button>
                            </div>
                            <pre style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#93c5fd', maxHeight: '160px', overflowY: 'auto' }}>
                              {JSON.stringify(t.inputSchema?.properties || {}, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: IN-DASHBOARD AI CHAT AGENT */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '720px', overflow: 'hidden' }}>
            {/* Chat Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(16, 21, 34, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={16} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Cluster AI Agent</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Executing tools as: <strong style={{ color: '#818cf8' }}>{currentUser.username}</strong> ({currentUser.role})
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-connected" style={{ fontSize: '11.5px' }}>
                  <span className="pulse-dot green" />
                  Gemini Tool Calling Loop Ready
                </span>
              </div>
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(0, 0, 0, 0.25)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px' }}>
                Suggested:
              </span>
              <button
                onClick={() => handleSendMessage('Create a new product named Studio Wireless Headphones priced at $199 with 20 items in stock.')}
                className="prompt-chip"
              >
                📦 Create $199 Headphones
              </button>
              <button
                onClick={() => handleSendMessage('What orders came in today? Please list their order IDs, customer names, and totals.')}
                className="prompt-chip"
              >
                📋 View Today's Orders
              </button>
              <button
                onClick={() => handleSendMessage('Find the latest order total in USD, convert that total to EUR, and calculate 2kg shipping to NYC.')}
                className="prompt-chip"
              >
                💱 Multi-Server: Convert & Ship
              </button>
              <button
                onClick={() => handleSendMessage('List all active products in the store with their prices and stock status.')}
                className="prompt-chip"
              >
                🔍 List All Products
              </button>
            </div>

            {/* Message Thread */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        background: isUser ? 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' : 'rgba(255, 255, 255, 0.04)',
                        border: isUser ? 'none' : '1px solid var(--border-medium)',
                        padding: '14px 18px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        fontSize: '13.5px',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        color: '#f8fafc',
                        boxShadow: isUser ? '0 4px 16px rgba(79, 70, 229, 0.35)' : 'var(--shadow-sm)',
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Timestamp & Attribution */}
                    {msg.timestamp && (
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', padding: '0 4px' }}>
                        {isUser ? currentUser.username : 'MCP Assistant'} • {msg.timestamp}
                      </span>
                    )}

                    {/* Tool Call Badges */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        {msg.toolCalls.map((tc, idx) => {
                          const pillKey = `${msg.id}-${idx}`;
                          const isExpanded = !!expandedToolPills[pillKey];
                          return (
                            <div
                              key={idx}
                              style={{
                                background: 'rgba(99, 102, 241, 0.08)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                onClick={() =>
                                  setExpandedToolPills((prev) => ({
                                    ...prev,
                                    [pillKey]: !prev[pillKey],
                                  }))
                                }
                                style={{
                                  padding: '8px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <CheckCircle2 size={13} color="#34d399" />
                                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 600 }}>
                                    {tc.tool}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                    {tc.durationMs}ms
                                  </span>
                                  {isExpanded ? <ChevronDown size={13} color="#818cf8" /> : <ChevronRight size={13} color="#818cf8" />}
                                </div>
                              </div>

                              {isExpanded && (
                                <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(99, 102, 241, 0.15)', background: 'rgba(0, 0, 0, 0.3)' }}>
                                  <div style={{ marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Arguments:</span>
                                    <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>
                                      {JSON.stringify(tc.arguments, null, 2)}
                                    </pre>
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Output:</span>
                                    <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#34d399', maxHeight: '100px', overflowY: 'auto' }}>
                                      {JSON.stringify(tc.result, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {isChatSending && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                  <RefreshCw size={14} className="spin" color="#06b6d4" />
                  <span>Agent is querying upstream MCP servers and compiling tool results...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'rgba(10, 13, 20, 0.95)',
                display: 'flex',
                gap: '12px',
              }}
            >
              <input
                type="text"
                placeholder={`Ask as ${currentUser.username} (e.g. "Create product...", "Check orders...")...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="input-field"
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={isChatSending || !chatInput.trim()} className="btn btn-primary" style={{ padding: '0 20px' }}>
                <Send size={15} />
                <span>Execute</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: API KEYS & TEAM */}
        {/* ========================================================================= */}
        {activeTab === 'keys' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Team API Keys & Access Control</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  External MCP clients (Claude Code, Cursor, MCP Inspector) connect to the unified gateway using personal API keys. Keys are stored hashed with SHA-256.
                </p>
              </div>
              <button onClick={() => setIsCreateKeyOpen(true)} className="btn btn-primary">
                <Plus size={15} />
                <span>Issue New API Key</span>
              </button>
            </div>

            {/* Quick config guide */}
            <div
              className="glass-panel"
              style={{
                padding: '18px 22px',
                marginBottom: '20px',
                borderLeft: '4px solid var(--accent-primary)',
                background: 'rgba(99, 102, 241, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Code2 size={16} color="#818cf8" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>External Client Configuration (Claude Code / Cursor)</span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Point your MCP client directly to the gateway SSE URL with your generated Bearer token:
              </p>
              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: '#93c5fd',
                  overflowX: 'auto',
                }}
              >
{`{
  "mcpServers": {
    "team-gateway": {
      "url": "http://dashboard.local.test/mcp/sse",
      "headers": {
        "Authorization": "Bearer <YOUR_USER_API_KEY>"
      }
    }
  }
}`}
              </pre>
            </div>

            {/* Keys Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>KEY LABEL / OWNER</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>KEY PREFIX</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>CREATED</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const owner = users.find((u) => u.id === k.userId);
                    return (
                      <tr key={k.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <strong style={{ color: '#fff' }}>{k.name}</strong>
                          <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)' }}>
                            {owner?.username || k.userId} ({owner?.role || 'member'})
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', color: '#818cf8' }}>
                          {k.keyPrefix}••••••••
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          {k.revokedAt ? (
                            <span className="badge badge-unreachable">REVOKED</span>
                          ) : (
                            <span className="badge badge-connected">ACTIVE</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!k.revokedAt && (
                            <button
                              onClick={() => handleRevokeKey(k.id)}
                              className="btn btn-danger"
                              style={{ fontSize: '12px', padding: '5px 10px' }}
                            >
                              Revoke Key
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

        {/* ========================================================================= */}
        {/* TAB 5: AUDIT LOG VIEWER */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Cluster Audit Log</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Every tool call made through the gateway is attributed to the user with latency, timestamp, and outcome.
                </p>
              </div>

              {/* Audit search & filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', minWidth: '240px' }}>
                  <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="text"
                    placeholder="Search user, tool, or server..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '34px', fontSize: '13px', padding: '8px 12px 8px 34px' }}
                  />
                </div>

                <select
                  value={auditStatusFilter}
                  onChange={(e: any) => setAuditStatusFilter(e.target.value)}
                  className="input-field"
                  style={{ width: 'auto', fontSize: '12.5px', padding: '8px 12px', cursor: 'pointer' }}
                >
                  <option value="all">All Outcomes</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>

                <button onClick={fetchData} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                  <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>TIMESTAMP</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>CALLER</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>SERVER & TOOL</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>LATENCY</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>OUTCOME</th>
                    <th style={{ padding: '14px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>INSPECT</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No audit records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '12px' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <strong style={{ color: '#fff' }}>{log.username}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)' }}>
                            {log.userRole}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{log.toolName}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)' }}>
                            {log.serverName}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: log.durationMs < 500 ? '#34d399' : '#fbbf24',
                            }}
                          >
                            {log.durationMs}ms
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '12px' }}>
                          <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                            {log.clientSource}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          {log.success ? (
                            <span className="badge badge-connected">SUCCESS</span>
                          ) : (
                            <span className="badge badge-unreachable">FAILED</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px' }}
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

      {/* ========================================================================= */}
      {/* MODAL: ADD UPSTREAM SERVER */}
      {/* ========================================================================= */}
      {isAddServerOpen && (
        <div className="modal-overlay" onClick={() => setIsAddServerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Register Upstream MCP Server</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Connect a new Streamable HTTP MCP server into the unified gateway.
              </p>
            </div>
            <form onSubmit={handleAddServer} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {serverError && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '12.5px' }}>
                  {serverError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Server Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Analytics MCP Server"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Streamable HTTP Endpoint (/sse)
                </label>
                <input
                  type="url"
                  required
                  placeholder="http://analytics-mcp.mcp-system.svc.cluster.local:8000/sse"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Authentication Mode
                </label>
                <select
                  value={newServerAuthType}
                  onChange={(e: any) => setNewServerAuthType(e.target.value)}
                  className="input-field"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="none">None (Internal ClusterIP Unauthenticated)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="header">Custom Header</option>
                </select>
              </div>

              {newServerAuthType !== 'none' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    Secret Credential Token
                  </label>
                  <input
                    type="password"
                    placeholder="Credential is saved securely server-side"
                    value={newServerToken}
                    onChange={(e) => setNewServerToken(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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

      {/* ========================================================================= */}
      {/* MODAL: GENERATE API KEY */}
      {/* ========================================================================= */}
      {isCreateKeyOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateKeyOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Issue Personal Gateway API Key</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Issuing key for: <strong style={{ color: '#fff' }}>{currentUser.username}</strong>
              </p>
            </div>

            {generatedKey ? (
              <div style={{ padding: '24px' }}>
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '18px' }}>
                  <span style={{ fontSize: '12.5px', color: '#34d399', fontWeight: 700 }}>Key Generated Successfully</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Copy this key immediately. For security, it is stored hashed with SHA-256 and will not be displayed again.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedKey}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', color: '#818cf8', fontSize: '12.5px' }}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      setCopiedKey(true);
                      showToast('API Key copied to clipboard');
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
              <form onSubmit={handleCreateKey} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    Key Label / Client Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cursor IDE Key / Claude Code"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button type="button" onClick={() => setIsCreateKeyOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Generate Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AUDIT PAYLOAD INSPECTOR */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Tool Call Audit Inspection</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  Record ID: {selectedLog.id}
                </span>
              </div>
              <span className={`badge badge-${selectedLog.success ? 'connected' : 'unreachable'}`}>
                {selectedLog.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>

            <div style={{ padding: '24px', maxHeight: '520px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '18px' }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Caller Identity</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{selectedLog.username}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Role: {selectedLog.userRole}</span>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block' }}>Execution Duration</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                    {selectedLog.durationMs}ms
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Client: {selectedLog.clientSource}</span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Invoked Tool & Upstream Server
                </span>
                <code style={{ fontSize: '13px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {selectedLog.serverName} ➔ {selectedLog.toolName}
                </code>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Parameters Payload</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLog.params || {}, null, 2));
                      showToast('Parameters copied');
                    }}
                    className="btn btn-ghost"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre
                  style={{
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid var(--border-subtle)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: '#93c5fd',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(selectedLog.params || {}, null, 2)}
                </pre>
              </div>

              {selectedLog.error && (
                <div>
                  <span style={{ fontSize: '12px', color: '#f87171', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Error Output
                  </span>
                  <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', padding: '12px', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '12px' }}>
                    {selectedLog.error}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
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
