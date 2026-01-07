import { Logger as N8nLogger } from 'n8n-workflow';
export declare enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error"
}
export declare class Logger {
    private n8nLogger;
    constructor(n8nLogger: N8nLogger);
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, error?: Error | unknown, ...args: unknown[]): void;
    child(_additionalContext: string): Logger;
}
export declare function createLogger(n8nLogger: N8nLogger): Logger;
//# sourceMappingURL=logger.d.ts.map