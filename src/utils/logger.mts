import winston from 'winston';
import chalk from 'chalk';

let logger: winston.Logger | null = null;

/**
 * Enhance log messages with emojis and colors
 */
function enhanceMessage(level: string, message: string): string {
  let enhanced = message;

  // Replace symbols with emojis
  enhanced = enhanced.replace(/✓/g, '✅');
  enhanced = enhanced.replace(/✗/g, '❌');
  enhanced = enhanced.replace(/➜/g, '🔄');
  enhanced = enhanced.replace(/⚠/g, '⚠️');

  // Add emoji prefixes for common patterns (if not already present)
  if (!enhanced.match(/^[\u{1F300}-\u{1F9FF}]/u)) {
    if (message.includes('Starting') || message.includes('Discovering routes in scope')) {
      enhanced = '🔍 ' + enhanced;
    } else if (message.includes('Found') && !message.includes('❌')) {
      enhanced = '📍 ' + enhanced;
    } else if (message.includes('Following')) {
      enhanced = '🔄 ' + enhanced;
    } else if (message.includes('complete')) {
      enhanced = '🎉 ' + enhanced;
    } else if (message.includes('Checking') || message.includes('Examining')) {
      enhanced = '🔎 ' + enhanced;
    } else if (message.includes('Extracting')) {
      enhanced = '📤 ' + enhanced;
    } else if (message.includes('Looking for')) {
      enhanced = '👀 ' + enhanced;
    }
  }

  // Apply colors based on content
  if (level === 'debug') {
    if (enhanced.includes('✅')) {
      return chalk.green(enhanced);
    } else if (enhanced.includes('❌')) {
      return chalk.red(enhanced);
    } else if (enhanced.includes('⚠️')) {
      return chalk.yellow(enhanced);
    } else if (enhanced.includes('🔄')) {
      return chalk.cyan(enhanced);
    } else {
      return chalk.gray(enhanced);
    }
  }

  return enhanced;
}

/**
 * Initialize the logger with the specified log level
 */
export function initLogger(debug: boolean = false): void {
  const level = debug ? 'debug' : 'info';

  logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const levelStr = String(level);
        const messageStr = String(message);
        const timestampStr = String(timestamp);

        const enhancedMsg = enhanceMessage(levelStr, messageStr);
        const metaStr = Object.keys(meta).length
          ? ' ' + chalk.dim(JSON.stringify(meta))
          : '';

        const levelLabel =
          levelStr === 'debug'
            ? chalk.blue('[debug]')
            : levelStr === 'info'
              ? chalk.green('[info]')
              : levelStr === 'warn'
                ? chalk.yellow('[warn]')
                : chalk.red('[error]');

        return `${chalk.dim(timestampStr)} ${levelLabel} ${enhancedMsg}${metaStr}`;
      }),
    ),
    transports: [new winston.transports.Console()],
  });
}

/**
 * Get the logger instance
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    // Default logger if not initialized
    initLogger(false);
  }
  return logger!;
}

/**
 * Debug log helper
 */
export function debug(message: string, meta?: Record<string, unknown>): void {
  getLogger().debug(message, meta);
}

/**
 * Info log helper
 */
export function info(message: string, meta?: Record<string, unknown>): void {
  getLogger().info(message, meta);
}

/**
 * Warn log helper
 */
export function warn(message: string, meta?: Record<string, unknown>): void {
  getLogger().warn(message, meta);
}

/**
 * Error log helper
 */
export function error(message: string, meta?: Record<string, unknown>): void {
  getLogger().error(message, meta);
}
