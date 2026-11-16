// Regras de publicação do blog, usadas pelo Eleventy (coleção, permalink e validações).
// Um artigo só vira página quando `publicado: true`. A variável BLOG_MOSTRAR_RASCUNHOS=1
// inclui os rascunhos (e o artigo de exemplo) só em desenvolvimento: no Netlify, em
// produção (CONTEXT=production), ela é ignorada.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import matter from 'gray-matter';
import path from 'node:path';

export const raiz = path.join(import.meta.dirname, '..');

// Fonte única das categorias: _data/categorias.json. O select de admin/config.yml é manual:
// ao mudar as categorias, atualize os dois lugares.
export const categorias = JSON.parse(readFileSync(path.join(raiz, '_data', 'categorias.json'), 'utf8')).map((c) => c.slug);

export const emProducao = process.env.CONTEXT === 'production';
export const mostrarRascunhos = process.env.BLOG_MOSTRAR_RASCUNHOS === '1' && !emProducao;

export function publicavel(data) {
  return data.publicado === true || mostrarRascunhos;
}

// Há ao menos um artigo publicável? Lido direto dos arquivos, porque o Eleventy ainda não
// monta as coleções quando decide os permalinks do blog.
let _tem;
export function temArtigos() {
  if (_tem === undefined) {
    const pasta = path.join(raiz, 'conteudo', 'artigos');
    _tem = readdirSync(pasta).filter((f) => f.endsWith('.md'))
      .some((f) => publicavel(matter(readFileSync(path.join(pasta, f), 'utf8')).data));
  }
  return _tem;
}

function textos(item) {
  try { return readFileSync(item.inputPath, 'utf8'); } catch { return ''; }
}

// Falha o build (nunca publica) quando um artigo publicável está incompleto ou inseguro.
export function validarArtigo(item) {
  const d = item.data;
  const nome = item.inputPath;
  const texto = textos(item);
  const erros = [];
  if (!d.title) erros.push('falta o título');
  if (!d.description) erros.push('falta a descrição');
  if (!d.date) erros.push('falta a data');
  if (!categorias.includes(d.categoria)) erros.push(`categoria inválida: ${d.categoria}`);
  if (!/^[a-z0-9-]+$/.test(item.fileSlug)) erros.push(`nome do arquivo inválido (use só a-z, 0-9 e hífen): ${item.fileSlug}`);
  if (d.imagem) {
    const img = String(d.imagem);
    if (!img.startsWith('/assets/blog/') || img.includes('..')) erros.push('imagem deve ficar em /assets/blog/ (sem "..")');
    else if (!existsSync(path.join(raiz, img))) erros.push(`arquivo da imagem não existe: ${img}`);
    if (!String(d.imagem_alt || '').trim()) erros.push('imagem sem texto alternativo (imagem_alt)');
  }
  if (/!\[\s*\]\(/.test(texto)) erros.push('imagem no texto com descrição (alt) vazia');
  if (d.publicado === true && /\[\[/.test(texto)) erros.push('ainda tem placeholder [[...]]');
  if (erros.length) throw new Error(`Artigo ${nome} não pode ser publicado: ${erros.join('; ')}.`);
  if (d.title.length > 60) console.warn(`[aviso] ${nome}: título com ${d.title.length} caracteres (ideal até 60).`);
  if (d.description.length < 140 || d.description.length > 160) {
    console.warn(`[aviso] ${nome}: descrição com ${d.description.length} caracteres (ideal de 140 a 160).`);
  }
}
