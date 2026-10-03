import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { MailService } from './mail.service';

const message = {
  to: 'shopper@example.com',
  subject: 'Reset your NIXZORA password',
  text: 'Reset link: https://example.com/reset?token=secret-token',
  template: 'auth.reset-password',
  data: {},
};

function sesMail(send: jest.Mock): MailService {
  const values: Record<string, string> = {
    MAIL_DRIVER: 'ses',
    SES_REGION: 'us-east-1',
    MAIL_FROM: 'NIXZORA <orders@nixzora.com>',
    NODE_ENV: 'production',
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>;
  const mail = new MailService(config);
  (mail as unknown as { ses: { send: jest.Mock } }).ses = { send };
  return mail;
}

describe('MailService', () => {
  it('send() reports provider failures so queued emails are retried', async () => {
    const mail = sesMail(jest.fn().mockRejectedValue(new Error('Email address is not verified.')));
    await expect(mail.send(message)).rejects.toThrow('not verified');
  });

  it('trySend() never fails the request, and logs no address or body', async () => {
    const mail = sesMail(
      jest.fn().mockRejectedValue(
        Object.assign(new Error('Email address is not verified.'), {
          name: 'MessageRejected',
        }),
      ),
    );
    const log = jest
      .spyOn((mail as unknown as { logger: { error: () => void } }).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(mail.trySend(message)).resolves.toBe(false);
    const logged = String((log.mock.calls[0] as unknown[])[0]);
    expect(logged).toContain('auth.reset-password');
    expect(logged).toContain('MessageRejected');
    expect(logged).not.toContain('shopper@example.com');
    expect(logged).not.toContain('secret-token');
  });

  it('trySend() returns true when the provider accepts the message', async () => {
    const send = jest.fn().mockResolvedValue({});
    await expect(sesMail(send).trySend(message)).resolves.toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
