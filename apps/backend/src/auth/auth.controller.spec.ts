import { AuthController } from './auth.controller';

describe('AuthController session contract', () => {
  it('returns the JWT for native clients while setting the browser cookie', async () => {
    const auth: any = {
      login: jest.fn().mockResolvedValue({ token: 'jwt-token', user: { id: 'user-1' } }),
    };
    const response: any = { cookie: jest.fn() };
    const result = await new AuthController(auth).login({ email: 'a@example.com', password: 'secret' }, response);
    expect(response.cookie).toHaveBeenCalledWith('safar_session', 'jwt-token', expect.objectContaining({ httpOnly: true }));
    expect(result).toEqual({ user: { id: 'user-1' }, token: 'jwt-token' });
  });
});
