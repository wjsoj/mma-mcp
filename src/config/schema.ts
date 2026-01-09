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
  DEFAULT_TIMEOUT: z.coerce.number().int().min(1000).max(600000).default(30000),
  MAX_TIMEOUT: z.coerce.number().int().min(1000).max(600000).default(300000),
  KERNEL_WARMUP_DELAY: z.coerce.number().int().min(0).max(180000).default(5000)
    .describe('Delay in ms after kernel warmup before starting transport (0-180000)'),

  // Package configuration
  PACKAGES_CONFIG_PATH: z.string().default('./config/packages.json'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

/**
 * Package configuration file schema (packages.json)
 */
export const PackagesConfigSchema = z.object({
  version: z.string().describe('Configuration version'),
  packages: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9`]*$/))
    .describe('List of Mathematica package names to pre-load'),
  autoLoad: z.boolean().default(true)
    .describe('Whether to automatically load packages on server startup'),
  description: z.string().optional()
    .describe('Human-readable description of this configuration'),
});

export type PackagesConfig = z.infer<typeof PackagesConfigSchema>;

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

  timeout: z.number().int().min(1000).max(600000).optional()
    .describe('Execution timeout in milliseconds (overrides default, clamped to MAX_TIMEOUT)'),

  autoLoadPackages: z.boolean().default(true)
    .describe('Whether to automatically load pre-configured packages'),

  additionalPackages: z.array(
    z.string().regex(/^[A-Za-z][A-Za-z0-9`]*$/)
  ).optional()
    .describe('Additional packages to load for this execution only'),
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
 * Tool output schema for list_packages
 */
export const ListPackagesOutputSchema = z.object({
  configuredPackages: z.array(z.string())
    .describe('List of pre-configured Mathematica packages'),
  autoLoad: z.boolean()
    .describe('Whether packages are auto-loaded on startup'),
  total: z.number().int()
    .describe('Total number of configured packages'),
  loaded: z.boolean()
    .describe('Whether packages have been loaded in current session'),
});

export type ListPackagesOutput = z.infer<typeof ListPackagesOutputSchema>;

/**
 * Execution options schema (internal)
 */
export const ExecuteOptionsSchema = z.object({
  timeout: z.number().int().min(1000),
  format: OutputFormatSchema,
  packages: z.array(z.string()),
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
