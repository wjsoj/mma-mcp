/**
 * Environment configuration loader and validator.
 * Loads environment variables and validates them using Zod schemas.
 * Note: Bun automatically loads .env files, so no additional loader is needed.
 */

import { EnvSchema, type EnvConfig } from './schema.ts';
import { EnvValidationError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Load and validate environment configuration
 * @returns Validated environment configuration
 * @throws {EnvValidationError} If validation fails
 */
export function loadEnvConfig(): EnvConfig {
  try {
    // Bun automatically loads .env file, so process.env is ready
    const config = EnvSchema.parse(process.env);

    logger.debug('Environment configuration loaded successfully');
    logger.debug('Transport mode:', config.MCP_TRANSPORT);
    logger.debug('Log level:', config.LOG_LEVEL);

    // Validate HTTP-specific requirements
    if (config.MCP_TRANSPORT === 'http') {
      if (!config.MCP_API_KEY) {
        logger.warn(
          'HTTP transport enabled but MCP_API_KEY is not set. ' +
          'Authentication will be disabled!'
        );
      } else if (config.MCP_API_KEY.length < 32) {
        logger.warn(
          `MCP_API_KEY is too short (${config.MCP_API_KEY.length} characters). ` +
          'For security, use at least 32 characters.'
        );
      }

      logger.info(`HTTP server will listen on ${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}`);
    }

    // Validate timeout constraints
    if (config.DEFAULT_TIMEOUT > config.MAX_TIMEOUT) {
      logger.warn(
        `DEFAULT_TIMEOUT (${config.DEFAULT_TIMEOUT}ms) is greater than MAX_TIMEOUT (${config.MAX_TIMEOUT}ms). ` +
        `Clamping to MAX_TIMEOUT.`
      );
      config.DEFAULT_TIMEOUT = config.MAX_TIMEOUT;
    }

    return config;
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      // Zod validation error
      const zodError = error as any;
      const issues = zodError.issues.map((issue: any) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      throw new EnvValidationError(issues);
    }

    throw error;
  }
}

/**
 * Get a specific environment variable with optional default
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Environment variable value or default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Validate that required environment variables are set
 * @param required - Array of required environment variable names
 * @throws {EnvValidationError} If any required variables are missing
 */
export function validateRequiredEnvVars(required: string[]): void {
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new EnvValidationError(
      missing.map(key => ({
        path: key,
        message: 'Required environment variable is not set',
      }))
    );
  }
}

/**
 * Print environment configuration (for debugging)
 * Redacts sensitive values like API keys
 */
export function printEnvConfig(config: EnvConfig): void {
  logger.info('=== Environment Configuration ===');
  logger.info(`Transport: ${config.MCP_TRANSPORT}`);

  if (config.MCP_TRANSPORT === 'http') {
    logger.info(`HTTP Host: ${config.MCP_HTTP_HOST}`);
    logger.info(`HTTP Port: ${config.MCP_HTTP_PORT}`);
    logger.info(`API Key: ${config.MCP_API_KEY ? '[REDACTED]' : '[NOT SET]'}`);
  }

  logger.info(`WolframScript Path: ${config.WOLFRAM_SCRIPT_PATH}`);
  logger.info(`Default Timeout: ${config.DEFAULT_TIMEOUT}ms`);
  logger.info(`Max Timeout: ${config.MAX_TIMEOUT}ms`);
  logger.info(`Packages Config: ${config.PACKAGES_CONFIG_PATH}`);
  logger.info(`Log Level: ${config.LOG_LEVEL}`);
  logger.info('================================');
}
