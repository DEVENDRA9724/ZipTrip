import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Msg91Service } from './msg91.service';

describe('Msg91Service', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  function service() {
    process.env.OTP_PROVIDER = 'msg91';
    process.env.MSG91_AUTHKEY = 'test-auth-key';
    process.env.MSG91_OTP_TEMPLATE_ID = 'template-123';
    return new Msg91Service();
  }

  it('sends an international-format OTP request without exposing the auth key', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ type: 'success', request_id: 'req-1' }) });
    jest.spyOn(global, 'fetch').mockImplementation(request as any);

    const result = await service().sendOtp('98765 43210');

    expect(result).toEqual({ requestId: 'req-1' });
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toContain('template_id=template-123');
    expect(String(url)).toContain('mobile=919876543210');
    expect(options.headers).toEqual(expect.objectContaining({ authkey: 'test-auth-key' }));
    expect(options.body).toBe('{}');
  });

  it('verifies OTP through MSG91 and rejects provider failures', async () => {
    const request = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ type: 'success' }) })
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => JSON.stringify({ type: 'error' }) });
    jest.spyOn(global, 'fetch').mockImplementation(request as any);
    const adapter = service();

    await expect(adapter.verifyOtp('+919876543210', '123456')).resolves.toEqual({ verified: true });
    await expect(adapter.verifyOtp('+919876543210', '000000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails clearly when production credentials are missing', async () => {
    process.env.OTP_PROVIDER = 'msg91';
    delete process.env.MSG91_AUTHKEY;
    delete process.env.MSG91_OTP_TEMPLATE_ID;
    await expect(new Msg91Service().sendOtp('+919876543210')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
