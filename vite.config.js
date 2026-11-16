// Empacota só o painel (admin/cms-entry.js) em _cms-build/. O Eleventy copia essa pasta
// para _site/admin/. Sem sourcemap, sem polyfill inline (a CSP do /admin não permite script inline).
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  logLevel: 'info',
  build: {
    outDir: '_cms-build',
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: 'admin/cms-entry.js',
      output: {
        entryFileNames: 'cms.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
