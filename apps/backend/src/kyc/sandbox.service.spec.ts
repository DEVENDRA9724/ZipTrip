import { Logger } from '@nestjs/common';
import { ProviderRequestError, SandboxService } from './sandbox.service';

describe('Verification provider errors', () => {
  const env = { ...process.env };
  let logged: string[];
  beforeEach(() => {
    Object.assign(process.env, {
      SANDBOX_API_KEY: 'test-key-not-real',
      SANDBOX_API_SECRET: 'test-secret-not-real',
      SANDBOX_ENV: 'test',
    });
    logged = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...env };
  });

  const respond = (status: number, body: unknown) =>
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

  it('logs only the status and short error fields, never the provider response body', async () => {
    respond(400, {
      code: 400,
      message: 'Insufficient credits',
      data: {
        aadhaar_number: '999988887777',
        name: 'Private Person',
        address: 'Private Street 1',
      },
    });
    const error: any = await new SandboxService()
      .call('/kyc/digilocker/sessions/abc/status')
      .catch((e) => e);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect(error.getStatus()).toBe(502);
    expect(error.message).toBe(
      'The verification provider could not complete the request. Try again later.',
    );
    expect(error.providerMessage).toBe('Insufficient credits');
    const text = logged.join('\n');
    expect(text).toContain('[400]');
    for (const secret of [
      '999988887777',
      'Private Person',
      'Private Street',
      'test-key-not-real',
      'test-secret-not-real',
    ])
      expect(text).not.toContain(secret);
  });

  it('does not return network error details to clients', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:443'));
    const error: any = await new SandboxService()
      .call('/kyc/digilocker/sessions/init', 'POST', {})
      .catch((e) => e);
    expect(error.message).not.toContain('10.0.0.5');
    expect(error.providerMessage).toContain('ECONNREFUSED');
  });
});
