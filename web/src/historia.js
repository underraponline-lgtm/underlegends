// Las imágenes para historias (1080×1920), en un solo lugar: el marco de la Liga —el fondo, los dos círculos de la
// escena, la barra de arriba, el logo y la dirección abajo—, la carta de verdad de alguien y el menú de compartir del
// celular. Las usan el Ranking («Mi puesto para historias», 02/10/2026) y Eventos («Para historias», el campeón de
// cada evento: Dlx, 02/10, «me gusta»). Se arman en el navegador: R2 deja leer las cartas desde la página (CORS), y el
// CDN de Discord los logos de los servidores, así que el lienzo no queda «manchado»
import { limpio } from './liga.js';

export const W = 1080;
export const H = 1920;

export function cargarImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('no cargó ' + src));
    im.src = src;
  });
}

// el lienzo con el marco de la Liga, y `letra()` para elegir la fuente
export async function lienzo() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  try { await Promise.all(['900 120px Archivo', '700 40px "Space Mono"'].map((x) => document.fonts.load(x))); } catch (e) { /* las del sistema */ }
  const letra = (peso, px, mono) => {
    g.font = peso + ' ' + px + 'px ' + (mono ? '"Space Mono", monospace' : 'Archivo, sans-serif');
    if ('fontStretch' in g) g.fontStretch = mono ? 'normal' : 'expanded';
    if ('letterSpacing' in g) g.letterSpacing = mono ? '4px' : '0px';
  };
  g.fillStyle = '#030304'; g.fillRect(0, 0, W, H);
  // los círculos de la escena: el magenta arriba a la derecha y el verde agua abajo a la izquierda
  g.globalAlpha = 0.9; g.fillStyle = '#E41373'; g.beginPath(); g.arc(W + 40, 300, 430, 0, 2 * Math.PI); g.fill();
  g.globalAlpha = 0.28; g.fillStyle = '#29B298'; g.beginPath(); g.arc(-60, H - 300, 480, 0, 2 * Math.PI); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = '#29B298'; g.fillRect(0, 0, W / 2, 16);
  g.fillStyle = '#E41373'; g.fillRect(W / 2, 0, W / 2, 16);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  return { c, g, letra };
}

// la carta de verdad de `k`, de `w` de ancho y centrada en `cx` (si pasa de `maxH` de alto, se achica); sin carta, su
// cara en un círculo grande —o la inicial— con el nombre abajo. Devuelve el alto que ocupó
export async function carta(g, letra, liga, k, nombre, cual, cx, y, w, maxH) {
  const url = liga.cartaUrl(k, cual);
  try {
    if (!url) throw new Error('sin carta');
    // 🔴 CON SU PROPIA DIRECCIÓN. La página ya cargó esta carta como imagen común, y R2 contesta ESE pedido sin
    // permiso de lectura y sin `Vary: Origin`: el navegador reusaba lo guardado y el lienzo la rechazaba. En
    // producción salía la cara en vez de la carta (02/10/2026); en la prueba local no se veía
    const im = await cargarImg(url + (url.indexOf('?') < 0 ? '?' : '&') + 'lienzo=1');
    let cw = w;
    let ch = Math.round(cw * im.naturalHeight / im.naturalWidth);
    if (ch > maxH) { cw = Math.round(cw * maxH / ch); ch = maxH; }
    g.drawImage(im, cx - cw / 2, y, cw, ch);
    return ch;
  } catch (e) {
    // las medidas son las del Ranking (600 de ancho), a escala
    const s = w / 600;
    const r = 260 * s;
    g.save(); g.beginPath(); g.arc(cx, y + 300 * s, r, 0, 2 * Math.PI); g.closePath(); g.fillStyle = '#F6F6F6'; g.fill(); g.clip();
    let cara = false;
    try { const av = liga.avUrl(k); if (av) { g.drawImage(await cargarImg(av), cx - r, y + 300 * s - r, 2 * r, 2 * r); cara = true; } } catch (e2) { /* la inicial */ }
    g.restore();
    if (!cara) { letra(900, 260 * s, false); g.fillStyle = '#030304'; g.textAlign = 'center'; g.fillText((limpio(nombre)[0] || '?').toUpperCase(), cx, y + 390 * s); }
    letra(900, 64 * s, false); g.fillStyle = '#F6F6F6'; g.textAlign = 'center'; g.fillText(limpio(nombre).toUpperCase(), cx, y + 680 * s);
    return 720 * s;
  }
}

// abajo: el logo, recortado en su círculo (el archivo es cuadrado y traía las esquinas de color), y la dirección
export async function pie(g, letra) {
  try {
    const ul = await cargarImg('/ul.png');
    g.save(); g.beginPath(); g.arc(W / 2, H - 216, 64, 0, 2 * Math.PI); g.closePath(); g.clip();
    g.drawImage(ul, W / 2 - 64, H - 280, 128, 128);
    g.restore();
  } catch (e) { /* sin logo */ }
  letra(700, 34, true); g.fillStyle = '#A5A5A0'; g.textAlign = 'center';
  g.fillText('underlegends.pages.dev', W / 2, H - 96);
}

export function aPng(c) {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('sin imagen'))), 'image/png'));
}

// el menú de compartir del celular (Instagram, WhatsApp…) o, en la compu, el archivo
export async function compartirImagen(blob, nombre, texto) {
  const file = new File([blob], nombre, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: texto }); return 'ok'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
  }
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
  return 'bajada';
}

// armar y compartir, con su estado para el botón: '' · 'armando' · 'bajada' · 'error'
export async function armarYCompartir(armar, nombre, texto, setEst, donde) {
  setEst('armando');
  let r = '';
  try {
    r = await compartirImagen(await armar(), nombre, texto);
  } catch (e) {
    console.error('[' + donde + '] la imagen para historias:', e);
    r = 'error';
  }
  setEst(r === 'bajada' ? 'bajada' : r === 'error' ? 'error' : '');
  if (r === 'bajada' || r === 'error') setTimeout(() => setEst(''), 3500);
}
