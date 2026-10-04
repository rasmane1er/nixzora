import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RegisterScreen from '@/app/register';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { auth: { register: jest.fn() } } }));
jest.mock('@/lib/account-actions', () => ({ completeSignIn: jest.fn() }));
jest.mock('@/components/SocialSignIn', () => ({ SocialSignIn: () => null }));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const register = api.auth.register as jest.Mock;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <RegisterScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('checks every field before sending', () => {
  renderScreen();
  fireEvent.press(screen.getByText('Create account'));
  expect(screen.getByText('Check the highlighted fields.')).toBeTruthy();
  expect(screen.getByText('Enter your first name.')).toBeTruthy();
  expect(
    screen.getByText('Agree to the Terms of Service and Privacy Policy to continue.'),
  ).toBeTruthy();
  expect(register).not.toHaveBeenCalled();
});

it('creates the account with the number in international form and the consent', async () => {
  register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
  renderScreen();
  fireEvent.changeText(screen.getByLabelText('First name *'), 'Awa');
  fireEvent.changeText(screen.getByLabelText('Last name *'), 'Traoré');
  fireEvent.changeText(screen.getByLabelText('Email address *'), ' awa@example.com ');
  fireEvent.press(screen.getByLabelText(/^Country code/));
  fireEvent.press(screen.getByText(/Burkina Faso|BF/));
  fireEvent.changeText(screen.getByLabelText('Mobile phone (Optional)'), '70 12 34 56');
  fireEvent.changeText(screen.getByLabelText('Password *'), 'correct horse battery staple');
  fireEvent.changeText(screen.getByLabelText('Confirm password *'), 'correct horse battery staple');
  fireEvent.press(screen.getByRole('checkbox', { name: /I agree to the/ }));
  fireEvent.press(screen.getByText('Create account'));
  await waitFor(() => expect(completeSignIn).toHaveBeenCalled());
  expect(register).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'awa@example.com',
      firstName: 'Awa',
      lastName: 'Traoré',
      phone: '+22670123456',
      acceptTerms: true,
      marketingEmails: false,
    }),
  );
});
