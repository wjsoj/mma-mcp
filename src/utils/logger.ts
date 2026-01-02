/**
 * Logging utility for the Mathematica MCP server.
 * Supports multiple log levels and stderr redirection for stdio transport mode.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger class with configurable log levels and output streams
 */
class Logger {
  private level: LogLevel;
  private useStderr: boolean = false;
  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  /**
   * Redirect all logging to stderr instead of stdout.
   * CRITICAL: Must be called when using stdio transport to avoid polluting the protocol stream.
   */
  public redirectToStderr(): void {
    this.useStderr = true;
    this.info('Logger redirected to stderr (stdio mode)');
  }

  /**
   * Set the logging level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current logging level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if a given level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  /**
   * Internal log method that handles output stream selection
   */
  private log(level: LogLevel, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (this.useStderr) {
      console.error(prefix, ...args);
    } else {
      // Map log levels to appropriate console methods
      switch (level) {
        case 'debug':
          console.debug(prefix, ...args);
          break;
        case 'info':
          console.info(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'error':
          console.error(prefix, ...args);
          break;
      }
    }
  }

  /**
   * Log debug message (lowest priority)
   */
  public debug(...args: unknown[]): void {
    this.log('debug', ...args);
  }

  /**
   * Log info message
   */
  public info(...args: unknown[]): void {
    this.log('info', ...args);
  }

  /**
   * Log warning message
   */
  public warn(...args: unknown[]): void {
    this.log('warn', ...args);
  }

  /**
   * Log error message (highest priority)
   */
  public error(...args: unknown[]): void {
    this.log('error', ...args);
  }

  /**
   * Log with a specific level dynamically
   */
  public logWithLevel(level: LogLevel, ...args: unknown[]): void {
    this.log(level, ...args);
  }

  /**
   * Create a child logger with a prefix
   * Useful for module-specific logging
   */
  public createChild(prefix: string): Logger {
    const childLogger = new Logger(this.level);
    childLogger.useStderr = this.useStderr;

    // Override log method to include prefix
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, ...args: unknown[]) => {
      originalLog(level, `[${prefix}]`, ...args);
    };

    return childLogger;
  }
}

/**
 * Global logger instance
 * Can be configured via environment variables
 */
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);

/**
 * Export Logger class for custom instances
 */
export { Logger };
