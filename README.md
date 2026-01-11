# Mathematica MCP Server

A production-ready [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that executes Mathematica code with package management, built from scratch using Bun, TypeScript, and Zod validation.

## Features

- 🚀 **Dual Transport Support**: HTTP/SSE and stdio transports
- 🔐 **Secure Authentication**: Bearer token authentication for HTTP transport
- 📦 **Package Management**: Pre-load and manage Mathematica packages
- ⏱️ **Timeout Control**: Configurable execution timeouts with dual protection
- 📝 **Multiple Output Formats**: text, LaTeX (TeXForm), and Mathematica (InputForm)
- ✅ **Type-Safe**: Full TypeScript implementation with Zod schema validation
- ⚡ **Bun-Powered**: Built on Bun for fast performance
- 🛡️ **Security**: Command injection prevention, timing-safe authentication

## Prerequisites

- [Bun](https://bun.sh/) (latest version recommended)
- [Mathematica](https://www.wolfram.com/mathematica/) with `wolframscript` in PATH
- Node.js 18+ (for TypeScript support)

## Installation

1. Navigate to the project directory:
```bash
cd mma-mcp
```

2. Install dependencies:
```bash
bun install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` to set your configuration.

4. Configure packages (optional):

Edit `config/packages.json` to specify which Mathematica packages to pre-load.

## Quick Start

### Minimal Commands (No .env file required)

```bash
# HTTP mode - default port 3000, no authentication
bun run start:http

# HTTP mode - custom port (e.g., 8080)
MCP_HTTP_PORT=8080 bun run start:http

# Stdio mode - for Claude Desktop integration
bun index.ts
```

### HTTP/SSE Mode

```bash
# Generate API key and start server
MCP_TRANSPORT=http MCP_API_KEY=$(bun run generate-key) bun start
```

Server will start on `http://127.0.0.1:3000/mcp`

### Stdio Mode

```bash
# Start server with stdio transport
MCP_TRANSPORT=stdio bun start
```

## Available Scripts

```bash
bun start              # Start server (uses .env)
bun run start:http     # Start with HTTP transport
bun run start:stdio    # Start with stdio transport
bun run dev            # Development mode with auto-reload
bun test               # Run tests
bun run typecheck      # Type checking
bun run generate-key   # Generate secure API key
```

## Tools

### execute_mathematica

Execute Mathematica code with configurable options.

**Parameters:**
- `code` (string, required): Mathematica code
- `format` (string): Output format - `text`, `latex`, `mathematica` (default: `text`)
- `timeout` (number): Timeout in ms (1000-600000)
- `autoLoadPackages` (boolean): Auto-load configured packages (default: `true`)
- `additionalPackages` (string[]): Additional packages to load

### list_packages

Get list of configured Mathematica packages.

## HTTP API Endpoints

When running in HTTP mode, the server exposes the following endpoints:

### GET /health

Comprehensive health check endpoint that verifies all critical server components are operational.

**Authentication:** None required

**Response Status Codes:**
- `200 OK` - All checks passed, server is fully operational
- `503 Service Unavailable` - Server is initializing or one or more checks failed

**Response Format:**

**Healthy Response (200 OK):**
```json
{
  "status": "ok",
  "server": "mathematica-mcp-server",
  "version": "1.0.0",
  "timestamp": "2024-01-09T10:30:00.000Z",
  "uptime": 123.45,
  "startedAt": "2024-01-09T10:28:00.000Z",
  "transport": "streamable-http",
  "checks": {
    "wolframScript": true,
    "wolframKernel": true,
    "mcpServer": true,
    "transport": true
  }
}
```

**Unhealthy Response (503 Service Unavailable):**
```json
{
  "status": "error",
  "server": "mathematica-mcp-server",
  "version": "1.0.0",
  "timestamp": "2024-01-09T10:30:00.000Z",
  "uptime": 10.5,
  "startedAt": "2024-01-09T10:29:50.000Z",
  "transport": "streamable-http",
  "checks": {
    "wolframScript": false,
    "wolframKernel": false,
    "mcpServer": true,
    "transport": true
  },
  "error": "WolframScript not found at path: wolframscript",
  "failedChecks": [
    "WolframScript not available",
    "Wolfram Kernel not initialized"
  ]
}
```

**Initializing Response (503 Service Unavailable):**
```json
{
  "status": "initializing",
  "server": "mathematica-mcp-server",
  "version": "1.0.0",
  "timestamp": "2024-01-09T10:28:05.000Z",
  "uptime": 5.2,
  "startedAt": "2024-01-09T10:28:00.000Z",
  "transport": "streamable-http",
  "checks": {
    "wolframScript": false,
    "wolframKernel": false,
    "mcpServer": false,
    "transport": false
  }
}
```

**Health Status Values:**
- `ok` - All checks passed, server is ready to execute Mathematica code
- `initializing` - Server is starting up, not yet ready
- `error` - One or more checks failed

**Health Checks:**

The endpoint verifies the following components:

- `wolframScript` - WolframScript executable is available
- `wolframKernel` - Wolfram Kernel has been initialized
- `mcpServer` - MCP server instance is connected
- `transport` - HTTP transport is connected

**Note:** Package loading status is NOT considered a failure condition. The server can operate without pre-loaded packages.

**Example Usage:**

```bash
# Check server health
curl http://127.0.0.1:3000/health

# Check health with pretty output
curl -s http://127.0.0.1:3000/health | jq

# Use in health check scripts (exits with non-zero on error)
curl -f http://127.0.0.1:3000/health || echo "Server is not healthy"

# Check only HTTP status code
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health
```

### GET /info

Server information endpoint (authentication not required).

### POST /mcp

Main MCP protocol endpoint for executing tools (requires authentication if `MCP_API_KEY` is set).

## Server Startup and Initialization

The server follows a multi-stage initialization process to ensure the Wolfram Kernel is fully ready before accepting requests:

### Initialization Stages

1. **WolframScript Check** - Verifies `wolframscript` executable is installed and accessible
2. **MCP Server Creation** - Initializes the MCP server instance and registers tools
3. **Kernel Warmup** - Executes a simple computation (`1+1`) to initialize the Wolfram Kernel
4. **Transport Start** - Starts HTTP or stdio transport and begins accepting requests

## Documentation

See the full [README](./README.md) for:
- Detailed configuration options
- Usage examples
- Security guidelines
- Troubleshooting
- API documentation

## License

MIT
