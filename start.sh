#!/bin/bash

# cc-caller - Start Script
# Starts all three components: Backend, Frontend, and optionally the MCP server

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           🔔 cc-caller - Starting Services 🔔              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "Done!"
}

trap cleanup EXIT

# Start Backend
echo "📡 Starting Backend (port 3001)..."
cd "$PROJECT_DIR/backend"
npm start &
BACKEND_PID=$!
sleep 2

# Start Frontend
echo "🌐 Starting Frontend (port 3000)..."
cd "$PROJECT_DIR/frontend"
npm run preview -- --port 3000 &
FRONTEND_PID=$!
sleep 2

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Services Started                      ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  🌐 Web App:    http://localhost:3000                      ║"
echo "║  📡 Backend:    http://localhost:3001                      ║"
echo "║  🔌 WebSocket:  ws://localhost:3001                        ║"
echo "║                                                            ║"
echo "║  To use with Claude Code, add this MCP config:             ║"
echo "║                                                            ║"
echo "║  {                                                         ║"
echo "║    \"mcpServers\": {                                        ║"
echo "║      \"cc-caller\": {                                      ║"
echo "║        \"command\": \"node\",                                ║"
echo "║        \"args\": [\"$PROJECT_DIR/mcp-server/dist/index.js\"]  ║"
echo "║      }                                                     ║"
echo "║    }                                                       ║"
echo "║  }                                                         ║"
echo "║                                                            ║"
echo "║  Press Ctrl+C to stop all services                         ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Wait for any process to exit
wait
