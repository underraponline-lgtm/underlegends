// 🎞️ Arma `escena.js` con el Vite de web/ (el `?inline` del CSS y React salen de ahí), en la carpeta que se le pasa.
//   node herramientas/gif_drops/armar.mjs <carpeta de salida>
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(aqui, '..', '..', 'web');
const salida = path.resolve(process.argv[2] || path.join(aqui, 'salida'));
const req = createRequire(path.join(web, 'package.json'));
const vite = await import(pathToFileURL(req.resolve('vite')).href);

await vite.build({
  root: web,
  configFile: false,
  logLevel: 'warn',
  resolve: { dedupe: ['react', 'react-dom'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: salida,
    emptyOutDir: true,
    minify: false,
    lib: { entry: path.join(aqui, 'escena.js'), formats: ['es'], fileName: () => 'escena.js' },
  },
});
console.log('armado en ' + salida);
