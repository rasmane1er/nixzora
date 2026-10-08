import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReviewScreen from '@/app/review/[slug]';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { catalog: { myReview: jest.fn(), submitReview: jest.fn() } },
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ slug: 'kestrel-14-pro', title: 'Kestrel 14 Pro' }),
}));

const myReview = api.catalog.myReview as jest.Mock;
const submitReview = api.catalog.submitReview as jest.Mock;

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReviewScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('checks the rating and length before sending', async () => {
  myReview.mockResolvedValue({ review: null, canReview: true });
  renderScreen();
  fireEvent.press(await screen.findByText('Submit review'));
  expect(screen.getByText('Tell other shoppers a little more (20+ characters).')).toBeTruthy();
  expect(submitReview).not.toHaveBeenCalled();
});

it('sends a new review for the product', async () => {
  myReview.mockResolvedValue({ review: null, canReview: true });
  submitReview.mockResolvedValue({ status: 'PENDING' });
  renderScreen();
  fireEvent.press(await screen.findByLabelText('4 out of 5 stars'));
  fireEvent.changeText(screen.getByLabelText('Headline'), 'Fast and quiet');
  fireEvent.changeText(
    screen.getByLabelText('Your review'),
    'Used it for a month of daily work; the battery easily lasts a full day.',
  );
  fireEvent.press(screen.getByText('Submit review'));
  await waitFor(() => expect(submitReview).toHaveBeenCalled());
  expect(submitReview).toHaveBeenCalledWith('kestrel-14-pro', {
    rating: 4,
    title: 'Fast and quiet',
    body: 'Used it for a month of daily work; the battery easily lasts a full day.',
  });
});

it('starts from the earlier review when editing', async () => {
  myReview.mockResolvedValue({
    review: {
      id: 'r1',
      rating: 5,
      title: 'Great laptop',
      body: 'Twenty characters at least, easily.',
      status: 'PENDING',
    },
    canReview: true,
  });
  renderScreen();
  expect(await screen.findByDisplayValue('Great laptop')).toBeTruthy();
  expect(screen.getByText('Your review is waiting for moderation.')).toBeTruthy();
});

it('explains that a review needs the product delivered first', async () => {
  myReview.mockResolvedValue({ review: null, canReview: false });
  renderScreen();
  expect(
    await screen.findByText('You can review this product once it has been delivered to you.'),
  ).toBeTruthy();
  expect(screen.queryByText('Submit review')).toBeNull();
});
