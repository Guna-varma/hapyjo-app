# Android & Play Store Checklist

Use this before building for the client and when publishing to the Play Store.

## Build & run

- **Lint:** `npm run lint`
- **TypeScript:** `npx tsc --noEmit`
- **Run on device/emulator:** `npm run android` (with Expo dev server)
- **Production APK (EAS):** `npm run build:apk` (uses `production-apk` profile in `eas.json`)
- **AAB for Play Store:** `eas build --platform android --profile production` (builds app bundle)

## app.json (Android)

- **version:** `1.0.0` – bump for each store release (e.g. `1.0.1`).
- **android.versionCode:** Integer; **must increase for every Play Store upload** (e.g. 1 → 2 → 3).
- **android.package:** `com.hapyjo.attendance` – do not change unless rebranding.
- **android.adaptiveIcon:** Foreground + background – already set.
- **android.permissions:** Camera, location, notifications, etc. – already declared.
- **expo-notifications:** Icon and default channel – already configured.

## Before submitting to Play Store

1. Bump `version` and `android.versionCode` in `app.json`.
2. Run `npx tsc --noEmit` and `npm run lint`; fix any errors.
3. Build AAB: `eas build --platform android --profile production`.
4. Submit: `eas submit --platform android --profile production` (or upload AAB manually in Play Console).
5. In Play Console: fill store listing, content rating, target audience, and data safety form.

## UI/UX

- Theme tokens are in `theme/tokens.ts` (colors, spacing, radius).
- Use `ScreenContainer`, `Card`, `Button`, `Input` from `@/components/ui` for consistency.
- Min touch target 48px; 16px screen padding; 12px card radius.
