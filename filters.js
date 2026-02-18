/**
 * Bot comment detection filters
 * Hybrid approach: Fast regex patterns + optional ML classification
 */

const LOCAL_FILTER_DATA_PATH = 'remote/filters-data.json';
const REMOTE_FILTER_SOURCES = [
  'https://cdn.jsdelivr.net/gh/Dev-Dipesh/bot-comment-cleaner@main/remote/filters-data.json',
  'https://raw.githubusercontent.com/Dev-Dipesh/bot-comment-cleaner/main/remote/filters-data.json'
];
const REMOTE_FETCH_MIN_INTERVAL_MS = 30 * 60 * 1000;
const STORAGE_KEY_FILTER_CACHE = 'bcc_filter_cache_v1';
const STORAGE_KEY_LAST_FETCH_AT = 'bcc_filter_last_fetch_at_v1';

const FALLBACK_FILTER_DATA = {
  version: 1,
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
    'nudes', 'nude', 'naked',
    'porn', 'p0rn', 'p3orn',
    'sex', 's.ex', 's­ex',
    'xxx', 'xxnx',
    'hentai', 'hent­ai',
    'incest', 'mom son',
    'd3rkweb', 'darkweb',
    'rule34', 'r34',
    'onlyfans', 'only fan',
    'nsfw',
    'cum', 'cock', 'pussy', 'dick', 'blowjob',
    'horny', 'wet',
    'telegram', 'telgram',
    'available via the site in my username',
    'site in my username',
    'snapchat', 'snapleaks',
    'only fans'
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

function compactText(input) {
  if (!input) return '';
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

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

function regexFromTerms(terms, { escape = false, flags = 'i' } = {}) {
  const cleaned = terms.filter(Boolean);
  if (cleaned.length === 0) return /$^/;
  const fragments = escape ? cleaned.map(escapeRegex) : cleaned;
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

function getStorageArea() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
  return chrome.storage.local;
}

function storageGet(keys) {
  const area = getStorageArea();
  if (!area) return Promise.resolve({});
  return area.get(keys);
}

function storageSet(values) {
  const area = getStorageArea();
  if (!area) return Promise.resolve();
  return area.set(values);
}

function notifyFilterDataUpdated(updateInfo) {
  filterUpdateListeners.forEach(listener => {
    try {
      listener(updateInfo);
    } catch {
      // Ignore callback failures from consumers.
    }
  });
}

async function fetchJsonFromUrl(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const text = await response.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadLocalBundledFilterData() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) return null;
  const localUrl = chrome.runtime.getURL(LOCAL_FILTER_DATA_PATH);
  const json = await fetchJsonFromUrl(localUrl);
  return normalizeFilterData(json);
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
  const stored = await storageGet([STORAGE_KEY_FILTER_CACHE]);
  const cached = normalizeFilterData(stored[STORAGE_KEY_FILTER_CACHE]);
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
  const stored = await storageGet([STORAGE_KEY_LAST_FETCH_AT]);
  const lastFetchAt = Number(stored[STORAGE_KEY_LAST_FETCH_AT] || 0);
  if (lastFetchAt > 0 && now - lastFetchAt < REMOTE_FETCH_MIN_INTERVAL_MS) return false;

  await storageSet({ [STORAGE_KEY_LAST_FETCH_AT]: now });
  const remoteData = await fetchRemoteFilterData();
  if (!remoteData) return false;

  const applied = applyFilterDataIfNewer(remoteData, patterns);
  await storageSet({ [STORAGE_KEY_FILTER_CACHE]: remoteData });
  if (applied) {
    notifyFilterDataUpdated({ source: 'remote', version: remoteData.version });
  }
  return applied;
}

/**
 * Compile regex patterns
 */
const patterns = {
  // Excessive emojis (3+ sexual emojis in comment)
  excessiveSexualEmojis: /$^/g,

  // Known spam domains
  spamDomains: /$^/,
  spamDomainsCompact: /$^/,

  // Sexual keywords
  sexualKeywords: /$^/,
  compactSexualKeywords: /$^/,

  // Bot phrases
  botPhrases: /$^/,

  // Suspicious link patterns (shortened URLs, multiple links)
  multipleLinks: /https?:\/\/[^\s]+.*https?:\/\/[^\s]+/i,

  // Combination: name + sexual content
  personalWithAdult: /(my name is|i am|i'm).*(nudes|naked|sex|porn|onlyfans|telegram)/i,

  // Obfuscated text (with zero-width characters or excessive spacing)
  obfuscatedText: /(\w\s+){5,}\w/,  // Words with excessive spaces between letters

  // Suspicious TLDs when link-like token exists
  suspiciousTld: /\.(top|fun|live|xyz|club|site|online|pro|cc|me|link)(\/|$)/i
};

rebuildPatterns(patterns);
loadLocalBundledFilterData().then(localData => {
  if (applyFilterDataIfNewer(localData, patterns)) {
    notifyFilterDataUpdated({ source: 'local', version: ACTIVE_DATA_VERSION });
  }
  loadCachedRemoteFilterData(patterns).finally(() => {
    refreshRemoteFilterData(patterns);
  });
});

/**
 * Normalize text to catch obfuscation (zero-width, separators, homoglyph spacing)
 */
function normalizeText(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    // Remove zero-width and soft hyphen characters
    .replace(/[\u200B-\u200F\uFEFF\u00AD]/g, '')
    // Collapse separators between alphanumerics (e.g. s.e.x or n-u-d-e-s)
    .replace(/([a-z0-9])[^a-z0-9]+([a-z0-9])/g, '$1$2')
    // Normalize spaced dots in domains (e.g. hot1 . top)
    .replace(/\s*\.\s*/g, '.')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Main classification function
 * Returns { isSpam: boolean, confidence: number, reasons: string[] }
 */
function classifyComment(text, username, links) {
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

  // Fast check: Empty comments. Keep short domain-only spam comments eligible.
  if (!text) {
    return { isSpam: false, confidence: 0, reasons: [] };
  }
  if (text.length < 20 && !hasKnownSpamDomain) {
    return { isSpam: false, confidence: 0, reasons: [] };
  }

  // 1. Check for known spam domains (HIGH confidence)
  if (hasKnownSpamDomain) {
    reasons.push('Contains known spam domain');
    confidence += 0.7;
  }

  // Check links too
  for (const link of links) {
    if (patterns.spamDomains.test(link.href) || patterns.spamDomains.test(normalizeText(link.href))) {
      reasons.push('Link to known spam site');
      confidence += 0.8;
      break;
    }
  }

  // 2. Check for sexual keywords (MEDIUM confidence)
  if (
    patterns.sexualKeywords.test(text) ||
    patterns.sexualKeywords.test(normalized) ||
    patterns.compactSexualKeywords.test(compact)
  ) {
    reasons.push('Contains sexual/inappropriate keywords');
    confidence += 0.5;
  }

  // 3. Check for excessive sexual emojis (MEDIUM confidence)
  const emojiMatches = text.match(patterns.excessiveSexualEmojis);
  if (emojiMatches) {
    reasons.push('Excessive sexual emojis');
    confidence += 0.4;
  }

  // 4. Check for bot phrases (LOW-MEDIUM confidence)
  if (patterns.botPhrases.test(text) || patterns.botPhrases.test(normalized)) {
    // Only add if combined with other indicators
    if (confidence > 0) {
      reasons.push('Uses common bot phrases');
      confidence += 0.2;
    }
  }

  // 5. Check for personal + adult content combo (HIGH confidence)
  if (patterns.personalWithAdult.test(text) || patterns.personalWithAdult.test(normalized)) {
    reasons.push('Personal introduction with adult content');
    confidence += 0.6;
  }

  // 6. Check username patterns
  if (username) {
    // Usernames with lots of numbers or random characters
    if (/\d{4,}$/.test(username) || /[a-z]{15,}/i.test(username)) {
      if (confidence > 0.3) {
        reasons.push('Suspicious username pattern');
        confidence += 0.1;
      }
    }
  }

  // 7. Check for multiple links (suspicious)
  if (links.length > 2) {
    reasons.push('Contains multiple links');
    confidence += 0.2;
  }

  // 7b. Check for suspicious TLDs in link-like tokens
  if (patterns.suspiciousTld.test(text) || patterns.suspiciousTld.test(normalized)) {
    reasons.push('Suspicious link TLD');
    confidence += 0.3;
  }

  // 8. Check for obfuscated text (spammers trying to bypass filters)
  if (patterns.obfuscatedText.test(text) || patterns.obfuscatedText.test(normalized)) {
    reasons.push('Obfuscated text pattern');
    confidence += 0.3;
  }

  // 9. Emoji density check (>30% emojis is suspicious)
  const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
  const emojiDensity = emojiCount / text.length;
  if (emojiDensity > 0.3 && text.length > 10) {
    reasons.push('High emoji density');
    confidence += 0.2;
  }

  // 10. Specific pattern: Hi + lots of emojis + personal info
  if (/^(hi|hello|hey).*\p{Emoji}{3,}/iu.test(text)) {
    reasons.push('Greeting with excessive emojis');
    confidence += 0.3;
  }

  // 11. Emoji count threshold (4+ emojis)
  const basicEmojiCount = (text.match(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (basicEmojiCount >= 4) {
    reasons.push('High emoji count');
    confidence += 0.2;
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  // Threshold: 0.5 confidence = spam
  const isSpam = confidence >= 0.5;

  return {
    isSpam,
    confidence: Math.round(confidence * 100) / 100,
    reasons: reasons.length > 0 ? reasons : ['No spam indicators detected']
  };
}

/**
 * Batch process comments for efficiency
 */
function batchClassify(comments) {
  return comments.map(comment => {
    const { text, username, links } = comment;
    return {
      ...comment,
      classification: classifyComment(text, username, links)
    };
  });
}

/**
 * Statistics tracking
 */
const stats = {
  totalScanned: 0,
  totalSpam: 0,
  totalLegitimate: 0
};

function updateStats(isSpam) {
  stats.totalScanned++;
  if (isSpam) {
    stats.totalSpam++;
  } else {
    stats.totalLegitimate++;
  }
  return stats;
}

function getStats() {
  return { ...stats };
}

function resetStats() {
  stats.totalScanned = 0;
  stats.totalSpam = 0;
  stats.totalLegitimate = 0;
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

// Expose to content script without modules
window.BotCommentFilters = {
  classifyComment,
  batchClassify,
  getStats,
  resetStats,
  onDataUpdated,
  getFilterDataInfo,
  getValidHosts,
  isValidHost
};
