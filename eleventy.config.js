// Eleventy 3 · site de Arthur Barbosa.
// Só o blog, a home (lista dos últimos artigos), o sitemap, o RSS e o _headers são modelos.
// As demais páginas (legais, 404, obrigado) e os assets são cópia direta: nada de {{ }}
// em HTML que não seja modelo. Saída: _site/.
import path from 'node:path';
import { rmSync } from 'node:fs';
import { raiz } from './_build/regras.js';
import { publicavel, validarArtigo, categorias as slugsCategorias } from './_build/regras.js';
import { dimensoes } from './_build/imagem.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const asDate = (v) => (v instanceof Date ? v : new Date(v));
const pad = (n) => String(n).padStart(2, '0');

export default function (eleventyConfig) {
  // ---- Limpa a saída antes de cada build: nada de página velha (rascunho, artigo removido) sobrando ----
  // Apaga a pasta de saída deste build (respeita --output), nunca outra.
  eleventyConfig.on('eleventy.before', ({ directories }) => {
    const saida = path.resolve(directories?.output || path.join(raiz, '_site'));
    if (saida !== raiz) rmSync(saida, { recursive: true, force: true });
  });

  // ---- Só estes formatos são modelos; .html não passa pelo Eleventy (cópia direta) ----
  eleventyConfig.setTemplateFormats(['njk', 'md']);
  eleventyConfig.ignores.add('nexus/**');
  eleventyConfig.ignores.add('_cms-build/**');

  // ---- Cópias diretas ----
  eleventyConfig.addPassthroughCopy('*.html');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('nexus');
  eleventyConfig.addPassthroughCopy('favicon.svg');
  eleventyConfig.addPassthroughCopy('og.png');
  eleventyConfig.addPassthroughCopy('robots.txt');
  eleventyConfig.addPassthroughCopy({
    'admin/index.html': 'admin/index.html',
    'admin/config.yml': 'admin/config.yml',
    '_cms-build': 'admin',
  });

  // ---- Markdown dos artigos: sem HTML cru, h1 vira h2, imagens com tamanho e carregamento tardio ----
  eleventyConfig.amendLibrary('md', (md) => {
    md.set({ html: false, linkify: false, typographer: false });

    const abre = md.renderer.rules.heading_open;
    const fecha = md.renderer.rules.heading_close;
    const sobe = (rule) => (tokens, idx, options, env, self) => {
      if (tokens[idx].tag === 'h1') tokens[idx].tag = 'h2';
      return rule ? rule(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    };
    md.renderer.rules.heading_open = sobe(abre);
    md.renderer.rules.heading_close = sobe(fecha);

    const imagem = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      const t = tokens[idx];
      const src = t.attrGet('src') || '';
      t.attrSet('loading', 'lazy');
      t.attrSet('decoding', 'async');
      if (src.startsWith('/')) {
        const dim = dimensoes(path.join(raiz, src));
        if (dim) { t.attrSet('width', String(dim.w)); t.attrSet('height', String(dim.h)); }
      }
      return imagem(tokens, idx, options, env, self);
    };
  });

  // ---- Coleção de artigos publicáveis, do mais novo para o mais antigo ----
  eleventyConfig.addCollection('artigos', (api) => api
    .getFilteredByGlob('conteudo/artigos/*.md')
    .filter((item) => publicavel(item.data))
    .map((item) => { validarArtigo(item); return item; })
    .sort((a, b) => (asDate(b.data.date) - asDate(a.data.date)) || String(a.data.title).localeCompare(String(b.data.title), 'pt-BR')));

  // ---- Filtros ----
  eleventyConfig.addFilter('dataIso', (v) => asDate(v).toISOString().slice(0, 10));
  eleventyConfig.addFilter('dataBr', (v) => {
    const d = asDate(v);
    return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter('dataRfc822', (v) => {
    const d = asDate(v);
    return `${DIAS[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${MES_EN[d.getUTCMonth()]} ${d.getUTCFullYear()} 00:00:00 +0000`;
  });
  eleventyConfig.addFilter('rotuloCategoria', (slug, lista) => (lista.find((c) => c.slug === slug) || {}).rotulo || slug);
  eleventyConfig.addFilter('comCategoria', (artigos, slug) => artigos.filter((a) => a.data.categoria === slug));
  // Data mais recente entre publicação e atualização de uma lista de artigos.
  eleventyConfig.addFilter('ultimaMod', (lista) => lista.map((a) => asDate(a.data.atualizado || a.data.date)).sort((x, y) => y - x)[0]);
  eleventyConfig.addFilter('primeiros', (lista, n) => lista.slice(0, n));
  eleventyConfig.addFilter('tituloPagina', (t) => (t.length <= 42 ? `${t} | Arthur Barbosa` : t));
  eleventyConfig.addFilter('urlAbsoluta', (caminho, base) => (/^https?:/.test(caminho) ? caminho : `${base}${caminho}`));
  // JSON-LD seguro dentro de <script>: escapa "<" para que nada feche a tag.
  eleventyConfig.addFilter('jsonld', (obj) => JSON.stringify(obj, null, 2)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'));
  // Caminhos que recebem a CSP pública: a página e, por segurança, a versão sem ".html".
  eleventyConfig.addFilter('variantesCaminho', (caminho) => {
    if (caminho === '/') return ['/', '/index.html'];
    return caminho.endsWith('.html') ? [caminho, caminho.slice(0, -5)] : [caminho];
  });

  eleventyConfig.addGlobalData('slugsCategorias', slugsCategorias);

  return {
    dir: { input: '.', output: '_site', includes: '_includes', data: '_data' },
    markdownTemplateEngine: false,
    htmlTemplateEngine: false,
  };
}
