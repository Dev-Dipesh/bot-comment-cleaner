/**
 * Bot comment detection filters
 * Hybrid approach: Fast regex patterns + optional ML classification
 */

/**
 * Known spam/bot link patterns
 */
const SPAM_DOMAINS = [
  'lovex.su',
  'lovex',
  'onlyfans',
  'onlyfans.',
  'fans.ly',
  'telegram',
  't.me/',
  'tele.gg',
  'snapleaks',
  'scrollx.org',
  'hot1.top',
  'acort.me',
  'bit.ly',
  'tinyurl.com',
  'short.link',
  'linktr.ee'
];

/**
 * Sexual and inappropriate keywords
 */
const SEXUAL_KEYWORDS = [
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
  'horny', 'wet',
  'telegram', 'telgram',
  'snapchat', 'snapleaks',
  'only fans'
];

/**
 * Bot/spam phrases commonly used
 */
const BOT_PHRASES = [
  'my name is',
  'follow me on',
  'follow me on site',
  'follow me',
  'check my',
  'dm me',
  'contact here',
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
];

/**
 * Emoji spam patterns (excessive sexual emojis)
 */
const SEXUAL_EMOJIS = [
  '🔞', '🍆', '🍑', '💋', '👅',
  '🥵', '💦', '🔥', '❤️‍🔥', '💯'
];

/**
 * Compile regex patterns
 */
const patterns = {
  // Excessive emojis (3+ sexual emojis in comment)
  excessiveSexualEmojis: new RegExp(
    `([${SEXUAL_EMOJIS.join('')}]\\s*){3,}`,
    'g'
  ),

  // Known spam domains
  spamDomains: new RegExp(
    SPAM_DOMAINS.map(domain => domain.replace(/\./g, '\\.')).join('|'),
    'i'
  ),

  // Sexual keywords
  sexualKeywords: new RegExp(
    SEXUAL_KEYWORDS.join('|'),
    'i'
  ),

  // Bot phrases
  botPhrases: new RegExp(
    BOT_PHRASES.join('|'),
    'i'
  ),

  // Suspicious link patterns (shortened URLs, multiple links)
  multipleLinks: /https?:\/\/[^\s]+.*https?:\/\/[^\s]+/i,

  // Combination: name + sexual content
  personalWithAdult: /(my name is|i am|i'm).*(nudes|naked|sex|porn|onlyfans|telegram)/i,

  // Obfuscated text (with zero-width characters or excessive spacing)
  obfuscatedText: /(\w\s+){5,}\w/  // Words with excessive spaces between letters
};

/**
 * Normalize text to catch obfuscation (zero-width, separators, homoglyph spacing)
 */
function normalizeText(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    // Remove zero-width and soft hyphen characters
    .replace(/[\u200B-\u200F\uFEFF\u00AD]/g, '')
    // Collapse separators between letters (e.g. s.e.x -> sex)
    .replace(/([a-z])[^a-z0-9]+([a-z])/g, '$1$2')
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

  // Fast check: Empty or very short comments
  if (!text || text.length < 20) {
    return { isSpam: false, confidence: 0, reasons: [] };
  }

  // 1. Check for known spam domains (HIGH confidence)
  if (patterns.spamDomains.test(text) || patterns.spamDomains.test(normalized)) {
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
  if (patterns.sexualKeywords.test(text) || patterns.sexualKeywords.test(normalized)) {
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

// Expose to content script without modules
window.BotCommentFilters = {
  classifyComment,
  batchClassify,
  getStats,
  resetStats
};
