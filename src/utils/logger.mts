import winston from 'winston';

let logger: winston.Logger | null = null;

/**
 * Initialize the logger with the specified log level
 */
export function initLogger(debug: boolean = false): void {
  const level = debug ? 'debug' : 'info';

  logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.printf(
        ({ timestamp, level, message, ...meta }) =>
          `${timestamp} [${level}] ${message}${
            Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
          }`,
      ),
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
