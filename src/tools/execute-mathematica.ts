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
import { formatErrorForMcp } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Tool definition for execute_mathematica
 */
export const EXECUTE_MATHEMATICA_TOOL: Tool = {
  name: 'execute_mathematica',
  description: 'Execute Mathematica code and return results in various formats (text, LaTeX, or Mathematica syntax). Users should load packages themselves using Needs[] or Get[] in their code.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Mathematica code to execute. Use Needs["Package`"] or Get["Package`"] to load packages.',
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
      path: {
        type: 'string',
        description: 'Working directory for wolframscript execution',
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
      path: input.path,
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

    // Execute Mathematica code
    const result = await executeWolframScript(
      input.code,
      {
        timeout,
        format: input.format,
        path: input.path,
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
