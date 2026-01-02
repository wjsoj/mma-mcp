#!/usr/bin/env bun

/**
 * Mathematica MCP Server - Entry Point
 *
 * A Model Context Protocol (MCP) server that executes Mathematica code
 * and provides package management capabilities.
 *
 * Features:
 * - Execute Mathematica code with configurable timeout
 * - Support for multiple output formats (text, LaTeX, Mathematica syntax)
 * - Pre-load and manage Mathematica packages
 * - Dual transport support: HTTP/SSE and stdio
 * - Bearer token authentication for HTTP transport
 * - Full TypeScript implementation with Zod validation
 */

import { startServer, setupShutdownHandlers } from './src/server/index.ts';
import { logger } from './src/utils/logger.ts';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Setup graceful shutdown handlers
    setupShutdownHandlers();

    // Start the server
    await startServer();

    // Keep the process alive
    // Server will run until interrupted by SIGINT/SIGTERM
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the server
main();