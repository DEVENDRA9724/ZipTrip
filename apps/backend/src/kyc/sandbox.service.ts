import { Injectable, ServiceUnavailableException, BadGatewayException, Logger } from '@nestjs/common';

// Clients get a generic message; the provider's own text is kept on the error for server-side classification only
// (for example "insufficient credits" or an expired session), never returned in API responses.
export class ProviderRequestError extends BadGatewayException {
  constructor(readonly providerMessage: string) {
    super('The verification provider could not complete the request. Try again later.');
  }
}

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
        // The response body can contain identity data, so only its status and short error fields are logged.
        const providerMessage = String(result.message || result.error || 'Provider failure').slice(0, 200);
        this.logger.error(`Sandbox API error [${response.status}] on ${path}: code=${String(result.code ?? '').slice(0, 20)} message=${JSON.stringify(providerMessage)}`);
        throw new ProviderRequestError(providerMessage);
      }
      return result.data || result;
    } catch (err: any) {
      if (err instanceof ProviderRequestError) throw err;
      this.logger.error(`Sandbox request failed on ${path}: ${String(err?.message || err).slice(0, 200)}`);
      throw new ProviderRequestError(String(err?.message || 'Provider failure').slice(0, 200));
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
