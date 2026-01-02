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

## Documentation

See the full [README](./README.md) for:
- Detailed configuration options
- Usage examples
- Security guidelines
- Troubleshooting
- API documentation

## License

MIT
