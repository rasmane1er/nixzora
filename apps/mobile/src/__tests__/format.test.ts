import { attributeLabel, money, optionName, optionsText, statusLabel } from '@/lib/format';

describe('format', () => {
  it('formats cents as dollars', () => {
    expect(money(134900)).toBe('$1,349.00');
    expect(money(0)).toBe('$0.00');
  });

  it('labels specs and options like the website does', () => {
    expect(attributeLabel('refresh_hz')).toBe('Refresh (Hz)');
    expect(attributeLabel('screen_in')).toBe('Screen (inches)');
    expect(attributeLabel('cpu_cores')).toBe('CPU cores');
    expect(attributeLabel('os')).toBe('OS');
    expect(attributeLabel('volume_ml')).toBe('Volume (ml)');
    expect(attributeLabel('volume_ml', 'fr')).toBe('Contenance (ml)');
    expect(attributeLabel('drawer_count')).toBe('Drawer count');
    expect(optionName('size')).toBe('Size');
    expect(optionName('size', 'es')).toBe('Talla');
  });

  it('speaks the customer’s language for order states and options', () => {
    expect(statusLabel('PENDING_PAYMENT')).toBe('Awaiting payment');
    expect(statusLabel('SHIPPED')).toBe('Shipped');
    expect(optionsText({ memory: '32GB', color: 'Graphite' })).toBe('32GB · Graphite');
  });
});
