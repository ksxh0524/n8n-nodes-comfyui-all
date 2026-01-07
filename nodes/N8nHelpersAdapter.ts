import { IExecuteFunctions } from 'n8n-workflow';
import { HttpRequestConfig, IHttpAdapter } from './HttpClient';

export class N8nHelpersAdapter implements IHttpAdapter {
  private helpers: IExecuteFunctions['helpers'];

  constructor(helpers: IExecuteFunctions['helpers']) {
    this.helpers = helpers;
  }

  async request<T>(config: HttpRequestConfig): Promise<T> {
    return await this.helpers.httpRequest({
      method: config.method,
      url: config.url,
      headers: config.headers,
      body: config.body as FormData | Buffer | undefined,
      json: config.json,
      qs: config.qs as Record<string, string | number> | undefined,
      encoding: config.encoding as 'arraybuffer' | undefined,
      timeout: config.timeout,
      abortSignal: config.abortSignal,
    }) as Promise<T>;
  }
}
