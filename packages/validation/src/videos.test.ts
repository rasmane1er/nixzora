import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVideoUrl, ProductVideoAddSchema, videoUrls } from './videos';

test('reads YouTube links in their usual shapes', () => {
  const yt = { provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' };
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ]) {
    assert.deepEqual(parseVideoUrl(url), yt, url);
  }
});

test('reads Vimeo links, unlisted ones with their key', () => {
  assert.deepEqual(parseVideoUrl('https://vimeo.com/76979871'), {
    provider: 'VIMEO',
    videoId: '76979871',
  });
  assert.deepEqual(parseVideoUrl('https://vimeo.com/channels/staffpicks/76979871'), {
    provider: 'VIMEO',
    videoId: '76979871',
  });
  assert.deepEqual(parseVideoUrl('https://vimeo.com/76979871/a1b2c3d4e5'), {
    provider: 'VIMEO',
    videoId: '76979871:a1b2c3d4e5',
  });
  assert.equal(
    videoUrls({ provider: 'VIMEO', videoId: '76979871:a1b2c3d4e5' }).embedUrl,
    'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=a1b2c3d4e5',
  );
});

test('refuses anything else', () => {
  for (const url of [
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=short',
    'javascript:alert(1)',
    'not a link',
    'https://vimeo.com/about',
  ]) {
    assert.equal(parseVideoUrl(url), null, url);
  }
  assert.ok(!ProductVideoAddSchema.safeParse({ url: 'https://example.com/x.mp4' }).success);
  assert.ok(ProductVideoAddSchema.safeParse({ url: 'https://youtu.be/dQw4w9WgXcQ' }).success);
});

test('plays YouTube in its privacy-enhanced player', () => {
  const urls = videoUrls({ provider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ' });
  assert.match(urls.embedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.equal(urls.watchUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
