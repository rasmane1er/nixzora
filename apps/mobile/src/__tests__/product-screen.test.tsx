import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ProductScreen from '@/app/p/[slug]';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: {
    catalog: {
      product: jest.fn(),
      related: jest.fn(),
      reviewInsights: jest.fn(),
      reviews: jest.fn(),
      questions: jest.fn(async () => ({
        questions: [],
        page: 1,
        totalPages: 1,
        total: 0,
        canAnswer: false,
      })),
      myReview: jest.fn(),
    },
    recommendations: { view: jest.fn(async () => undefined) },
    ads: { forPage: jest.fn(async () => ({ ads: [] })), click: jest.fn() },
    cart: { add: jest.fn() },
    wishlist: { ids: jest.fn(async () => []), list: jest.fn(async () => ({ items: [] })) },
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
  Link: ({ children }: { children: unknown }) => children,
  useLocalSearchParams: () => ({ slug: 'linden-organic-tee' }),
}));

const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const colors = ['Black', 'Natural', 'Sage'];
const tee = {
  id: 'p1',
  slug: 'linden-organic-tee',
  title: 'Linden organic cotton tee',
  brand: { slug: 'linden', name: 'Linden' },
  category: { slug: 'tops', name: 'T-shirts & hoodies' },
  priceFromCents: 2400,
  compareAtCents: null,
  currency: 'USD',
  inStock: true,
  image: null,
  defaultVariantId: null,
  rating: { average: 4.5, count: 2 },
  description: 'A midweight crew-neck tee.',
  status: 'ACTIVE',
  attributes: {
    fit: 'Regular',
    care: 'Machine wash cold',
    material: '100% organic cotton',
    breathable: true,
  },
  breadcrumb: [
    { slug: 'clothing-shoes', name: 'Clothing & shoes' },
    { slug: 'tops', name: 'T-shirts & hoodies' },
  ],
  seller: null,
  reviewNote: null,
  images: [1, 2].map((n) => ({ id: `i${n}`, url: `https://x/${n}.webp`, alt: 'tee', position: n })),
  variants: colors.flatMap((color) =>
    sizes.map((size) => ({
      id: `${color}-${size}`,
      sku: `${color}-${size}`,
      barcode: null,
      title: `${color} / ${size}`,
      options: { size, color },
      priceCents: 2400,
      compareAtCents: null,
      currency: 'USD',
      available: 10,
      isActive: true,
    })),
  ),
  createdAt: '2026-10-08T20:49:14.298Z',
  updatedAt: '2026-10-08T20:49:14.298Z',
};

// The product page, opened with clothing data shaped like the staging API's.
it('opens a product and picks its color, then its size', async () => {
  (api.catalog.product as jest.Mock).mockResolvedValue(tee);
  (api.catalog.related as jest.Mock).mockResolvedValue({
    similar: [],
    boughtTogether: [],
    alsoViewed: [],
  });
  (api.catalog.reviewInsights as jest.Mock).mockResolvedValue(null);
  (api.catalog.reviews as jest.Mock).mockResolvedValue({
    summary: { average: 4.5, count: 2, distribution: [0, 0, 0, 1, 1] },
    reviews: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ProductScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Linden organic cotton tee')).toBeTruthy();
  expect(screen.getByText('Color: Black')).toBeTruthy();
  expect(screen.getByText('Size: XS')).toBeTruthy();
  // Colors are round swatches now (ADR-0053): found by their name, not text.
  fireEvent.press(screen.getByLabelText('Sage'));
  fireEvent.press(screen.getByText('XL'));
  expect(screen.getByText('Color: Sage')).toBeTruthy();
  expect(screen.getByText('Size: XL')).toBeTruthy();
});
