# Expo tunnel (--tunnel) troubleshooting

If `npx expo start --tunnel` fails with:

```text
CommandError: TypeError: Cannot read properties of undefined (reading 'body')
```

**Use LAN instead (recommended):**

```bash
npm start
```

Connect your phone to the **same Wi‑Fi** as your PC, then scan the QR code in Expo Go. No tunnel needed.

---

**If you really need tunnel (e.g. different networks):**

1. Install ngrok globally, then try tunnel again:
   ```bash
   npm i -g @expo/ngrok
   npm run start:tunnel
   ```
2. If it still fails, this is a known Expo CLI/ngrok bug; use LAN (`npm start`) or check https://status.ngrok.com/ for outages.
