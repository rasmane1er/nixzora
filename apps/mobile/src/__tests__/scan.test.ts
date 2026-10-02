import { scanTarget } from '@/lib/scan';

describe('scanTarget', () => {
  it('opens NIXZORA product links straight away', () => {
    expect(scanTarget('https://nixzora.shop/p/kestrel-14-pro?ref=shelf')).toEqual({
      kind: 'product',
      slug: 'kestrel-14-pro',
    });
    expect(scanTarget('nixzora://p/arden-27-4k-usb-c')).toEqual({
      kind: 'product',
      slug: 'arden-27-4k-usb-c',
    });
  });

  it('sends barcodes and SKUs to the API', () => {
    expect(scanTarget(' 0036000291452 ')).toEqual({ kind: 'code', code: '0036000291452' });
    expect(scanTarget('kes14p-32-1t-gr')).toEqual({ kind: 'code', code: 'KES14P-32-1T-GR' });
  });

  it('ignores codes that cannot be products', () => {
    expect(scanTarget('')).toBeNull();
    expect(scanTarget('WIFI:S:home;T:WPA;P:secret;;')).toBeNull();
    expect(scanTarget('https://example.com/blog/post')).toBeNull();
  });
});
