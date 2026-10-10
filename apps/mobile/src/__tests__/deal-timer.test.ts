import { remaining } from '../components/DealTimer';

describe('deal countdown', () => {
  it('shows hours, minutes and seconds, never negative', () => {
    expect(remaining(3 * 3_600_000 + 7 * 60_000 + 15_000)).toBe('3:07:15');
    expect(remaining(30 * 3_600_000)).toBe('30:00:00');
    expect(remaining(-5_000)).toBe('0:00:00');
  });
});
