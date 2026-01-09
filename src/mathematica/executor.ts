/**
 * Mathematica/WolframScript executor.
 * Handles safe execution of Mathematica code with timeout and package loading.
 */

import { $ } from 'bun';
import type { ExecuteOptions, ExecutionResult, OutputFormat } from '../config/schema.ts';
import {
  MathematicaTimeoutError,
  MathematicaExecutionError,
  WolframScriptNotFoundError,
} from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { formatOutput } from './formatter.ts';

/**
 * Check if WolframScript is installed and accessible
 * @param wolframPath - Path to wolframscript executable
 * @returns true if WolframScript is available, false otherwise
 */
export async function checkWolframScriptInstallation(
  wolframPath: string = 'wolframscript'
): Promise<boolean> {
  try {
    logger.debug(`Checking WolframScript installation at: ${wolframPath}`);

    const result = await $`${wolframPath} -version`.quiet();
    const version = result.stdout.toString().trim();

    logger.info(`WolframScript found: ${version}`);
    return true;
  } catch (error) {
    logger.error('WolframScript not found or not accessible:', error);
    return false;
  }
}

/**
 * Build Mathematica code with package loading prefix
 * @param code - User's Mathematica code
 * @param packages - List of packages to load
 * @returns Complete code with package loading
 */
function buildCodeWithPackages(code: string, packages: string[]): string {
  if (packages.length === 0) {
    return code;
  }

  // Build package loading commands
  // Using Get[] for each package ensures they're loaded properly
  const packageCommands = packages
    .map(pkg => `Get["${pkg}\`"]`)
    .join('; ');

  // Combine package loading with user code
  return `${packageCommands}; ${code}`;
}

/**
 * Get format option for wolframscript
 * @param format - Desired output format
 * @returns wolframscript format flag
 */
function getFormatOption(format: OutputFormat): string {
  switch (format) {
    case 'latex':
      return 'TeXForm';
    case 'mathematica':
      return 'InputForm';
    case 'text':
    default:
      return 'OutputForm';
  }
}

/**
 * Execute Mathematica code using wolframscript
 * @param code - Mathematica code to execute
 * @param options - Execution options (timeout, format, packages)
 * @returns Execution result with formatted output
 * @throws {MathematicaTimeoutError} If execution exceeds timeout
 * @throws {MathematicaExecutionError} If execution fails
 */
export async function executeWolframScript(
  code: string,
  options: ExecuteOptions,
  wolframPath: string = 'wolframscript'
): Promise<ExecutionResult> {
  const { timeout, format, packages } = options;

  logger.debug('Executing Mathematica code:', {
    codeLength: code.length,
    format,
    timeout,
    packagesCount: packages.length,
  });

  // Build complete code with package loading
  const fullCode = buildCodeWithPackages(code, packages);

  // Get format transformation
  const formatFunc = getFormatOption(format);

  // Wrap code with format transformation if needed
  const wrappedCode = format === 'text'
    ? fullCode
    : `${formatFunc}[${fullCode}]`;

  // Calculate timeout in seconds for wolframscript (rounds up)
  const timeoutSec = Math.ceil(timeout / 1000);

  const startTime = Date.now();

  try {
    logger.debug(`Executing with ${timeoutSec}s wolframscript timeout`);

    // Execute using Bun's $ with template literal for safe escaping
    const proc = $`${wolframPath} -timeout ${timeoutSec} -code ${wrappedCode}`.quiet();

    // Implement timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), timeout);
    });

    const result = await Promise.race([proc, timeoutPromise]);

    const output = result.stdout.toString();
    const stderr = result.stderr.toString();

    // Filter out benign WolframScript warnings
    if (stderr && stderr.trim().length > 0) {
      const stderrTrimmed = stderr.trim();

      // Ignore known benign warnings
      const benignWarnings = [
        'Failed to open configuaration file at path:', // WolframScript config file warning (typo is intentional)
        'Failed to open configuration file at path:',  // Also handle correct spelling
      ];

      const isBenignWarning = benignWarnings.some(warning =>
        stderrTrimmed.includes(warning)
      );

      if (!isBenignWarning) {
        logger.warn('WolframScript stderr output:', stderrTrimmed);
      } else {
        logger.debug('WolframScript benign warning (ignored):', stderrTrimmed);
      }
    }

    const executionTime = Date.now() - startTime;

    logger.debug(`Execution completed in ${executionTime}ms`);

    // Format the output
    return formatOutput(output, format, executionTime);
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Check if it's a timeout error
    if (error.name === 'TimeoutError' || error.message?.includes('timed out')) {
      logger.error(`Execution timed out after ${timeout}ms`);
      throw new MathematicaTimeoutError(timeout);
    }

    // Check if wolframscript is not found
    if (error.code === 'ENOENT' || error.message?.includes('not found')) {
      logger.error(`WolframScript not found at: ${wolframPath}`);
      throw new WolframScriptNotFoundError(wolframPath);
    }

    // Extract error message from stderr if available
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    const errorMessage = stderr.trim() || stdout.trim() || error.message || 'Unknown error';

    logger.error('Execution failed:', {
      error: errorMessage,
      executionTime,
      exitCode: error.exitCode,
    });

    throw new MathematicaExecutionError(errorMessage, error);
  }
}

/**
 * Execute a simple Mathematica expression (convenience wrapper)
 * @param expression - Simple Mathematica expression
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Output as string
 */
export async function executeSimple(
  expression: string,
  timeout: number = 30000,
  wolframPath: string = 'wolframscript'
): Promise<string> {
  const result = await executeWolframScript(
    expression,
    {
      timeout,
      format: 'text',
      packages: [],
    },
    wolframPath
  );

  return result.content;
}

/**
 * Verify that a specific Mathematica package exists
 * @param packageName - Name of the package to verify
 * @param wolframPath - Path to wolframscript
 * @returns true if package is found, false otherwise
 */
export async function verifyPackage(
  packageName: string,
  wolframPath: string = 'wolframscript'
): Promise<boolean> {
  try {
    // Use FindFile to check if package is available
    // Returns $Failed if not found, otherwise returns the path
    const code = `If[FindFile["${packageName}\`"] =!= $Failed, "OK", "FAILED"]`;

    const result = await executeSimple(code, 5000, wolframPath);

    const success = result.trim() === 'OK';

    if (success) {
      logger.debug(`Package verified: ${packageName}`);
    } else {
      logger.warn(`Package not found: ${packageName}`);
    }

    return success;
  } catch (error) {
    logger.error(`Package verification failed for ${packageName}:`, error);
    return false;
  }
}

/**
 * Warm up the Wolfram Kernel by executing a simple computation
 * This ensures the kernel is fully initialized and ready to accept requests
 * @param wolframPath - Path to wolframscript
 * @returns true if warmup successful, false otherwise
 */
export async function warmupWolframKernel(
  wolframPath: string = 'wolframscript'
): Promise<boolean> {
  try {
    logger.info('Warming up Wolfram Kernel...');

    const startTime = Date.now();

    // Execute a simple computation to initialize the kernel
    const result = await executeSimple('1+1', 10000, wolframPath);

    const elapsedTime = Date.now() - startTime;

    if (result.trim() === '2') {
      logger.info(`Wolfram Kernel warmed up successfully in ${elapsedTime}ms`);
      return true;
    } else {
      logger.error(`Wolfram Kernel warmup failed: unexpected result "${result}"`);
      return false;
    }
  } catch (error) {
    logger.error('Wolfram Kernel warmup failed:', error);
    return false;
  }
}
