import * as Device from 'expo-device';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Phones stay upright (the layouts are designed for it); tablets turn freely, like any iPad app,
 * including Split View and Slide Over.
 */
export async function applyOrientationPolicy(): Promise<void> {
  try {
    const type = await Device.getDeviceTypeAsync();
    if (type === Device.DeviceType.TABLET || type === Device.DeviceType.DESKTOP) {
      await ScreenOrientation.unlockAsync();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  } catch {
    // Web and some emulators do not support orientation locks; the default is fine there.
  }
}
