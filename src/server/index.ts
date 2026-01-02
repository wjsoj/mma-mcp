/**
 * Server orchestrator.
 * Loads configuration, creates MCP server, and starts the appropriate transport.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { loadEnvConfig, printEnvConfig } from '../config/env.ts';
import { createMcpServer, printServerInfo } from './mcp-server.ts';
import {
  startHttpTransport,
  stopHttpTransport,
  printHttpTransportInfo,
} from './transports/http.ts';
import {
  startStdioTransport,
  warnIfInteractive,
  printStdioTransportInfo,
} from './transports/stdio.ts';
import { logger } from '../utils/logger.ts';

// Global references for cleanup
let mcpServer: Server | null = null;
let httpServer: any = null;

/**
 * Start the MCP server with configured transport
 */
export async function startServer(): Promise<void> {
  try {
    logger.info('┌────────────────────────────────────────────┐');
    logger.info('│  Mathematica MCP Server                    │');
    logger.info('│  Version 1.0.0                             │');
    logger.info('└────────────────────────────────────────────┘');
    logger.info('');

    // Load and validate environment configuration
    logger.info('Loading configuration...');
    const config = loadEnvConfig();

    // Print configuration (for debugging)
    if (logger.getLevel() === 'debug') {
      printEnvConfig(config);
    }

    // Set logger level from config
    logger.setLevel(config.LOG_LEVEL);

    // Create MCP server instance
    logger.info('Creating MCP server...');
    mcpServer = await createMcpServer(config);

    // Print server information
    printServerInfo();

    // Start appropriate transport based on configuration
    if (config.MCP_TRANSPORT === 'http') {
      logger.info('Transport mode: HTTP/SSE');

      httpServer = await startHttpTransport(mcpServer, config);

      if (logger.getLevel() === 'debug') {
        printHttpTransportInfo(config);
      }

      logger.info('');
      logger.info('✓ Server started successfully!');
      logger.info('');
      logger.info('To use the server, send MCP requests to:');
      logger.info(`  http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/mcp`);

      if (config.MCP_API_KEY) {
        logger.info('');
        logger.info('Authentication is enabled. Include header:');
        logger.info(`  Authorization: Bearer ${config.MCP_API_KEY.substring(0, 8)}...`);
      }

      logger.info('');
      logger.info('Health check endpoint:');
      logger.info(`  http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/health`);

    } else {
      logger.info('Transport mode: stdio');

      // Warn if running in interactive mode
      warnIfInteractive();

      if (logger.getLevel() === 'debug') {
        printStdioTransportInfo();
      }

      await startStdioTransport(mcpServer);

      logger.info('');
      logger.info('✓ Server started successfully!');
      logger.info('');
      logger.info('Server is ready to receive JSON-RPC messages via stdin.');
      logger.info('All logs are redirected to stderr.');
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

/**
 * Stop the MCP server and clean up resources
 */
export async function stopServer(): Promise<void> {
  try {
    logger.info('Stopping server...');

    // Stop HTTP server if running
    if (httpServer) {
      await stopHttpTransport(httpServer);
      httpServer = null;
    }

    // Close MCP server
    if (mcpServer) {
      await mcpServer.close();
      mcpServer = null;
    }

    logger.info('Server stopped successfully');
  } catch (error) {
    logger.error('Error stopping server:', error);
    throw error;
  }
}

/**
 * Get server status
 */
export function getServerStatus(): {
  running: boolean;
  transport: 'http' | 'stdio' | null;
  hasHttpServer: boolean;
  hasMcpServer: boolean;
} {
  return {
    running: mcpServer !== null,
    transport: httpServer ? 'http' : mcpServer ? 'stdio' : null,
    hasHttpServer: httpServer !== null,
    hasMcpServer: mcpServer !== null,
  };
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers(): void {
  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await stopServer();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle SIGTERM (termination signal)
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception:', error);
    handleShutdown('uncaughtException').catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection:', reason);
    handleShutdown('unhandledRejection').catch(() => process.exit(1));
  });

  logger.debug('Shutdown handlers configured');
}
