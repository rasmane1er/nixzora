import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { type PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';

const tokens = ['ExponentPushToken[aaaaaaaaaa]', 'ExponentPushToken[bbbbbbbbbb]'];

function setup(driver: 'log' | 'expo') {
  const values: Partial<Env> = { PUSH_DRIVER: driver, NODE_ENV: 'test' };
  const config = { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    pushDevice: {
      findMany: jest.fn().mockResolvedValue(tokens.map((token) => ({ token }))),
      deleteMany,
    },
  } as unknown as PrismaService;
  return { service: new PushService(prisma, config), deleteMany };
}

const message = {
  title: 'Delivered',
  body: 'Order NX-1 was delivered.',
  data: { path: '/orders/NX-1' },
};

describe('PushService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('records instead of sending with the log driver', async () => {
    const { service } = setup('log');
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(await service.sendToUser('user', message)).toBe(2);
    expect(service.sentTo(tokens[0]!)).toEqual([{ ...message, to: tokens[0] }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends through Expo and forgets devices that were uninstalled', async () => {
    const { service, deleteMany } = setup('expo');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { status: 'ok', id: 'ticket-1' },
            { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
          ],
        }),
        { status: 200 },
      ),
    );
    expect(await service.sendToUser('user', message)).toBe(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body)) as { to: string }[];
    expect(body.map((m) => m.to)).toEqual(tokens);
    expect(deleteMany).toHaveBeenCalledWith({ where: { token: { in: [tokens[1]] } } });
  });

  it('never throws when Expo is unreachable', async () => {
    const { service } = setup('expo');
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(service.sendToUser('user', message)).resolves.toBe(0);
  });
});
