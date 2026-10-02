import { attributeLabel, money, optionsText, statusLabel } from '@/lib/format';

describe('format', () => {
  it('formats cents as dollars', () => {
    expect(money(134900)).toBe('$1,349.00');
    expect(money(0)).toBe('$0.00');
  });

  it('labels specs with their units', () => {
    expect(attributeLabel('refresh_hz')).toBe('Refresh (Hz)');
    expect(attributeLabel('screen_in')).toBe('Screen (in)');
    expect(attributeLabel('cpu_cores')).toBe('Cpu cores');
    expect(attributeLabel('os')).toBe('Os');
  });

  it('speaks the customer’s language for order states and options', () => {
    expect(statusLabel('PENDING_PAYMENT')).toBe('Awaiting payment');
    expect(statusLabel('SHIPPED')).toBe('Shipped');
    expect(optionsText({ memory: '32GB', color: 'Graphite' })).toBe('32GB · Graphite');
  });
});
