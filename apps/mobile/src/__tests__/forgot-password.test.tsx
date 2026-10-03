import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '@/app/forgot-password';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { auth: { forgotPassword: jest.fn() } } }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ email: '' }),
}));

const forgot = api.auth.forgotPassword as jest.Mock;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <ForgotPasswordScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('asks for a valid email before sending', () => {
  renderScreen();
  fireEvent.press(screen.getByText('Send reset link'));
  expect(screen.getByText('Enter the email you signed up with.')).toBeTruthy();
  expect(forgot).not.toHaveBeenCalled();
});

it('sends the link and confirms without revealing whether the account exists', async () => {
  forgot.mockResolvedValue(undefined);
  renderScreen();
  fireEvent.changeText(screen.getByLabelText('Email'), ' ada@example.com ');
  fireEvent.press(screen.getByText('Send reset link'));
  await waitFor(() => expect(screen.getByText('Check your email')).toBeTruthy());
  expect(forgot).toHaveBeenCalledWith('ada@example.com');
  expect(screen.getByText(/If ada@example.com has a NIXZORA account/)).toBeTruthy();
});
