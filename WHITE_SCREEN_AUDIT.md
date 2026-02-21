# White Screen & Core Issues – Audit

## Executive summary

The app was showing a **white screen after bundling** because of several overlapping causes. This document lists **root causes**, **what was fixed**, and **remaining recommendations**.

---

## 1. Root causes of the white screen

### 1.1 Layout blocked on font loading (fixed)

- **Where:** `app/_layout.tsx`
- **What:** The root layout used `useFonts()` and returned `null` until fonts loaded. If the font never loaded or was slow (e.g. on Expo Go or slow networks), the app stayed on a blank screen.
- **Why it felt complex:** Timeout and “ready” logic were added on top of font loading, making the root layout harder to follow.
- **Fix:** Font loading was removed from the root layout. The app no longer blocks on fonts. Splash is hidden in a simple `useEffect`. Custom font can be re-added later in a non-blocking way if needed.

### 1.2 Supabase throwing at module load (fixed)

- **Where:** `lib/supabase.ts`
- **What:** `if (!supabaseUrl || !supabaseAnonKey) throw new Error(...)` ran as soon as any file imported `supabase`. In some environments (e.g. Expo Go, env not inlined), that import happens when the first screen loads, so the process threw **before** React could render. Error boundaries don’t catch module-load errors, so you get a crash or white screen.
- **Fix:** Supabase no longer throws at load. It always creates a client (using placeholders if env is missing). The app always mounts; missing env only causes API calls to fail later.

### 1.3 No visible state while auth initializes (fixed)

- **Where:** `app/index.tsx` + `context/AuthContext.tsx`
- **What:** Until `getSession()` completed, the app had no explicit “loading” UI. Combined with the above, the first paint could be delayed or never happen.
- **Fix:** `AuthContext` now exposes `authLoading` and sets it to `false` after the first session check. The index screen shows a simple “Loading…” + spinner while `authLoading` is true, so there is always something on screen.

### 1.4 Reanimated at root (fixed)

- **Where:** `app/_layout.tsx`
- **What:** `ReducedMotionConfig` and the top-level `"react-native-reanimated"` import in the root layout could interact badly with some runtimes (e.g. Expo Go, reduced-motion settings) and add failure points before the first screen.
- **Fix:** Reanimated was removed from the root layout. The Babel plugin remains for any screen that uses animations later. No component in the project currently uses Reanimated directly.

### 1.5 Root layout complexity (fixed)

- **What:** The root layout mixed font loading, timeout state, Reanimated, and error boundary. That made debugging harder and increased the chance of a bad state (e.g. `ready` never true).
- **Fix:** Root layout is now minimal: error boundary → SafeAreaProvider → ThemeProvider → Stack → hide splash. No fonts, no Reanimated, no conditional “ready” that can hang.

---

## 2. What was changed (summary)

| Area | Change |
|------|--------|
| **app/_layout.tsx** | Removed font loading, timeout, and Reanimated. Kept error boundary. Splash hidden in one `useEffect`. |
| **lib/supabase.ts** | No longer throws at load; uses placeholder URL/key when env is missing so the app always mounts. |
| **context/AuthContext.tsx** | Added `authLoading`; set to `false` after first `getSession()` (in `finally`). |
| **app/index.tsx** | When `authLoading` is true, show a simple “Loading…” view with spinner so the screen is never blank. |

---

## 3. Other core issues (audit)

### 3.1 Architecture / bootstrap

- **Entry:** `expo-router/entry` → loads `app/_layout.tsx` then the initial route (`app/index.tsx`). No custom entry file; structure is correct.
- **Provider order:** Index wraps with AuthProvider → LocaleProvider → MockAppStoreProvider → AppContent. Order is correct; MockAppStore uses `useAuth()` inside AuthProvider.
- **Env:** `.env` has `EXPO_PUBLIC_SUPABASE_*`. Expo inlines these at build time. If you ever run without env, the app will now mount and only fail on login/API use.

### 3.2 New Architecture

- **app.json:** `"newArchEnabled": true`. The New Architecture can sometimes cause issues with older or incompatible native modules. If you still see a white screen or odd crashes after these fixes, try setting this to `false` and testing again.

### 3.3 Styling

- **NativeWind:** Used with `contentContainerClassName` on some `ScrollView`s and `className` elsewhere. If a screen ever looks broken, check that NativeWind is processing that component (e.g. correct preset in Babel and Metro).
- **global.css:** Imported in `_layout.tsx` and `index.tsx`; Tailwind directives only. Fine as long as Metro/NativeWind are configured to handle it (they are).

### 3.4 Data / RLS

- **RLS and 500s:** If RLS policies still use inline `(SELECT role FROM profiles WHERE id = auth.uid())`, you can get 500s. Use the migration/script that switches to `current_user_role()` (SECURITY DEFINER) and run it in Supabase. See `supabase/scripts/run_rls_fix_current_user_role.sql`.
- **Profile fetch:** Auth already uses `get_my_profile` RPC instead of direct `profiles` select; that’s correct.

### 3.5 Complexity vs simplicity

- **Before:** Root layout had fonts, timeout, Reanimated, and error boundary; supabase threw at load; no auth loading UI. Many ways to end up with a white or stuck screen.
- **After:** Root layout is minimal; supabase never throws at load; auth has an explicit loading state and the index always shows either “Loading…”, Login, or the app. Fewer moving parts and fewer failure modes.

---

## 4. If the white screen persists

1. **Clear and restart:**  
   `npx expo start -c` (clear cache) and open the app again in Expo Go.

2. **Turn off New Architecture:**  
   In `app.json`, set `"newArchEnabled": false`, then rebuild/restart.

3. **Check console:**  
   Look for red errors or warnings when the bundle loads and when the first screen should render. The root error boundary will show “Something went wrong” only for **render** errors; module-load errors won’t be caught there.

4. **Verify env in the bundle:**  
   Temporarily log `process.env.EXPO_PUBLIC_SUPABASE_URL` (e.g. in `AuthProvider`’s first render). If it’s undefined in Expo Go, fix env loading (e.g. ensure `.env` is in the project root and that you’re not using a cached bundle built without env).

5. **Minimal root test:**  
   In `app/index.tsx`, temporarily replace the whole tree with a single `<View style={{flex:1, backgroundColor:'red'}}><Text>Hello</Text></View>`. If you still see white, the problem is before the index (router, Metro, or device). If you see red and “Hello”, the problem is in one of the providers or screens.

---

## 5. Files touched in this fix

- `app/_layout.tsx` – simplified; no font block, no Reanimated
- `lib/supabase.ts` – no throw at load
- `context/AuthContext.tsx` – `authLoading` added and set after first session check
- `app/index.tsx` – “Loading…” UI when `authLoading` is true
- This audit: `WHITE_SCREEN_AUDIT.md`

No other files were changed for the white-screen fix. Reanimated Babel plugin is unchanged for future use.
