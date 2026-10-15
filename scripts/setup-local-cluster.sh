#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="mcp-platform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/kind-config.yaml"

echo "============================================="
echo " Setting up Local Kubernetes Cluster (Kind) "
echo "============================================="

# 1. Check if cluster already exists
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "Kind cluster '${CLUSTER_NAME}' is already running."
else
  echo "Creating Kind cluster '${CLUSTER_NAME}' with ports 80 and 443 mapped..."
  kind create cluster --name "${CLUSTER_NAME}" --config "${CONFIG_FILE}"
fi

# 2. Set current context
kubectl cluster-info --context "kind-${CLUSTER_NAME}"

# 3. Install Ingress NGINX for Kind
echo "Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "Waiting for Ingress NGINX controller to become ready (this may take up to 2 minutes)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s || true

# 4. Create mcp-system namespace
echo "Creating mcp-system namespace..."
kubectl create namespace mcp-system --dry-run=client -o yaml | kubectl apply -f -

# 5. Check /etc/hosts entries
echo "---------------------------------------------"
echo "Checking /etc/hosts for local domains..."
if grep -q "woo.local.test" /etc/hosts 2>/dev/null && grep -q "dashboard.local.test" /etc/hosts 2>/dev/null; then
  echo "Local domain mappings found in /etc/hosts."
else
  echo "IMPORTANT: Please ensure the following line is added to your /etc/hosts:"
  echo "  127.0.0.1 woo.local.test dashboard.local.test"
  echo "You can add it by running:"
  echo "  echo '127.0.0.1 woo.local.test dashboard.local.test' | sudo tee -a /etc/hosts"
fi

echo "============================================="
echo " Local Kubernetes Cluster is Ready! "
echo "============================================="
