#!/usr/bin/env bash
# First TestFlight + Google Play internal testing release of NIXZORA (preview variant).
# Run from your Mac:  pnpm --filter @nixzora/mobile release:first -- --api-url https://api.example.com
# Safe to re-run: steps that are already done are skipped. Never commits anything.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL=""
WEB_URL=""
PLATFORM="all"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --web-url) WEB_URL="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --) shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

step() { printf '\n\033[1;33m▶ %s\033[0m\n' "$1"; }

if [[ -z "$API_URL" ]]; then
  echo "The build needs the address of a public NIXZORA API, e.g. --api-url https://api.staging.nixzora.shop"
  echo "(Phones cannot reach 'localhost'. Deploy staging first: docs/runbooks/first-deploy.md.)"
  exit 1
fi
WEB_URL="${WEB_URL:-${API_URL/api./}}"

step "1/6 Expo CLI and sign-in"
command -v eas >/dev/null || npm install --global eas-cli
eas whoami >/dev/null 2>&1 || eas login
echo "Signed in to Expo as $(eas whoami)."

step "2/6 Build-time settings for the preview builds (EAS environment variables)"
set_var() {
  eas env:create --environment preview --name "$1" --value "$2" --visibility plaintext \
    --non-interactive --force >/dev/null && echo "  $1 = $2"
}
set_var EXPO_PUBLIC_API_URL "$API_URL"
set_var EXPO_PUBLIC_WEB_URL "$WEB_URL"

step "3/6 Android push configuration (google-services.json from Firebase project nexora-66e0b)"
GS="${GOOGLE_SERVICES_JSON_PATH:-$HOME/Downloads/google-services.json}"
if [[ -f "$GS" ]]; then
  eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value "$GS" \
    --visibility secret --non-interactive --force >/dev/null
  echo "  Uploaded $GS to EAS (secret file variable). You can delete the local copy."
else
  echo "  Not found: $GS — download it in Firebase → Project settings → Your apps → NIXZORA Preview."
  echo "  Android builds still work; push notifications on Android stay off until it is uploaded."
fi

step "4/6 Build in the Expo cloud (iOS asks you to sign in to Apple once to create certificates)"
eas build --profile preview --platform "$PLATFORM"

step "5/6 Send the iOS build to TestFlight"
if [[ "$PLATFORM" != "android" ]]; then
  eas submit --profile preview --platform ios --latest
fi

step "6/6 Android: first upload to Play internal testing"
if [[ "$PLATFORM" != "ios" ]]; then
  if ! eas submit --profile preview --platform android --latest; then
    cat <<'MSG'
  Google only accepts the very first upload of a new app through the Play Console:
    1. Open the build on expo.dev and download the .aab file.
    2. Play Console → NIXZORA Preview → Test and release → Internal testing → Create new release
       → upload the .aab → Save → Review release → Start rollout.
  After that, re-run this script (or the "Mobile release" GitHub workflow) and uploads are automatic.
MSG
  fi
fi

cat <<'MSG'

Done. Still to do once, by hand (see docs/runbooks/mobile-release.md):
  • Android push: eas credentials → Android → preview → Push Notifications: FCM V1 →
    upload the Firebase Admin SDK key (nexora-66e0b-firebase-adminsdk-*.json in Downloads).
  • TestFlight: App Store Connect → NIXZORA Preview → TestFlight → add internal testers.
  • Play: Internal testing → Testers → create an email list and share the opt-in link.
MSG
