import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  css: { postcss: {} }, // não procurar config de PostCSS em pastas acima do projeto
  server: { port: 5173, open: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});