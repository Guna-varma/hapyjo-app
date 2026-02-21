# HapyJo Ltd – Deployment Checklist

This document outlines steps for building and deploying the Android app (production and side-load).

## Prerequisites

- [Expo EAS CLI](https://docs.expo.dev/build/setup/): `npm install -g eas-cli`
- Expo account: `eas login`
- Project linked to EAS: `eas build:configure` (if not already done)

## Build profiles (eas.json)

- **preview:** Internal distribution; produces an **APK** suitable for side-loading or internal testing.
- **production:** Produces an **AAB** (Android App Bundle) for Play Store submission.

## Building

### Preview (APK for side-load / testing)

```bash
eas build --platform android --profile preview
```

Download the APK from the EAS dashboard and install on device or emulator.

### Production (AAB for Play Store)

```bash
eas build --platform android --profile production
```

Use the AAB artifact from the EAS dashboard for Play Store upload.

## Play Store checklist

1. **Signing:** Ensure production profile uses a keystore (EAS can manage this; run `eas credentials` if needed).
2. **AAB:** Upload the `.aab` from the production build, not an APK.
3. **Store listing:** Prepare app title, short/long description, screenshots, and privacy policy URL.
4. **Content rating:** Complete the questionnaire in Play Console.
5. **Pricing & distribution:** Set countries and whether the app is free or paid.

## Notes

- The **prototype** uses mock data and mock auth; deploy production only after Supabase (or your backend) and real auth are integrated.
- For local development, use `npx expo start` and run on Android emulator or device with Expo Go / dev client.
