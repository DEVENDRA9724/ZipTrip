import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('Prisma exception filter', () => {
  const setup = () => {
    const adapter = {
      reply: jest.fn(),
      isHeadersSent: () => false,
      end: jest.fn(),
    };
    const response = {};
    const host: any = {
      getArgByIndex: (index: number) => (index === 1 ? response : {}),
      getArgs: () => [{}, response],
      getType: () => 'http',
    };
    return {
      filter: new PrismaExceptionFilter(adapter as any),
      adapter,
      response,
      host,
    };
  };
  // Shape matches what the better-sqlite3 adapter raises for a duplicate email (verified against a scratch database).
  const known = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      {
        code,
        clientVersion: 'test',
        meta: {
          modelName: 'User',
          driverAdapterError: {
            cause: { originalMessage: 'UNIQUE constraint failed: User.email' },
          },
        },
      },
    );

  it('maps unique-constraint races to 409 without exposing table or column names', () => {
    const { filter, adapter, response, host } = setup();
    filter.catch(known('P2002'), host);
    const [target, body, status] = adapter.reply.mock.calls[0];
    expect(target).toBe(response);
    expect(status).toBe(409);
    expect(body.statusCode).toBe(409);
    expect(JSON.stringify(body)).not.toMatch(/User|email|UNIQUE/);
  });

  it('leaves other Prisma errors as server errors', () => {
    const { filter, adapter, host } = setup();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    filter.catch(known('P2025'), host);
    expect(adapter.reply.mock.calls[0][2]).toBe(500);
  });
});
