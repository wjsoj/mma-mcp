/**
 * Output formatter for Mathematica execution results.
 * Handles different output formats: text, latex, and mathematica.
 */

import type { OutputFormat, ExecutionResult } from '../config/schema.ts';
import { logger } from '../utils/logger.ts';

/**
 * Clean and format raw Mathematica output
 * @param rawOutput - Raw output from wolframscript
 * @returns Cleaned output string
 */
function cleanOutput(rawOutput: string): string {
  // Trim whitespace
  let cleaned = rawOutput.trim();

  // Remove any control characters or ANSI codes that might have slipped through
  cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');

  return cleaned;
}

/**
 * Format text output
 * @param rawOutput - Raw output from wolframscript
 * @returns Formatted text output
 */
function formatTextOutput(rawOutput: string): string {
  const cleaned = cleanOutput(rawOutput);

  // For text output, preserve formatting as-is
  return cleaned;
}

/**
 * Format LaTeX output
 * @param rawOutput - Raw output from wolframscript (should be TeXForm)
 * @returns Formatted LaTeX output
 */
function formatLatexOutput(rawOutput: string): string {
  const cleaned = cleanOutput(rawOutput);

  // The output should already be in LaTeX format from TeXForm
  // Just ensure it's properly cleaned
  return cleaned;
}

/**
 * Format Mathematica (InputForm) output
 * @param rawOutput - Raw output from wolframscript (should be InputForm)
 * @returns Formatted Mathematica syntax output
 */
function formatMathematicaOutput(rawOutput: string): string {
  const cleaned = cleanOutput(rawOutput);

  // The output should already be in InputForm
  // InputForm is the canonical Mathematica syntax
  return cleaned;
}

/**
 * Format execution result based on output format
 * @param rawOutput - Raw output from wolframscript
 * @param format - Desired output format
 * @param executionTime - Execution time in milliseconds (optional)
 * @returns Formatted execution result
 */
export function formatOutput(
  rawOutput: string,
  format: OutputFormat,
  executionTime?: number
): ExecutionResult {
  logger.debug(`Formatting output as: ${format}`);

  let content: string;

  switch (format) {
    case 'latex':
      content = formatLatexOutput(rawOutput);
      break;

    case 'mathematica':
      content = formatMathematicaOutput(rawOutput);
      break;

    case 'text':
    default:
      content = formatTextOutput(rawOutput);
      break;
  }

  const result: ExecutionResult = {
    format,
    content,
  };

  if (executionTime !== undefined) {
    result.executionTime = executionTime;
  }

  logger.debug(`Formatted output (${content.length} characters)`);

  return result;
}

/**
 * Detect if output appears to be an error message
 * @param output - Output string to check
 * @returns true if output looks like an error
 */
export function isErrorOutput(output: string): boolean {
  const errorPatterns = [
    /^Syntax::/i,
    /^General::/i,
    /^Part::/i,
    /^Power::/i,
    /^Infinity::/i,
    /^\$Failed$/,
    /^Error:/i,
    /::.*::/,  // Mathematica message pattern
  ];

  return errorPatterns.some(pattern => pattern.test(output.trim()));
}

/**
 * Extract error message from Mathematica output
 * @param output - Output containing error
 * @returns Extracted error message
 */
export function extractErrorMessage(output: string): string {
  const lines = output.trim().split('\n');

  // Find lines that look like error messages
  const errorLines = lines.filter(line => {
    return line.includes('::') || line.startsWith('Error:') || line.includes('$Failed');
  });

  if (errorLines.length > 0) {
    return errorLines.join('\n');
  }

  // If no specific error pattern found, return the whole output
  return output.trim();
}

/**
 * Pretty-print execution result as JSON
 * @param result - Execution result
 * @param indent - Indentation spaces (default: 2)
 * @returns Formatted JSON string
 */
export function prettyPrintResult(result: ExecutionResult, indent: number = 2): string {
  return JSON.stringify(result, null, indent);
}

/**
 * Truncate output if it exceeds maximum length
 * @param output - Output string
 * @param maxLength - Maximum length (default: 10000)
 * @returns Truncated output with ellipsis if needed
 */
export function truncateOutput(output: string, maxLength: number = 10000): string {
  if (output.length <= maxLength) {
    return output;
  }

  const truncated = output.substring(0, maxLength);
  const truncationMessage = `\n\n... [Output truncated. Full length: ${output.length} characters]`;

  return truncated + truncationMessage;
}

/**
 * Format output for display in terminal
 * Adds formatting and color (if supported)
 * @param result - Execution result
 * @returns Formatted string for terminal display
 */
export function formatForTerminal(result: ExecutionResult): string {
  const lines = [
    '─'.repeat(60),
    `Format: ${result.format}`,
  ];

  if (result.executionTime !== undefined) {
    lines.push(`Execution Time: ${result.executionTime}ms`);
  }

  lines.push('─'.repeat(60));
  lines.push(result.content);
  lines.push('─'.repeat(60));

  return lines.join('\n');
}
