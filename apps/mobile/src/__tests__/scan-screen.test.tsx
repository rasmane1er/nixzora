import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import ScanScreen from '@/app/(tabs)/scan';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { catalog: { lookup: jest.fn() } } }));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const lookup = api.catalog.lookup as jest.Mock;

function renderScan() {
  return renderRouter(
    {
      scan: ScanScreen,
      'p/[slug]': () => <Text>Product page</Text>,
    },
    { initialUrl: '/scan' },
  );
}

describe('Scan screen', () => {
  beforeEach(() => lookup.mockReset());

  it('asks for the camera before scanning', () => {
    renderScan();
    expect(screen.getByText('Allow camera')).toBeTruthy();
  });

  it('opens the product for a typed barcode', async () => {
    lookup.mockResolvedValue({ slug: 'arden-27-4k-usb-c', variantId: 'v-1' });
    renderScan();
    fireEvent.changeText(screen.getByLabelText('Or type the code'), '2000898608126');
    fireEvent.press(screen.getByText('Find'));
    await waitFor(() => expect(screen).toHavePathname('/p/arden-27-4k-usb-c'));
    expect(lookup).toHaveBeenCalledWith('2000898608126');
    expect(screen).toHaveSearchParams({ slug: 'arden-27-4k-usb-c', variant: 'v-1' });
  });

  it('says so when NIXZORA does not sell the product', async () => {
    const { ApiError } = jest.requireActual('@nixzora/api-client');
    lookup.mockRejectedValue(new ApiError(404, 'Not found'));
    renderScan();
    fireEvent.changeText(screen.getByLabelText('Or type the code'), '4006381333931');
    fireEvent.press(screen.getByText('Find'));
    expect(await screen.findByText(/We don’t sell 4006381333931 yet/)).toBeTruthy();
  });
});
