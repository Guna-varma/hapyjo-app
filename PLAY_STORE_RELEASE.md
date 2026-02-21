# Hapyjo Ltd – APK release and Play Store publish

This guide covers building **dev** and **production** Android builds and publishing to the Google Play Store.

## Icons in use

- **App icon / splash / adaptive icon:** `assets/images/hapyjo_playstore_icon_v2_1024.png`
- **Favicon (web):** `assets/images/hapyjo_playstore_icon_v2_512.png`
- **Play Store listing (512×512):** use `hapyjo_playstore_icon_v2_512.png` in Play Console for “High-res icon”.

---

## 1. Prerequisites

- Node.js and npm installed.
- [EAS CLI](https://docs.expo.dev/build/setup/) and an Expo account:
  ```bash
  npm install -g eas-cli
  eas login
  ```
- Android: for **production** builds, a **Google Play Console** account and a **keystore** (EAS can create one on first build).

---

## 2. Build profiles (EAS)

| Profile            | Use case              | Output   | Command (below)   |
|--------------------|------------------------|----------|-------------------|
| **development**    | Dev/testing on device  | APK      | `eas build -p android --profile development` |
| **preview**       | Internal testing      | APK      | `eas build -p android --profile preview`     |
| **production**    | Play Store (recommended) | AAB    | `eas build -p android --profile production`  |
| **production-apk**| Production as APK      | APK      | `eas build -p android --profile production-apk` |

- **Dev / internal:** use **development** or **preview** to get an APK you can install directly (e.g. via link or sideload).
- **Play Store:** use **production** (AAB). Use **production-apk** only if you specifically need a production APK (e.g. other stores or sideload).

---

## 3. Build commands

From the project root:

```bash
# Dev APK (development client)
eas build -p android --profile development

# Internal testing APK
eas build -p android --profile preview

# Production AAB for Play Store (recommended)
eas build -p android --profile production

# Production APK (if you need APK instead of AAB)
eas build -p android --profile production-apk
```

First time you run a **production** build, EAS will prompt to create or use an existing Android keystore; accept to have EAS manage it.

---

## 4. After the build

- Builds run on Expo’s servers. When finished, you get a link to the **APK** or **AAB**.
- **Preview/development:** download the APK and install on devices (internal testing).
- **Production:** download the **AAB** (from production profile) for upload to Play Console.

---

## 5. Publish to Google Play Store

1. **Google Play Console**
   - Go to [Google Play Console](https://play.google.com/console).
   - Create or select your app (e.g. “Hapyjo Ltd”).

2. **Store listing**
   - **App icon (512×512):** upload `assets/images/hapyjo_playstore_icon_v2_512.png`.
   - Fill in short description, full description, screenshots, category, contact details.

3. **Upload the AAB**
   - **Release** → **Production** (or **Testing** first) → **Create new release**.
   - Upload the **AAB** from:
     `eas build -p android --profile production`
   - Add release name (e.g. “1.0.0”) and release notes.
   - Review and roll out.

4. **Content rating, privacy policy, target audience**
   - Complete Content rating questionnaire.
   - Add privacy policy URL if required.
   - Set target audience and any other required fields.

5. **Submit for review**
   - Once all required sections are complete, submit the release. Review usually takes from a few hours to a few days.

---

## 6. Submit from CLI (optional)

To submit the **latest production build** to Play Store from the command line:

```bash
eas submit -p android --profile production --latest
```

You’ll need a **Google Service Account** with access to the Play Console and a JSON key; EAS will prompt or use the one linked to your project.

---

## 7. Version and icon checklist

- **App icon:** `app.json` already points to `hapyjo_playstore_icon_v2_1024.png` for app/splash/adaptive icon.
- **Bump version** for each store release in `app.json`: `expo.version` (and optionally `expo.android.versionCode` for Android).
- **Play Store 512×512 icon:** use `assets/images/hapyjo_playstore_icon_v2_512.png` in the Play Console store listing.

---

## Summary

| Goal                    | Command / action |
|-------------------------|------------------|
| Dev APK                 | `eas build -p android --profile development` |
| Internal test APK       | `eas build -p android --profile preview`     |
| Production for Play Store | `eas build -p android --profile production` → upload AAB in Play Console |
| Production APK         | `eas build -p android --profile production-apk` |
| Submit from CLI         | `eas submit -p android --profile production --latest` |

Language can be changed from the **auth (login) screen** via the small **globe icon** at the top; the choice is saved and used for the rest of the app.
