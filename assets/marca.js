/* ==========================================================================
   Monograma do hero — interação (a entrada é CSS puro, em site.css).
   · Inclinação leve que acompanha o ponteiro (só mouse/trackpad, só com movimento permitido).
   · A luz champanhe atravessa a fita de novo quando o ponteiro entra na arte.
   Sem dependências, sem terceiros. Arquivo externo: compatível com a CSP estrita.
   ========================================================================== */
(() => {
  const art = document.querySelector('[data-ab-tilt]');
  if (!art) return;

  const motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hero = art.closest('section') || art;
  const luz = art.querySelector('.abm-luz');
  const MAX_X = 7; // graus
  const MAX_Y = 9;
  let frame = 0;

  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const active = () => motionOk.matches && finePointer.matches;

  // CSSOM (style.setProperty) não é bloqueado pela CSP; só o atributo style="" no HTML é.
  function setTilt(rx, ry) {
    art.style.setProperty('--ab-rx', `${rx.toFixed(2)}deg`);
    art.style.setProperty('--ab-ry', `${ry.toFixed(2)}deg`);
  }

  hero.addEventListener('pointermove', (ev) => {
    if (!active() || ev.pointerType !== 'mouse') return;
    const r = art.getBoundingClientRect();
    const x = clamp((ev.clientX - (r.left + r.width / 2)) / r.width);
    const y = clamp((ev.clientY - (r.top + r.height / 2)) / r.height);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setTilt(-y * MAX_X, x * MAX_Y));
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    setTilt(0, 0);
  });

  // Reinicia a luz alternando entre duas animações idênticas (trocar o nome reinicia).
  art.addEventListener('pointerenter', () => {
    if (!active() || !luz) return;
    luz.classList.toggle('is-alt');
  });

  // Preferência alterada durante a visita: volta a arte ao repouso.
  motionOk.addEventListener('change', () => { if (!motionOk.matches) setTilt(0, 0); });
})();
