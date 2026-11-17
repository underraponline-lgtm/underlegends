// El Inicio nuevo (Dlx, 29/09/2026: «1. B. 2. B»): React, exportado a estáticos en bot/paginas/inicio/, que es lo
// que el ciclo ya despliega (bot/pipeline.py hashea bot/paginas/ y sube lo que cambió). Sin build en el ciclo: la
// salida se commitea.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 📦 la lista de pedazos que la página precarga al entrar (16/11/2026): con la huella en el nombre, la escribe el build
// y no una lista a mano. Sin el Dashboard, el panel del socio ni verificarse (son de pocos). Ver `__lgPrecargar`, App.jsx
function listaTrozos() {
  return {
    name: 'lista-trozos',
    generateBundle(_, bundle) {
      const fuera = /^inicio-(dashboard|socio2|panelsocio|verificar)-/;
      const p = Object.values(bundle).filter((c) => c.type === 'chunk' && !c.isEntry && !fuera.test(c.fileName)).map((c) => c.fileName).sort();
      this.emitFile({ type: 'asset', fileName: 'trozos.json', source: JSON.stringify(p) });
    },
  };
}

export default defineConfig({
  plugins: [react(), listaTrozos()],
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
        // 🔄 con su huella (16/11/2026, web/src/version.js): con el nombre fijo, una pestaña abierta durante una
        // publicación mezclaba el pedazo nuevo de una página con el principal viejo y cargaba funciones equivocadas
        chunkFileNames: 'inicio-[name]-[hash].js',
        assetFileNames: (a) => ((a.name || '').endsWith('.css') ? 'inicio.css' : 'f/[name][extname]'),
      },
    },
  },
});
