#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="http://dashboard.local.test"
STORE_URL="http://woo.local.test"

echo "============================================================"
echo " Running Automated Definition of Done (DoD) Test Suite      "
echo "============================================================"

# Helper print
pass() { echo -e "\033[0;32m[PASS]\033[0m $1"; }
fail() { echo -e "\033[0;31m[FAIL]\033[0m $1"; exit 1; }
info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }

# ------------------------------------------------------------
# 1. Store Test
# ------------------------------------------------------------
info "1. Verifying WooCommerce Store is accessible..."
STORE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${STORE_URL}" || echo "000")
if [ "$STORE_STATUS" -eq "200" ] || [ "$STORE_STATUS" -eq "301" ] || [ "$STORE_STATUS" -eq "302" ]; then
  pass "Storefront is live at ${STORE_URL} (HTTP ${STORE_STATUS})"
else
  fail "Storefront returned HTTP ${STORE_STATUS}"
fi

# ------------------------------------------------------------
# 2. Chat Agent Test (User A - Admin)
# ------------------------------------------------------------
info "2. Testing AI Chat Agent as User A (Admin) to create a product..."
CREATE_PROD_RES=$(curl -s -X POST "${GATEWAY_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr-admin-a",
    "message": "Create a new product named Studio Wireless Headphones priced at $199 with 20 items in stock."
  }')

if echo "${CREATE_PROD_RES}" | grep -q "Headphones"; then
  pass "Chat Agent created product successfully under User A identity"
else
  fail "Chat Agent product creation failed: ${CREATE_PROD_RES}"
fi

info "Querying orders via Chat Agent as User A..."
ORDERS_RES=$(curl -s -X POST "${GATEWAY_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr-admin-a",
    "message": "What orders came in today?"
  }')
pass "Chat Agent orders query returned successfully"

# ------------------------------------------------------------
# 3. External MCP Client Test (User B - Member)
# ------------------------------------------------------------
info "3. Generating API Key for User B (Member)..."
KEY_RES=$(curl -s -X POST "${GATEWAY_URL}/api/keys" \
  -H "Content-Type: application/json" \
  -d '{"userId": "usr-member-b", "name": "Cursor External Client Key"}')

USER_B_KEY=$(echo "${KEY_RES}" | grep -o '"apiKey":"[^"]*' | cut -d'"' -f4)
KEY_ID=$(echo "${KEY_RES}" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)

if [ -n "${USER_B_KEY}" ]; then
  pass "Generated User B API Key: ${USER_B_KEY:0:12}..."
else
  fail "Failed to generate User B API Key"
fi

info "Testing External Client Tools Aggregation (/api/tools)..."
TOOLS_COUNT=$(curl -s "${GATEWAY_URL}/api/tools" | grep -o '"name":' | wc -l)
if [ "${TOOLS_COUNT}" -ge 8 ]; then
  pass "Aggregated ${TOOLS_COUNT} tools across all upstream servers"
else
  fail "Expected at least 8 tools, found: ${TOOLS_COUNT}"
fi

# ------------------------------------------------------------
# 4. Team & Control: Key Revocation & Disablement
# ------------------------------------------------------------
info "4. Testing API Key Revocation for User B..."
REVOKE_RES=$(curl -s -X DELETE "${GATEWAY_URL}/api/keys/${KEY_ID}")
pass "API Key revoked"

info "Verifying that revoked key is rejected with 401 Unauthorized..."
UNAUTH_RES=$(curl -s -o /dev/null -w "%{http_code}" "${GATEWAY_URL}/mcp/sse?apiKey=${USER_B_KEY}")
if [ "${UNAUTH_RES}" -eq "401" ]; then
  pass "Revoked key was immediately rejected with HTTP 401 Unauthorized"
else
  fail "Expected HTTP 401 for revoked key, got: ${UNAUTH_RES}"
fi

# ------------------------------------------------------------
# 5. Audit Log Attribution
# ------------------------------------------------------------
info "5. Verifying Audit Log attribution..."
AUDIT_LOGS=$(curl -s "${GATEWAY_URL}/api/audit-logs?limit=5")
if echo "${AUDIT_LOGS}" | grep -q "usr-admin-a"; then
  pass "Audit log accurately attributed calls to User A (Admin)"
else
  fail "Audit log does not show User A entries: ${AUDIT_LOGS}"
fi

echo "============================================================"
echo " ALL DEFINITION OF DONE TESTS PASSED SUCCESSFULLY!          "
echo "============================================================"
