/**
 * Custom error classes for the Mathematica MCP server.
 * Provides specific error types for different failure scenarios.
 */

/**
 * Base class for all Mathematica-related errors
 */
export class MathematicaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MathematicaError';
    Object.setPrototypeOf(this, MathematicaError.prototype);
  }
}

/**
 * Error thrown when Mathematica execution exceeds the timeout limit
 */
export class MathematicaTimeoutError extends MathematicaError {
  public readonly timeout: number;

  constructor(timeout: number) {
    super(`Execution exceeded timeout of ${timeout}ms`);
    this.name = 'MathematicaTimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, MathematicaTimeoutError.prototype);
  }
}

/**
 * Error thrown when Mathematica code execution fails
 */
export class MathematicaExecutionError extends MathematicaError {
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(`Execution failed: ${message}`);
    this.name = 'MathematicaExecutionError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, MathematicaExecutionError.prototype);
  }
}

/**
 * Error thrown when WolframScript is not installed or accessible
 */
export class WolframScriptNotFoundError extends MathematicaError {
  constructor(path: string) {
    super(`WolframScript not found at path: ${path}. Please ensure Mathematica is installed.`);
    this.name = 'WolframScriptNotFoundError';
    Object.setPrototypeOf(this, WolframScriptNotFoundError.prototype);
  }
}

/**
 * Base class for configuration-related errors
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when environment variable validation fails
 */
export class EnvValidationError extends ConfigurationError {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(issues: Array<{ path: string; message: string }>) {
    const issuesList = issues.map(i => `  - ${i.path}: ${i.message}`).join('\n');
    super(`Environment validation failed:\n${issuesList}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
    Object.setPrototypeOf(this, EnvValidationError.prototype);
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error thrown when an invalid bearer token is provided
 */
export class InvalidTokenError extends AuthenticationError {
  constructor() {
    super('Invalid or missing bearer token');
    this.name = 'InvalidTokenError';
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
  }
}

/**
 * Type guard to check if an error is a MathematicaError
 */
export function isMathematicaError(error: unknown): error is MathematicaError {
  return error instanceof MathematicaError;
}

/**
 * Type guard to check if an error is a ConfigurationError
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/**
 * Extract a user-friendly error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Format an error for MCP response
 */
export function formatErrorForMcp(error: unknown): {
  error: string;
  message: string;
  timestamp: string;
  details?: unknown;
} {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    return {
      error: error.name,
      message: error.message,
      timestamp,
      details: error instanceof MathematicaError || error instanceof ConfigurationError
        ? Object.getOwnPropertyNames(error).reduce((acc, key) => {
            if (key !== 'name' && key !== 'message' && key !== 'stack') {
              acc[key] = (error as any)[key];
            }
            return acc;
          }, {} as Record<string, unknown>)
        : undefined,
    };
  }

  return {
    error: 'UnknownError',
    message: String(error),
    timestamp,
  };
}
