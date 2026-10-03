import { fireEvent, render, screen } from '@testing-library/react-native';
import { Price } from '@/components/Price';
import { ProductRail } from '@/components/ProductRail';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Totals } from '@/components/Totals';

describe('Price', () => {
  it('shows the sale price and the old one', () => {
    render(<Price cents={134900} compareAtCents={149900} />);
    expect(screen.getByText('$1,349.00')).toBeTruthy();
    expect(screen.getByText('$1,499.00')).toBeTruthy();
  });
});

describe('QuantityStepper', () => {
  it('stays within stock and the per-line limit', () => {
    const onChange = jest.fn();
    const { rerender } = render(<QuantityStepper value={3} max={3} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Decrease quantity'));
    expect(onChange).toHaveBeenCalledWith(2);

    rerender(<QuantityStepper value={20} max={99} onChange={onChange} />);
    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Totals', () => {
  it('explains discount, free shipping and pending tax', () => {
    render(
      <Totals
        taxKnown={false}
        totals={{
          currency: 'USD',
          subtotalCents: 6000,
          discountCents: 600,
          shippingCents: 0,
          taxCents: 0,
          totalCents: 5400,
          freeShippingRemainingCents: 3900,
        }}
      />,
    );
    expect(screen.getByText('−$6.00')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('At checkout')).toBeTruthy();
    expect(screen.getByText('Add $39.00 more for free shipping.')).toBeTruthy();
  });
});

describe('ProductRail', () => {
  const card = (n: number, inStock = true) => ({
    id: `0190a5b2-0000-7000-8000-00000000000${n}`,
    slug: `watch-${n}`,
    title: `Watch ${n}`,
    brand: null,
    category: { slug: 'wearables', name: 'Wearables' },
    priceFromCents: 19900,
    compareAtCents: null,
    currency: 'USD',
    inStock,
    image: null,
  });

  it('lists the products in a titled, sideways-scrolling row', () => {
    render(<ProductRail title="Similar products" products={[card(1), card(2, false)]} />);
    expect(screen.getByText('Similar products')).toBeTruthy();
    expect(screen.getByLabelText('Watch 1')).toBeTruthy();
    expect(screen.getByLabelText('Watch 2, sold out')).toBeTruthy();
  });

  it('renders nothing when there is nothing to show', () => {
    render(<ProductRail title="Similar products" products={[]} />);
    expect(screen.queryByText('Similar products')).toBeNull();
  });
});
