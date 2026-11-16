/*!
 * Nexus Consent v4 — gestor de consentimento de cookies
 * Referências: LGPD (arts. 7º, I; 8º, §5º; 9º) e Guia Orientativo de Cookies da ANPD (out/2022).
 *
 * O que ele garante:
 *  - Bloqueio real: nada marcado com data-consent roda antes da escolha ("modo básico").
 *  - "Aceitar" e "Rejeitar" com o mesmo destaque, no banner e nas preferências.
 *  - Escolha granular por categoria; nada pré-marcado.
 *  - Revogação a qualquer momento ([data-consent-open]); ao revogar, apaga os cookies
 *    da categoria e recarrega a página para encerrar scripts já carregados.
 *  - Versão da política: mudou a versão, pergunta de novo.
 *  - Sem dependências; compatível com CSP estrita (config em JSON, sem inline).
 *
 * Uso no HTML:
 *   <script type="application/json" id="nx-consent-config">{ "version": "1", ... }</script>
 *   <script src="nexus/consent.js" defer></script>
 *
 *   Script bloqueado até consentir (externo ou inline):
 *   <script type="text/plain" data-consent="analytics" src="https://..."></script>
 *
 *   Iframe bloqueado (YouTube, Maps…) + aviso no lugar:
 *   <iframe data-consent="marketing" data-src="https://..." title="..." hidden></iframe>
 *   <div data-consent-placeholder="marketing">…<button data-consent-allow="marketing">Permitir</button></div>
 *
 *   Reabrir preferências: <button type="button" data-consent-open>Preferências de cookies</button>
 *   API: window.NexusConsent.open() · .get() · .reset()
 *   Evento: document.addEventListener('nexus:consent', (e) => e.detail.choices)
 */
(() => {
  'use strict';

  const DEFAULTS = {
    version: '1',
    maxAgeDays: 365,
    storageKey: 'nx-consent',
    policyUrl: 'politica-de-privacidade.html#cookies',
    logEndpoint: null,
    googleConsentMode: {
      analytics_storage: 'analytics',
      ad_storage: 'marketing',
      ad_user_data: 'marketing',
      ad_personalization: 'marketing',
    },
    categories: [
      {
        id: 'analytics',
        label: 'Análise e desempenho',
        description: 'Medem visitas e uso das páginas de forma agregada, para melhorarmos o conteúdo.',
        cookies: ['_ga', '_ga_*', '_gid', '_clck', '_clsk'],
      },
      {
        id: 'marketing',
        label: 'Marketing',
        description: 'Medem campanhas e permitem anúncios relacionados ao seu interesse em outros sites.',
        cookies: ['_fbp', '_gcl_*', '_ttp'],
      },
    ],
    texts: {
      title: 'Sua privacidade',
      body: 'Usamos cookies necessários para o site funcionar. Com a sua permissão, também usaremos cookies de análise e de marketing. Você pode mudar a escolha quando quiser em “Preferências de cookies”, no rodapé.',
      policyLink: 'Política de Cookies',
      acceptAll: 'Aceitar todos',
      rejectAll: 'Rejeitar não necessários',
      customize: 'Personalizar',
      dialogTitle: 'Preferências de cookies',
      dialogIntro: 'Escolha o que você autoriza. Os cookies necessários não podem ser desativados: eles garantem o funcionamento, a segurança e o registro desta escolha.',
      necessaryLabel: 'Necessários',
      necessaryDescription: 'Essenciais para o site funcionar e para guardar sua escolha de cookies.',
      alwaysOn: 'Sempre ativos',
      save: 'Salvar escolhas',
      close: 'Fechar preferências',
      saved: 'Preferências de cookies salvas.',
    },
  };

  /* ---------------------------------------------------------------- config */
  function readConfig() {
    const node = document.getElementById('nx-consent-config');
    if (!node) return {};
    try { return JSON.parse(node.textContent || '{}'); } catch (err) {
      console.error('[NexusConsent] JSON inválido em #nx-consent-config:', err);
      return {};
    }
  }

  const parsed = readConfig();
  // JSON válido mas que não é objeto (null, array, número) é ignorado: o banner sempre aparece.
  const user = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const cfg = {
    ...DEFAULTS,
    ...user,
    texts: { ...DEFAULTS.texts, ...(user.texts || {}) },
    categories: Array.isArray(user.categories) ? user.categories : DEFAULTS.categories,
    googleConsentMode: user.googleConsentMode === null ? null : { ...DEFAULTS.googleConsentMode, ...(user.googleConsentMode || {}) },
  };
  cfg.version = String(cfg.version);

  // URL aceitável: https:// absoluto, ou relativo sem esquema (nada de javascript:, data:, //host).
  function isSafeUrl(value) {
    // Remove espaços e caracteres de controle que o navegador também descarta (ex.: "java\tscript:").
    const url = String(value || '').replace(/[\u0000- \u007f]/g, '');
    if (!url) return false;
    if (/^https:\/\//i.test(url)) return true;
    return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//');
  }
  if (!isSafeUrl(cfg.policyUrl)) cfg.policyUrl = DEFAULTS.policyUrl;
  const CATEGORY_IDS = cfg.categories.map((c) => c.id);
  const T = cfg.texts;

  /* --------------------------------------------------------------- storage */
  let memoryRecord = null; // fallback quando localStorage está bloqueado

  const store = {
    read() {
      try {
        const raw = window.localStorage.getItem(cfg.storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch { return memoryRecord; }
    },
    write(rec) {
      memoryRecord = rec;
      try { window.localStorage.setItem(cfg.storageKey, JSON.stringify(rec)); } catch { /* modo privado/bloqueado */ }
    },
    clear() {
      memoryRecord = null;
      try { window.localStorage.removeItem(cfg.storageKey); } catch { /* idem */ }
    },
  };

  function isValidRecord(rec) {
    return !!rec
      && rec.version === cfg.version
      && typeof rec.ts === 'number'
      && Date.now() - rec.ts < cfg.maxAgeDays * 864e5
      && rec.choices !== null
      && typeof rec.choices === 'object';
  }

  function normalize(choices) {
    const out = {};
    for (const id of CATEGORY_IDS) out[id] = choices && choices[id] === true;
    return out;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /* ------------------------------------------------------------- utilitários */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function svgClose() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of ['M18 6 6 18', 'm6 6 12 12']) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    return svg;
  }

  function globToRegExp(glob) {
    const escaped = String(glob).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
  }

  function isGranted(list, choices) {
    const ids = String(list || '').split(/\s+/).filter(Boolean);
    return ids.length > 0 && ids.every((id) => choices[id] === true);
  }

  /* ------------------------------------------------------------- aplicação */
  // Só estes atributos passam do script bloqueado para o ativo (nada de on*, por exemplo).
  const SCRIPT_ATTRS = new Set(['src', 'async', 'defer', 'crossorigin', 'integrity', 'referrerpolicy', 'id', 'charset']);

  // Scripts inline bloqueados exigem hash/nonce na CSP; prefira sempre arquivo .js externo.
  function activateScripts(choices) {
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach((blocked) => {
      if (blocked.dataset.consentActivated || !isGranted(blocked.dataset.consent, choices)) return;
      const live = document.createElement('script');
      for (const { name, value } of Array.from(blocked.attributes)) {
        if (!SCRIPT_ATTRS.has(name) && !(name.startsWith('data-') && name !== 'data-consent' && name !== 'data-type')) continue;
        live.setAttribute(name, value);
      }
      if (blocked.dataset.type) live.type = blocked.dataset.type; // ex.: data-type="module"
      if (blocked.nonce) live.nonce = blocked.nonce;
      if (blocked.src) live.async = blocked.hasAttribute('async'); // preserva a ordem de execução
      else live.textContent = blocked.textContent;
      blocked.dataset.consentActivated = 'true';
      blocked.after(live);
    });
  }

  function activateEmbeds(choices) {
    document.querySelectorAll('[data-consent][data-src]:not(script)').forEach((el) => {
      if (!isGranted(el.dataset.consent, choices)) return;
      if (!isSafeUrl(el.dataset.src)) { console.error('[NexusConsent] data-src recusado (use https ou caminho relativo):', el.dataset.src); return; }
      if (!el.hasAttribute('referrerpolicy')) el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      if (!el.getAttribute('src')) el.setAttribute('src', el.dataset.src);
      el.hidden = false;
    });
    document.querySelectorAll('[data-consent-placeholder]').forEach((el) => {
      el.hidden = isGranted(el.dataset.consentPlaceholder, choices);
    });
  }

  function updateGoogleConsentMode(choices) {
    if (!cfg.googleConsentMode || typeof window.gtag !== 'function') return;
    const update = {};
    for (const [signal, category] of Object.entries(cfg.googleConsentMode)) {
      update[signal] = choices[category] === true ? 'granted' : 'denied';
    }
    window.gtag('consent', 'update', update);
  }

  function apply(choices) {
    activateScripts(choices);   // primeiro: define gtag(), se houver
    activateEmbeds(choices);
    updateGoogleConsentMode(choices);
    document.dispatchEvent(new CustomEvent('nexus:consent', { detail: { choices: { ...choices }, version: cfg.version } }));
  }

  function deleteCookiesOf(categoryIds) {
    const patterns = cfg.categories
      .filter((c) => categoryIds.includes(c.id))
      .flatMap((c) => c.cookies || [])
      .map(globToRegExp);
    if (!patterns.length) return;

    const names = document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean);
    const parts = window.location.hostname.split('.');
    const domains = [null];
    for (let i = 0; i < parts.length - 1; i += 1) domains.push(`.${parts.slice(i).join('.')}`);

    for (const name of names) {
      if (!patterns.some((re) => re.test(name))) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}; SameSite=Lax`;
      }
    }
  }

  function sendLog(record, source) {
    if (!cfg.logEndpoint || !navigator.sendBeacon) return;
    const payload = JSON.stringify({ id: record.id, ts: record.ts, version: record.version, choices: record.choices, source });
    try { navigator.sendBeacon(cfg.logEndpoint, new Blob([payload], { type: 'application/json' })); } catch { /* sem bloqueio */ }
  }

  /* ----------------------------------------------------------------- estado */
  let record = store.read();
  if (!isValidRecord(record)) record = null;

  function currentChoices() {
    return normalize(record ? record.choices : {});
  }

  // Região viva única para confirmar a escolha a quem usa leitor de tela.
  let live = null;
  function announce(text) {
    if (!live) {
      live = h('p', { class: 'nx-sr-only', role: 'status', 'data-nx-consent-status': true });
      document.body.append(live);
    }
    live.textContent = '';
    window.setTimeout(() => { live.textContent = text; }, 50);
  }

  // Se o elemento focado sumiu (banner ou aviso de embed ocultados), o foco vai para um lugar
  // previsível em vez de cair no <body>, sem rolar a página.
  function restoreFocus(preferred) {
    const active = document.activeElement;
    const lost = !active || active === document.body || active.closest('[hidden]');
    if (!lost) return;
    const target = (preferred && preferred.isConnected && !preferred.closest('[hidden]') && preferred)
      || document.querySelector('main[tabindex="-1"], #conteudo');
    if (target) target.focus({ preventScroll: true });
  }

  function save(choices, source, focusTarget) {
    const next = normalize(choices);
    const prev = record ? normalize(record.choices) : null;
    record = { version: cfg.version, ts: Date.now(), id: (record && record.id) || makeId(), choices: next };
    store.write(record);
    sendLog(record, source);

    // Apaga cookies de toda categoria não autorizada — inclusive sobras de uma versão anterior
    // da política ou de um registro expirado, quando não há "prev" para comparar.
    const denied = CATEGORY_IDS.filter((id) => !next[id]);
    deleteCookiesOf(denied);

    hideBanner();
    if (dialog && dialog.open) dialog.close();

    const revoked = prev ? denied.filter((id) => prev[id]) : [];
    if (revoked.length) {
      window.location.reload(); // encerra scripts que já estavam rodando
      return;
    }
    apply(next);
    restoreFocus(focusTarget);
    announce(T.saved);
  }

  const acceptAll = (source) => save(Object.fromEntries(CATEGORY_IDS.map((id) => [id, true])), source);
  const rejectAll = (source) => save({}, source);

  /* ----------------------------------------------------------------- banner */
  let banner = null;
  let bannerObserver = null;

  function buildBanner() {
    const titleId = 'nx-consent-title';
    const bodyId = 'nx-consent-body';
    const section = h('section', { class: 'nx-consent', 'aria-labelledby': titleId, 'aria-describedby': bodyId, 'data-nx-consent-banner': true },
      h('div', { class: 'nx-consent__text' },
        h('h2', { id: titleId, class: 'nx-consent__title' }, T.title),
        h('p', { id: bodyId }, T.body, ' ', h('a', { href: cfg.policyUrl }, T.policyLink), '.'),
      ),
      h('div', { class: 'nx-consent__actions' },
        h('button', { type: 'button', class: 'nx-btn nx-btn--choice', 'data-nx-action': 'reject' }, T.rejectAll),
        h('button', { type: 'button', class: 'nx-btn nx-btn--choice', 'data-nx-action': 'accept' }, T.acceptAll),
        h('button', { type: 'button', class: 'nx-btn nx-btn--ghost', 'data-nx-action': 'customize', 'aria-haspopup': 'dialog' }, T.customize),
      ),
    );
    section.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-nx-action]');
      if (!btn) return;
      const action = btn.dataset.nxAction;
      if (action === 'accept') acceptAll('banner');
      else if (action === 'reject') rejectAll('banner');
      else if (action === 'customize') openDialog(btn);
    });
    return section;
  }

  function showBanner() {
    if (!banner) banner = buildBanner();
    // Entra cedo na ordem de leitura/tabulação (logo após o skip link), embora apareça no rodapé.
    const skip = document.querySelector('.nx-skip');
    if (skip && skip.parentNode === document.body) skip.after(banner);
    else document.body.prepend(banner);
    banner.hidden = false;

    const setHeight = () => document.documentElement.style.setProperty('--nx-consent-h', `${banner.offsetHeight}px`);
    setHeight();
    if ('ResizeObserver' in window) {
      bannerObserver = new ResizeObserver(setHeight);
      bannerObserver.observe(banner);
    }
  }

  function hideBanner() {
    if (!banner) return;
    banner.hidden = true;
    if (bannerObserver) { bannerObserver.disconnect(); bannerObserver = null; }
    document.documentElement.style.setProperty('--nx-consent-h', '0px');
  }

  /* ----------------------------------------------------------------- dialog */
  let dialog = null;
  let opener = null;

  function buildDialog() {
    const titleId = 'nx-prefs-title';
    const rows = cfg.categories.map((cat) => {
      const inputId = `nx-cat-${cat.id}`;
      const descId = `${inputId}-desc`;
      return h('div', { class: 'nx-pref' },
        h('label', { class: 'nx-pref__label', for: inputId }, cat.label),
        h('p', { class: 'nx-pref__desc', id: descId }, cat.description),
        h('input', { type: 'checkbox', role: 'switch', class: 'nx-switch', id: inputId, 'data-category': cat.id, 'aria-describedby': descId }),
      );
    });

    const el = h('dialog', { class: 'nx-dialog', 'aria-labelledby': titleId, 'data-nx-consent-dialog': true },
      h('div', { class: 'nx-dialog__header' },
        h('h2', { id: titleId }, T.dialogTitle),
        h('button', { type: 'button', class: 'nx-btn nx-btn--ghost nx-btn--icon', 'aria-label': T.close, 'data-nx-action': 'close' }, svgClose()),
      ),
      h('div', { class: 'nx-dialog__body' },
        h('p', null, T.dialogIntro, ' ', h('a', { href: cfg.policyUrl }, T.policyLink), '.'),
        h('div', { class: 'nx-pref' },
          h('p', { class: 'nx-pref__label', id: 'nx-cat-necessary' }, T.necessaryLabel),
          h('p', { class: 'nx-pref__desc' }, T.necessaryDescription),
          h('span', { class: 'nx-badge' }, T.alwaysOn),
        ),
        rows,
      ),
      h('div', { class: 'nx-dialog__footer' },
        h('button', { type: 'button', class: 'nx-btn nx-btn--choice', 'data-nx-action': 'reject' }, T.rejectAll),
        h('button', { type: 'button', class: 'nx-btn nx-btn--choice', 'data-nx-action': 'accept' }, T.acceptAll),
        h('button', { type: 'button', class: 'nx-btn nx-btn--primary', 'data-nx-action': 'save' }, T.save),
      ),
    );

    // Fecha no backdrop só se o clique COMEÇOU e terminou nele (arrastar de dentro para fora não fecha).
    let downOnBackdrop = false;
    el.addEventListener('pointerdown', (ev) => { downOnBackdrop = ev.target === el; });
    el.addEventListener('click', (ev) => {
      if (ev.target === el) { if (downOnBackdrop) el.close(); downOnBackdrop = false; return; }
      const btn = ev.target.closest('[data-nx-action]');
      if (!btn) return;
      const action = btn.dataset.nxAction;
      if (action === 'close') el.close();
      else if (action === 'accept') acceptAll('preferences');
      else if (action === 'reject') rejectAll('preferences');
      else if (action === 'save') {
        const choices = {};
        el.querySelectorAll('input[data-category]').forEach((input) => { choices[input.dataset.category] = input.checked; });
        save(choices, 'preferences');
      }
    });

    el.addEventListener('close', () => {
      const target = opener && opener.isConnected && !opener.closest('[hidden]') ? opener : null;
      if (target) target.focus();
      opener = null;
    });

    document.body.append(el);
    return el;
  }

  function openDialog(from) {
    if (!dialog) dialog = buildDialog();
    const choices = currentChoices();
    dialog.querySelectorAll('input[data-category]').forEach((input) => { input.checked = choices[input.dataset.category] === true; });
    opener = from || document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const first = dialog.querySelector('input[data-category]');
    if (first) first.focus();
  }

  /* ------------------------------------------------------------------- init */
  function init() {
    if (record) apply(currentChoices());
    else showBanner();

    document.addEventListener('click', (ev) => {
      const openBtn = ev.target.closest('[data-consent-open]');
      if (openBtn) { ev.preventDefault(); openDialog(openBtn); return; }
      const allowBtn = ev.target.closest('[data-consent-allow]');
      if (allowBtn) {
        const ids = allowBtn.dataset.consentAllow.split(/\s+/).filter((id) => CATEGORY_IDS.includes(id));
        if (!ids.length) return;
        const next = currentChoices();
        ids.forEach((id) => { next[id] = true; });
        // Foco vai para o conteúdo recém-liberado (o botão clicado some junto com o aviso).
        const holder = allowBtn.closest('[data-consent-placeholder]');
        const embed = holder && holder.parentElement && holder.parentElement.querySelector('[data-consent][data-src]:not(script)');
        save(next, 'placeholder', embed);
      }
    });

    // Outra aba mudou a escolha: sincroniza (revogação → recarrega).
    window.addEventListener('storage', (ev) => {
      if (ev.key !== cfg.storageKey) return;
      const prev = currentChoices();
      const incoming = store.read();
      record = isValidRecord(incoming) ? incoming : null;
      const next = currentChoices();
      if (CATEGORY_IDS.some((id) => prev[id] && !next[id])) { window.location.reload(); return; }
      if (record) { hideBanner(); apply(next); } else showBanner();
    });

    document.documentElement.classList.add('nx-consent-ready');
  }

  window.NexusConsent = Object.freeze({
    open: () => openDialog(),
    get: () => (record ? { ...currentChoices() } : null),
    reset: () => { store.clear(); window.location.reload(); },
    version: cfg.version,
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
