/**
 * HTTP transport for MCP server using Bun.serve().
 * Uses Streamable HTTP (SSE) transport for full MCP protocol support.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { EnvConfig } from '../../config/schema.ts';
import {
  validateBearerToken,
  createUnauthorizedResponse,
  logAuthAttempt,
  validateApiKeySecurity,
} from '../../middleware/auth.ts';
import { logger } from '../../utils/logger.ts';

/**
 * Start HTTP transport using Bun.serve() with Streamable HTTP (SSE) support
 *
 * @param mcpServer - MCP server instance
 * @param config - Environment configuration
 */
export async function startHttpTransport(
  mcpServer: Server,
  config: EnvConfig
) {
  logger.info('Starting HTTP transport with Streamable HTTP (SSE)...');

  // Validate API key security if configured
  if (config.MCP_API_KEY) {
    const warnings = validateApiKeySecurity(config.MCP_API_KEY);
    if (warnings.length > 0) {
      logger.warn('API Key Security Warnings:');
      warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }
  } else {
    logger.warn('⚠️  HTTP transport started WITHOUT authentication!');
    logger.warn('⚠️  Set MCP_API_KEY environment variable to enable authentication.');
  }

  // Create Streamable HTTP transport for MCP
  // Use stateful mode with session management
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  logger.debug('Streamable HTTP transport created');

  // Connect MCP server to transport
  await mcpServer.connect(transport);

  logger.info('MCP server connected to HTTP transport');

  // Create Bun HTTP server
  const httpServer = Bun.serve({
    port: config.MCP_HTTP_PORT,
    hostname: config.MCP_HTTP_HOST,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const method = req.method;

      logger.debug(`[HTTP] ${method} ${url.pathname}`);

      // Handle /mcp endpoint (main MCP protocol endpoint)
      // Supports GET (SSE stream), POST (JSON-RPC), and DELETE (session termination)
      if (url.pathname === '/mcp') {
        // Validate bearer token for authentication
        if (!validateBearerToken(req, config.MCP_API_KEY)) {
          logAuthAttempt(req, false);
          return createUnauthorizedResponse('Invalid or missing bearer token');
        }

        logAuthAttempt(req, true);

        try {
          // Delegate to the MCP transport's handleRequest
          // This handles the full MCP protocol (SSE streams, JSON-RPC, etc.)
          return await transport.handleRequest(req);
        } catch (error) {
          logger.error('[HTTP] Error handling MCP request:', error);

          return new Response(
            JSON.stringify({
              error: 'InternalError',
              message: error instanceof Error ? error.message : 'Internal server error',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }
      }

      // Handle /health endpoint (health check, no auth required)
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            server: 'mathematica-mcp-server',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            transport: 'streamable-http',
            note: 'Full MCP protocol support with SSE',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Handle /info endpoint (server info, no auth required)
      if (url.pathname === '/info') {
        return new Response(
          JSON.stringify({
            name: 'mathematica-mcp-server',
            version: '1.0.0',
            transport: 'streamable-http',
            endpoints: {
              mcp: '/mcp (GET for SSE stream, POST for JSON-RPC, DELETE for session termination)',
              health: '/health',
              info: '/info',
            },
            authentication: config.MCP_API_KEY ? 'bearer' : 'disabled',
            timestamp: new Date().toISOString(),
            note: 'Full MCP protocol support with Streamable HTTP (SSE)',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // 404 for unknown endpoints
      return new Response(
        JSON.stringify({
          error: 'NotFound',
          message: `Endpoint not found: ${url.pathname}`,
          availableEndpoints: ['/health', '/info'],
          timestamp: new Date().toISOString(),
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    },

    // Error handler
    error(error: Error): Response {
      logger.error('[HTTP] Server error:', error);

      return new Response(
        JSON.stringify({
          error: 'InternalError',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    },
  });

  logger.info(`HTTP server listening on http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}`);
  logger.info(`MCP endpoint: http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/mcp`);
  logger.info(`Health check: http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/health`);
  logger.info(`Server info: http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/info`);
  logger.info('Transport: Streamable HTTP (SSE) - Full MCP protocol support');

  if (config.MCP_API_KEY) {
    logger.info('Authentication: Bearer token (enabled)');
  } else {
    logger.warn('Authentication: Disabled (no API key configured)');
  }

  return httpServer;
}

/**
 * Stop HTTP transport and clean up
 */
export async function stopHttpTransport(httpServer: any): Promise<void> {
  logger.info('Stopping HTTP transport...');
  httpServer.stop();
  logger.info('HTTP transport stopped');
}

/**
 * Get HTTP transport information for logging
 */
export function getHttpTransportInfo(config: EnvConfig) {
  return {
    type: 'streamable-http',
    host: config.MCP_HTTP_HOST,
    port: config.MCP_HTTP_PORT,
    url: `http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}`,
    mcpEndpoint: `http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/mcp`,
    authenticated: !!config.MCP_API_KEY,
  };
}

/**
 * Print HTTP transport information
 */
export function printHttpTransportInfo(config: EnvConfig): void {
  const info = getHttpTransportInfo(config);

  logger.info('=== HTTP Transport Information ===');
  logger.info(`Type: ${info.type}`);
  logger.info(`Host: ${info.host}`);
  logger.info(`Port: ${info.port}`);
  logger.info(`URL: ${info.url}`);
  logger.info(`MCP Endpoint: ${info.mcpEndpoint}`);
  logger.info(`Authenticated: ${info.authenticated}`);
  logger.info('===================================');
}
