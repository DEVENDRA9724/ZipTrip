import { MediaController } from './media.controller';

describe('Media read access', () => {
  const setup = (user: any) => {
    const media = {
      read: jest.fn().mockResolvedValue({
        buffer: Buffer.from('x'),
        mimeType: 'image/jpeg',
      }),
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ id: 'u1' }) };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const res: any = {
      setHeader: jest.fn(),
      type: jest.fn(() => res),
      send: jest.fn(),
    };
    return {
      controller: new MediaController(media as any, jwt as any, prisma as any),
      media,
      jwt,
      res,
    };
  };

  it('passes an active signed-in user to the access check', async () => {
    const { controller, media, res } = setup({
      id: 'u1',
      role: 'HOST',
      isBlocked: false,
    });
    await controller.read(
      'm1',
      { headers: { authorization: 'Bearer token' } },
      res,
    );
    expect(media.read).toHaveBeenCalledWith('m1', { id: 'u1', role: 'HOST' });
  });

  it('treats blocked accounts as anonymous', async () => {
    const { controller, media, res } = setup({
      id: 'u1',
      role: 'ADMIN',
      isBlocked: true,
    });
    await controller.read(
      'm1',
      { headers: { cookie: 'safar_session=token' } },
      res,
    );
    expect(media.read).toHaveBeenCalledWith('m1', undefined);
  });

  it('ignores non-Bearer authorization headers and falls back to the session cookie', async () => {
    const { controller, jwt, res } = setup({
      id: 'u1',
      role: 'CUSTOMER',
      isBlocked: false,
    });
    await controller.read(
      'm1',
      {
        headers: {
          authorization: 'Basic abcdefgh',
          cookie: 'safar_session=cookie-token',
        },
      },
      res,
    );
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token');
  });
});
