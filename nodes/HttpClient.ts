import { HttpError } from './types';
import { Logger } from './logger';

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  json?: boolean;
  qs?: Record<string, unknown>;
  encoding?: string;
  timeout?: number;
  abortSignal?: AbortSignal;
}

export interface IHttpAdapter {
  request<T>(config: HttpRequestConfig): Promise<T>;
}

export interface HttpClientConfig {
  adapter: IHttpAdapter;
  logger?: Logger;
  defaultTimeout?: number;
}

export class HttpClient {
  private adapter: IHttpAdapter;
  private logger: Logger;
  private defaultTimeout: number;

  constructor(config: HttpClientConfig) {
    this.adapter = config.adapter;
    this.logger = config.logger || new Logger();
    this.defaultTimeout = config.defaultTimeout || 30000;
  }

  async request<T = unknown>(config: HttpRequestConfig): Promise<T> {
    const requestConfig = {
      method: config.method,
      url: config.url,
      headers: config.headers,
      body: config.body,
      json: config.json,
      qs: config.qs,
      encoding: config.encoding,
      timeout: config.timeout || this.defaultTimeout,
      abortSignal: config.abortSignal,
    };

    this.logger.debug(`HTTP ${config.method} ${config.url}`, {
      headers: config.headers,
      hasBody: !!config.body,
      timeout: requestConfig.timeout,
    });

    try {
      const response = await this.adapter.request<T>(requestConfig);
      return response;
    } catch (error: unknown) {
      this.logger.error(`HTTP request failed: ${config.method} ${config.url}`, error);
      throw this.normalizeError(error);
    }
  }

  async get<T = unknown>(
    url: string,
    options?: Omit<HttpRequestConfig, 'method' | 'url'>
  ): Promise<T> {
    return this.request<T>({ method: 'GET', url, ...options });
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({ method: 'POST', url, body, ...options });
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({ method: 'PUT', url, body, ...options });
  }

  async delete<T = unknown>(
    url: string,
    options?: Omit<HttpRequestConfig, 'method' | 'url'>
  ): Promise<T> {
    return this.request<T>({ method: 'DELETE', url, ...options });
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<HttpRequestConfig, 'method' | 'url' | 'body'>
  ): Promise<T> {
    return this.request<T>({ method: 'PATCH', url, body, ...options });
  }

  private normalizeError(error: unknown): HttpError {
    if (error instanceof Error) {
      const httpError = error as HttpError;
      if (httpError.response) {
        return {
          name: 'HttpError',
          message: `HTTP ${httpError.response.statusCode} ${httpError.response.statusMessage}`,
          code: httpError.code,
          response: httpError.response,
        };
      }
      if (httpError.statusCode) {
        return {
          name: 'HttpError',
          message: `HTTP ${httpError.statusCode} ${httpError.statusMessage || ''}`,
          code: httpError.code,
          statusCode: httpError.statusCode,
          statusMessage: httpError.statusMessage,
        };
      }
      return {
        name: error.name,
        message: error.message,
        code: httpError.code,
      };
    }
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }
}
