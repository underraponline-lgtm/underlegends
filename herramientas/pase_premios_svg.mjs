// 🎫 Los premios del Pase como SVG, sacados del MISMO dibujo que la página (`web/src/pase_objetos.jsx`): lo usa
// `herramientas/pase_premios_png.py`, que los pasa a PNG para los mensajes del bot (bot/pase_dc.js). Escribe en stdout
// `{clave: svg}`. Sin copiar el dibujo: si la página lo cambia, se vuelven a sacar y salen iguales.
//
//     node herramientas/pase_premios_svg.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(AQUI, '..', 'web');
const req = createRequire(path.join(WEB, 'package.json'));
const esbuild = req('esbuild');

// ⚠️ LAS CLAVES SON LAS DE `imagenPremio()` DE bot/pase_dc.js (`CLAVES_IMG`): el objeto de cada premio y, en la
// insignia, su metal. La prueba (bot/pase_dc_prueba.mjs) revisa que cada una tenga su PNG
const entrada = `
import { renderToStaticMarkup } from 'react-dom/server';
import { Objeto } from './src/pase_objetos.jsx';
const out = {};
const tipos = ['pdt', 'titulo', 'carta', 'drop', 'star', 'caja', 'color', 'brillo', 'marco', 'reaccion', 'fondo'];
for (const t of tipos) out[t] = renderToStaticMarkup(<Objeto tipo={t} t={256} />);
for (const m of ['bronce', 'plata', 'oro', 'platino', 'diamante']) out['insignia-' + m] = renderToStaticMarkup(<Objeto p={[0, 0, 'insignia', 'Pase ' + m]} t={256} />);
out['insignia-premium'] = renderToStaticMarkup(<Objeto p={[0, 0, 'emblema', 'Pase premium']} t={256} />);
process.stdout.write(JSON.stringify(out));
`;
// ⚠️ EN CommonJS Y A UN ARCHIVO: react-dom es CommonJS, y un `import()` de un data: URL no puede `require()`
const tmp = path.join(os.tmpdir(), 'pase_premios_' + process.pid + '.cjs');
esbuild.buildSync({ stdin: { contents: entrada, loader: 'jsx', resolveDir: WEB }, bundle: true, platform: 'node', format: 'cjs',
  jsx: 'automatic', outfile: tmp, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' } });
try { req(tmp); } finally { fs.rmSync(tmp, { force: true }); }
