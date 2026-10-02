import * as SecureStore from 'expo-secure-store';

/**
 * Small secrets (refresh token, guest cart id) live in the iOS Keychain / Android Keystore,
 * readable only while the phone is unlocked and never included in backups or other devices.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key, options),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  remove: (key: string) => SecureStore.deleteItemAsync(key, options),
};
