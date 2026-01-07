import { Logger as N8nLogger } from 'n8n-workflow';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Null Logger implementation for cases where no logger is provided
 * Implements a no-op logger that silently discards all log messages
 */
class NullLogger implements N8nLogger {
  debug(_message: string): void {}
  info(_message: string): void {}
  warn(_message: string): void {}
  error(_message: string): void {}
}

export class Logger {
  private n8nLogger: N8nLogger;
  private context: string[];

  constructor(n8nLogger?: N8nLogger, context: string[] = []) {
    this.n8nLogger = n8nLogger || new NullLogger();
    this.context = context;
  }

  private formatMessage(message: string): string {
    if (this.context.length === 0) {
      return message;
    }
    return `[${this.context.join(' > ')}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(message);
    if (args.length > 0) {
      this.n8nLogger.debug(formattedMessage, { args });
    } else {
      this.n8nLogger.debug(formattedMessage);
    }
  }

  info(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(message);
    if (args.length > 0) {
      this.n8nLogger.info(formattedMessage, { args });
    } else {
      this.n8nLogger.info(formattedMessage);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(message);
    if (args.length > 0) {
      this.n8nLogger.warn(formattedMessage, { args });
    } else {
      this.n8nLogger.warn(formattedMessage);
    }
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage(message);
    if (error instanceof Error) {
      if (args.length > 0) {
        this.n8nLogger.error(formattedMessage, { error: error.message, stack: error.stack, args });
      } else {
        this.n8nLogger.error(formattedMessage, { error: error.message, stack: error.stack });
      }
    } else if (error !== undefined) {
      if (args.length > 0) {
        this.n8nLogger.error(formattedMessage, { error, args });
      } else {
        this.n8nLogger.error(formattedMessage, { error });
      }
    } else {
      if (args.length > 0) {
        this.n8nLogger.error(formattedMessage, { args });
      } else {
        this.n8nLogger.error(formattedMessage);
      }
    }
  }

  child(additionalContext: string): Logger {
    const newContext = [...this.context, additionalContext];
    return new Logger(this.n8nLogger, newContext);
  }
}

export function createLogger(n8nLogger: N8nLogger): Logger {
  return new Logger(n8nLogger);
}