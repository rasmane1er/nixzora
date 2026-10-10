import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { Price } from '@/components/Price';
import { ProductRail } from '@/components/ProductRail';
import { ReviewInsightsCard } from '@/components/ReviewInsightsCard';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Totals } from '@/components/Totals';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { ads: { click: jest.fn(async () => ({ slug: 'arden-27' })) }, cart: { add: jest.fn() } },
}));
jest.mock('@/lib/visitor', () => ({ visitorId: async () => 'visitor0123456789abcdef' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

function withQueries({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

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
    render(<ProductRail title="Similar products" products={[card(1), card(2, false)]} />, {
      wrapper: withQueries,
    });
    expect(screen.getByText('Similar products')).toBeTruthy();
    expect(screen.getByLabelText('Watch 1')).toBeTruthy();
    expect(screen.getByLabelText('Watch 2, sold out')).toBeTruthy();
  });

  it('renders nothing when there is nothing to show', () => {
    render(<ProductRail title="Similar products" products={[]} />, { wrapper: withQueries });
    expect(screen.queryByText('Similar products')).toBeNull();
  });
});

describe('ProductCard', () => {
  const base = {
    id: '0190a5b2-0000-7000-8000-000000000009',
    slug: 'arden-27',
    title: 'Arden 27',
    brand: { slug: 'arden', name: 'Arden' },
    category: { slug: 'monitors', name: 'Monitors' },
    priceFromCents: 38900,
    compareAtCents: 42900,
    currency: 'USD',
    inStock: true,
    image: null,
  };

  it('shows a sale badge, rating, save heart and add to cart for single-option products', () => {
    render(
      <ProductCard
        product={{
          ...base,
          rating: { average: 4.6, count: 5 },
          defaultVariantId: '0190a5b2-0000-7000-8000-0000000000aa',
        }}
      />,
      { wrapper: withQueries },
    );
    expect(screen.getByText('Sale −9%')).toBeTruthy();
    expect(screen.getByLabelText('Save Arden 27')).toBeTruthy();
    expect(screen.getByLabelText('Add to cart: Arden 27')).toBeTruthy();
    expect(screen.queryByText('From')).toBeNull();
  });

  it('sends products with options to their page and says "From"', () => {
    render(<ProductCard product={{ ...base, compareAtCents: null, defaultVariantId: null }} />, {
      wrapper: withQueries,
    });
    expect(screen.getByLabelText('Choose options: Arden 27')).toBeTruthy();
    expect(screen.getByText('From')).toBeTruthy();
  });
});

describe('Sponsored products', () => {
  const card = {
    id: '0190a5b2-0000-7000-8000-000000000009',
    slug: 'arden-27',
    title: 'Arden 27',
    brand: null,
    category: { slug: 'monitors', name: 'Monitors' },
    priceFromCents: 38900,
    compareAtCents: null,
    currency: 'USD',
    inStock: true,
    image: null,
  };

  it('labels an ad and records the click when it is opened', async () => {
    render(
      <ProductRail
        title="Sponsored products"
        sponsored={[{ product: card, token: 'signed.token' }]}
      />,
      { wrapper: withQueries },
    );
    expect(screen.getByText('Sponsored')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sponsored: Arden 27'));
    await waitFor(() =>
      expect(api.ads.click).toHaveBeenCalledWith('signed.token', 'visitor0123456789abcdef'),
    );
  });
});

describe('ReviewInsightsCard', () => {
  it('shows the summary, themes with counts and whether AI wrote it', () => {
    render(
      <ReviewInsightsCard
        insights={{
          summary: '80% of 5 reviewers rate it 4 or 5 stars.',
          pros: [{ label: 'Sound', mentions: 4 }],
          cons: [{ label: 'Connectivity', mentions: 1 }],
          reviewCount: 5,
          averageRating: 4.2,
          positivePercent: 80,
          aiWritten: true,
          generatedAt: '2026-10-03T00:00:00.000Z',
        }}
      />,
    );
    expect(screen.getByText('What customers say')).toBeTruthy();
    expect(screen.getByText('AI summary of 5 reviews')).toBeTruthy();
    expect(screen.getByText('+ Sound · 4')).toBeTruthy();
    expect(screen.getByText('− Connectivity · 1')).toBeTruthy();
  });
});
