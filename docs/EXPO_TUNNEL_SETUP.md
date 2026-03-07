# Expo tunnel (ngrok) setup

If you get **"ngrok tunnel took too long to connect"** when running `npx expo start --tunnel`, use one of these approaches.

---

## Option 1: Use LAN (recommended when on same Wi‑Fi)

No tunnel needed. Phone and PC must be on the **same network**.

```bash
npm start
# or
npx expo start
```

Then scan the QR code with Expo Go. Prefer this when you’re on the same Wi‑Fi as your dev machine.

---

## Option 2: Run ngrok first, then tunnel

Expo’s built-in tunnel can time out. Running **ngrok yourself** often fixes it.

1. **Install ngrok**
   - https://ngrok.com/download  
   - Or: `choco install ngrok` (Windows)

2. **Start ngrok** (leave this terminal open):
   ```bash
   ngrok http 8081
   ```
   (Use port **19000** if Expo is using that; check the Expo output for “Metro waiting on …”.)

3. **In another terminal**, start Expo with tunnel:
   ```bash
   npm run start:tunnel
   # or
   npx expo start -c --tunnel
   ```

4. If it still times out, try again once or twice.

---

## Option 3: Try tunnel again

Sometimes the first attempt fails and the second works:

```bash
npm run start:tunnel
```

If it fails, run the same command again.

---

## Option 4: Firewall / antivirus

- Temporarily allow Node / Expo / ngrok in Windows Firewall.
- Temporarily disable antivirus and run `npm run start:tunnel` again.

---

## Scripts in this project

| Script            | Command                  | Use case                    |
|-------------------|--------------------------|-----------------------------|
| `npm start`       | `expo start`             | LAN (same Wi‑Fi)            |
| `npm run start:lan` | `expo start`          | Same as above               |
| `npm run start:tunnel` | `expo start -c --tunnel` | Tunnel (after ngrok or retry) |
