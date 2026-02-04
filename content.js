(() => {
  const Filters = window.BotCommentFilters;
  if (!Filters || typeof Filters.classifyComment !== 'function') {
    console.warn('[BCC] Filters not available');
    return;
  }

  const SETTINGS = {
    scanIntervalMs: 3000,
    enabled: localStorage.getItem('bcc_enabled') !== '0'
  };

  const runtimeStats = {
    lastScanAt: null,
    scannedComments: 0,
    hiddenComments: 0,
    reasonCounts: {}
  };

  const SITE_CONFIGS = [
    {
      hostRe: /(^|\.)hianime\.to$/,
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
    }
  ];

  function getSiteConfig() {
    const host = window.location.hostname;
    return SITE_CONFIGS.find(cfg => cfg.hostRe.test(host)) || null;
  }

  function getContainer(cfg) {
    return document.querySelector(cfg.containerSelector);
  }

  function textLengthScore(el) {
    const text = (el.innerText || '').trim();
    return text.length;
  }

  function cssPath(el, root) {
    const parts = [];
    let current = el;
    while (current && current !== root && parts.length < 4) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }
      const className = (current.className || '')
        .toString()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      if (className) part += `.${className}`;
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function findCommentElements(container, cfg) {
    // Prefer most specific match if available
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

    // Fallback: find leaf-ish elements with enough text
    return Array.from(container.querySelectorAll('*'))
      .filter(el => el.children.length <= 5)
      .filter(el => (el.innerText || '').trim().length >= 20);
  }

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

  function createPlaceholder(result) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bcc-placeholder';

    const label = document.createElement('span');
    label.className = 'bcc-label';
    label.textContent = `Hidden spam comment (${Math.round(result.confidence * 100)}%)`;

    const reasons = document.createElement('span');
    reasons.className = 'bcc-reasons';
    reasons.textContent = result.reasons.join(', ');

    const button = document.createElement('button');
    button.className = 'bcc-toggle';
    button.type = 'button';
    button.textContent = 'Show';

    wrapper.appendChild(label);
    wrapper.appendChild(button);
    wrapper.appendChild(reasons);

    return { wrapper, button };
  }

  function hideComment(el) {
    if (el.classList.contains('bcc-hidden')) return;
    el.classList.add('bcc-hidden');
  }

  function showAllHidden(container) {
    const hidden = container.querySelectorAll('.bcc-hidden');
    hidden.forEach(el => el.classList.remove('bcc-hidden'));
  }

  function resetProcessed(container) {
    const processed = container.querySelectorAll('[data-bcc-processed="1"]');
    processed.forEach(el => {
      delete el.dataset.bccProcessed;
    });
  }

  function removePlaceholders(container) {
    const placeholders = container.querySelectorAll('.bcc-placeholder');
    placeholders.forEach(el => el.remove());
  }

  function updatePanel(container, cfg) {
    const panel = document.querySelector('.bcc-panel') || createPanel();
    const scannedEl = panel.querySelector('.bcc-count-scanned');
    const hiddenEl = panel.querySelector('.bcc-count-hidden');
    const statusEl = panel.querySelector('.bcc-status');
    const toggleBtn = panel.querySelector('.bcc-toggle');
    const minimizeBtn = panel.querySelector('.bcc-minimize');

    scannedEl.textContent = runtimeStats.scannedComments.toString();
    hiddenEl.textContent = runtimeStats.hiddenComments.toString();
    statusEl.textContent = runtimeStats.isScanning ? 'Scanning…' : 'Idle';
    toggleBtn.textContent = SETTINGS.enabled ? 'Show All Comments' : 'Hide Spam';
    minimizeBtn.textContent = panel.classList.contains('bcc-minimized') ? 'Expand' : 'Minimize';
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'bcc-panel';

    const title = document.createElement('div');
    title.className = 'bcc-title';
    title.textContent = 'Comment Cleaner';

    const status = document.createElement('div');
    status.className = 'bcc-status';
    status.textContent = 'Idle';

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

    const actions = document.createElement('div');
    actions.className = 'bcc-actions';

    const scanBtn = document.createElement('button');
    scanBtn.className = 'bcc-btn';
    scanBtn.type = 'button';
    scanBtn.textContent = 'Scan Now';
    scanBtn.addEventListener('click', () => {
      const cfg = getSiteConfig();
      if (!cfg) return;
      const container = getContainer(cfg);
      if (container) scanContainer(container, cfg);
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'bcc-btn bcc-toggle';
    toggleBtn.type = 'button';
    toggleBtn.textContent = SETTINGS.enabled ? 'Show All Comments' : 'Hide Spam';
    toggleBtn.addEventListener('click', () => {
      SETTINGS.enabled = !SETTINGS.enabled;
      localStorage.setItem('bcc_enabled', SETTINGS.enabled ? '1' : '0');

      const cfg = getSiteConfig();
      if (!cfg) return;
      const container = getContainer(cfg);
      if (!container) return;

      if (!SETTINGS.enabled) {
        showAllHidden(container);
        removePlaceholders(container);
        runtimeStats.hiddenComments = 0;
        updatePanel(container, cfg);
      } else {
        resetProcessed(container);
        scanContainer(container, cfg);
      }
    });

    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'bcc-btn bcc-minimize';
    minimizeBtn.type = 'button';
    minimizeBtn.textContent = 'Minimize';
    minimizeBtn.addEventListener('click', () => {
      panel.classList.toggle('bcc-minimized');
      updatePanel();
    });

    panel.addEventListener('click', event => {
      if (!panel.classList.contains('bcc-minimized')) return;
      if (event.target && event.target.closest('.bcc-minimize')) return;
      panel.classList.remove('bcc-minimized');
      updatePanel();
    });

    actions.appendChild(scanBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(minimizeBtn);

    panel.appendChild(title);
    panel.appendChild(status);
    panel.appendChild(counts);
    panel.appendChild(actions);
    document.body.appendChild(panel);
    return panel;
  }

  function processElement(el) {
    if (!el || el.dataset.bccProcessed === '1') return;
    el.dataset.bccProcessed = '1';

    const { text, username, links } = extractCommentData(el);
    if (!text || text.length < 20) return;

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

  function scanContainer(container, cfg) {
    runtimeStats.isScanning = true;
    if (!SETTINGS.enabled) {
      updatePanel(container, cfg);
      runtimeStats.isScanning = false;
      return;
    }

    resetProcessed(container);
    runtimeStats.scannedComments = 0;
    runtimeStats.hiddenComments = 0;
    runtimeStats.reasonCounts = {};
    runtimeStats.lastScanAt = new Date().toLocaleTimeString();
    const commentEls = findCommentElements(container, cfg);
    commentEls.forEach(processElement);
    updatePanel(container, cfg);
    runtimeStats.isScanning = false;
  }

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

  function start() {
    const cfg = getSiteConfig();
    if (!cfg) return;

    const initialContainer = getContainer(cfg);
    if (initialContainer) {
      scanContainer(initialContainer, cfg);
      observeContainer(initialContainer, cfg);
      setInterval(() => scanContainer(initialContainer, cfg), SETTINGS.scanIntervalMs);
      return;
    }

    // If comments load later, watch the document for the container
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

  start();
})();
