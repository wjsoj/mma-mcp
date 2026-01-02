/**
 * List packages MCP tool.
 * Returns information about configured Mathematica packages.
 */

import type {
  CallToolRequest,
  CallToolResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { ListPackagesOutput } from '../config/schema.ts';
import {
  getLoadedPackages,
  isAutoLoadEnabled,
  arePackagesLoaded,
} from '../mathematica/package-loader.ts';
import { formatErrorForMcp } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Tool definition for list_packages
 */
export const LIST_PACKAGES_TOOL: Tool = {
  name: 'list_packages',
  description: 'Get a list of pre-configured Mathematica packages available for use',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * Handle list_packages tool call
 */
export async function handleListPackages(
  request: CallToolRequest
): Promise<CallToolResult> {
  const toolName = 'list_packages';

  try {
    logger.info(`[${toolName}] Tool called`);

    // Get package information
    const configuredPackages = getLoadedPackages();
    const autoLoad = isAutoLoadEnabled();
    const loaded = arePackagesLoaded();

    const output: ListPackagesOutput = {
      configuredPackages,
      autoLoad,
      total: configuredPackages.length,
      loaded,
    };

    logger.debug(`[${toolName}] Returning ${output.total} package(s)`);

    // Return MCP response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(`[${toolName}] Failed:`, error);

    // Format error for MCP response
    const errorResponse = formatErrorForMcp(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
}
