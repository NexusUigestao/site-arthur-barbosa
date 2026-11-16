// Sem artigo publicado, o blog inteiro (lista, categorias e RSS) não é gerado.
import { temArtigos } from '../_build/regras.js';

export default {
  eleventyComputed: {
    permalink: (data) => {
      if (!temArtigos()) return false;
      const arq = data.page.inputPath;
      if (arq.endsWith('blog/index.njk')) return '/blog/';
      if (arq.endsWith('blog/feed.njk')) return '/blog/feed.xml';
      if (arq.endsWith('blog/categoria.njk')) return `/blog/${data.categoria.slug}/`;
      return false;
    },
  },
};
