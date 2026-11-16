/* ==========================================================================
   Pré-atendimento pelo WhatsApp.
   As respostas montam, no navegador, o texto que abre no WhatsApp do visitante
   (link wa.me). Nada é gravado nem enviado por este site: a mensagem só segue
   quando a própria pessoa toca em enviar no WhatsApp. Sem terceiros, CSP estrita.
   Sem suporte a <dialog>: o botão fica oculto e os links diretos da página valem.
   ========================================================================== */
(() => {
  const PHONE = '5582999577381';
  const dialog = document.getElementById('ab-wa');
  const openBtn = document.querySelector('[data-ab-wa-open]');
  if (!dialog || !openBtn || typeof dialog.showModal !== 'function') return;

  const form = dialog.querySelector('[data-ab-wa-form]');
  const go = dialog.querySelector('[data-ab-wa-go]');
  const preview = dialog.querySelector('[data-ab-wa-preview]');
  const closeBtn = dialog.querySelector('[data-ab-wa-close]');

  // Ordem e rótulo de cada resposta na mensagem.
  const FIELDS = [
    ['perfil', 'Sou'],
    ['assunto', 'Assunto'],
    ['momento', 'Momento'],
    ['prazo', 'Prazo correndo'],
  ];

  function build() {
    const data = new FormData(form);
    // Só letras, espaços e sinais comuns de nome; corta em 60 caracteres.
    const nome = String(data.get('nome') || '').replace(/[^\p{L}\p{M} '.-]/gu, '').trim().slice(0, 60);
    const lines = [nome
      ? `Olá, Arthur! Meu nome é ${nome}. Vim pelo site e gostaria de um atendimento.`
      : 'Olá, Arthur! Vim pelo site e gostaria de um atendimento.'];
    for (const [name, label] of FIELDS) {
      const value = data.get(name);
      if (value) lines.push(`• ${label}: ${value}`);
    }
    const text = lines.join('\n');
    preview.textContent = text; // textContent: nada do que a pessoa digita vira HTML
    go.href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
  }

  form.addEventListener('change', build);
  form.addEventListener('input', build);
  // Enter no campo de nome: segue para o WhatsApp em vez de recarregar a página.
  form.addEventListener('submit', (ev) => { ev.preventDefault(); go.click(); });

  openBtn.hidden = false;
  openBtn.addEventListener('click', () => {
    build();
    dialog.showModal();
  });
  closeBtn.addEventListener('click', () => dialog.close());
  // Clique no fundo escurecido fecha (o <dialog> do kit não tem padding: o alvo é o próprio fundo).
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
  // Ao fechar (Esc, X, fundo ou depois de abrir o WhatsApp), o foco volta ao botão.
  dialog.addEventListener('close', () => openBtn.focus());
  go.addEventListener('click', () => { window.setTimeout(() => dialog.close(), 0); });
})();
