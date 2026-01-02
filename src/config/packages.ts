/**
 * Package configuration loader.
 * Loads and validates the packages.json configuration file.
 */

import { PackagesConfigSchema, type PackagesConfig } from './schema.ts';
import { PackageConfigError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

/**
 * Load package configuration from file
 * @param configPath - Path to packages.json file
 * @returns Validated package configuration
 * @throws {PackageConfigError} If file cannot be read or validation fails
 */
export async function loadPackagesConfig(configPath: string): Promise<PackagesConfig> {
  try {
    logger.debug(`Loading package configuration from: ${configPath}`);

    // Use Bun.file to read the configuration
    const file = Bun.file(configPath);

    // Check if file exists
    if (!(await file.exists())) {
      throw new PackageConfigError(
        configPath,
        'Configuration file does not exist'
      );
    }

    // Read and parse JSON
    const content = await file.text();
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new PackageConfigError(
        configPath,
        `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // Validate with Zod schema
    try {
      const config = PackagesConfigSchema.parse(parsed);

      logger.info(
        `Loaded ${config.packages.length} package(s) from configuration ` +
        `(autoLoad: ${config.autoLoad})`
      );

      if (config.packages.length > 0) {
        logger.debug('Configured packages:', config.packages.join(', '));
      }

      return config;
    } catch (validationError) {
      if (validationError instanceof Error && 'issues' in validationError) {
        const zodError = validationError as any;
        const issues = zodError.issues
          .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');

        throw new PackageConfigError(
          configPath,
          `Validation failed: ${issues}`
        );
      }

      throw validationError;
    }
  } catch (error) {
    if (error instanceof PackageConfigError) {
      throw error;
    }

    throw new PackageConfigError(
      configPath,
      `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Save package configuration to file
 * @param configPath - Path to packages.json file
 * @param config - Package configuration to save
 */
export async function savePackagesConfig(
  configPath: string,
  config: PackagesConfig
): Promise<void> {
  try {
    // Validate before saving
    PackagesConfigSchema.parse(config);

    // Write to file with pretty formatting
    await Bun.write(configPath, JSON.stringify(config, null, 2) + '\n');

    logger.info(`Package configuration saved to: ${configPath}`);
  } catch (error) {
    throw new PackageConfigError(
      configPath,
      `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create a default packages.json configuration file
 * @param configPath - Path where to create the file
 */
export async function createDefaultPackagesConfig(configPath: string): Promise<PackagesConfig> {
  const defaultConfig: PackagesConfig = {
    version: '1.0.0',
    packages: [
      'LinearAlgebra',
      'Statistics',
      'NumericalCalculus',
    ],
    autoLoad: true,
    description: 'Default Mathematica packages configuration',
  };

  await savePackagesConfig(configPath, defaultConfig);
  logger.info(`Created default package configuration at: ${configPath}`);

  return defaultConfig;
}

/**
 * Validate package names in configuration
 * Ensures package names follow Mathematica naming conventions
 */
export function validatePackageNames(packageNames: string[]): {
  valid: string[];
  invalid: Array<{ name: string; reason: string }>;
} {
  const valid: string[] = [];
  const invalid: Array<{ name: string; reason: string }> = [];

  const packageNameRegex = /^[A-Za-z][A-Za-z0-9`]*$/;

  for (const name of packageNames) {
    if (!name || name.trim().length === 0) {
      invalid.push({ name, reason: 'Package name is empty' });
      continue;
    }

    if (!packageNameRegex.test(name)) {
      invalid.push({
        name,
        reason: 'Package name must start with a letter and contain only letters, numbers, and backticks',
      });
      continue;
    }

    valid.push(name);
  }

  return { valid, invalid };
}

/**
 * Merge additional packages with configured packages
 * Removes duplicates and validates all package names
 */
export function mergePackages(
  configuredPackages: string[],
  additionalPackages: string[]
): string[] {
  const allPackages = [...configuredPackages, ...additionalPackages];
  const uniquePackages = [...new Set(allPackages)];

  const { valid, invalid } = validatePackageNames(uniquePackages);

  if (invalid.length > 0) {
    logger.warn('Invalid package names will be skipped:', invalid);
  }

  return valid;
}
