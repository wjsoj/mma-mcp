/**
 * Stdio transport for MCP server.
 * Enables communication via standard input/output streams.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logger } from '../../utils/logger.ts';

/**
 * Start stdio transport
 * IMPORTANT: Redirects all logging to stderr to avoid polluting the protocol stream
 * @param server - MCP server instance
 */
export async function startStdioTransport(server: Server): Promise<void> {
  logger.info('Starting stdio transport...');

  // CRITICAL: Redirect all logging to stderr in stdio mode
  // Stdout is used for the MCP protocol, so any other output would corrupt it
  logger.redirectToStderr();

  logger.info('Logger redirected to stderr (stdio mode)');

  try {
    // Create stdio transport
    const transport = new StdioServerTransport();

    logger.debug('Stdio transport created');

    // Connect server to transport
    await server.connect(transport);

    logger.info('Stdio transport connected successfully');
    logger.info('Server is ready to receive messages via stdin/stdout');

    // Set up error handlers
    transport.onclose = () => {
      logger.info('Stdio transport closed');
    };

    transport.onerror = (error) => {
      logger.error('Stdio transport error:', error);
    };

    // Keep process alive
    // In stdio mode, the process will run until stdin is closed or SIGTERM/SIGINT is received
  } catch (error) {
    logger.error('Failed to start stdio transport:', error);
    throw error;
  }
}

/**
 * Check if stdin is a TTY (interactive terminal)
 * Stdio transport should not be used in interactive mode
 * @returns true if stdin is a TTY, false otherwise
 */
export function isInteractiveMode(): boolean {
  return process.stdin.isTTY || false;
}

/**
 * Warn if stdio transport is started in interactive mode
 */
export function warnIfInteractive(): void {
  if (isInteractiveMode()) {
    logger.warn('┌─────────────────────────────────────────────────────┐');
    logger.warn('│ WARNING: Stdio transport in interactive mode       │');
    logger.warn('│                                                     │');
    logger.warn('│ Stdio transport is designed for programmatic use.  │');
    logger.warn('│ For testing, use HTTP transport instead.           │');
    logger.warn('│                                                     │');
    logger.warn('│ The server expects JSON-RPC messages on stdin.     │');
    logger.warn('└─────────────────────────────────────────────────────┘');
  }
}

/**
 * Get stdio transport information for logging
 */
export function getStdioTransportInfo(): {
  type: string;
  interactive: boolean;
  stdinReadable: boolean;
  stdoutWritable: boolean;
} {
  return {
    type: 'stdio',
    interactive: isInteractiveMode(),
    stdinReadable: !process.stdin.destroyed && process.stdin.readable,
    stdoutWritable: !process.stdout.destroyed && process.stdout.writable,
  };
}

/**
 * Print stdio transport information
 */
export function printStdioTransportInfo(): void {
  const info = getStdioTransportInfo();

  logger.info('=== Stdio Transport Information ===');
  logger.info(`Type: ${info.type}`);
  logger.info(`Interactive: ${info.interactive}`);
  logger.info(`Stdin Readable: ${info.stdinReadable}`);
  logger.info(`Stdout Writable: ${info.stdoutWritable}`);
  logger.info('===================================');
}
