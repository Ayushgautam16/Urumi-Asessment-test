#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="mcp-platform"

echo "============================================="
echo " Building Container Images for MCP Platform  "
echo "============================================="

echo "1. Building WooCommerce MCP server..."
docker build -t mcp-platform/woocommerce-mcp:latest ./services/woocommerce-mcp

echo "2. Building Upstream Currency MCP server..."
docker build -t mcp-platform/upstream-currency:latest ./services/upstream-currency-mcp

echo "3. Building Upstream Inventory MCP server..."
docker build -t mcp-platform/upstream-inventory:latest ./services/upstream-inventory-mcp

echo "4. Building Team MCP Gateway backend..."
docker build -t mcp-platform/gateway:latest ./services/gateway

echo "5. Building React Frontend Dashboard..."
docker build -t mcp-platform/dashboard:latest ./services/dashboard

echo "============================================="
echo " Loading Images into Kind Cluster (${CLUSTER_NAME}) "
echo "============================================="
kind load docker-image mcp-platform/woocommerce-mcp:latest --name "${CLUSTER_NAME}"
kind load docker-image mcp-platform/upstream-currency:latest --name "${CLUSTER_NAME}"
kind load docker-image mcp-platform/upstream-inventory:latest --name "${CLUSTER_NAME}"
kind load docker-image mcp-platform/gateway:latest --name "${CLUSTER_NAME}"
kind load docker-image mcp-platform/dashboard:latest --name "${CLUSTER_NAME}"

echo "All images successfully built and loaded into Kind!"
