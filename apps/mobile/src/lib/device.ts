import * as Device from 'expo-device';

/** Shown in "Signed-in devices" on the website, e.g. "Ada's iPhone · NIXZORA app". */
export function deviceName(): string {
  return [Device.deviceName ?? Device.modelName, 'NIXZORA app']
    .filter(Boolean)
    .join(' · ')
    .slice(0, 100);
}
