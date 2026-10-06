// Expo's default Metro config plus Sentry's debug ids, so uploaded source maps match the bundle.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
