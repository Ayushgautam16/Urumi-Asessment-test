# System Design & Tradeoffs

## 1. Architectural Choices

### 1.1 Microservice Topology
The platform decomposes into distinct, decoupled components communicating over standard protocols:
- **Stateful Core (WooCommerce + MariaDB)**: Standard containerized WordPress with MariaDB. Uses PersistentVolumeClaims to ensure durability of uploaded media and database records.
- **Custom WooCommerce MCP Server**: A standalone microservice exposing store operations via the Model Context Protocol (MCP) using Streamable HTTP. It interacts with WooCommerce exclusively via the official WooCommerce REST API v3.
- **Gateway Backend & Aggregator**: Central control plane and proxy. It acts as an MCP client to upstream MCP servers (WooCommerce, Currency, Logistics) and exposes a single aggregated MCP server endpoint to users and external clients.
- **Management Dashboard & Chat Agent**: Modern single-page React application coupled with a conversational agent execution loop.

### 1.2 Communication Mechanism: REST API vs. WP-CLI
For the custom WooCommerce MCP server, we evaluated two primary integration approaches:
1. **WP-CLI (Command-Line Interface)**:
   - *Pros*: Direct database/PHP access without HTTP overhead.
   - *Cons*: Requires sharing storage volumes or executing commands inside the WordPress container via `kubectl exec` / Docker sockets. This breaks pod isolation, requires privileged cluster roles (RBAC security risk), and couples the MCP server lifecycle directly to the WordPress runtime.
2. **WooCommerce REST API v3 (Selected Approach)**:
   - *Pros*: Standard HTTP-based communication, fully decoupled lifecycle, isolated network boundaries, native JSON serialization, and robust authentication via Consumer Key / Consumer Secret. The MCP server can scale independently, be restarted without affecting the store, and communicate across namespaces using standard Kubernetes DNS.
   - *Cons*: Requires HTTP roundtrips, which are negligible within the cluster's internal network (<2ms latency).

---

## 2. Tool Aggregation, Routing, and Resilience

### 2.1 Dynamic Discovery & Tool Namespacing
When upstream servers are registered in the gateway, the aggregator connects via MCP Streamable HTTP and executes `tools/list`.
- **Namespace Collision Scheme**: To prevent collisions between heterogeneous upstream servers (e.g., two servers defining `list_orders` or `ping`), tools are registered in the gateway using namespaced identifiers:
  ```plaintext
  <server_slug>__<tool_name>
  ```
  Example:
  - `woocommerce__list_orders`
  - `currency__convert_currency`
  - `inventory__calculate_shipping_rates`
- The gateway maintains an internal mapping between the namespaced tool name, the target upstream server, and the original tool name. When an external client or chat agent calls a tool, the gateway strips the prefix and forwards the arguments to the designated upstream.

### 2.2 Fault Isolation, Timeouts & Circuit Breaking
A critical failure mode in aggregated gateways is upstream cascading failures:
- **Per-Call Timeouts**: All upstream tool executions and health checks enforce an aggressive 5-second timeout.
- **Dead Upstream Isolation**: If an upstream server pod crashes, hangs, or is killed:
  - The gateway handles the connection error gracefully without terminating active client sessions or failing other requests.
  - Subsequent `tools/list` requests continue returning tools from all healthy, reachable servers.
  - The failed server's status in the dashboard is automatically updated to `Unreachable`, accompanied by clear diagnostic logs.
  - Direct invocations of tools belonging to an unreachable server return a structured, informative JSON-RPC error rather than an unhandled 500 or hung connection.

---

## 3. Production vs. Local Differences (Helm Values)

The platform is designed to run interchangeably on local clusters (Kind, k3d, Minikube) and production VPS environments (k3s, cloud managed Kubernetes) using a single Helm chart configured via separate values files (`values-local.yaml` vs. `values-prod.yaml`).

| Dimension | Local (`values-local.yaml`) | Production VPS (`values-prod.yaml`) |
| :--- | :--- | :--- |
| **StorageClass** | `standard` / `local-path` (hostpath mount) | Cloud CSI (`do-block-storage`, `ebs-sc`, `hcloud-volumes`) |
| **Ingress Controller** | `ingress-nginx` with Kind hostPort mappings | Traefik / NGINX Ingress on VPS public IP |
| **Domain Strategy** | `.local.test` domains mapped in `/etc/hosts` | Fully Qualified Domain Names (e.g. `domain.com`) with public DNS records |
| **TLS / SSL** | Disabled or self-signed certs | Automated Let's Encrypt TLS via `cert-manager` ClusterIssuer |
| **Secrets Management** | Generated local secrets | External Secrets Operator, HashiCorp Vault, or sealed secrets |
| **Workload Replicas** | 1 replica per service (resource efficiency) | 2+ replicas with PodDisruptionBudgets & horizontal scaling |
| **Resource Allocations** | Lower requests/limits suited for laptop development | Sized for production workloads with headroom |

---

## 4. Upgrade and Rollback Strategy

1. **Declarative Upgrades via Helm**:
   ```bash
   helm upgrade mcp-platform ./charts/mcp-gateway-platform \
     -f ./charts/mcp-gateway-platform/values-prod.yaml \
     --set gateway.image.tag="v1.1.0"
   ```
2. **Safe Rollback**:
   If an upgrade fails readiness probes, Kubernetes prevents routing traffic to unready pods. Immediate rollback is executed via:
   ```bash
   helm rollback mcp-platform <previous_revision>
   ```
3. **Database Migration Safety**: The MariaDB storage volume remains decoupled from the WordPress application pod lifecycle, guaranteeing that rollbacks do not affect stored catalog and order data.
