# WooCommerce Hosting Platform with Team MCP Gateway on Kubernetes

[![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.28+-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io)
[![Helm](https://img.shields.io/badge/Helm-v3-0F1689?logo=helm&logoColor=white)](https://helm.sh)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Streamable%20HTTP-black?logo=anthropic)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev)

A complete, production-grade cloud-native platform hosting a **stateful WooCommerce store** on Kubernetes, unified by an **authenticated Model Context Protocol (MCP) Team Gateway** and an integrated **AI Chat Agent**.

Admins connect upstream MCP servers once in a central management dashboard; every team member can then access all aggregated tools through **a single authenticated MCP endpoint** (using clients like Claude Code, Cursor, or MCP Inspector) and through an **in-dashboard AI Chat Agent** acting under their own user identity.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [The 4 Layers of the System](#the-4-layers-of-the-system)
- [Repository Structure](#repository-structure)
- [Prerequisites & Local Tooling](#prerequisites--local-tooling)
- [Quickstart: Local Kubernetes (Kind / k3d)](#quickstart-local-kubernetes-kind--k3d)
- [Production VPS Deployment (k3s)](#production-vps-deployment-k3s)
- [Definition of Done Walkthrough](#definition-of-done-walkthrough)
- [Security & Threat Model](#security--threat-model)
- [Tradeoffs & Architectural Decisions](#tradeoffs--architectural-decisions)
- [Troubleshooting & Runbook](#troubleshooting--runbook)

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Clients["Clients & Users"]
        UserA["Admin (User A)\n[Browser Dashboard]"]
        UserB["Team Member (User B)\n[Browser Dashboard]"]
        ExtClient["External MCP Client\n[Claude Code / Cursor / Inspector]\n(Uses User B API Key)"]
    end

    subgraph IngressLayer["Kubernetes Ingress (Traefik / NGINX)"]
        IngressRouter["Ingress Controller\n• woo.local.test\n• dashboard.local.test"]
    end

    subgraph PlatformPods["Team Gateway & Dashboard (Namespace: mcp-system)"]
        DashboardUI["React Frontend Dashboard\n• Server Registry UI\n• Tool Inspector\n• API Key Manager\n• Audit Log Viewer\n• Chat Agent UI"]
        GatewayAPI["Gateway Backend & MCP Aggregator\n• MCP Streamable HTTP Aggregator\n• Tool Prefixing (server__tool)\n• Auth & Hashed Keys (SHA-256)\n• Circuit Breaker & 5s Timeouts\n• SSRF Guard & Audit Logger"]
        ChatAgent["Chat Agent Engine\n• LLM Tool Calling Loop\n• Runs with Authenticated User Context"]
    end

    subgraph InternalMCP["Internal MCP Upstreams (ClusterIP only)"]
        WcMcp["WooCommerce MCP Server\n• list_products\n• create_product\n• list_orders\n• get_order\n• update_order_status"]
        CurrencyMcp["Upstream #2: Currency MCP\n• convert_currency\n• get_exchange_rates\n• format_price_localized"]
        InventoryMcp["Upstream #3: Logistics MCP\n• calculate_shipping_rates\n• track_shipment\n• estimate_delivery"]
    end

    subgraph StatefulStore["Stateful Store (Namespace: woocommerce)"]
        WcApp["WordPress + WooCommerce\n(PHP 8.2 Apache)"]
        MariaDB[("MariaDB 10.11\n(Persistent Storage)")]
        WpPVC[("WordPress Content\n(Persistent Storage)")]
    end

    UserA -->|HTTP / Ingress| IngressRouter
    UserB -->|HTTP / Ingress| IngressRouter
    ExtClient -->|Streamable HTTP + Bearer Key| IngressRouter

    IngressRouter -->|dashboard.local.test| DashboardUI
    IngressRouter -->|dashboard.local.test/api & /mcp| GatewayAPI
    IngressRouter -->|woo.local.test| WcApp

    DashboardUI <-->|REST API| GatewayAPI
    DashboardUI <-->|Chat API| ChatAgent
    ChatAgent <-->|Internal MCP Loop| GatewayAPI

    GatewayAPI -->|Streamable HTTP| WcMcp
    GatewayAPI -->|Streamable HTTP| CurrencyMcp
    GatewayAPI -->|Streamable HTTP| InventoryMcp

    WcMcp -->|REST API (Consumer Key/Secret)| WcApp
    WcApp --> MariaDB
    WcApp --> WpPVC
```

---

## Key Features

1. **Single Entry Point for All AI Tools**: External AI assistants connect to one endpoint (`/mcp/sse` or `/mcp/stream`) with a single personal API key to discover and run tools across all connected upstreams.
2. **Zero-Leak Upstream Credentials**: Upstream credentials (headers, bearer tokens, WooCommerce keys) are stored server-side in Kubernetes Secrets and injected by the Gateway. Neither the browser nor external MCP clients ever see them.
3. **Resilient Aggregation & Fault Isolation**:
   - Upstream servers have per-call timeouts (5 seconds).
   - If an upstream server pod crashes, restarts, or hangs, the gateway isolates the failure. Listing tools still succeeds for all healthy servers, and the dead server is clearly surfaced as `Unreachable` in the dashboard.
4. **Collision-Safe Tool Namespacing**: If two servers expose identically named tools (e.g. `list_orders` or `ping`), the gateway namespaces them cleanly (`serverName__toolName`) while preserving full descriptions and argument schemas.
5. **Team RBAC & Hashed API Keys**:
   - Roles: `Admin` (server & team management) and `Member` (tool execution).
   - Personal API keys are cryptographically generated and stored hashed with SHA-256. Keys can be instantly revoked.
6. **Full Observability & Audit Logging**:
   - Every single tool call is recorded: **who** ran it, **which server and tool**, **when**, **execution duration (ms)**, and **outcome (success/failure)**.
   - Filterable, searchable audit log table in the dashboard.
7. **Production-Ready Kubernetes & Helm**:
   - Single Helm chart parameterized with `values-local.yaml` (Kind/k3d) and `values-prod.yaml` (VPS/k3s).
   - Liveness/readiness probes, resource requests/limits on every container, persistent PVCs, and NetworkPolicies denying external access to internal MCP servers.

---

## The 4 Layers of the System

### Layer 1: WooCommerce Store
- **Workloads**: WordPress (with WooCommerce) and MariaDB.
- **Storage**: Persistent Volume Claims (`ReadWriteOnce`) ensuring product and order state survives pod restarts.
- **Bootstrapping**: Automated Kubernetes initialization Job (`store-bootstrap-job`) that configures WordPress, activates WooCommerce, enables **Cash on Delivery (COD)** for instant testing without payment gateways, seeds initial demo products, generates WooCommerce REST API keys, and stores them in a Kubernetes Secret.
- **Exposure**: Ingress at `http://woo.local.test`.

### Layer 2: Custom WooCommerce MCP Server
- **Implementation**: Written from scratch in TypeScript using `@modelcontextprotocol/sdk`.
- **Protocol**: MCP over Streamable HTTP (`/sse` and `/messages`).
- **Communication with Store**: WooCommerce REST API v3 over internal cluster network (`http://woocommerce-store.woocommerce.svc.cluster.local/wp-json/wc/v3`).
- **Tools Implemented**:
  1. `list_products`: Search, filter by status, price, category, and pagination.
  2. `create_product`: Create products with name, regular price, description, and inventory.
  3. `list_orders`: Filter orders by date, status (`processing`, `completed`), and customer.
  4. `get_order`: Retrieve detailed order line items, totals, and customer details.
  5. `update_order_status`: Change order status (e.g., `completed`, `cancelled`).
- **Security**: Bound to internal ClusterIP only; cannot be called from outside the cluster.

### Layer 3: Gateway & Management Dashboard
- **Aggregator Backend**:
  - Connects to upstreams via MCP Streamable HTTP clients.
  - Dynamically discovers tools, aggregates schemas, and routes tool calls to the correct upstream.
  - Protects against Server-Side Request Forgery (SSRF) when admins add new server URLs.
  - Manages upstream server status: `Connected`, `Unreachable`, `Disabled`.
  - Records real-time audit logs into persistent storage.
- **Modern React Dashboard**:
  - **Servers View**: Live cards with status badges, tool counts, tool schema drawer, add/edit/disable/remove controls. Pre-seeded with WooCommerce MCP server.
  - **Team & Keys View**: User list with roles, issue/revoke API keys modal with one-click copy.
  - **Audit Logs View**: Real-time table of tool calls with duration, parameters, results, and user attribution.
  - **Chat View**: Full-screen conversational AI with visible tool call bubbles.

### Layer 4: Chat Agent
- **Tool Execution Loop**:
  - Embedded AI assistant in the dashboard powered by an LLM (Gemini / OpenAI / Groq / Ollama).
  - Inspects user intent -> Selects tool -> Executes tool through the Gateway under the logged-in user's identity -> Generates natural language answer.
  - Transparently renders each tool invocation step (arguments, execution time, and response preview).

---

## Repository Structure

```plaintext
.
├── README.md                           # This file
├── docs/
│   ├── system-design.md                # In-depth architectural trade-offs & routing design
│   ├── threat-model.md                 # Security analysis, SSRF, untrusted upstreams
│   └── runbook.md                      # Step-by-step DoD verification walkthrough
├── charts/
│   └── mcp-gateway-platform/           # Production Helm Chart
│       ├── Chart.yaml
│       ├── values.yaml                 # Default values
│       ├── values-local.yaml           # Local cluster configuration (Kind/k3d)
│       ├── values-prod.yaml            # VPS / production configuration (k3s)
│       └── templates/
│           ├── _helpers.tpl
│           ├── namespace.yaml
│           ├── networkpolicies.yaml
│           ├── secrets.yaml
│           ├── mariadb-pvc.yaml
│           ├── mariadb-deployment.yaml
│           ├── mariadb-service.yaml
│           ├── store-pvc.yaml
│           ├── store-deployment.yaml
│           ├── store-service.yaml
│           ├── store-bootstrap-job.yaml
│           ├── wc-mcp-deployment.yaml
│           ├── wc-mcp-service.yaml
│           ├── upstream-currency.yaml
│           ├── upstream-inventory.yaml
│           ├── gateway-pvc.yaml
│           ├── gateway-deployment.yaml
│           ├── gateway-service.yaml
│           ├── dashboard-deployment.yaml
│           ├── dashboard-service.yaml
│           └── ingress.yaml
├── services/
│   ├── woocommerce-mcp/                # Custom TypeScript WooCommerce MCP Server
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── wc-client.ts
│   │       └── tools/
│   ├── upstream-currency-mcp/          # Upstream #2: Forex & Currency MCP
│   │   ├── Dockerfile
│   │   └── src/index.ts
│   ├── upstream-inventory-mcp/         # Upstream #3: Logistics & Shipping MCP
│   │   ├── Dockerfile
│   │   └── src/index.ts
│   ├── gateway/                        # Gateway Backend & MCP Aggregation Engine
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── aggregator.ts
│   │       ├── auth.ts
│   │       ├── audit.ts
│   │       ├── ssrf.ts
│   │       └── routes/
│   └── dashboard/                      # React Frontend Dashboard
│       ├── Dockerfile
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
└── scripts/
    ├── setup-local-cluster.sh          # Creates local Kind/k3d cluster with Ingress
    ├── build-images.sh                 # Builds local container images
    └── test-dod.sh                     # Automated verification of Definition of Done
```

---

## Prerequisites & Local Tooling

To run this platform locally, ensure you have:
- **macOS / Linux** with terminal access
- **Container Runtime**: Docker Desktop, Colima, or OrbStack
- **Kubernetes**: [Kind](https://kind.sigs.k8s.io/) or [k3d](https://k3d.io/)
- **CLI Tools**: `kubectl` (v1.28+), `helm` (v3+), `node` (v20+)

### Quick Install via Homebrew (macOS)
```bash
brew install docker colima kubectl helm kind
colima start --cpu 4 --memory 8 --disk 40
```

---

## Quickstart: Local Kubernetes (Kind / k3d)

### Step 1: Create Cluster with Port Mappings
Create a local Kind cluster that maps ports 80 and 443 to the host:

```bash
kind create cluster --name mcp-platform --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF
```

### Step 2: Install Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Step 3: Configure Local DNS (/etc/hosts)
Add the following line to `/etc/hosts`:
```plaintext
127.0.0.1 woo.local.test dashboard.local.test
```

### Step 4: Build Local Docker Images & Load to Kind
```bash
# Build services
docker build -t mcp-platform/gateway:latest ./services/gateway
docker build -t mcp-platform/dashboard:latest ./services/dashboard
docker build -t mcp-platform/woocommerce-mcp:latest ./services/woocommerce-mcp
docker build -t mcp-platform/upstream-currency:latest ./services/upstream-currency-mcp
docker build -t mcp-platform/upstream-inventory:latest ./services/upstream-inventory-mcp

# Load images into Kind
kind load docker-image mcp-platform/gateway:latest --name mcp-platform
kind load docker-image mcp-platform/dashboard:latest --name mcp-platform
kind load docker-image mcp-platform/woocommerce-mcp:latest --name mcp-platform
kind load docker-image mcp-platform/upstream-currency:latest --name mcp-platform
kind load docker-image mcp-platform/upstream-inventory:latest --name mcp-platform
```

### Step 5: Deploy with Helm
```bash
helm install mcp-platform ./charts/mcp-gateway-platform \
  -f ./charts/mcp-gateway-platform/values-local.yaml \
  --create-namespace \
  --namespace mcp-system
```

Wait for all pods to become ready:
```bash
kubectl get pods -n mcp-system -w
```

Access your applications:
- **Dashboard**: `http://dashboard.local.test`
- **WooCommerce Store**: `http://woo.local.test`

---

## Production VPS Deployment (k3s)

Deploying to a single-node or multi-node production VPS running k3s requires only configuration updates via Helm values:

1. **Storage**: Uses `local-path` or your VPS provider's CSI driver (e.g., DigitalOcean / Hetzner / AWS EBS).
2. **DNS & Ingress**: Replace `.local.test` domains with your public domain (e.g., `store.yourdomain.com` and `gateway.yourdomain.com`).
3. **TLS Certificates**: Enabled automatically with `cert-manager` and Let's Encrypt.
4. **Secrets**: Real API keys (OpenAI / Gemini) injected via Kubernetes Secrets or external secret stores.

```bash
helm install mcp-platform ./charts/mcp-gateway-platform \
  -f ./charts/mcp-gateway-platform/values-prod.yaml \
  --set ingress.domain="yourdomain.com" \
  --set certManager.email="admin@yourdomain.com" \
  --namespace mcp-system
```

---

## Definition of Done Walkthrough

The platform satisfies all testable criteria outlined in the hiring specification:

### 1. Store Test
1. Open `http://woo.local.test`.
2. Browse products, add a sample product ("Ergonomic Mechanical Keyboard") to the cart.
3. Proceed to checkout, select **Cash on Delivery (COD)**, and click **Place Order**.
4. Log into WordPress admin (`http://woo.local.test/wp-admin`) to confirm the order is marked `Processing`.

### 2. Chat Agent (as User A - Admin)
1. Open `http://dashboard.local.test` and navigate to **Chat Agent**.
2. Prompt: `"Create a new product named 'Noise Cancelling Headphones' priced at $199 with 20 items in stock."`
   - *Observation*: Chat displays tool execution pill for `woocommerce__create_product`. Product instantly appears on `http://woo.local.test`.
3. Place an order for this product on the storefront by hand.
4. Ask the agent: `"What orders came in today?"`
   - *Observation*: Agent calls `woocommerce__list_orders` and returns your order details.

### 3. External MCP Client (as User B - Team Member)
1. In the dashboard, switch to **User B**, open the **API Keys** tab, and generate a new key.
2. In your terminal or in **Claude Code / Cursor / MCP Inspector**, add the gateway:
   ```json
   {
     "mcpServers": {
       "team-gateway": {
         "url": "http://dashboard.local.test/mcp/sse",
         "headers": {
           "Authorization": "Bearer mcp_gw_user_b_token_here"
         }
       }
     }
   }
   ```
3. Run `tools/list`: All enabled tools from WooCommerce, Currency, and Logistics servers appear.
4. Run cross-server prompt: `"Check today's latest WooCommerce order total and convert it to EUR, then calculate standard shipping to New York."`
   - *Observation*: Client successfully executes `woocommerce__get_order`, `currency__convert_currency`, and `inventory__calculate_shipping_rates`.

### 4. Team and Control
1. **Revoke Key**: Revoke User B's key in the dashboard. Re-run an external tool call; the gateway immediately rejects it with `401 Unauthorized`.
2. **Disable Upstream**: Toggle the Currency MCP server to `Disabled`. Its tools vanish from both the chat agent and external clients.
3. **Fault Isolation**: Kill the Currency MCP pod (`kubectl delete pod -l app=upstream-currency -n mcp-system`).
   - The other servers continue functioning seamlessly.
   - The dashboard updates the Currency server's card to `Unreachable` with error diagnostic.
4. **Audit Log**: Open the **Audit Logs** tab in the dashboard. Verify that every call above is logged with timestamp, user attribution (User A vs User B), tool, duration, and status.

---

## Security & Threat Model

- **Hashed API Key Storage**: Personal API keys are stored hashed with SHA-256. Plaintext keys are never stored and cannot be retrieved after initial generation.
- **Upstream Credential Isolation**: Upstream tokens (headers, basic auth) remain entirely within the Gateway backend memory and Kubernetes Secrets.
- **SSRF Guard**: When an admin registers a new upstream URL, the Gateway validates the IP address. Private cloud metadata IPs (`169.254.169.254`), loopbacks, and non-whitelisted internal services are strictly rejected.
- **Least-Privilege Network Policies**: Kubernetes NetworkPolicies ensure only the Gateway backend can communicate with the internal MCP servers and the WooCommerce REST API.
- **Non-Root Containers**: All microservices run under unprivileged non-root users (`USER 10001`).

---

## Tradeoffs & Architectural Decisions

1. **REST API vs. WP-CLI for WooCommerce**:
   - *Choice*: WooCommerce REST API v3 over HTTP.
   - *Rationale*: Microservice decoupling. WP-CLI requires direct filesystem mounts or container exec privileges, introducing security risks and tight coupling. The REST API is standard, resilient, and asynchronous.
2. **Tool Collision Resolution**:
   - *Choice*: Prefixing with double underscore (`serverName__toolName`).
   - *Rationale*: Guarantees uniqueness across heterogeneous servers while keeping tool names clean and predictable for LLM tool selection.
3. **Streamable HTTP Transport**:
   - *Choice*: MCP over SSE + HTTP POST (`/sse` and `/messages`).
   - *Rationale*: Native browser and cloud compatibility; works seamlessly through Kubernetes Ingress without complex raw TCP routing.

---

## Documentation Links

- [System Design & Tradeoffs (docs/system-design.md)](./docs/system-design.md)
- [Security & Threat Model (docs/threat-model.md)](./docs/threat-model.md)
- [Verification Runbook & Step-by-Step Script (docs/runbook.md)](./docs/runbook.md)

---

## License
This project is licensed under the Apache 2.0 License.
