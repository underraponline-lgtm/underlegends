// 🖼️ LOS FONDOS APROBADOS (13/10/2026): `{clave: [url, en su perfil, de fondo de su página]}`, del objeto (`fondos()` en
// bot/avisos.js). Una vez por visita y con cinco minutos de borde, como los roles. Lo usan el perfil (la cabecera de cada
// uno) y la app (tu propia página, si lo elegiste). Ver `FondoCaja` en cuenta.jsx
import { useEffect, useState } from 'react';

let fondos = null, fondosT = 0, fondosP = null;

export function useFondos() {
  const [f, setF] = useState(fondos);
  useEffect(() => {
    if (fondos && Date.now() - fondosT < 300000) return undefined;
    let vivo = true;
    fondosP = fondosP || fetch('/api/avisos/fondos').then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((d) => { fondosP = null; if (d && d.f) { fondos = d.f; fondosT = Date.now(); } return fondos; });
    fondosP.then((x) => { if (vivo) setF(x); });
    return () => { vivo = false; };
  }, []);
  return f;
}

// sólo direcciones del bucket de la Liga: un `url("…")` armado con otra cosa no entra al estilo
export const urlFondo = (u) => (/^https:\/\/pub-[a-z0-9]+\.r2\.dev\/fondos\/[a-f0-9]{24}\.(webp|jpg|png)$/.test(String(u || '')) ? 'url("' + u + '")' : '');

// 🌆 las escenas de cada servidor (las de los banners, sin textos: `herramientas/banners_eventos.py` las deja en
// `bot/paginas/escenas/`). Sin la suya, el fondo de antes. La usan el escenario del Inicio (arriba.jsx) y «Tus fondos»
const ESCENAS = new Set(['acad', 'ch', 'ddf', 'dds', 'dra', 'fds', 'ffa', 'ffs', 'frz', 'fvs', 'lkr', 'sr', 'urbf']);
export const escenaDe = (sv) => { const k = String(sv || '').toLowerCase(); return ESCENAS.has(k) ? '/escenas/' + k + '.webp' : ''; };

// ═══ 🖼️ TUS FONDOS POR LUGAR (17/11/2026, la tanda 2 del remake de Tu cuenta). Dlx: «Tus fondos debería tener más
// significado… el del VS, el de escenario donde aparece la tarjeta, el fondo de mi perfil», y de los lugares nuevos «el
// #1 y el #4». Cada lugar guarda qué va (`fo[3]`, de `fondos()` en avisos.js): `auto`, `mia` (tu imagen), `bandera` o
// `servidor`. ⚠️ Las opciones de cada lugar están también en `LUGARES_FONDO` de bot/avisos.js: si se toca una, la otra ═══
export const LUGARES = [
  ['perfil', 'Tu perfil', 'La portada de arriba de tu perfil.', ['auto', 'mia', 'bandera', 'servidor'], 'Tu imagen; sin ella, el color de tu servidor'],
  ['vs', 'El VS del Inicio', 'Tu mitad del cara a cara de arriba, en el Inicio de cada uno.', ['auto', 'mia', 'bandera', 'servidor'], 'Tu imagen; sin ella, tu bandera'],
  ['esc', 'El escenario de tu carta', 'Detrás de tu carta cuando alguien la abre.', ['auto', 'mia', 'bandera', 'servidor'], 'La luz del color de tu rango'],
  ['vivo', 'El VS en vivo de Discord', 'Tu mitad de la imagen del VS que el bot pone en el chat del evento.', ['auto', 'mia', 'bandera'], 'El fondo del servidor del evento'],
  ['ficha', 'Tu ficha', 'La que sale al pasar el mouse por tu cara. Si eliges algo (o tienes tu imagen), va también detrás de tu fila en el Ranking.', ['auto', 'mia', 'bandera', 'servidor'], 'Tu imagen; sin ella, tu bandera'],
];
export const NOMBRE_OPCION = { auto: 'Automático', mia: 'Tu imagen', bandera: 'Tu bandera', servidor: 'Tu servidor' };
/** Qué eligió para `lugar` (`auto` si nada). */
export const eleccion = (fo, lugar) => (fo && fo[3] && fo[3][lugar]) || 'auto';
const banderaFondo = (cc) => (cc ? 'url("/banderas/xl/' + cc + '.webp"), url("/banderas/g/' + cc + '.webp")' : '');
/** La imagen de cada opción, como `background-image` ('' = sin imagen). `quien` trae `{cc, sv}`. */
export function fondoOpcion(fo, op, quien) {
  const q = quien || {};
  if (op === 'mia') return fo ? urlFondo(fo[0]) : '';
  if (op === 'bandera') return banderaFondo(String(q.cc || '').toLowerCase());
  if (op === 'servidor') { const e = escenaDe(q.sv); return e ? 'url("' + e + '")' : ''; }
  return '';
}
/** Lo que va detrás en `lugar`. En `auto`, lo de siempre de ese lugar; `mia` sin imagen es `auto`. */
export function fondoEn(fo, lugar, quien) {
  const e = eleccion(fo, lugar);
  const mia = fo ? urlFondo(fo[0]) : '';
  if (e !== 'auto' && !(e === 'mia' && !mia)) return fondoOpcion(fo, e, quien);
  // automático: la imagen si la quiere en su perfil (la casilla de siempre, `fo[1]`)
  const suya = mia && fo[1] ? mia : '';
  if (lugar === 'perfil') return suya;
  if (lugar === 'vs' || lugar === 'ficha') return suya || fondoOpcion(fo, 'bandera', quien);
  return '';
}
/** 🖤 SÓLO LO QUE ES SUYO (25/11/2026, Dlx: «que por default sea el negro y que sólo los que tengan algo, que el
 *  automático ponga algo que tengan»): lo que eligió a propósito para `lugar`, o su imagen si la tiene; en Automático y sin
 *  imagen, nada ('') —el lugar queda como siempre—. Para los lugares donde, si todos tuvieran fondo, el fondo no diría
 *  nada: la fila del Ranking y las listas de gente */
export function fondoPropio(fo, lugar, quien) {
  const e = eleccion(fo, lugar);
  const mia = fo ? urlFondo(fo[0]) : '';
  if (e !== 'auto' && !(e === 'mia' && !mia)) return fondoOpcion(fo, e, quien);
  return mia && fo[1] ? mia : '';
}
