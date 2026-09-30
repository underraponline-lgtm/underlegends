// El Inicio nuevo (Dlx, 29/09/2026: «1. B. 2. B»): React, exportado a estáticos en bot/paginas/inicio/, que es lo
// que el ciclo ya despliega (bot/pipeline.py hashea bot/paginas/ y sube lo que cambió). Sin build en el ciclo: la
// salida se commitea.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/inicio/',
  build: {
    outDir: '../bot/paginas/inicio',
    emptyOutDir: true,
    sourcemap: false,          // paginas_subir.py publica todo lo que hay en la carpeta
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    target: 'es2019',
    rollupOptions: {
      input: 'src/main.jsx',
      output: {
        entryFileNames: 'inicio.js',
        chunkFileNames: 'inicio-[name].js',
        assetFileNames: (a) => ((a.name || '').endsWith('.css') ? 'inicio.css' : 'f/[name][extname]'),
      },
    },
  },
});
