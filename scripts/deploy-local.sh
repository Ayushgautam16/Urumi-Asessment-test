#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="mcp-system"
RELEASE_NAME="mcp-platform"

echo "============================================="
echo " Deploying MCP Platform with Helm (Local)    "
echo "============================================="

# Ensure namespace exists
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# Deploy / upgrade Helm release
helm upgrade --install "${RELEASE_NAME}" ./charts/mcp-gateway-platform \
  -f ./charts/mcp-gateway-platform/values-local.yaml \
  --namespace "${NAMESPACE}"

echo "Waiting for core deployments to initialize..."
kubectl get pods -n "${NAMESPACE}"

echo ""
echo "============================================="
echo " Deployment Dispatched!                      "
echo "============================================="
echo "Access Points:"
echo "• Dashboard:        http://dashboard.local.test"
echo "• Gateway MCP SSE:  http://dashboard.local.test/mcp/sse"
echo "• WooCommerce Store: http://woo.local.test"
echo "• WP Admin:         http://woo.local.test/wp-admin (admin / admin_password_123)"
echo "============================================="
