import { Logger as N8nLogger } from 'n8n-workflow';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export class Logger {
  private n8nLogger: N8nLogger;

  constructor(n8nLogger: N8nLogger) {
    this.n8nLogger = n8nLogger;
  }

  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.n8nLogger.debug(message, { args });
    } else {
      this.n8nLogger.debug(message);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.n8nLogger.info(message, { args });
    } else {
      this.n8nLogger.info(message);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.n8nLogger.warn(message, { args });
    } else {
      this.n8nLogger.warn(message);
    }
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (error instanceof Error) {
      if (args.length > 0) {
        this.n8nLogger.error(message, { error: error.message, stack: error.stack, args });
      } else {
        this.n8nLogger.error(message, { error: error.message, stack: error.stack });
      }
    } else if (error !== undefined) {
      if (args.length > 0) {
        this.n8nLogger.error(message, { error, args });
      } else {
        this.n8nLogger.error(message, { error });
      }
    } else {
      if (args.length > 0) {
        this.n8nLogger.error(message, { args });
      } else {
        this.n8nLogger.error(message);
      }
    }
  }

  child(_additionalContext: string): Logger {
    return new Logger(this.n8nLogger);
  }
}

export function createLogger(n8nLogger: N8nLogger): Logger {
  return new Logger(n8nLogger);
}