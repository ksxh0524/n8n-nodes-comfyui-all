/**
 * Simple logger for ComfyUI nodes
 * In n8n context, console statements are not allowed
 * This logger is disabled for community nodes
 */
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export declare class Logger {
    private context;
    constructor(context: string, _enabled?: boolean);
    debug(_message: string, ..._args: unknown[]): void;
    info(_message: string, ..._args: unknown[]): void;
    warn(_message: string, ..._args: unknown[]): void;
    error(_message: string, _error?: Error | unknown, ..._args: unknown[]): void;
    /**
     * Create a child logger with additional context
     */
    child(additionalContext: string): Logger;
}
/**
 * Create a logger instance
 */
export declare function createLogger(context: string, _enabled?: boolean): Logger;
//# sourceMappingURL=logger.d.ts.map