/**
 * Execute Mathematica code MCP tool.
 * Handles the execute_mathematica tool registration and execution.
 */

import type {
  CallToolRequest,
  CallToolResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ExecuteMathematicaInputSchema, type EnvConfig } from '../config/schema.ts';
import { executeWolframScript } from '../mathematica/executor.ts';
import { getLoadedPackages } from '../mathematica/package-loader.ts';
import { mergePackages } from '../config/packages.ts';
import { formatErrorForMcp } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Tool definition for execute_mathematica
 */
export const EXECUTE_MATHEMATICA_TOOL: Tool = {
  name: 'execute_mathematica',
  description: 'Execute Mathematica code and return results in various formats (text, LaTeX, or Mathematica syntax)',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Mathematica code to execute',
      },
      format: {
        type: 'string',
        enum: ['text', 'latex', 'mathematica'],
        description: 'Output format: text (default), latex (TeXForm), or mathematica (InputForm)',
        default: 'text',
      },
      timeout: {
        type: 'number',
        description: 'Execution timeout in milliseconds (1000-600000, clamped to MAX_TIMEOUT)',
        minimum: 1000,
        maximum: 600000,
      },
      autoLoadPackages: {
        type: 'boolean',
        description: 'Whether to automatically load pre-configured packages',
        default: true,
      },
      additionalPackages: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Additional packages to load for this execution only',
      },
    },
    required: ['code'],
  },
};

/**
 * Handle execute_mathematica tool call
 */
export async function handleExecuteMathematica(
  request: CallToolRequest,
  config: EnvConfig
): Promise<CallToolResult> {
  const toolName = 'execute_mathematica';

  try {
    logger.info(`[${toolName}] Tool called`);

    // Validate and parse input using Zod
    const input = ExecuteMathematicaInputSchema.parse(request.params.arguments);

    logger.debug(`[${toolName}] Input:`, {
      codeLength: input.code.length,
      format: input.format,
      timeout: input.timeout,
      autoLoadPackages: input.autoLoadPackages,
      additionalPackages: input.additionalPackages?.length || 0,
    });

    // Determine timeout (respect MAX_TIMEOUT)
    const timeout = Math.min(
      input.timeout ?? config.DEFAULT_TIMEOUT,
      config.MAX_TIMEOUT
    );

    if (input.timeout && input.timeout > config.MAX_TIMEOUT) {
      logger.warn(
        `[${toolName}] Requested timeout ${input.timeout}ms exceeds MAX_TIMEOUT ${config.MAX_TIMEOUT}ms, clamping`
      );
    }

    // Build package list
    let packages: string[] = [];

    if (input.autoLoadPackages) {
      const loadedPackages = getLoadedPackages();
      const additionalPackages = input.additionalPackages || [];

      packages = mergePackages(loadedPackages, additionalPackages);

      logger.debug(`[${toolName}] Using ${packages.length} package(s):`, packages.join(', '));
    } else if (input.additionalPackages && input.additionalPackages.length > 0) {
      packages = input.additionalPackages;

      logger.debug(
        `[${toolName}] Auto-load disabled, using ${packages.length} additional package(s):`,
        packages.join(', ')
      );
    }

    // Execute Mathematica code
    const result = await executeWolframScript(
      input.code,
      {
        timeout,
        format: input.format,
        packages,
      },
      config.WOLFRAM_SCRIPT_PATH
    );

    logger.info(`[${toolName}] Execution successful (${result.executionTime}ms)`);

    // Return MCP response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(`[${toolName}] Execution failed:`, error);

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
