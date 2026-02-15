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

  const VALID_HOSTS = [
    'hianime.nz',
    'hianime.bz',
    'hianime.do',
    'hianime.pe',
    'hianime.cx',
    'hianime.to',
    'hianimez.is',
    'hianimez.to'
  ];

  const SITE_CONFIGS = [
    {
      hostRe: /(^|\.)hianime\.nz$|(^|\.)hianime\.bz$|(^|\.)hianime\.do$|(^|\.)hianime\.pe$|(^|\.)hianime\.cx$|(^|\.)hianime\.to$|(^|\.)hianimez\.is$|(^|\.)hianimez\.to$/,
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

  function isValidHost(host) {
    return VALID_HOSTS.some(valid => host === valid || host.endsWith(`.${valid}`));
  }

  function isHianimeDomain(host) {
    return /(^|\.)hianime(\.|z\.)/i.test(host);
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
    const toggleInput = panel.querySelector('.bcc-switch input');
    const toggleStatus = panel.querySelector('.bcc-toggle-status');

    scannedEl.textContent = runtimeStats.scannedComments.toString();
    hiddenEl.textContent = runtimeStats.hiddenComments.toString();
    if (toggleInput) toggleInput.checked = SETTINGS.enabled;
    if (toggleStatus) {
      toggleStatus.textContent = SETTINGS.enabled ? 'Active' : 'Disabled';
      toggleStatus.classList.toggle('bcc-off', !SETTINGS.enabled);
    }
    updateMinimizeIcon(panel);
  }

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

  function toggleMinimized(panel) {
    panel.classList.toggle('bcc-minimized');
    updateMinimizeIcon(panel);
  }

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

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'bcc-panel';

    const header = document.createElement('div');
    header.className = 'bcc-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'bcc-title-wrap';

    const icon = document.createElement('img');
    icon.className = 'bcc-icon';
    icon.src = chrome.runtime.getURL('icons/icon-32.png');
    icon.alt = '';
    icon.loading = 'lazy';

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
    infoCheck.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

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
    const currentHost = window.location.hostname;
    VALID_HOSTS.forEach(host => {
      const item = document.createElement('li');
      item.textContent = host;
      if (currentHost === host || currentHost.endsWith(`.${host}`)) {
        item.classList.add('bcc-info-current');
      }
      infoList.appendChild(item);
    });

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
      onChange: checked => {
        SETTINGS.enabled = checked;
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
      }
    });

    toggleRow.appendChild(toggleMeta);
    toggleRow.appendChild(toggleSwitch);

    panel.addEventListener('click', event => {
      if (!panel.classList.contains('bcc-minimized')) return;
      if (event.target && event.target.closest('.bcc-minimize')) return;
      panel.classList.remove('bcc-minimized');
      updatePanel();
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
    const host = window.location.hostname;
    if (isHianimeDomain(host) && !isValidHost(host)) {
      alert(
        `Warning: This domain isn't in the official list and may be a phishing site. ` +
          `Valid domains: ${VALID_HOSTS.join(', ')}`
      );
      return;
    }

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
