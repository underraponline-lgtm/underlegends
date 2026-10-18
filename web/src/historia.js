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

// los renglones de `texto` que entran en `ancho`, con la letra que ya tiene puesta `g`
export function renglones(g, texto, ancho) {
  const out = [];
  let l = '';
  String(texto || '').split(/\s+/).filter(Boolean).forEach((p) => {
    const x = l ? l + ' ' + p : p;
    if (l && g.measureText(x).width > ancho) { out.push(l); l = p; } else l = x;
  });
  if (l) out.push(l);
  return out;
}

// 📸 UNA HISTORIA COMO IMAGEN (Dlx, 18/10/2026, a las ideas de historias: «todas»: «compartir la historia como imagen
// para Instagram o WhatsApp, con el link de vuelta»). Se arma con lo que la historia muestra —`el` es su cuerpo ya
// dibujado—: la etiqueta, la imagen principal (la carta de verdad si lleva a una), el título, lo de abajo y, si es una
// lista, sus renglones. El link va en el texto que acompaña la imagen (`compartirImagen`)
export async function imagenHistoria(liga, el, s) {
  const { c, g, letra } = await lienzo();
  const x0 = 72;
  const ancho = W - 2 * x0;
  const txt = (sel) => ((el && el.querySelector(sel)) || {}).textContent || '';
  // el texto de un renglón, con espacio entre sus partes («2º» y «Colesito» son dos piezas)
  const plano = (n) => [...n.childNodes].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
  const cargar = async (src) => {
    if (!src) return null;
    try { return await cargarImg(src + (src.indexOf('?') < 0 ? '?' : '&') + 'lienzo=1'); } catch (e) { return null; }
  };
  letra(700, 34, true); g.fillStyle = '#A5A5A0'; g.textAlign = 'left';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · ' + (s.tag || '')).toUpperCase().slice(0, 52), x0, 132);
  // 🧱 cada pieza sabe cuánto mide y cómo dibujarse: así el conjunto va centrado en el alto que queda libre
  const bloques = [];
  const d = s.ir || {};
  const titulo = (txt('h3') || txt('.st-nom')).replace(/\u200b/g, '').toUpperCase();
  let px = 96;
  let ls = [];
  if (titulo) {
    for (;;) {
      letra(900, px, false);
      ls = renglones(g, titulo, ancho);
      if ((ls.length <= 4 && ls.every((l) => g.measureText(l).width <= ancho)) || px <= 48) break;
      px -= 6;
    }
    ls = ls.slice(0, 5);
    const pxT = px;
    bloques.push({ h: ls.length * Math.round(pxT * 1.02) + 20, draw: (y) => {
      letra(900, pxT, false); g.fillStyle = '#F6F6F6'; g.textAlign = 'center';
      ls.forEach((l, i) => g.fillText(l, W / 2, y + (i + 1) * Math.round(pxT * 1.02)));
    } });
  }
  // 🏆 el podio: las tres cartas, el 1º al medio y más alto, con su puesto y su nombre
  const podio = el ? [...el.querySelectorAll('.st-podio3 li')] : [];
  if (podio.length) {
    // ⚠️ el nombre es el ÚLTIMO hijo: sin carta, la cara también es un <span>, y era la que se leía (sin texto)
    const piezas = await Promise.all(podio.map(async (li) => {
      const im = li.querySelector('img');
      return {
        im: await cargar(im ? (im.currentSrc || im.src) : ''), cara: !li.querySelector('.st-p3-c'),
        p: (li.querySelector('b') || {}).textContent || '', n: (li.lastElementChild || {}).textContent || '',
        uno: li.classList.contains('p1'),
      };
    }));
    const col = Math.floor(ancho / 3) - 16;
    // sin carta, la cara en un círculo de tres cuartos de la columna
    const anchoDe = (x) => (x.cara ? Math.round((x.uno ? col + 40 : col) * 0.75) : (x.uno ? col + 40 : col));
    const altoDe = (x) => (x.cara || !x.im ? anchoDe(x) : Math.round(anchoDe(x) * x.im.naturalHeight / x.im.naturalWidth));
    const maxH = Math.max(...piezas.map(altoDe));
    bloques.push({ h: maxH + 40 + 170, draw: (y) => {
      piezas.forEach((x, i) => {
        const cx = x0 + (i + 0.5) * (ancho / 3);
        const w = anchoDe(x);
        const h = altoDe(x);
        const top = y + 40 + (maxH - h) - (x.uno ? 40 : 0);
        if (x.cara) {
          g.save(); g.beginPath(); g.arc(cx, top + h / 2, w / 2, 0, 2 * Math.PI); g.closePath();
          g.fillStyle = '#2A2A2E'; g.fill(); g.clip();
          if (x.im) g.drawImage(x.im, cx - w / 2, top, w, h);
          else { letra(900, Math.round(w / 2), false); g.fillStyle = '#F6F6F6'; g.textAlign = 'center'; g.fillText((x.n.trim()[0] || '?').toUpperCase(), cx, top + h * 0.68); }
          g.restore();
        } else if (x.im) g.drawImage(x.im, cx - w / 2, top, w, h);
        const yb = top + h + 24;
        g.fillStyle = x.uno ? '#29B298' : '#F6F6F6'; g.fillRect(cx - 34, yb, 68, 44);
        letra(900, 32, false); g.fillStyle = '#030304'; g.textAlign = 'center'; g.fillText(x.p, cx, yb + 34);
        letra(800, 34, false); g.fillStyle = '#F6F6F6';
        renglones(g, x.n, ancho / 3 - 8).slice(0, 2).forEach((l, k) => g.fillText(l, cx, yb + 92 + k * 40));
      });
    } });
  } else {
    // la imagen: la carta de quien la historia nombra, o la primera imagen de la historia (las fotos de YouTube y los
    // logos dejan leerse desde la página; si una no deja, la imagen sale sin ella)
    const caja = 820;
    if (d.carta) {
      const url = liga.cartaUrl(d.carta, d.cual || 'temporada');
      const im = await cargar(url);
      if (im) {
        let w = 520;
        let h = Math.round(w * im.naturalHeight / im.naturalWidth);
        if (h > caja) { w = Math.round(w * caja / h); h = caja; }
        bloques.unshift({ h: h + 40, draw: (y) => g.drawImage(im, (W - w) / 2, y, w, h) });
      }
    } else {
      const im0 = el ? [...el.querySelectorAll('img')].find((im) => im.naturalWidth > 40) : null;
      const im = im0 ? await cargar(im0.currentSrc || im0.src) : null;
      if (im) {
        const redonda = !!(im0.closest && im0.closest('.st-cara, .st-logo, .h-c')) || /st-logo|st-cara/.test(im0.className || '');
        let w = redonda ? 360 : Math.min(ancho, im.naturalWidth * 4);
        let h = redonda ? 360 : Math.round(w * im.naturalHeight / im.naturalWidth);
        if (h > caja) { w = Math.round(w * caja / h); h = caja; }
        bloques.unshift({ h: h + 40, draw: (y) => {
          if (redonda) { g.save(); g.beginPath(); g.arc(W / 2, y + h / 2, w / 2, 0, 2 * Math.PI); g.closePath(); g.clip(); }
          g.drawImage(im, (W - w) / 2, y, w, h);
          if (redonda) g.restore();
        } });
      }
    }
  }
  // los renglones de una lista (lo que se juega hoy, los premios, tus eventos…)
  const items = el ? [...el.querySelectorAll('.st-l li, .st-gente li, .st-vivo p')].map(plano).filter(Boolean).slice(0, 7) : [];
  if (items.length) {
    letra(700, 40, false);
    const filas = items.map((t) => renglones(g, t, ancho).slice(0, 3));
    const n = filas.reduce((t, f) => t + f.length, 0);
    bloques.push({ h: n * 54 + (filas.length - 1) * 16 + 20, draw: (y) => {
      letra(700, 40, false); g.fillStyle = '#F6F6F6'; g.textAlign = 'center';
      let yy = y;
      filas.forEach((f) => { f.forEach((l) => { yy += 54; g.fillText(l, W / 2, yy); }); yy += 16; });
    } });
  }
  const sub = txt('.st-s');
  if (sub) {
    letra(700, 38, false);
    const sl = renglones(g, sub, ancho).slice(0, 3);
    bloques.push({ h: sl.length * 52 + 20, draw: (y) => {
      letra(700, 38, false); g.fillStyle = '#A5A5A0'; g.textAlign = 'center';
      sl.forEach((l, i) => g.fillText(l, W / 2, y + (i + 1) * 52));
    } });
  }
  // centrado en lo que queda entre la etiqueta y el logo de abajo; si no entra, desde arriba
  const arriba = 190;
  const libre = H - 330 - arriba;
  const total = bloques.reduce((t, b) => t + b.h, 0) + (bloques.length - 1) * 24;
  let y = arriba + Math.max(0, Math.round((libre - total) / 2));
  bloques.forEach((b) => { b.draw(y); y += b.h + 24; });
  await pie(g, letra);
  return aPng(c);
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
