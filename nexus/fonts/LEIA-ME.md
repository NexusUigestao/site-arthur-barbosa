# Fontes auto-hospedadas

O Nexus v4 **não** carrega Google Fonts por CDN. Cada visita a um site que usa
`fonts.googleapis.com` envia o IP do visitante ao Google antes de qualquer
consentimento (o LG München I condenou exatamente isso em 20/01/2022). Por isso
as fontes ficam junto do site.

## O que está nesta pasta

| Arquivo | Origem | Licença |
|---|---|---|
| `inter-latin-wght-normal.woff2` (48 KB) | Fontsource `@fontsource-variable/inter@5.3.0` | SIL OFL 1.1 — `LICENSE-Inter.txt` |
| `space-grotesk-latin-wght-normal.woff2` (22 KB) | Fontsource `@fontsource-variable/space-grotesk@5.3.0` | SIL OFL 1.1 — `LICENSE-SpaceGrotesk.txt` |

Versões variáveis (todos os pesos num arquivo), subconjunto *latin* — cobre os acentos do
português. A OFL permite uso comercial e auto-hospedagem; os arquivos `LICENSE-*.txt` devem
acompanhar as fontes (o `novo-site.mjs` já copia a pasta inteira).

## Como as páginas carregam

Antes de `tokens.css`, em todas as páginas do starter e no `design-system.html`:

```html
<link rel="preload" href="nexus/fonts/space-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="nexus/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="nexus/fonts.css">
```

As duas têm `preload` porque o `h1` (Space Grotesk) costuma ser o elemento LCP. Se faltar
algum arquivo, `tokens.css` cai para a pilha de fontes do sistema sem quebrar o layout.

## Atualizar ou trocar de fonte

Baixe a nova versão do mesmo pacote (pasta `files/`), mantenha os nomes de arquivo ou ajuste
`nexus/fonts.css`, e troque os `LICENSE-*.txt`. Fonte nova: confirme a licença antes e
rode `node scripts/audit-html.mjs <pasta-do-site>`, que acusa qualquer fonte de terceiro.
