import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProductReviews } from '@/components/ProductReviews';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { catalog: { reviews: jest.fn() } } }));
const reviews = api.catalog.reviews as jest.Mock;

const review = (n: number, rating = 4) => ({
  id: `r${n}`,
  rating,
  title: `Review ${n}`,
  body: 'Long enough to read.',
  author: 'Ada',
  verifiedPurchase: true,
  createdAt: '2026-10-01T12:00:00.000Z',
});
const summary = { average: 4.2, count: 12, distribution: [0, 0, 1, 7, 4] };

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProductReviews slug="vela-13-air" />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('shows nothing for a product without reviews', async () => {
  reviews.mockResolvedValue({
    summary: { average: null, count: 0, distribution: [0, 0, 0, 0, 0] },
    reviews: [],
    page: 1,
    totalPages: 0,
    total: 0,
  });
  const { toJSON } = renderList();
  await waitFor(() => expect(reviews).toHaveBeenCalled());
  expect(toJSON()).toBeNull();
});

it('loads 10 at a time and filters by stars', async () => {
  reviews.mockImplementation(async (_slug: string, query: { page: number; rating?: number }) =>
    query.rating === 3
      ? { summary, reviews: [review(99, 3)], page: 1, totalPages: 1, total: 1 }
      : query.page === 1
        ? {
            summary,
            reviews: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => review(n)),
            page: 1,
            totalPages: 2,
            total: 12,
          }
        : { summary, reviews: [review(11), review(12)], page: 2, totalPages: 2, total: 12 },
  );
  renderList();
  expect(await screen.findByText('Showing 10 of 12 reviews')).toBeTruthy();
  fireEvent.press(screen.getByText('Show more reviews'));
  expect(await screen.findByText('Review 12')).toBeTruthy();
  expect(screen.queryByText('Show more reviews')).toBeNull();

  fireEvent.press(screen.getByText('3★ (1)'));
  expect(await screen.findByText('Review 99')).toBeTruthy();
  expect(reviews).toHaveBeenLastCalledWith('vela-13-air', { page: 1, sort: 'relevant', rating: 3 });
});
