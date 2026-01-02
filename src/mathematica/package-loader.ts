/**
 * Package loader for Mathematica packages.
 * Handles pre-loading and verification of configured packages on server startup.
 */

import type { PackagesConfig } from '../config/schema.ts';
import { loadPackagesConfig } from '../config/packages.ts';
import { PackageNotFoundError, PackageVerificationError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';
import { verifyPackage } from './executor.ts';

/**
 * Global state for loaded packages
 */
export interface PackageState {
  packages: string[];
  autoLoad: boolean;
  loaded: boolean;
  config: PackagesConfig | null;
}

// Global package state
let packageState: PackageState = {
  packages: [],
  autoLoad: false,
  loaded: false,
  config: null,
};

/**
 * Get current package state
 */
export function getPackageState(): Readonly<PackageState> {
  return { ...packageState };
}

/**
 * Pre-load and verify Mathematica packages on server startup
 * @param configPath - Path to packages.json configuration file
 * @param wolframPath - Path to wolframscript executable
 * @throws {PackageNotFoundError} If a package cannot be found
 * @throws {PackageVerificationError} If package verification fails
 */
export async function preloadPackages(
  configPath: string,
  wolframPath: string = 'wolframscript'
): Promise<void> {
  try {
    logger.info('Starting package pre-loading...');

    // Load package configuration
    const config = await loadPackagesConfig(configPath);

    // Store config in state
    packageState.config = config;
    packageState.autoLoad = config.autoLoad;

    if (!config.autoLoad) {
      logger.info('Package auto-loading is disabled');
      packageState.loaded = true;
      return;
    }

    if (config.packages.length === 0) {
      logger.info('No packages configured for pre-loading');
      packageState.loaded = true;
      return;
    }

    logger.info(`Pre-loading ${config.packages.length} package(s): ${config.packages.join(', ')}`);

    // Verify each package
    const verificationResults = await Promise.allSettled(
      config.packages.map(async (packageName) => {
        logger.debug(`Verifying package: ${packageName}`);

        const isAvailable = await verifyPackage(packageName, wolframPath);

        if (!isAvailable) {
          throw new PackageNotFoundError(packageName);
        }

        logger.debug(`Package verified successfully: ${packageName}`);
        return packageName;
      })
    );

    // Collect successful and failed verifications
    const successful: string[] = [];
    const failed: Array<{ packageName: string; error: Error }> = [];

    verificationResults.forEach((result, index) => {
      const packageName = config.packages[index]!;

      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          packageName,
          error: result.reason,
        });
      }
    });

    // Log results
    if (successful.length > 0) {
      logger.info(`Successfully verified ${successful.length} package(s): ${successful.join(', ')}`);
    }

    if (failed.length > 0) {
      logger.error(`Failed to verify ${failed.length} package(s):`);
      failed.forEach(({ packageName, error }) => {
        logger.error(`  - ${packageName}: ${error.message}`);
      });

      // Throw error for the first failed package
      const firstFailure = failed[0]!;
      if (firstFailure.error instanceof PackageNotFoundError) {
        throw firstFailure.error;
      } else {
        throw new PackageVerificationError(
          firstFailure.packageName,
          firstFailure.error.message
        );
      }
    }

    // Update package state
    packageState.packages = successful;
    packageState.loaded = true;

    logger.info('Package pre-loading completed successfully');
  } catch (error) {
    logger.error('Package pre-loading failed:', error);

    // Mark as not loaded
    packageState.loaded = false;

    throw error;
  }
}

/**
 * Reload packages from configuration
 * Useful for runtime package updates
 */
export async function reloadPackages(
  configPath: string,
  wolframPath: string = 'wolframscript'
): Promise<void> {
  logger.info('Reloading package configuration...');

  // Reset state
  packageState = {
    packages: [],
    autoLoad: false,
    loaded: false,
    config: null,
  };

  // Pre-load packages again
  await preloadPackages(configPath, wolframPath);
}

/**
 * Get list of currently loaded packages
 */
export function getLoadedPackages(): string[] {
  return [...packageState.packages];
}

/**
 * Check if packages have been loaded
 */
export function arePackagesLoaded(): boolean {
  return packageState.loaded;
}

/**
 * Check if auto-load is enabled
 */
export function isAutoLoadEnabled(): boolean {
  return packageState.autoLoad;
}

/**
 * Get package configuration
 */
export function getPackagesConfig(): PackagesConfig | null {
  return packageState.config ? { ...packageState.config } : null;
}

/**
 * Add packages to the loaded list without verification
 * Use with caution - packages are not verified
 */
export function addPackagesUnsafe(packages: string[]): void {
  const currentPackages = new Set(packageState.packages);

  packages.forEach(pkg => currentPackages.add(pkg));

  packageState.packages = Array.from(currentPackages);

  logger.warn(`Added ${packages.length} package(s) without verification:`, packages.join(', '));
}

/**
 * Remove packages from the loaded list
 */
export function removePackages(packages: string[]): void {
  const packagesToRemove = new Set(packages);

  packageState.packages = packageState.packages.filter(
    pkg => !packagesToRemove.has(pkg)
  );

  logger.info(`Removed ${packages.length} package(s):`, packages.join(', '));
}

/**
 * Clear all loaded packages
 */
export function clearPackages(): void {
  const count = packageState.packages.length;

  packageState.packages = [];
  packageState.loaded = false;

  logger.info(`Cleared ${count} loaded package(s)`);
}

/**
 * Check if a specific package is loaded
 */
export function isPackageLoaded(packageName: string): boolean {
  return packageState.packages.includes(packageName);
}

/**
 * Get package statistics
 */
export function getPackageStats(): {
  total: number;
  loaded: number;
  autoLoad: boolean;
  configured: number;
} {
  return {
    total: packageState.packages.length,
    loaded: packageState.loaded ? packageState.packages.length : 0,
    autoLoad: packageState.autoLoad,
    configured: packageState.config?.packages.length || 0,
  };
}
