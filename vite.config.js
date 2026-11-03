import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // مسارات نسبية حتى تعمل النسخة المبنية من أي مجلد أو استضافة
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        teacher: resolve(import.meta.dirname, 'teacher.html'),
      },
    },
  },
});
