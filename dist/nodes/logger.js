"use strict";
/**
 * Simple logger for ComfyUI nodes
 * In n8n context, console statements are not allowed
 * This logger is disabled for community nodes
 */
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
    constructor(context, _enabled = false) {
        this.context = context;
    }
    debug(_message, ..._args) {
        // Logging disabled for n8n community nodes
    }
    info(_message, ..._args) {
        // Logging disabled for n8n community nodes
    }
    warn(_message, ..._args) {
        // Logging disabled for n8n community nodes
    }
    error(_message, _error, ..._args) {
        // Logging disabled for n8n community nodes
    }
    /**
     * Create a child logger with additional context
     */
    child(additionalContext) {
        return new Logger(`${this.context}:${additionalContext}`, false);
    }
}
exports.Logger = Logger;
/**
 * Create a logger instance
 */
function createLogger(context, _enabled = false) {
    return new Logger(context, false);
}
//# sourceMappingURL=logger.js.map