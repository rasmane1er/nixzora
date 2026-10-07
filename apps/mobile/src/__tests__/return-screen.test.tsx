import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReturnScreen from '@/app/return/[number]';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { orders: { get: jest.fn(), requestReturn: jest.fn() } },
}));
jest.mock('@/lib/session', () => ({ useSession: () => ({ status: 'signedIn' }) }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ number: 'NX-ABC123' }),
}));

const get = api.orders.get as jest.Mock;
const requestReturn = api.orders.requestReturn as jest.Mock;
const ITEM_A = '0190a1b2-0000-7000-8000-00000000000a';
const ITEM_B = '0190a1b2-0000-7000-8000-00000000000b';

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReturnScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({
    number: 'NX-ABC123',
    items: [
      { id: ITEM_A, productTitle: 'Kestrel 14 Pro', variantTitle: '32GB / 1TB', quantity: 1 },
      { id: ITEM_B, productTitle: 'USB-C cable', variantTitle: '2 m', quantity: 3 },
    ],
  });
});

it('asks for at least one item before sending', async () => {
  renderScreen();
  fireEvent.press(await screen.findByText('Request return'));
  expect(screen.getByText('Choose at least one item to return.')).toBeTruthy();
  expect(requestReturn).not.toHaveBeenCalled();
});

it('sends the chosen items, quantities and reason for a signed-in customer', async () => {
  requestReturn.mockResolvedValue({ id: 'r1' });
  renderScreen();
  fireEvent.press(await screen.findByLabelText('USB-C cable, 2 m'));
  fireEvent.press(screen.getByLabelText('+'));
  fireEvent.press(screen.getByLabelText('Wrong item sent'));
  fireEvent.press(screen.getByText('Request return'));
  await waitFor(() => expect(screen.getByText(/Return requested/)).toBeTruthy());
  expect(get).toHaveBeenCalledWith('NX-ABC123', undefined);
  expect(requestReturn).toHaveBeenCalledWith(
    'NX-ABC123',
    { reason: 'WRONG_ITEM', note: undefined, items: [{ orderItemId: ITEM_B, quantity: 2 }] },
    undefined,
  );
});
