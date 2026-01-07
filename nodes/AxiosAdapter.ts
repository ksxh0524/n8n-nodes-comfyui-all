import axios from 'axios';
import { HttpRequestConfig, IHttpAdapter } from './HttpClient';

export class AxiosAdapter implements IHttpAdapter {
  async request<T>(config: HttpRequestConfig): Promise<T> {
    const axiosConfig: any = {
      method: config.method,
      url: config.url,
      headers: config.headers,
      timeout: config.timeout,
      signal: config.abortSignal,
    };

    if (config.body) {
      axiosConfig.data = config.body;
    }

    if (config.qs) {
      axiosConfig.params = config.qs;
    }

    if (config.encoding === 'arraybuffer') {
      axiosConfig.responseType = 'arraybuffer';
    }

    const response = await axios.request(axiosConfig);
    return response.data as T;
  }
}
