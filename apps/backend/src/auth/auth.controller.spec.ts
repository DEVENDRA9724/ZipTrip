import type { Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

type CookieOptions = { httpOnly?: boolean; secure?: boolean };

describe('AuthController session contract', () => {
  const previousOrigin = process.env.WEB_ORIGIN;
  afterEach(() => {
    if (previousOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = previousOrigin;
  });
  const login = async (req: {
    headers: Record<string, string>;
    secure?: boolean;
  }) => {
    const auth = {
      login: jest
        .fn()
        .mockResolvedValue({ token: 'jwt-token', user: { id: 'user-1' } }),
    } as unknown as AuthService;
    const cookie = jest.fn<void, [string, string, CookieOptions]>();
    const response = { cookie } as unknown as Response;
    const result: unknown = await new AuthController(auth).login(
      req,
      { email: 'a@example.com', password: 'secret' },
      response,
    );
    return { result, cookie, options: cookie.mock.calls[0][2] };
  };

  it('returns the JWT for native clients while setting the browser cookie', async () => {
    const { result, cookie } = await login({ headers: {} });
    expect(cookie).toHaveBeenCalledWith(
      'safar_session',
      'jwt-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result).toEqual({ user: { id: 'user-1' }, token: 'jwt-token' });
  });

  it('marks the cookie secure whenever the site is served over HTTPS', async () => {
    process.env.WEB_ORIGIN = 'http://13.0.0.1';
    expect((await login({ headers: {} })).options.secure).toBe(false);
    expect(
      (await login({ headers: { 'x-forwarded-proto': 'https' } })).options
        .secure,
    ).toBe(true);
    expect(
      (await login({ headers: { 'x-forwarded-proto': 'https,http' } })).options
        .secure,
    ).toBe(true);
    expect((await login({ headers: {}, secure: true })).options.secure).toBe(
      true,
    );
    process.env.WEB_ORIGIN = 'https://safar.example';
    expect((await login({ headers: {} })).options.secure).toBe(true);
  });
});
