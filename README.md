# Bot Comment Cleaner

**Short description (Chrome Web Store)**
Hide spam/sexual bot comments locally while you browse. Lightweight, fast, and private.

**Full description (Chrome Web Store)**
Bot Comment Cleaner is a lightweight Chrome extension that removes spammy and sexual bot comments directly in your browser. Comment scanning runs locally, and filter-data can be refreshed from the project's public GitHub JSON so updates can ship without a store release.

Features
- Hides spam/sexual bot comments on supported sites
- On‑page control panel with scan stats
- Toggle to show all comments anytime
- Periodic rescans for lazy‑loaded threads
- Remote filter-data updates with local fallback cache
- No tracking, no data collection

Supported sites
- https://hianime.nz/*
- https://hianime.bz/*
- https://hianime.do/*
- https://hianime.pe/*
- https://hianime.cx/*
- https://hianime.me/*
- https://hianime.vc/*
- https://hianime.ps/*
- https://hianime.to/*
- https://hianimez.is/*
- https://hianimez.to/*

Privacy
Comment filtering runs locally in your browser. The extension can fetch public filter-data JSON from GitHub CDN endpoints, but it does not collect, transmit, or store personal data.

## Local install (developer mode)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `bot-comment-cleaner/` folder

## Userscript install (one-file)
This repo now includes a one-file userscript: `Tampermonkey/bot-comment-cleaner.js`.

- Chromium / Chrome / Edge:
  1. Install Tampermonkey or Violentmonkey.
  2. Create a new script and paste `Tampermonkey/bot-comment-cleaner.js`.
  3. Save and enable the script.

- Firefox:
  1. Install Tampermonkey, Violentmonkey, or Greasemonkey.
  2. Create a new script and paste `Tampermonkey/bot-comment-cleaner.js`.
  3. Save and enable the script.

- Safari:
  1. Install **Userscripts** or **Stay** from the App Store.
  2. Import or paste `Tampermonkey/bot-comment-cleaner.js`.
  3. Save and enable the script.
  4. Both work on Safari mobile (iPhone/iPad) as well.

Notes
- The userscript is self-contained (no `@require` dependencies).
- Filtering remains local-only; no comment data is sent to external servers.

## Build a zip for Chrome Web Store
From the `bot-comment-cleaner/` folder:

```bash
./release.sh
```

This creates `dist/bot-comment-cleaner.zip`.
The release zip includes only runtime extension files (`manifest.json`, scripts, styles, `icons/`, and `remote/`).

## Release checklist
1. If extension code/permissions/manifest changed, bump `manifest.json` version.
2. If only filter data changed, update `remote/filters-data.json` and bump its `version`.
3. Run `npm test`.
4. Build zip with `./release.sh`.
5. Upload `dist/bot-comment-cleaner.zip` to Chrome Web Store when a new extension version is needed.

## Run local tests
From the `bot-comment-cleaner/` folder:

```bash
node scripts/test-comments.js
```

Or via npm:

```bash
npm test
```

Add more test cases to `tests/comments.json` over time and re-run the command.

## Customize filters
Edit `remote/filters-data.json` for all data-driven filtering updates:
- Increment `version` whenever filter data changes.
- Keep `sexualKeywords`, `spamDomains`, `botPhrases`, `sexualEmojis`, and `validHosts` as plain arrays.
- Extension load order is: bundled local JSON -> cached remote data -> latest remote data fetch.
- If a newer remote version is fetched, patterns are rebuilt and comments are re-scanned automatically.

## License
MIT

## Contributing
See `CONTRIBUTING.md` for contribution guidelines.
