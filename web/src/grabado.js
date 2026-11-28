// 🎙️💎 LOS EVENTOS GRABADOS, CON EL PREMIUM (28/11/2026, el paso 7). Dlx, 27/11: «30 s gratis de cada ronda, tu propia batalla
// completa gratis, el evento entero para Premium (audio servido por el Worker, no link público)».
//
// La regla vive en el Worker (bot/grabados.js `acceso()`): la página pide `/api/grabados?ll=<n>` con su sesión (la cookie
// viaja sola a /api) y recibe, por batalla, lo que ESA persona puede oír, con un link sellado que vence a las 2 h. La página
// no decide nada: sólo muestra. Sin grabación registrada para esa llave (`hay: false`) no hay audio: ⚠️ NUNCA se cae a lo
// público de antes (`reels/audios.json`, batallas enteras para cualquiera), que se borra con herramientas/grabados_publicos.py.
import { useEffect, useState } from 'react';

//: adónde lleva «Hazte Premium»: la pestaña del Premium del Pase (pase.jsx lee /premium del link)
export const HAZTE = '#/pase/premium';
export const PREVIA_S = 30;

/** La lista de una llave: `undefined` mientras llega, `null` si no hay grabación (o falló), o lo que dijo el Worker. */
export function useGrabados(ll, quien = '') {
  const [G, setG] = useState(undefined);
  useEffect(() => {
    if (!/^\d{1,9}$/.test(String(ll || ''))) { setG(null); return undefined; }
    let vivo = true;
    setG(undefined);
    fetch('/api/grabados?ll=' + encodeURIComponent(ll), { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo) setG(j && j.ok && j.hay ? j : null); })
      .catch(() => { if (vivo) setG(null); });
    return () => { vivo = false; };
  }, [ll, quien]);
  return G;
}

/**
 * Las batallas de la lista con la forma de `reels/audios.json` (lo que ya leen `EventoCompleto` y el ♫ de cada batalla):
 * `{ev, k, ll, ronda, nombres, dur, url, det, nivel, previa, tuya}`. Sólo las que se pueden oír (entera o adelanto); las
 * cerradas van aparte, para la cuenta. `null` si no hay lista.
 */
export function filasDe(G, ll) {
  if (!G || !Array.isArray(G.batallas)) return null;
  const ev = (G.ev && G.ev.ev) || '';
  const xs = [], cerradas = [];
  for (const b of G.batallas) {
    const y = { ev, k: b.k, ll: String(ll), ronda: b.r || '', nombres: b.nombres || [], dur: b.dur || 0, nivel: b.nivel, tuya: !!b.tuya,
      previa: b.nivel === 'previa', durp: b.durp || PREVIA_S, url: b.url || '', det: b.det || '', sv: (G.ev && G.ev.sv) || '' };
    if (b.nivel === 'entera' || b.nivel === 'previa') { if (y.url) xs.push(y); } else cerradas.push(y);
  }
  const mejor = G.mejor && G.mejor.url ? { ev, k: 'mejor', mejor: true, ll: String(ll), url: G.mejor.url, det: G.mejor.det || '', dur: G.mejor.dur || 0 } : null;
  return { xs, cerradas, mejor, yo: G.yo || 'anon', partes: Array.isArray(G.partes) ? G.partes : [], evento: G.evento || null,
    previas: xs.filter((x) => x.previa).length, tuyas: xs.filter((x) => x.tuya).length, ev: G.ev || {} };
}

/** «2 h 04 min» */
export function largo(s) {
  const t = Math.max(0, Math.round(s || 0));
  const h = Math.floor(t / 3600), m = Math.round((t % 3600) / 60);
  return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : Math.max(1, m) + ' min';
}
