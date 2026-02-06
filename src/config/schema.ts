/**
 * Central Zod schemas for type-safe validation across the application.
 * All configuration, input, and output schemas are defined here.
 */

import { z } from 'zod';

/**
 * Environment configuration schema
 * Validates and provides defaults for all environment variables
 */
export const EnvSchema = z.object({
  // Transport configuration
  MCP_TRANSPORT: z.enum(['http', 'stdio']).default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MCP_HTTP_HOST: z.string().default('127.0.0.1'),

  // Authentication (HTTP only)
  MCP_API_KEY: z.string().min(32).optional()
    .describe('API key for bearer token authentication (min 32 characters)'),

  // Mathematica/WolframScript configuration
  WOLFRAM_SCRIPT_PATH: z.string().default('wolframscript'),
  DEFAULT_TIMEOUT: z.coerce.number().int().min(1).max(86400).default(300),
  MAX_TIMEOUT: z.coerce.number().int().min(1).max(86400).default(86400),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Output format enum for Mathematica execution
 */
export const OutputFormatSchema = z.enum(['text', 'latex', 'mathematica']);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

/**
 * Tool input schema for execute_mathematica
 */
export const ExecuteMathematicaInputSchema = z.object({
  code: z.string().min(1).describe('Mathematica code to execute'),

  format: OutputFormatSchema.default('text')
    .describe('Output format: text (default), latex (TeXForm), or mathematica (InputForm)'),

  timeout: z.number().int().min(1).max(86400).optional()
    .describe('Execution timeout in seconds (overrides default, clamped to MAX_TIMEOUT)'),

  path: z.string().optional()
    .describe('Working directory for wolframscript execution'),
});

export type ExecuteMathematicaInput = z.infer<typeof ExecuteMathematicaInputSchema>;

/**
 * Execution result schema (internal)
 */
export const ExecutionResultSchema = z.object({
  format: OutputFormatSchema,
  content: z.string().describe('Formatted output content'),
  executionTime: z.number().optional().describe('Execution time in milliseconds'),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

/**
 * Execution options schema (internal)
 */
export const ExecuteOptionsSchema = z.object({
  timeout: z.number().int().min(1),
  format: OutputFormatSchema,
  path: z.string().optional(),
});

export type ExecuteOptions = z.infer<typeof ExecuteOptionsSchema>;

/**
 * MCP error response schema
 */
export const McpErrorResponseSchema = z.object({
  error: z.string().describe('Error type/name'),
  message: z.string().describe('Human-readable error message'),
  timestamp: z.string().describe('ISO 8601 timestamp'),
  details: z.unknown().optional().describe('Additional error details'),
});

export type McpErrorResponse = z.infer<typeof McpErrorResponseSchema>;
