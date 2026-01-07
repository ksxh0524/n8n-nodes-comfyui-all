import { NodeOperationError, IExecuteFunctions } from 'n8n-workflow';

export class ComfyUIError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'COMFYUI_ERROR', statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ComfyUIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ComfyUIConnectionError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', undefined, details);
    this.name = 'ComfyUIConnectionError';
  }
}

export class ComfyUIValidationError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', undefined, details);
    this.name = 'ComfyUIValidationError';
  }
}

export class ComfyUIExecutionError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXECUTION_ERROR', undefined, details);
    this.name = 'ComfyUIExecutionError';
  }
}

export class ComfyUITimeoutError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', undefined, details);
    this.name = 'ComfyUITimeoutError';
  }
}

export class ComfyUIUploadError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'UPLOAD_ERROR', undefined, details);
    this.name = 'ComfyUIUploadError';
  }
}

export class ComfyUIDownloadError extends ComfyUIError {
  constructor(message: string, details?: unknown) {
    super(message, 'DOWNLOAD_ERROR', undefined, details);
    this.name = 'ComfyUIDownloadError';
  }
}

export function isComfyUIError(error: unknown): error is ComfyUIError {
  return error instanceof ComfyUIError;
}

export function createErrorFromHttpError(
  error: { code?: string; response?: { statusCode?: number; statusMessage?: string } },
  defaultMessage: string = 'HTTP request failed'
): ComfyUIError {
  const statusCode = error.response?.statusCode;
  const statusMessage = error.response?.statusMessage;
  const errorCode = error.code;

  let message = defaultMessage;
  const details = error;

  if (statusCode) {
    message = `${defaultMessage}: HTTP ${statusCode} ${statusMessage || ''}`;
  } else if (errorCode) {
    message = `${defaultMessage}: ${errorCode}`;
  }

  if (errorCode === 'ECONNREFUSED') {
    return new ComfyUIConnectionError('Failed to connect to ComfyUI server. Please check if the server is running.', details);
  } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNABORTED') {
    return new ComfyUITimeoutError('Connection timeout while connecting to ComfyUI server.', details);
  } else if (statusCode === 403) {
    return new ComfyUIConnectionError('The server returned 403 Forbidden. The URL may require authentication or block automated access.', details);
  } else if (statusCode === 404) {
    return new ComfyUIConnectionError('The server returned 404 Not Found. The URL may be incorrect or the resource may have been removed.', details);
  } else if (statusCode === 400) {
    return new ComfyUIValidationError('The server returned 400 Bad Request. The request may be malformed.', details);
  } else if (statusCode === 500) {
    return new ComfyUIExecutionError('The server returned 500 Internal Server Error. Please try again later.', details);
  } else if (statusCode === 503) {
    return new ComfyUIExecutionError('The server returned 503 Service Unavailable. The server may be overloaded.', details);
  }

  return new ComfyUIError(message, 'HTTP_ERROR', statusCode, details);
}

export function wrapNodeOperationError(
  error: unknown,
  node: IExecuteFunctions,
  defaultMessage: string = 'An error occurred'
): NodeOperationError {
  if (error instanceof NodeOperationError) {
    return error;
  }

  const nodeInstance = node.getNode();

  if (error instanceof ComfyUIError) {
    return new NodeOperationError(nodeInstance, error.message);
  }

  if (error instanceof Error) {
    return new NodeOperationError(nodeInstance, `${defaultMessage}: ${error.message}`);
  }

  return new NodeOperationError(nodeInstance, `${defaultMessage}: ${String(error)}`);
}
