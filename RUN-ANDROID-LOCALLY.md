# Run Hapyjo Android app locally (Windows)

## See the app inside Cursor (web preview)

You can run the app in Cursor’s built-in browser so you don’t need a phone or emulator.

1. **Start the app in web mode**
   ```bash
   npm run web
   ```
2. **Open it in Cursor**
   - Press **Ctrl+Shift+P** (Command Palette).
   - Type **Simple Browser: Show** and select it.
   - Enter: **http://localhost:8081** (or the URL shown in the terminal, e.g. `http://localhost:19006`).
3. The app opens in a tab inside Cursor. You can keep coding and see changes as you refresh.

Note: The web build may behave slightly differently from the real Android app (e.g. some native features), but it’s fine for UI and flow testing.

---

## Prerequisites (for other options)

1. **Node.js** – You already have it (project uses npm).
2. Either **Android Studio + emulator** (run on PC) or **Expo Go on a phone** (no SDK needed).

---

## Quick test without Android Studio: use Expo Go on your phone

1. On your PC, run: `npm start`
2. Install **Expo Go** on your Android phone from the Play Store.
3. Scan the **QR code** shown in the terminal with Expo Go.
4. The app loads on your phone over Wi‑Fi.

---

## Run on Android emulator on your PC

If you see **"Failed to resolve the Android SDK path"** or **"'adb' is not recognized"**, set up the SDK first.

### Step 1: Install Android Studio and SDK

1. Download and install **Android Studio**: https://developer.android.com/studio  
2. During setup, install the **Android SDK** (default: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`).  
3. In Android Studio: **Tools → Device Manager** → **Create Device** → pick a phone (e.g. Pixel 6) → **Next** → download a system image → **Finish**.  
4. Start the emulator with the **Play** button in Device Manager.

### Step 2: Set ANDROID_HOME (required for `npm run android`)

1. Press **Win + R**, type `sysdm.cpl`, press Enter → **Advanced** → **Environment Variables**.  
2. Under **User variables**, click **New**: `ANDROID_HOME` = `C:\Users\MedaVarma\AppData\Local\Android\Sdk`  
3. Edit **Path** and add: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator`  
4. Click **OK**, then **close and reopen** your terminal (or Cursor).

### Step 3: Run the app on the emulator

1. Start the emulator from Android Studio (Device Manager → Play).  
2. In the project folder: `npm run android`
