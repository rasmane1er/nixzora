import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import AssistantScreen from '@/app/(tabs)/assistant';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { assistant: { chat: jest.fn() }, cart: { add: jest.fn() } },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const chat = api.assistant.chat as jest.Mock;
const add = api.cart.add as jest.Mock;

const laptop = {
  id: '0190a5b2-0000-7000-8000-000000000001',
  slug: 'kestrel-14-pro',
  title: 'Kestrel 14 Pro developer laptop',
  brand: { slug: 'kestrel', name: 'Kestrel' },
  category: { slug: 'laptops', name: 'Laptops' },
  priceFromCents: 114900,
  compareAtCents: null,
  currency: 'USD',
  inStock: true,
  image: null,
};

const response = {
  reply: 'Here’s the best match for laptops under $1,500 (quiet).',
  need: {
    category: 'laptops',
    categoryName: 'Laptops',
    minPriceCents: null,
    maxPriceCents: 150000,
    mustHave: ['quiet'],
    query: 'quiet laptop',
  },
  picks: [
    {
      product: laptop,
      badge: 'Best match',
      reason: 'silent · 12-core CPU',
      matched: ['quiet'],
      variantId: '0190a5b2-0000-7000-8000-0000000000aa',
    },
  ],
  comparison: null,
  suggestions: ['Longer battery life'],
  relaxed: [],
  model: 'local',
};

function renderAssistant(initialUrl = '/assistant') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderRouter(
    {
      assistant: () => (
        <QueryClientProvider client={client}>
          <AssistantScreen />
        </QueryClientProvider>
      ),
    },
    { initialUrl },
  );
}

describe('Assistant screen', () => {
  beforeEach(() => {
    chat.mockReset();
    add.mockReset();
  });

  it('sends the request and shows grounded picks', async () => {
    chat.mockResolvedValue(response);
    renderAssistant();
    fireEvent.changeText(
      screen.getByLabelText('Message the assistant'),
      'quiet laptop under $1,500',
    );
    fireEvent.press(screen.getByLabelText('Send'));
    await waitFor(() => expect(screen.getByText('Kestrel 14 Pro developer laptop')).toBeTruthy());
    expect(chat).toHaveBeenCalledWith([{ role: 'user', content: 'quiet laptop under $1,500' }]);
    expect(screen.getByText('Best match')).toBeTruthy();
    expect(screen.getByText('Up to $1,500')).toBeTruthy();
  });

  it('starts from a deep link and keeps the conversation for follow-ups', async () => {
    chat.mockResolvedValue(response);
    renderAssistant('/assistant?q=quiet%20laptop');
    await waitFor(() => expect(screen.getByText('Longer battery life')).toBeTruthy());
    fireEvent.press(screen.getByText('Longer battery life'));
    await waitFor(() => expect(chat).toHaveBeenCalledTimes(2));
    expect(chat.mock.calls[1]![0]).toEqual([
      { role: 'user', content: 'quiet laptop' },
      { role: 'assistant', content: response.reply },
      { role: 'user', content: 'Longer battery life' },
    ]);
  });

  it('adds a pick to the cart', async () => {
    chat.mockResolvedValue(response);
    add.mockResolvedValue({ itemCount: 1 });
    renderAssistant('/assistant?q=quiet%20laptop');
    await waitFor(() =>
      expect(screen.getByLabelText('Add Kestrel 14 Pro developer laptop to cart')).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Add Kestrel 14 Pro developer laptop to cart'));
    await waitFor(() => expect(screen.getByText('Added ✓')).toBeTruthy());
    expect(add).toHaveBeenCalledWith('0190a5b2-0000-7000-8000-0000000000aa', 1);
  });
});
