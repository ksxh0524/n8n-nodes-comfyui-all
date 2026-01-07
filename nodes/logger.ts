/**
 * Simple logger for ComfyUI nodes
 * In n8n context, console statements are not allowed
 * This logger is disabled for community nodes
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export class Logger {
  private context: string;

  constructor(context: string, _enabled: boolean = false) {
    this.context = context;
  }

  debug(_message: string, ..._args: unknown[]): void {
    // Logging disabled for n8n community nodes
  }

  info(_message: string, ..._args: unknown[]): void {
    // Logging disabled for n8n community nodes
  }

  warn(_message: string, ..._args: unknown[]): void {
    // Logging disabled for n8n community nodes
  }

  error(_message: string, _error?: Error | unknown, ..._args: unknown[]): void {
    // Logging disabled for n8n community nodes
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: string): Logger {
    return new Logger(`${this.context}:${additionalContext}`, false);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context: string, _enabled: boolean = false): Logger {
  return new Logger(context, false);
}
