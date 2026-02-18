// ==UserScript==
// @name         Bot Comment Cleaner
// @version      0.1.2
// @description  Hide spam/sexual bot comments locally on supported HiAnime domains.
// @author       JJJ
// @match        https://hianime.nz/*
// @match        https://hianime.bz/*
// @match        https://hianime.do/*
// @match        https://hianime.pe/*
// @match        https://hianime.cx/*
// @match        https://hianime.me/*
// @match        https://hianime.vc/*
// @match        https://hianime.ps/*
// @match        https://hianimez.is/*
// @match        https://hianimez.to/*
// @match        https://hianime.to/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hianime.to
// ==/UserScript==

(function () {
  'use strict';

  // Prevent duplicate initialization on dynamic pages or repeated injections.
  if (window.__BCC_USER_SCRIPT_ACTIVE__) return;
  window.__BCC_USER_SCRIPT_ACTIVE__ = true;

  // Cross-manager compatibility layer (Tampermonkey, Violentmonkey, Greasemonkey, Safari userscript managers).
  const GMCompat = {
    async getValue(key, fallback) {
      try {
        if (typeof GM_getValue === 'function') {
          return GM_getValue(key, fallback);
        }
      } catch {
      }

      try {
        if (typeof GM === 'object' && typeof GM.getValue === 'function') {
          return await GM.getValue(key, fallback);
        }
      } catch {
      }

      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    async setValue(key, value) {
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(key, value);
          return;
        }
      } catch {
      }

      try {
        if (typeof GM === 'object' && typeof GM.setValue === 'function') {
          await GM.setValue(key, value);
          return;
        }
      } catch {
      }

      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
      }
    },

    addStyle(cssText) {
      try {
        if (typeof GM_addStyle === 'function') {
          return GM_addStyle(cssText);
        }
      } catch {
      }

      try {
        if (typeof GM === 'object' && typeof GM.addStyle === 'function') {
          return GM.addStyle(cssText);
        }
      } catch {
      }

      const style = document.createElement('style');
      style.textContent = cssText;
      (document.head || document.documentElement).appendChild(style);
      return style;
    },

    registerMenuCommand(label, handler) {
      try {
        if (typeof GM_registerMenuCommand === 'function') {
          return GM_registerMenuCommand(label, handler);
        }
      } catch {
      }

      try {
        if (typeof GM === 'object' && typeof GM.registerMenuCommand === 'function') {
          return GM.registerMenuCommand(label, handler);
        }
      } catch {
      }

      return null;
    }
  };

  // Injected one-file CSS (copied from styles.css for userscript portability).
  const STYLE_CSS = `.bcc-hidden {
  display: none !important;
}

.bcc-panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  width: 260px;
  max-width: 92vw;
  z-index: 999999;
  background: #101316;
  color: #e6eef7;
  border: 1px solid #2a3038;
  border-radius: 12px;
  padding: 12px;
  font: 12px/1.4 "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.bcc-panel.bcc-minimized {
  width: auto;
  padding: 8px 10px;
  cursor: pointer;
}

.bcc-panel.bcc-minimized .bcc-status,
.bcc-panel.bcc-minimized .bcc-counts,
.bcc-panel.bcc-minimized .bcc-info,
.bcc-panel.bcc-minimized .bcc-actions {
  display: none;
}

.bcc-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
}

.bcc-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.bcc-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1b2530;
  border: 1px solid #2f3a46;
  color: #cfe5ff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.bcc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.bcc-minimize {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #e6eef7;
  border: 1px solid #2f3a46;
  background: #171d24;
  padding: 4px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  cursor: pointer;
}

.bcc-minimize:hover {
  background: #1f2630;
}

.bcc-counts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.bcc-count-item {
  background: #151a20;
  border: 1px solid #222a33;
  border-radius: 8px;
  padding: 8px;
  display: grid;
  gap: 2px;
}

.bcc-count-label {
  color: #9fb7d0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bcc-count-value {
  font-size: 18px;
  font-weight: 700;
}

.bcc-info {
  border: 1px solid #222a33;
  background: #151a20;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  margin-top: 6px;
}

.bcc-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
}

.bcc-info-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.bcc-info-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #e6eef7;
}

.bcc-info-body {
  display: none;
  padding: 8px 10px 10px;
  border-top: 1px solid #1e242c;
  gap: 6px;
}

.bcc-info.is-open .bcc-info-body {
  display: grid;
}

.bcc-info-desc {
  color: #c0ccdb;
  font-size: 11px;
}

.bcc-info-list {
  margin: 0;
  padding-left: 16px;
  color: #9fb7d0;
  font-size: 11px;
}

.bcc-info-list li {
  margin: 2px 0;
}

.bcc-info-list li.bcc-info-current {
  color: #7ddc9f;
  font-weight: 600;
}

.bcc-collapse-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #9fb7d0;
}

.bcc-actions {
  display: grid;
  gap: 6px;
}

.bcc-toggle-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #222a33;
  background: #151a20;
  border-radius: 10px;
}

.bcc-toggle-meta {
  display: grid;
  gap: 2px;
}

.bcc-toggle-label {
  font-size: 12px;
  font-weight: 600;
}

.bcc-toggle-status {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7ddc9f;
}

.bcc-toggle-status.bcc-off {
  color: #f2b5b5;
}

/* Switch UI (adapted from Uiverse.io by Admin12121) */
.switch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
}

.switch-button .switch-outer {
  height: 100%;
  background: #252532;
  width: 60px;
  border-radius: 999px;
  box-shadow: inset 0 4px 8px 0 #16151c, 0 3px 6px -2px #403f4e;
  border: 1px solid #32303e;
  padding: 4px;
  box-sizing: border-box;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  position: relative;
}

.switch-button .switch-outer input[type="checkbox"] {
  opacity: 0;
  appearance: none;
  position: absolute;
}

.switch-button .switch-outer .button {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
  justify-content: space-between;
}

.switch-button .switch-outer .button-toggle {
  height: 20px;
  width: 20px;
  background: linear-gradient(#3b3a4e, #272733);
  border-radius: 100%;
  box-shadow: inset 0 3px 3px 0 #424151, 0 4px 12px 0 #0f0e17;
  position: relative;
  z-index: 2;
  transition: left 0.3s ease-in;
  left: 0;
}

.switch-button .switch-outer input[type="checkbox"]:checked + .button .button-toggle {
  left: 52%;
}

.switch-button .switch-outer .button-indicator {
  height: 12px;
  width: 12px;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 50%;
  border: 2px solid #ef565f;
  box-sizing: border-box;
  right: 6px;
  position: relative;
}

.switch-button .switch-outer input[type="checkbox"]:checked + .button .button-indicator {
  animation: bcc-indicator 0.6s forwards;
}

@keyframes bcc-indicator {
  30% {
    opacity: 0;
  }

  0% {
    opacity: 1;
  }

  100% {
    opacity: 1;
    border: 2px solid #60d480;
    left: -66%;
  }
}`;

  if (!window.__BCC_STYLE_INJECTED__) {
    window.__BCC_STYLE_INJECTED__ = true;
    GMCompat.addStyle(STYLE_CSS);
  }

  const REMOTE_FILTER_SOURCES = [
    'https://cdn.jsdelivr.net/gh/Dev-Dipesh/bot-comment-cleaner@main/remote/filters-data.json',
    'https://raw.githubusercontent.com/Dev-Dipesh/bot-comment-cleaner/main/remote/filters-data.json'
  ];
  const REMOTE_FETCH_MIN_INTERVAL_MS = 30 * 60 * 1000;
  const STORAGE_KEY_FILTER_CACHE = 'bcc_filter_cache_v1';
  const STORAGE_KEY_LAST_FETCH_AT = 'bcc_filter_last_fetch_at_v1';

  // Bundled baseline filter-data. Remote updates can override this when available.
  const FALLBACK_FILTER_DATA = {
    version: 3,
    updatedAt: '2026-02-18',
    spamDomains: [
      'lovex.su',
      'lovex',
      'onlyfans',
      'onlyfans.',
      'fans.ly',
      'telegram',
      't.me/',
      'tele.gg',
      'discord.gg',
      'dc.gg',
      'snapleaks',
      'scrollx.org',
      'hot1.top',
      'hot1top',
      'acort.me',
      'bit.ly',
      'goo.gl',
      't.co',
      'tinyurl.com',
      'short.link',
      'linktr.ee'
    ],
    sexualKeywords: [
      'nudes',
      'nude',
      'naked',
      'porn',
      'p0rn',
      'p3orn',
      'sex',
      's.ex',
      's­ex',
      'xxx',
      'xxnx',
      'hentai',
      'hent­ai',
      'incest',
      'mom son',
      'd3rkweb',
      'darkweb',
      'rule34',
      'r34',
      'onlyfans',
      'only fan',
      'only fans',
      'nsfw',
      'cum',
      'cock',
      'pussy',
      'dick',
      'blowjob',
      'horny',
      'wet',
      'telegram',
      'telgram',
      'available via the site in my username',
      'site in my username',
      'snapchat',
      'snapleaks',
      'anal',
      'anus',
      'ass',
      'asshole',
      'bbc',
      'bdsm',
      'boob',
      'boobs',
      'breast',
      'breasts',
      'busty',
      'butt',
      'cam',
      'cams',
      'camgirl',
      'clit',
      'cumshot',
      'cumming',
      'dildo',
      'doggy',
      'escort',
      'fap',
      'fetish',
      'fisting',
      'fuck',
      'fucked',
      'fucking',
      'handjob',
      'jav',
      'jerkoff',
      'jizz',
      'kink',
      'lingerie',
      'masturbate',
      'milf',
      'orgy',
      'panties',
      'pegging',
      'penis',
      'sexy',
      'suck',
      'threesome',
      'tit',
      'tits',
      'topless',
      'vagina',
      'whore'
    ],
    botPhrases: [
      'my name is',
      'follow me on',
      'follow me on site',
      'follow me',
      'check my',
      'dm me',
      'contact here',
      'contact me',
      'send nudes',
      'nudes here',
      'free nudes',
      'of link',
      'sub onlyfans',
      'hot girls',
      'hot girl',
      'hot singles',
      'meet girls',
      'join my discord',
      'join our discord',
      'discord me',
      'tiktok for',
      'no ads',
      'ad-free',
      'ad free',
      'my telegram',
      'uploaded all kind',
      'click here',
      'check now',
      'go and check',
      'visit my',
      'see my',
      'watch me',
      'hi guys my',
      'hello guys',
      'hey guys'
    ],
    sexualEmojis: ['🔞', '🍆', '🍑', '🌽', '💋', '👅', '👄', '🥵', '💦', '🔥', '❤️‍🔥'],
    validHosts: [
      'hianime.nz',
      'hianime.bz',
      'hianime.do',
      'hianime.pe',
      'hianime.cx',
      'hianime.me',
      'hianime.vc',
      'hianime.ps',
      'hianime.to',
      'hianimez.is',
      'hianimez.to'
    ]
  };

  let ACTIVE_FILTER_DATA = {
    version: FALLBACK_FILTER_DATA.version,
    updatedAt: FALLBACK_FILTER_DATA.updatedAt,
    spamDomains: FALLBACK_FILTER_DATA.spamDomains.slice(),
    sexualKeywords: FALLBACK_FILTER_DATA.sexualKeywords.slice(),
    botPhrases: FALLBACK_FILTER_DATA.botPhrases.slice(),
    sexualEmojis: FALLBACK_FILTER_DATA.sexualEmojis.slice(),
    validHosts: FALLBACK_FILTER_DATA.validHosts.slice()
  };
  let ACTIVE_DATA_VERSION = ACTIVE_FILTER_DATA.version;
  const filterUpdateListeners = new Set();

  // Removes separators to detect obfuscated domains/keywords (e.g., "n-u-d-e-s").
  function compactText(input) {
    if (!input) return '';
    return input.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Escapes user-provided terms before building regex alternations.
  function escapeRegex(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function uniqueNormalizedTerms(values, lowerCase = true) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    const output = [];
    values.forEach(value => {
      const str = String(value || '').trim();
      if (!str) return;
      const normalized = lowerCase ? str.toLowerCase() : str;
      if (!normalized || normalized.startsWith('#') || seen.has(normalized)) return;
      seen.add(normalized);
      output.push(normalized);
    });
    return output;
  }

  function normalizeFilterData(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const version = Number(raw.version);
    if (!Number.isFinite(version) || version <= 0) return null;

    return {
      version,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
      spamDomains: uniqueNormalizedTerms(raw.spamDomains || []),
      sexualKeywords: uniqueNormalizedTerms(raw.sexualKeywords || []),
      botPhrases: uniqueNormalizedTerms(raw.botPhrases || []),
      sexualEmojis: uniqueNormalizedTerms(raw.sexualEmojis || [], false),
      validHosts: uniqueNormalizedTerms(raw.validHosts || [])
    };
  }

  function regexFromTerms(terms, { escape: escapeTerms = false, flags = 'i' } = {}) {
    const cleaned = terms.filter(Boolean);
    if (cleaned.length === 0) return /$^/;
    const fragments = escapeTerms ? cleaned.map(escapeRegex) : cleaned;
    return new RegExp(fragments.join('|'), flags);
  }

  function rebuildPatterns(patterns) {
    patterns.spamDomains = regexFromTerms(ACTIVE_FILTER_DATA.spamDomains, { escape: true, flags: 'i' });

    const compactSpamDomains = ACTIVE_FILTER_DATA.spamDomains
      .map(domain => domain.replace(/[^a-z0-9]/gi, ''))
      .filter(domain => domain.length >= 4);
    patterns.spamDomainsCompact = regexFromTerms(compactSpamDomains, { flags: 'i' });

    patterns.sexualKeywords = regexFromTerms(ACTIVE_FILTER_DATA.sexualKeywords, { flags: 'i' });

    const compactSexualKeywords = ACTIVE_FILTER_DATA.sexualKeywords
      .map(fragment => fragment.replace(/[^a-z0-9]/gi, ''))
      .filter(fragment => fragment.length >= 3);
    patterns.compactSexualKeywords = regexFromTerms(compactSexualKeywords, { flags: 'i' });

    patterns.botPhrases = regexFromTerms(ACTIVE_FILTER_DATA.botPhrases, { escape: true, flags: 'i' });

    if (ACTIVE_FILTER_DATA.sexualEmojis.length === 0) {
      patterns.excessiveSexualEmojis = /$^/g;
    } else {
      const emojiAlt = ACTIVE_FILTER_DATA.sexualEmojis.map(escapeRegex).join('|');
      patterns.excessiveSexualEmojis = new RegExp(`((?:${emojiAlt})\\s*){3,}`, 'g');
    }
  }

  function notifyFilterDataUpdated(updateInfo) {
    filterUpdateListeners.forEach(listener => {
      try {
        listener(updateInfo);
      } catch {
      }
    });
  }

  function onDataUpdated(listener) {
    if (typeof listener !== 'function') return () => {};
    filterUpdateListeners.add(listener);
    return () => filterUpdateListeners.delete(listener);
  }

  function getFilterDataInfo() {
    return {
      version: ACTIVE_DATA_VERSION,
      updatedAt: ACTIVE_FILTER_DATA.updatedAt,
      sourceUrls: REMOTE_FILTER_SOURCES.slice()
    };
  }

  function getValidHosts() {
    return ACTIVE_FILTER_DATA.validHosts.slice();
  }

  function isValidHost(host) {
    const normalizedHost = String(host || '').toLowerCase();
    return ACTIVE_FILTER_DATA.validHosts.some(valid => {
      return normalizedHost === valid || normalizedHost.endsWith(`.${valid}`);
    });
  }

  async function storageGetValue(key, fallback) {
    return GMCompat.getValue(key, fallback);
  }

  async function storageSetValue(key, value) {
    await GMCompat.setValue(key, value);
  }

  function gmRequestText(url) {
    return new Promise(resolve => {
      const req = typeof GM_xmlhttpRequest === 'function'
        ? GM_xmlhttpRequest
        : (typeof GM === 'object' && typeof GM.xmlHttpRequest === 'function'
          ? GM.xmlHttpRequest
          : null);

      if (!req) {
        resolve(null);
        return;
      }

      try {
        req({
          method: 'GET',
          url,
          onload: response => resolve(response && typeof response.responseText === 'string' ? response.responseText : null),
          onerror: () => resolve(null),
          ontimeout: () => resolve(null)
        });
      } catch {
        resolve(null);
      }
    });
  }

  async function fetchJsonFromUrl(url) {
    const gmText = await gmRequestText(url);
    if (gmText) {
      try {
        return JSON.parse(gmText);
      } catch {
        return null;
      }
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const text = await response.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function applyFilterDataIfNewer(data, patterns) {
    if (!data || data.version <= ACTIVE_DATA_VERSION) return false;
    ACTIVE_FILTER_DATA = {
      version: data.version,
      updatedAt: data.updatedAt,
      spamDomains: data.spamDomains.slice(),
      sexualKeywords: data.sexualKeywords.slice(),
      botPhrases: data.botPhrases.slice(),
      sexualEmojis: data.sexualEmojis.slice(),
      validHosts: data.validHosts.slice()
    };
    ACTIVE_DATA_VERSION = data.version;
    rebuildPatterns(patterns);
    return true;
  }

  async function loadCachedRemoteFilterData(patterns) {
    const cachedRaw = await storageGetValue(STORAGE_KEY_FILTER_CACHE, null);
    const cached = normalizeFilterData(cachedRaw);
    if (!cached) return false;
    const applied = applyFilterDataIfNewer(cached, patterns);
    if (applied) {
      notifyFilterDataUpdated({ source: 'cache', version: cached.version });
    }
    return applied;
  }

  async function fetchRemoteFilterData() {
    for (const sourceUrl of REMOTE_FILTER_SOURCES) {
      const json = await fetchJsonFromUrl(sourceUrl);
      const parsed = normalizeFilterData(json);
      if (parsed) return parsed;
    }
    return null;
  }

  async function refreshRemoteFilterData(patterns) {
    const now = Date.now();
    const lastFetchAt = Number(await storageGetValue(STORAGE_KEY_LAST_FETCH_AT, 0) || 0);
    if (lastFetchAt > 0 && now - lastFetchAt < REMOTE_FETCH_MIN_INTERVAL_MS) return false;

    await storageSetValue(STORAGE_KEY_LAST_FETCH_AT, now);
    const remoteData = await fetchRemoteFilterData();
    if (!remoteData) return false;

    const applied = applyFilterDataIfNewer(remoteData, patterns);
    await storageSetValue(STORAGE_KEY_FILTER_CACHE, remoteData);
    if (applied) {
      notifyFilterDataUpdated({ source: 'remote', version: remoteData.version });
    }
    return applied;
  }

  // Core matcher set used by classifier scoring.
  const patterns = {
    excessiveSexualEmojis: /$^/g,
    spamDomains: /$^/,
    spamDomainsCompact: /$^/,
    sexualKeywords: /$^/,
    compactSexualKeywords: /$^/,
    botPhrases: /$^/,
    multipleLinks: /https?:\/\/[^\s]+.*https?:\/\/[^\s]+/i,
    personalWithAdult: /(my name is|i am|i'm).*(nudes|naked|sex|porn|onlyfans|telegram)/i,
    obfuscatedText: /(\w\s+){5,}\w/,
    suspiciousTld: /\.(top|fun|live|xyz|club|site|online|pro|cc|me|link)(\/|$)/i
  };

  rebuildPatterns(patterns);
  loadCachedRemoteFilterData(patterns).finally(() => {
    refreshRemoteFilterData(patterns);
  });

  // Feature-detect Unicode emoji properties for older JS engines.
  const supportsEmojiProperty = (() => {
    try {
      return /\p{Emoji}/u.test('😀');
    } catch {
      return false;
    }
  })();

  // Collapses punctuation/spacing noise while preserving readable text.
  function normalizeText(input) {
    if (!input) return '';
    return input
      .toLowerCase()
      .replace(/[\u200B-\u200F\uFEFF\u00AD]/g, '')
      .replace(/([a-z0-9])[^a-z0-9]+([a-z0-9])/g, '$1$2')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Main heuristic classifier: accumulates confidence and emits human-readable reasons.
  function classifyComment(text, username, links) {
    // Confidence-based scoring preserves extension behavior and threshold semantics.
    const reasons = [];
    let confidence = 0;
    const normalized = normalizeText(text);
    const compact = compactText(text);

    const hasKnownSpamDomain = (
      patterns.spamDomains.test(text) ||
      patterns.spamDomains.test(normalized) ||
      patterns.spamDomainsCompact.test(compact) ||
      links.some(link => (
        patterns.spamDomains.test(link.href) ||
        patterns.spamDomains.test(normalizeText(link.href))
      ))
    );

    if (!text) {
      return { isSpam: false, confidence: 0, reasons: [] };
    }

    if (text.length < 20 && !hasKnownSpamDomain) {
      return { isSpam: false, confidence: 0, reasons: [] };
    }

    if (hasKnownSpamDomain) {
      reasons.push('Contains known spam domain');
      confidence += 0.7;
    }

    for (const link of links) {
      if (patterns.spamDomains.test(link.href) || patterns.spamDomains.test(normalizeText(link.href))) {
        reasons.push('Link to known spam site');
        confidence += 0.8;
        break;
      }
    }

    if (
      patterns.sexualKeywords.test(text) ||
      patterns.sexualKeywords.test(normalized) ||
      patterns.compactSexualKeywords.test(compact)
    ) {
      reasons.push('Contains sexual/inappropriate keywords');
      confidence += 0.5;
    }

    const emojiMatches = text.match(patterns.excessiveSexualEmojis);
    if (emojiMatches) {
      reasons.push('Excessive sexual emojis');
      confidence += 0.4;
    }

    if (patterns.botPhrases.test(text) || patterns.botPhrases.test(normalized)) {
      if (confidence > 0) {
        reasons.push('Uses common bot phrases');
        confidence += 0.2;
      }
    }

    if (patterns.personalWithAdult.test(text) || patterns.personalWithAdult.test(normalized)) {
      reasons.push('Personal introduction with adult content');
      confidence += 0.6;
    }

    if (username) {
      if (/\d{4,}$/.test(username) || /[a-z]{15,}/i.test(username)) {
        if (confidence > 0.3) {
          reasons.push('Suspicious username pattern');
          confidence += 0.1;
        }
      }
    }

    if (links.length > 2) {
      reasons.push('Contains multiple links');
      confidence += 0.2;
    }

    if (patterns.suspiciousTld.test(text) || patterns.suspiciousTld.test(normalized)) {
      reasons.push('Suspicious link TLD');
      confidence += 0.3;
    }

    if (patterns.obfuscatedText.test(text) || patterns.obfuscatedText.test(normalized)) {
      reasons.push('Obfuscated text pattern');
      confidence += 0.3;
    }

    const emojiCount = supportsEmojiProperty
      ? (text.match(/\p{Emoji}/gu) || []).length
      : (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;

    const emojiDensity = emojiCount / text.length;
    if (emojiDensity > 0.3 && text.length > 10) {
      reasons.push('High emoji density');
      confidence += 0.2;
    }

    if (/^(hi|hello|hey).*\p{Emoji}{3,}/iu.test(text)) {
      reasons.push('Greeting with excessive emojis');
      confidence += 0.3;
    }

    const basicEmojiCount = (text.match(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{27BF}]/gu) || []).length;
    if (basicEmojiCount >= 4) {
      reasons.push('High emoji count');
      confidence += 0.2;
    }

    confidence = Math.min(confidence, 1.0);
    const isSpam = confidence >= 0.5;

    return {
      isSpam,
      confidence: Math.round(confidence * 100) / 100,
      reasons: reasons.length > 0 ? reasons : ['No spam indicators detected']
    };
  }

  function batchClassify(comments) {
    return comments.map(comment => {
      const text = comment && comment.text ? comment.text : '';
      const username = comment && comment.username ? comment.username : '';
      const links = comment && Array.isArray(comment.links) ? comment.links : [];
      return Object.assign({}, comment, {
        classification: classifyComment(text, username, links)
      });
    });
  }

  // Lightweight adapter used by content logic.
  const Filters = {
    classifyComment,
    batchClassify,
    onDataUpdated,
    getFilterDataInfo,
    getValidHosts,
    isValidHost
  };

  // Runtime settings and counters used by panel + scan flow.
  const STORAGE_KEY_ENABLED = 'bcc_enabled';
  const SETTINGS = {
    scanIntervalMs: 3000,
    enabled: true
  };

  const runtimeStats = {
    lastScanAt: null,
    scannedComments: 0,
    hiddenComments: 0,
    reasonCounts: {}
  };

  // Trusted domains shown in warning/panel (kept in sync with filter-data updates).
  let validHosts = getValidHosts();

  // Site selectors (host validation is driven by validHosts).
  const SITE_CONFIG = {
    containerSelector: '#content-comments',
    commentSelectors: [
      '#content-comments div[id^="cm-"]',
      '#content-comments .list-comment',
      '#content-comments .comment-item',
      '#content-comments .comment',
      '#content-comments .comment-main',
      '#content-comments .comment-wrap',
      '#content-comments .comment-body',
      '#content-comments .comment-content',
      '#content-comments .item',
      '#content-comments li',
      '#content-comments > div'
    ]
  };

  function refreshValidHosts() {
    const nextHosts = getValidHosts();
    if (Array.isArray(nextHosts) && nextHosts.length > 0) {
      validHosts = nextHosts;
    }
  }

  const IS_TOP_FRAME = (() => {
    try {
      // Render control panel only once in the top frame.
      return window.top === window.self;
    } catch {
      return true;
    }
  })();

  // Normalizes values from GM storage/localStorage into strict booleans.
  function normalizeEnabledValue(value) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return true;
  }

  // Loads persisted enabled flag once at startup.
  async function loadEnabledSetting() {
    const value = await GMCompat.getValue(STORAGE_KEY_ENABLED, true);
    SETTINGS.enabled = normalizeEnabledValue(value);
  }

  // Persists enabled flag after UI/menu toggles.
  async function saveEnabledSetting() {
    await GMCompat.setValue(STORAGE_KEY_ENABLED, Boolean(SETTINGS.enabled));
  }

  // Resolves host to matching site config.
  function getSiteConfig() {
    const host = window.location.hostname;
    return isValidHost(host) ? SITE_CONFIG : null;
  }

  // Broad detector used only for phishing warning path.
  function isHianimeDomain(host) {
    return /(^|\.)hianime(\.|z\.)/i.test(host);
  }

  // Gets primary comments container from site config.
  function getContainer(cfg) {
    return document.querySelector(cfg.containerSelector);
  }

  // Used to discard tiny/irrelevant nodes during fallback discovery.
  function textLengthScore(el) {
    const text = (el.innerText || '').trim();
    return text.length;
  }

  // Finds likely comment nodes with layered selector fallbacks.
  function findCommentElements(container, cfg) {
    const cmNodes = Array.from(container.querySelectorAll('#content-comments div[id^="cm-"]'))
      .filter(el => !el.classList.contains('bcc-placeholder'));
    if (cmNodes.length > 0) return cmNodes;

    for (const selector of cfg.commentSelectors) {
      const nodes = Array.from(container.querySelectorAll(selector))
        .filter(el => !el.classList.contains('bcc-placeholder'));
      if (nodes.length >= 1) {
        const avgLen = nodes.reduce((sum, el) => sum + textLengthScore(el), 0) / nodes.length;
        if (avgLen >= 20) return nodes;
      }
    }

    return Array.from(container.querySelectorAll('*'))
      .filter(el => el.children.length <= 5)
      .filter(el => (el.innerText || '').trim().length >= 20);
  }

  // Extracts text, username, and links from a comment block.
  function extractCommentData(el) {
    const textEl = el.querySelector(
      '.comment-text, .text, .content, .comment-content, .message, .body, p'
    ) || el;

    const text = (textEl.innerText || '').trim();

    const usernameEl = el.querySelector(
      '.comment-username, .username, .user, .name, .author, a[href*="/user"], a[href*="/profile"], a[href*="/member"]'
    );
    const username = usernameEl ? (usernameEl.innerText || '').trim() : '';

    const links = Array.from(el.querySelectorAll('a[href]'));

    return { text, username, links };
  }

  // Applies the visibility class used by CSS filter mode.
  function hideComment(el) {
    if (el.classList.contains('bcc-hidden')) return;
    el.classList.add('bcc-hidden');
  }

  // Restores all hidden comments when filter is disabled.
  function showAllHidden(container) {
    const hidden = container.querySelectorAll('.bcc-hidden');
    hidden.forEach(el => {
      el.classList.remove('bcc-hidden');
    });
  }

  // Clears processing marker so a fresh scan can reclassify all comments.
  function resetProcessed(container) {
    const processed = container.querySelectorAll('[data-bcc-processed="1"]');
    processed.forEach(el => {
      delete el.dataset.bccProcessed;
    });
  }

  // Removes temporary placeholders if they exist.
  function removePlaceholders(container) {
    const placeholders = container.querySelectorAll('.bcc-placeholder');
    placeholders.forEach(el => {
      el.remove();
    });
  }

  function renderTrustedHostList(infoList) {
    if (!infoList) return;
    infoList.innerHTML = '';
    const currentHost = window.location.hostname;
    validHosts.forEach(host => {
      const item = document.createElement('li');
      item.textContent = host;
      if (currentHost === host || currentHost.endsWith(`.${host}`)) {
        item.classList.add('bcc-info-current');
      }
      infoList.appendChild(item);
    });
  }

  // Builds plus/minus SVG icons for panel controls.
  function createIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '5');
    line1.setAttribute('y1', '12');
    line1.setAttribute('x2', '19');
    line1.setAttribute('y2', '12');
    svg.appendChild(line1);

    if (type === 'plus') {
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '12');
      line2.setAttribute('y1', '5');
      line2.setAttribute('x2', '12');
      line2.setAttribute('y2', '19');
      svg.appendChild(line2);
    }

    return svg;
  }

  // Syncs minimize button icon and accessibility label with panel state.
  function updateMinimizeIcon(panel) {
    const btn = panel.querySelector('.bcc-minimize');
    if (!btn) return;
    btn.innerHTML = '';
    const icon = panel.classList.contains('bcc-minimized') ? createIcon('plus') : createIcon('minus');
    btn.appendChild(icon);
    btn.setAttribute(
      'aria-label',
      panel.classList.contains('bcc-minimized') ? 'Expand panel' : 'Minimize panel'
    );
  }

  // Toggles compact panel mode.
  function toggleMinimized(panel) {
    panel.classList.toggle('bcc-minimized');
    updateMinimizeIcon(panel);
  }

  // Expands/collapses trusted-site info accordion.
  function setInfoOpen(panel, isOpen) {
    const info = panel.querySelector('.bcc-info');
    if (!info) return;
    info.classList.toggle('is-open', isOpen);
    const icon = info.querySelector('.bcc-collapse-icon');
    if (icon) {
      icon.innerHTML = '';
      icon.appendChild(createIcon(isOpen ? 'minus' : 'plus'));
    }
  }

  // Builds a stylized switch and wires change callback.
  function createSwitch({ checked, onChange }) {
    const label = document.createElement('label');
    label.className = 'switch-button bcc-switch';

    const outer = document.createElement('div');
    outer.className = 'switch-outer';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.addEventListener('change', () => onChange(input.checked));

    const button = document.createElement('div');
    button.className = 'button';

    const toggle = document.createElement('span');
    toggle.className = 'button-toggle';

    const indicator = document.createElement('span');
    indicator.className = 'button-indicator';

    button.appendChild(toggle);
    button.appendChild(indicator);
    outer.appendChild(input);
    outer.appendChild(button);
    label.appendChild(outer);

    return { label, input };
  }

  // Creates the panel UI once and wires interactions.
  function createPanel() {
    const existing = document.querySelector('.bcc-panel');
    if (existing) return existing;

    const panel = document.createElement('div');
    panel.className = 'bcc-panel';

    const header = document.createElement('div');
    header.className = 'bcc-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'bcc-title-wrap';

    const icon = document.createElement('span');
    icon.className = 'bcc-icon';
    icon.textContent = 'BCC';

    const title = document.createElement('div');
    title.className = 'bcc-title';
    title.textContent = 'Comment Cleaner';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'bcc-minimize';
    minimizeBtn.type = 'button';
    minimizeBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleMinimized(panel);
    });

    titleWrap.appendChild(icon);
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);
    header.appendChild(minimizeBtn);

    const counts = document.createElement('div');
    counts.className = 'bcc-counts';

    const scanned = document.createElement('div');
    scanned.className = 'bcc-count-item';
    scanned.innerHTML = '<span class="bcc-count-label">Scanned</span><span class="bcc-count-value bcc-count-scanned">0</span>';

    const hidden = document.createElement('div');
    hidden.className = 'bcc-count-item';
    hidden.innerHTML = '<span class="bcc-count-label">Hidden</span><span class="bcc-count-value bcc-count-hidden">0</span>';

    counts.appendChild(scanned);
    counts.appendChild(hidden);

    const info = document.createElement('div');
    info.className = 'bcc-info';

    const infoHeader = document.createElement('div');
    infoHeader.className = 'bcc-info-header';

    const infoTitle = document.createElement('div');
    infoTitle.className = 'bcc-info-title';

    const infoCheck = document.createElement('span');
    infoCheck.className = 'bcc-info-check';
    infoCheck.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    const infoText = document.createElement('span');
    infoText.textContent = 'On Trusted Site';

    infoTitle.appendChild(infoCheck);
    infoTitle.appendChild(infoText);

    const infoIcon = document.createElement('span');
    infoIcon.className = 'bcc-collapse-icon';
    infoIcon.appendChild(createIcon('minus'));

    infoHeader.appendChild(infoTitle);
    infoHeader.appendChild(infoIcon);

    const infoBody = document.createElement('div');
    infoBody.className = 'bcc-info-body';

    const infoDesc = document.createElement('div');
    infoDesc.className = 'bcc-info-desc';
    infoDesc.textContent = 'Official domains:';

    const infoList = document.createElement('ul');
    infoList.className = 'bcc-info-list';
    renderTrustedHostList(infoList);

    infoBody.appendChild(infoDesc);
    infoBody.appendChild(infoList);

    info.appendChild(infoHeader);
    info.appendChild(infoBody);

    infoHeader.addEventListener('click', () => {
      const isOpen = info.classList.contains('is-open');
      setInfoOpen(panel, !isOpen);
    });

    const actions = document.createElement('div');
    actions.className = 'bcc-actions';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'bcc-toggle-row';

    const toggleMeta = document.createElement('div');
    toggleMeta.className = 'bcc-toggle-meta';

    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'bcc-toggle-label';
    toggleLabel.textContent = 'Spam Filter';

    const toggleStatus = document.createElement('span');
    toggleStatus.className = 'bcc-toggle-status';
    toggleStatus.textContent = SETTINGS.enabled ? 'Active' : 'Disabled';
    toggleStatus.classList.toggle('bcc-off', !SETTINGS.enabled);

    toggleMeta.appendChild(toggleLabel);
    toggleMeta.appendChild(toggleStatus);

    const { label: toggleSwitch } = createSwitch({
      checked: SETTINGS.enabled,
      onChange: async checked => {
        SETTINGS.enabled = checked;
        await saveEnabledSetting();

        const cfg = getSiteConfig();
        if (!cfg) return;
        const container = getContainer(cfg);
        if (!container) return;

        if (!SETTINGS.enabled) {
          showAllHidden(container);
          removePlaceholders(container);
          runtimeStats.hiddenComments = 0;
          updatePanel(container);
        } else {
          resetProcessed(container);
          scanContainer(container, cfg);
        }
      }
    });

    toggleRow.appendChild(toggleMeta);
    toggleRow.appendChild(toggleSwitch);

    panel.addEventListener('click', event => {
      if (!panel.classList.contains('bcc-minimized')) return;
      if (event.target && event.target.closest('.bcc-minimize')) return;
      panel.classList.remove('bcc-minimized');
      updateMinimizeIcon(panel);
    });

    actions.appendChild(toggleRow);

    panel.appendChild(header);
    panel.appendChild(counts);
    panel.appendChild(actions);
    panel.appendChild(info);
    document.body.appendChild(panel);
    updateMinimizeIcon(panel);
    return panel;
  }

  // Refreshes panel counters/state after each scan or toggle action.
  function updatePanel() {
    if (!IS_TOP_FRAME) return;
    const panel = document.querySelector('.bcc-panel') || createPanel();
    const scannedEl = panel.querySelector('.bcc-count-scanned');
    const hiddenEl = panel.querySelector('.bcc-count-hidden');
    const toggleInput = panel.querySelector('.bcc-switch input');
    const toggleStatus = panel.querySelector('.bcc-toggle-status');

    scannedEl.textContent = runtimeStats.scannedComments.toString();
    hiddenEl.textContent = runtimeStats.hiddenComments.toString();
    if (toggleInput) toggleInput.checked = SETTINGS.enabled;
    if (toggleStatus) {
      toggleStatus.textContent = SETTINGS.enabled ? 'Active' : 'Disabled';
      toggleStatus.classList.toggle('bcc-off', !SETTINGS.enabled);
    }
    renderTrustedHostList(panel.querySelector('.bcc-info-list'));
    updateMinimizeIcon(panel);
  }

  // Processes one comment element exactly once per scan cycle.
  function processElement(el) {
    if (!el || el.dataset.bccProcessed === '1') return;
    el.dataset.bccProcessed = '1';

    const { text, username, links } = extractCommentData(el);
    if (!text) return;

    runtimeStats.scannedComments += 1;

    const result = Filters.classifyComment(text, username, links);
    if (result.isSpam) {
      runtimeStats.hiddenComments += 1;
      result.reasons.forEach(reason => {
        runtimeStats.reasonCounts[reason] = (runtimeStats.reasonCounts[reason] || 0) + 1;
      });
      if (SETTINGS.enabled) hideComment(el);
    }
  }

  // Full scan pass over current container.
  function scanContainer(container, cfg) {
    if (!container) return;

    runtimeStats.isScanning = true;
    if (!SETTINGS.enabled) {
      updatePanel();
      runtimeStats.isScanning = false;
      return;
    }

    resetProcessed(container);
    runtimeStats.scannedComments = 0;
    runtimeStats.hiddenComments = 0;
    runtimeStats.reasonCounts = {};
    runtimeStats.lastScanAt = new Date().toLocaleTimeString();
    const commentEls = findCommentElements(container, cfg);
    // Re-scan all candidate nodes each cycle to handle lazy-loaded and updated comments.
    commentEls.forEach(processElement);
    updatePanel();
    runtimeStats.isScanning = false;
  }

  // Watches for new comments and triggers rescans on dynamic updates.
  function observeContainer(container, cfg) {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches && node.matches(cfg.containerSelector)) {
            scanContainer(node, cfg);
            return;
          }
          if (container.contains(node)) {
            scanContainer(container, cfg);
          }
        });
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // Registers manager menu command as secondary control surface.
  function registerMenuAction() {
    GMCompat.registerMenuCommand('Toggle Bot Comment Cleaner', async () => {
      SETTINGS.enabled = !SETTINGS.enabled;
      await saveEnabledSetting();

      const cfg = getSiteConfig();
      if (!cfg) return;
      const container = getContainer(cfg);
      if (!container) return;

      if (!SETTINGS.enabled) {
        showAllHidden(container);
        removePlaceholders(container);
        runtimeStats.hiddenComments = 0;
        updatePanel();
      } else {
        resetProcessed(container);
        scanContainer(container, cfg);
      }
    });
  }

  // Startup bootstrap: load settings, validate host, attach scanners.
  async function start() {
    await loadEnabledSetting();
    registerMenuAction();

    refreshValidHosts();

    const host = window.location.hostname;
    if (IS_TOP_FRAME && isHianimeDomain(host) && !isValidHost(host)) {
      alert(
        `Warning: This domain isn't in the official list and may be a phishing site. ` +
          `Valid domains: ${validHosts.join(', ')}`
      );
      return;
    }

    const cfg = getSiteConfig();
    if (!cfg) return;

    onDataUpdated(() => {
      refreshValidHosts();
      updatePanel();
      const nextCfg = getSiteConfig();
      if (!nextCfg) return;
      const container = getContainer(nextCfg);
      if (!container) return;
      scanContainer(container, nextCfg);
    });

    if (IS_TOP_FRAME) {
      updatePanel();
    }

    const initialContainer = getContainer(cfg);
    if (initialContainer) {
      scanContainer(initialContainer, cfg);
      observeContainer(initialContainer, cfg);
      // Keep periodic scans to match extension behavior on infinite/lazy threads.
      setInterval(() => scanContainer(initialContainer, cfg), SETTINGS.scanIntervalMs);
      return;
    }

    const docObserver = new MutationObserver(() => {
      const container = getContainer(cfg);
      if (container) {
        docObserver.disconnect();
        scanContainer(container, cfg);
        observeContainer(container, cfg);
        setInterval(() => scanContainer(container, cfg), SETTINGS.scanIntervalMs);
      }
    });

    docObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Surface startup errors for debugging without breaking page scripts.
  start().catch(error => {
    console.error('[BCC userscript] startup failed:', error);
  });
})();
