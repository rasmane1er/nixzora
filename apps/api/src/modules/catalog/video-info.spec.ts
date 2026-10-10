import { lookUpVideo } from './video-info';

const yt = { provider: 'YOUTUBE' as const, videoId: 'dQw4w9WgXcQ' };

describe('lookUpVideo', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const reply = (status: number, body: unknown = {}) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  };

  it('takes the title and the provider’s own still', async () => {
    reply(200, { title: ' Unboxing ', thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' });
    await expect(lookUpVideo(yt)).resolves.toEqual({
      ok: true,
      title: 'Unboxing',
      thumbnailUrl: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
    });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ',
    );
  });

  it('ignores a still from anywhere else', async () => {
    reply(200, { title: 'x', thumbnail_url: 'https://evil.example/x.jpg' });
    await expect(lookUpVideo(yt)).resolves.toMatchObject({ thumbnailUrl: null });
  });

  it('refuses private, removed or non-embeddable videos', async () => {
    for (const status of [401, 403, 404]) {
      reply(status);
      await expect(lookUpVideo(yt)).resolves.toEqual({ ok: false });
    }
  });

  it('takes the link as given when the provider is down or unreachable', async () => {
    reply(503);
    await expect(lookUpVideo(yt)).resolves.toEqual({ ok: true, title: null, thumbnailUrl: null });
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(lookUpVideo(yt)).resolves.toEqual({ ok: true, title: null, thumbnailUrl: null });
  });
});
