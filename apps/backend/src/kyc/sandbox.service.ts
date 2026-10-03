import { Injectable, ServiceUnavailableException, BadGatewayException, Logger } from '@nestjs/common';

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private token?: string;
  private expires = 0;

  environment() {
    return process.env.SANDBOX_ENV === 'live' ? 'live' : 'test';
  }

  configured() {
    return Boolean(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
  }

  private async request(path: string, method: string, body?: any, authenticate = false): Promise<any> {
    if (!this.configured()) {
      throw new ServiceUnavailableException('Configure Sandbox key and secret on the server');
    }
    const base = this.environment() === 'live' ? 'https://api.sandbox.co.in' : 'https://test-api.sandbox.co.in';
    const headers: Record<string, string> = {
      'x-api-key': process.env.SANDBOX_API_KEY!,
      'x-api-version': '1.0',
      'Content-Type': 'application/json',
    };
    if (authenticate) {
      headers['x-api-secret'] = process.env.SANDBOX_API_SECRET!;
    } else {
      headers.Authorization = this.token!;
    }

    try {
      const response = await fetch(base + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok || (result.code !== 200 && result.status !== 200)) {
        this.logger.error(`Sandbox API error [${response.status}] on ${path}: ${JSON.stringify(result)}`);
        throw new Error(result.message || result.error || 'Provider failure');
      }
      return result.data || result;
    } catch (err: any) {
      this.logger.error(`Sandbox request failed: ${err.message}`, err.stack);
      throw new BadGatewayException(err.message || 'Verification provider could not complete the request.');
    }
  }

  async call(path: string, method = 'GET', body?: any) {
    if (!this.token || this.expires < Date.now()) {
      const auth = await this.request('/authenticate', 'POST', undefined, true);
      const token = auth.access_token || auth.data?.access_token;
      if (typeof token !== 'string') {
        throw new BadGatewayException('Invalid provider authentication response');
      }
      this.token = token;
      this.expires = Date.now() + 23 * 3600000;
    }
    return this.request(path, method, body);
  }
}
