/**
 * Constants for the Kaoto extension
 * Centralized configuration values
 */

import packageJson from '../package.json';

/**
 * Default Camel version used as fallback when catalog service cannot determine version
 * This value is defined in package.json under "kaoto.defaultCamelVersion"
 */
export const DEFAULT_CAMEL_VERSION = packageJson.kaoto?.defaultCamelVersion || '4.18.1';

/**
 * Default Camel JBang version used for JBang executor
 * This value is defined in package.json under "kaoto.defaultCamelJbangVersion"
 */
export const DEFAULT_CAMEL_JBANG_VERSION = packageJson.kaoto?.defaultCamelJbangVersion || '4.18.1';
