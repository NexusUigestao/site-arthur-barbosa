/*!
 * Nexus UI v4 — comportamentos de interface
 * Menu móvel · revelação ao rolar · validação acessível de formulários · abas · ano no rodapé
 * Sem dependências. Compatível com CSP estrita (sem inline, sem eval, sem style="").
 * Tudo é melhoria progressiva: sem JS, o site continua utilizável.
 */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
   * Header: expõe a altura em --nx-header-h (usado no scroll-padding)
   * ------------------------------------------------------------------- */
  function initHeader() {
    const header = document.querySelector('[data-nx-header]');
    if (!header) return;
    const update = () => root.style.setProperty('--nx-header-h', `${header.offsetHeight}px`);
    update();
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(header);
  }

  /* ---------------------------------------------------------------------
   * Menu móvel: botão com aria-expanded + aria-controls
   * ------------------------------------------------------------------- */
  function initMenu() {
    const header = document.querySelector('[data-nx-header]');
    const toggle = header && header.querySelector('[data-nx-menu-toggle]');
    const nav = toggle && document.getElementById(toggle.getAttribute('aria-controls') || '');
    if (!toggle || !nav) return;

    header.setAttribute('data-menu-ready', '');
    const desktop = window.matchMedia('(min-width: 48rem)');

    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', String(open));
      header.toggleAttribute('data-menu-open', open);
      if (!open && returnFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (ev) => { if (ev.target.closest('a')) setOpen(false); });
    header.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false, { returnFocus: true });
      }
    });
    desktop.addEventListener('change', (ev) => { if (ev.matches) setOpen(false); });
  }

  /* ---------------------------------------------------------------------
   * Revelação ao rolar: [data-reveal] (+ data-reveal-delay="1|2|3")
   * Não arma com movimento reduzido. O que já está na tela aparece sem piscar.
   * ------------------------------------------------------------------- */
  function initReveal() {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!items.length || reduceMotion.matches || !('IntersectionObserver' in window)) return;

    const fold = window.innerHeight * 0.92;
    for (const el of items) {
      if (el.getBoundingClientRect().top < fold) el.classList.add('is-visible');
    }
    root.classList.add('nx-reveal-armed');

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    for (const el of items) if (!el.classList.contains('is-visible')) io.observe(el);

    // Foco via teclado num elemento ainda oculto: revela na hora.
    document.addEventListener('focusin', (ev) => {
      const hidden = ev.target.closest && ev.target.closest('[data-reveal]:not(.is-visible)');
      if (hidden) { hidden.classList.add('is-visible'); io.unobserve(hidden); }
    });

    // Se o visitante ativar "reduzir movimento" com a página aberta, desarma.
    reduceMotion.addEventListener('change', (ev) => {
      if (!ev.matches) return;
      items.forEach((el) => el.classList.add('is-visible'));
      io.disconnect();
    });
  }

  /* ---------------------------------------------------------------------
   * Formulários: form[data-nx-form]
   *  - mensagens em pt-BR ligadas por aria-describedby ao <p id="<campo>-error">
   *  - aria-invalid só depois de interação (não grita no primeiro Tab)
   *  - foco no primeiro campo inválido; resumo em role="status"
   *  - data-demo: não envia nada (showcase) · data-ajax: envia via fetch
   *  - honeypot [data-nx-honeypot]: se preenchido, finge sucesso e descarta
   * ------------------------------------------------------------------- */
  const MESSAGES = {
    valueMissing: (f) => (f.type === 'checkbox' ? 'Marque esta opção para continuar.' : 'Preencha este campo.'),
    typeMismatch: (f) => (f.type === 'email' ? 'Informe um e-mail válido, como nome@exemplo.com.br.' : 'Formato inválido.'),
    tooShort: (f) => `Use pelo menos ${f.minLength} caracteres (agora: ${f.value.length}).`,
    tooLong: (f) => `Use no máximo ${f.maxLength} caracteres.`,
    patternMismatch: (f) => f.dataset.patternMessage || 'Formato inválido.',
    badInput: () => 'Valor inválido.',
  };

  function messageFor(field) {
    for (const key of Object.keys(MESSAGES)) {
      if (field.validity[key]) return MESSAGES[key](field);
    }
    return field.validationMessage;
  }

  function errorElementFor(field) {
    const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/);
    const id = ids.find((x) => x.endsWith('-error'));
    return id ? document.getElementById(id) : null;
  }

  function renderValidity(field) {
    const valid = field.checkValidity();
    if (valid) field.removeAttribute('aria-invalid');
    else field.setAttribute('aria-invalid', 'true');
    const el = errorElementFor(field);
    if (el) el.textContent = valid ? '' : messageFor(field);
    return valid;
  }

  function setStatus(form, text, tone) {
    const status = form.querySelector('[data-nx-form-status]');
    if (!status) return;
    status.textContent = '';
    if (tone) status.dataset.tone = tone; else delete status.dataset.tone;
    // Pequeno atraso garante que leitores de tela anunciem mesmo texto repetido.
    window.setTimeout(() => { status.textContent = text; }, 50);
  }

  function initForms() {
    document.querySelectorAll('form[data-nx-form]').forEach((form) => {
      form.noValidate = true; // as mensagens nativas são substituídas pelas nossas
      const fields = Array.from(form.elements).filter((el) => el.willValidate && !el.closest('[data-nx-honeypot-wrap]'));

      for (const field of fields) {
        field.addEventListener('blur', () => {
          // Checkbox sempre tem value ("on"): só valida no blur se já houve interação.
          const typed = field.type !== 'checkbox' && field.value !== '';
          if (typed || field.dataset.touched) { field.dataset.touched = '1'; renderValidity(field); }
        });
        field.addEventListener('input', () => {
          if (field.getAttribute('aria-invalid') === 'true') renderValidity(field);
        });
        field.addEventListener('change', () => {
          if (field.type === 'checkbox' || field.tagName === 'SELECT') { field.dataset.touched = '1'; renderValidity(field); }
        });
      }

      form.addEventListener('submit', async (ev) => {
        const invalid = fields.filter((f) => !renderValidity(f));
        fields.forEach((f) => { f.dataset.touched = '1'; });

        if (invalid.length) {
          ev.preventDefault();
          setStatus(form, invalid.length === 1
            ? 'Há 1 campo para revisar.'
            : `Há ${invalid.length} campos para revisar.`, 'error');
          // O foco vai depois do anúncio do resumo, para os leitores de tela não descartarem a fala.
          window.setTimeout(() => invalid[0].focus(), 120);
          return;
        }

        const honeypot = form.querySelector('[data-nx-honeypot]');
        const done = (msg) => {
          form.reset();
          fields.forEach((f) => { delete f.dataset.touched; f.removeAttribute('aria-invalid'); });
          setStatus(form, msg || form.dataset.successMessage || 'Mensagem enviada. Responderemos pelo e-mail informado.', 'success');
        };

        if (honeypot && honeypot.value) { ev.preventDefault(); done(); return; }
        if (form.hasAttribute('data-demo')) { ev.preventDefault(); done('Demonstração: o formulário é válido e nada foi enviado.'); return; }
        if (!form.hasAttribute('data-ajax')) return; // envio nativo para o action

        ev.preventDefault();
        // aria-disabled (e não disabled): o botão continua focado, então o leitor de tela não
        // perde a posição; o reenvio é barrado pela flag abaixo.
        if (form.dataset.sending) return;
        form.dataset.sending = '1';
        const submit = form.querySelector('[type="submit"]');
        if (submit) { submit.setAttribute('aria-disabled', 'true'); submit.setAttribute('aria-busy', 'true'); }
        setStatus(form, 'Enviando…');
        try {
          // Sempre POST: dados pessoais não vão na URL (e GET com corpo quebra o fetch).
          const res = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          });
          if (!res.ok) throw new Error(String(res.status));
          done();
        } catch {
          setStatus(form, form.dataset.errorMessage || 'Não foi possível enviar agora. Tente de novo em instantes ou use o e-mail de contato no rodapé.', 'error');
        } finally {
          delete form.dataset.sending;
          if (submit) { submit.removeAttribute('aria-disabled'); submit.removeAttribute('aria-busy'); }
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
   * Abas: [data-nx-tabs] > [role="tablist"] > button[role="tab"][aria-controls]
   *  - ativação automática: setas ←/→, Home e End trocam e focam a aba
   *  - só a aba ativa entra no Tab (tabindex roving); painéis inativos ficam hidden
   *  - sem JS, todos os painéis aparecem (o HTML não traz hidden)
   *  - dispara "nx:tabchange" no [data-nx-tabs] com detail { value, tab, panel }
   * ------------------------------------------------------------------- */
  function initTabs() {
    document.querySelectorAll('[data-nx-tabs]').forEach((box) => {
      const list = box.querySelector('[role="tablist"]');
      const tabs = list ? Array.from(list.querySelectorAll('[role="tab"]')) : [];
      if (!tabs.length) return;
      const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls') || '');

      const select = (tab, { focus = false, emit = true } = {}) => {
        for (const t of tabs) {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          const panel = panelOf(t);
          if (panel) panel.hidden = !on;
        }
        if (focus) tab.focus();
        if (emit) {
          box.dispatchEvent(new CustomEvent('nx:tabchange', {
            bubbles: true,
            detail: { value: tab.dataset.value || tab.id, tab, panel: panelOf(tab) },
          }));
        }
      };

      list.addEventListener('click', (ev) => {
        const tab = ev.target.closest('[role="tab"]');
        if (tab && tabs.includes(tab)) select(tab);
      });
      list.addEventListener('keydown', (ev) => {
        const i = tabs.indexOf(document.activeElement);
        if (i === -1) return;
        // Lista horizontal: só ←/→ (↑/↓ continuam rolando a página).
        const next = {
          ArrowRight: tabs[(i + 1) % tabs.length],
          ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
          Home: tabs[0],
          End: tabs[tabs.length - 1],
        }[ev.key];
        if (!next) return;
        ev.preventDefault();
        select(next, { focus: true });
      });

      const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
      select(initial, { emit: false });
      box.setAttribute('data-tabs-ready', '');
    });
  }

  /* ---------------------------------------------------------------------
   * Ano corrente: <span data-nx-year>2026</span>
   * ------------------------------------------------------------------- */
  function initYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-nx-year]').forEach((el) => { el.textContent = year; });
  }

  // Cada módulo isolado: uma falha (ex.: API ausente em navegador antigo) não derruba os outros.
  function init() {
    for (const run of [initHeader, initMenu, initReveal, initForms, initTabs, initYear]) {
      try { run(); } catch (err) { console.error(`[Nexus] ${run.name} falhou:`, err); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
