# Bot Comment Cleaner

**Short description (Chrome Web Store)**
Hide spam/sexual bot comments locally while you browse. Lightweight, fast, and private.

**Full description (Chrome Web Store)**
Bot Comment Cleaner is a lightweight Chrome extension that removes spammy and sexual bot comments directly in your browser. It works entirely on your device using fast, local filters, so nothing is sent to any server.

Features
- Hides spam/sexual bot comments on supported sites
- On‑page control panel with scan stats
- Toggle to show all comments anytime
- Periodic rescans for lazy‑loaded threads
- No tracking, no data collection

Supported sites
- https://hianime.to/*

Privacy
All filtering runs locally in your browser. This extension does not collect, transmit, or store personal data.

## Local install (developer mode)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `bot-comment-cleaner/` folder

## Build a zip for Chrome Web Store
From the `bot-comment-cleaner/` folder:

```bash
./release.sh
```

This creates `dist/bot-comment-cleaner.zip`.

## Run local tests
From the `bot-comment-cleaner/` folder:

```bash
node scripts/test-comments.js
```

Add more test cases to `tests/comments.json` over time and re-run the command.

## Customize filters
Edit `filters.js` to add or tweak patterns.
You can also add keywords to `wordlists/sexual-en.txt` (one term per line). This is loaded locally by the extension at runtime.

## License
MIT
