/**
 * MCP server initialization and tool registration.
 * Creates the MCP server instance and sets up all tool handlers.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { EnvConfig } from '../config/schema.ts';
import { preloadPackages, getPackageState } from '../mathematica/package-loader.ts';
import { checkWolframScriptInstallation } from '../mathematica/executor.ts';
import {
  EXECUTE_MATHEMATICA_TOOL,
  handleExecuteMathematica,
} from '../tools/execute-mathematica.ts';
import {
  LIST_PACKAGES_TOOL,
  handleListPackages,
} from '../tools/list-packages.ts';
import { WolframScriptNotFoundError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Create and initialize MCP server
 */
export async function createMcpServer(config: EnvConfig): Promise<Server> {
  logger.info('Initializing Mathematica MCP server...');

  // Check WolframScript installation
  logger.info('Checking WolframScript installation...');
  const wolframAvailable = await checkWolframScriptInstallation(config.WOLFRAM_SCRIPT_PATH);

  if (!wolframAvailable) {
    throw new WolframScriptNotFoundError(config.WOLFRAM_SCRIPT_PATH);
  }

  // Create server instance
  const server = new Server(
    {
      name: 'mathematica-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  logger.info('MCP server instance created');

  // Pre-load Mathematica packages
  try {
    logger.info('Pre-loading Mathematica packages...');
    await preloadPackages(config.PACKAGES_CONFIG_PATH, config.WOLFRAM_SCRIPT_PATH);

    const packageState = getPackageState();
    logger.info(
      `Package loading ${packageState.loaded ? 'succeeded' : 'skipped'} ` +
      `(${packageState.packages.length} packages)`
    );
  } catch (error) {
    logger.error('Package pre-loading failed:', error);
    logger.warn('Server will start without pre-loaded packages');
    // Don't throw - allow server to start without packages
  }

  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug('Handling tools/list request');

    return {
      tools: [
        EXECUTE_MATHEMATICA_TOOL,
        LIST_PACKAGES_TOOL,
      ],
    };
  });

  // Register tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    logger.debug(`Handling tools/call request for: ${toolName}`);

    switch (toolName) {
      case 'execute_mathematica':
        return await handleExecuteMathematica(request, config);

      case 'list_packages':
        return await handleListPackages(request);

      default:
        logger.error(`Unknown tool requested: ${toolName}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'MethodNotFound',
                message: `Unknown tool: ${toolName}`,
                timestamp: new Date().toISOString(),
              }),
            },
          ],
          isError: true,
        };
    }
  });

  logger.info('MCP server initialized successfully');

  return server;
}

/**
 * Get server information for logging/debugging
 */
export function getServerInfo(): {
  name: string;
  version: string;
  tools: string[];
} {
  return {
    name: 'mathematica-mcp-server',
    version: '1.0.0',
    tools: [
      EXECUTE_MATHEMATICA_TOOL.name,
      LIST_PACKAGES_TOOL.name,
    ],
  };
}

/**
 * Print server information
 */
export function printServerInfo(): void {
  const info = getServerInfo();

  logger.info('=== MCP Server Information ===');
  logger.info(`Name: ${info.name}`);
  logger.info(`Version: ${info.version}`);
  logger.info(`Tools: ${info.tools.join(', ')}`);
  logger.info('==============================');
}
