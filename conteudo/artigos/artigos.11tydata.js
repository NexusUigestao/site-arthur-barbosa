import path from 'node:path';
import { publicavel, raiz } from '../../_build/regras.js';
import { dimensoes } from '../../_build/imagem.js';

const iso = (v) => new Date(v).toISOString().slice(0, 10);

// Dados comuns a todos os artigos. Quem não é publicável não gera página (permalink: false).
export default {
  layout: 'artigo.njk',
  eleventyComputed: {
    permalink: (data) => (publicavel(data) ? `/blog/${data.page.fileSlug}/` : false),
    tituloDaPagina: (data) => {
      const t = data.title || '';
      return t.length <= 42 ? `${t} | Arthur Barbosa` : t;
    },
    ogTipo: () => 'article',
    ogPublicado: (data) => (data.date ? iso(data.date) : undefined),
    ogImagem: (data) => data.imagem || undefined,
    altImagem: (data) => (data.imagem ? String(data.imagem_alt || '').trim() : undefined),
    ogImagemAlt: (data) => (data.imagem ? String(data.imagem_alt || '').trim() : undefined),
    ogAtualizado: (data) => (data.atualizado ? iso(data.atualizado) : undefined),
    imagemDim: (data) => (data.imagem ? dimensoes(path.join(raiz, data.imagem)) : undefined),
    ldjson: (data) => {
      if (!data.title || !data.date) return undefined;
      const base = data.site.url;
      const url = `${base}/blog/${data.page.fileSlug}/`;
      const obj = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: data.title,
        description: data.description,
        inLanguage: 'pt-BR',
        datePublished: iso(data.date),
        ...(data.atualizado ? { dateModified: iso(data.atualizado) } : {}),
        mainEntityOfPage: url,
        url,
        author: { '@type': 'Person', name: data.autor.nomeCompleto },
        publisher: { '@type': 'LegalService', name: data.site.nome, url: `${base}/` },
      };
      if (data.imagem) obj.image = /^https?:/.test(data.imagem) ? data.imagem : `${base}${data.imagem}`;
      return obj;
    },
  },
};
