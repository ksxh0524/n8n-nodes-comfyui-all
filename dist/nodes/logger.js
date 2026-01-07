"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(n8nLogger) {
        this.n8nLogger = n8nLogger;
    }
    debug(message, ...args) {
        if (args.length > 0) {
            this.n8nLogger.debug(message, { args });
        }
        else {
            this.n8nLogger.debug(message);
        }
    }
    info(message, ...args) {
        if (args.length > 0) {
            this.n8nLogger.info(message, { args });
        }
        else {
            this.n8nLogger.info(message);
        }
    }
    warn(message, ...args) {
        if (args.length > 0) {
            this.n8nLogger.warn(message, { args });
        }
        else {
            this.n8nLogger.warn(message);
        }
    }
    error(message, error, ...args) {
        if (error instanceof Error) {
            if (args.length > 0) {
                this.n8nLogger.error(message, { error: error.message, stack: error.stack, args });
            }
            else {
                this.n8nLogger.error(message, { error: error.message, stack: error.stack });
            }
        }
        else if (error !== undefined) {
            if (args.length > 0) {
                this.n8nLogger.error(message, { error, args });
            }
            else {
                this.n8nLogger.error(message, { error });
            }
        }
        else {
            if (args.length > 0) {
                this.n8nLogger.error(message, { args });
            }
            else {
                this.n8nLogger.error(message);
            }
        }
    }
    child(_additionalContext) {
        return new Logger(this.n8nLogger);
    }
}
exports.Logger = Logger;
function createLogger(n8nLogger) {
    return new Logger(n8nLogger);
}
//# sourceMappingURL=logger.js.map