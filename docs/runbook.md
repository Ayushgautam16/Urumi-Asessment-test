# End-to-End Verification Runbook
## Testing the Definition of Done (DoD)

This runbook guides you through testing the entire platform end-to-end with **two distinct users**: **User A (Admin)** and **User B (Team Member)**.

---

##  Pre-Flight Checklist

Ensure the platform is deployed and pods are running:
```bash
kubectl get pods -n mcp-system
```
*Expected*: All pods (`mariadb`, `store`, `wc-mcp`, `upstream-currency`, `upstream-inventory`, `gateway`, `dashboard`, `ingress-controller`) should show `Running` or `Completed` (for bootstrap jobs).

Ensure `/etc/hosts` contains:
```plaintext
127.0.0.1 woo.local.test dashboard.local.test
```

---

##  Flow 1: Store Checkout Test

1. **Open Storefront**:
   Navigate to `http://woo.local.test` in your web browser.
2. **Add Product to Cart**:
   Locate the pre-seeded product **"Ergonomic Mechanical Keyboard"** and click **Add to cart**.
3. **Checkout**:
   - Go to Cart -> Checkout (`http://woo.local.test/checkout/`).
   - Fill in standard sample billing details (Name: *Test Customer*, Address: *123 Main St*).
   - Select **Cash on delivery (COD)** as the payment method.
   - Click **Place order**.
4. **Verify in WordPress Admin**:
   - Log into `http://woo.local.test/wp-admin` (Credentials: `admin` / `admin_password_123` or configured in secrets).
   - Navigate to **WooCommerce -> Orders**.
   - Verify that the new order appears with status **Processing** or **Pending payment**.

---

##  Flow 2: Chat Agent with User A (Admin)

1. **Open Dashboard**:
   Open `http://dashboard.local.test` in your browser.
2. **Login as User A**:
   Select or authenticate as **User A (Admin)**.
3. **Step 2A: Create Product via Natural Language**:
   In the **Chat Agent** tab, type:
   > *"Create a new product named 'Studio Noise-Canceling Headphones' priced at $199 with 25 items in stock."*
   
   - **Verification**:
     - The chat UI displays a visible tool call step: `woocommerce__create_product`.
     - The assistant confirms product creation with the assigned WooCommerce Product ID.
     - Switch to `http://woo.local.test/shop/` and refresh: The new product appears immediately on the live storefront!
4. **Step 2B: Manual Order & Query**:
   - On `http://woo.local.test`, add the new **"Studio Noise-Canceling Headphones"** to your cart and complete checkout via COD.
   - Return to the Chat Agent and ask:
     > *"What orders came in today? Please list their order IDs, customer names, and totals."*
   - **Verification**:
     - The chat UI displays tool call: `woocommerce__list_orders`.
     - The agent returns the order placed in the previous step with complete details.

---

##  Flow 3: External MCP Client with User B (Team Member)

1. **Switch to User B & Generate API Key**:
   - In the Dashboard, switch user context or log in as **User B (Member)**.
   - Navigate to the **API Keys** tab and click **Generate API Key**.
   - Copy the generated key (e.g., `mcp_gw_b8f3...`).
2. **Configure External MCP Client**:
   Configure Claude Code, Cursor, or MCP Inspector:
   ```json
   {
     "mcpServers": {
       "team-gateway": {
         "url": "http://dashboard.local.test/mcp/sse",
         "headers": {
           "Authorization": "Bearer mcp_gw_b8f3..."
         }
       }
     }
   }
   ```
3. **Verify Tool Aggregation**:
   Run `tools/list` in your client.
   - **Verification**: Tools from all 3 enabled upstream servers are visible:
     - `woocommerce__list_products`, `woocommerce__create_product`, `woocommerce__list_orders`, `woocommerce__get_order`, `woocommerce__update_order_status`
     - `currency__convert_currency`, `currency__get_exchange_rates`, `currency__format_price_localized`
     - `inventory__calculate_shipping_rates`, `inventory__track_shipment`, `inventory__estimate_delivery`
4. **Single-Server Query via External Client**:
   Ask Claude Code / Cursor:
   > *"What orders came in today in the WooCommerce store?"*
   - **Verification**: The external client invokes `woocommerce__list_orders` through the gateway and successfully returns the orders.
5. **Cross-Server Multi-Tool Query**:
   Prompt the external client:
   > *"Find the latest WooCommerce order, get its total amount in USD, convert that total to EUR, and calculate standard shipping for 2kg to New York."*
   - **Verification**:
     - The client calls `woocommerce__get_order` or `woocommerce__list_orders`.
     - It then calls `currency__convert_currency` (Upstream #2).
     - It then calls `inventory__calculate_shipping_rates` (Upstream #3).
     - Returns a unified, complete response.

---

##  Flow 4: Team and Control Verification

### 4.1 Key Revocation
1. In the Dashboard (as Admin or User B), locate User B's active key and click **Revoke Key**.
2. Immediately re-run a command in the external client or send a test request:
   ```bash
   curl -i http://dashboard.local.test/mcp/messages \
     -H "Authorization: Bearer <revoked_key>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
   ```
3. **Verification**: The gateway immediately rejects the request with HTTP `401 Unauthorized` and an error indicating the key was revoked.

### 4.2 Disabling an Upstream Server
1. In the Dashboard under **MCP Servers**, locate the **Currency & Forex MCP Server** and toggle it to **Disabled**.
2. Run `tools/list` on the external client or ask the Chat Agent for currency tools.
3. **Verification**: All `currency__*` tools have vanished from the tool list. Existing WooCommerce and Inventory tools remain completely unaffected.

### 4.3 Fault Isolation & Dead Upstream Pod
1. Intentionally kill the pod of the Currency MCP server:
   ```bash
   kubectl delete pod -l app=upstream-currency -n mcp-system
   ```
2. While the pod is terminating/restarting, run `tools/list` or ask the Chat Agent for WooCommerce orders:
   - **Verification**:
     - The WooCommerce store and inventory tools continue working normally.
     - The Dashboard's **MCP Servers** page marks the Currency server as `Unreachable` with error diagnostics.
     - Calls to healthy servers suffer zero downtime or blocking.

### 4.4 Audit Log Verification
1. In the Dashboard, open the **Audit Logs** tab.
2. Review the recorded entries:
   - Verify every tool call performed in Flows 2, 3, and 4 is listed.
   - Verify that calls from Flow 2 show **User A (Admin)** with source `chat_agent`.
   - Verify that calls from Flow 3 show **User B (Member)** with source `external_client`.
   - Confirm each entry records: exact timestamp, server name, tool name, sanitized parameters, execution latency in milliseconds, and status (`Success` or `Failed`).
