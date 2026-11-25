// 🏆 LOS MES AWARDS, LO QUE COMPARTEN LAS PÁGINAS (02/11/2026): el pedido de `/api/salon`, cada nominado, la categoría
// que se vota y el reparto del cierre. Vivían en salon.jsx y los importaban la página de cada servidor, la Tienda y el
// Salón nuevo; borrar salon.jsx al publicar el remake los habría dejado sin de dónde salir (la crítica de la tanda 2).
// Acá no cambia nada de cómo se ven ni de cómo se vota: es el mismo código, mudado.
//
// Lo arma el ciclo (`bot/mes_awards.py`) y se pide al abrir el Salón (`/api/salon`): no viaja en el lobby. Se vota con
// las mismas reglas que El Elegido y el ×2 (`accion.votar`, `enc` de App.jsx): un voto por cuenta y por categoría, se
// cambia hasta que cierra, y afuera se ve cuántos, nunca quién
import { Fragment, useEffect, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Cara } from './piezas.jsx';
import { FondoPropio } from './fondo_propio.jsx';
import { Miniatura } from './video.jsx';

const SAL = { d: null, pedido: 0, oyentes: new Set() };
function pedirSalon() {
  if (Date.now() - SAL.pedido < 120000) return;
  SAL.pedido = Date.now();
  fetch('/api/salon', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.cats) { SAL.d = d; SAL.oyentes.forEach((f) => f()); } })
    .catch(() => { /* sin esto, el Salón sigue sin los MES AWARDS */ });
}
export function useSalon() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    SAL.oyentes.add(f);
    pedirSalon();
    return () => { SAL.oyentes.delete(f); };
  }, []);
  return SAL.d;
}

// 🪪 EL NOMBRE, LA CLAVE Y LA LÍNEA DE CADA NOMINADO, EN UN SOLO LUGAR (17/11/2026): los usan `Nominado` (las listas) y
// las tarjetas de votar de mesvoto.jsx, que dibujan otra cosa (la carta, el video) con el mismo texto. `k`: la clave de
// la persona en la tabla, o '' (una batalla, un servidor, alguien fuera de la tabla)
export function nomTexto(liga, cat, x) {
  // 🏆 las de «Ver las demás nominaciones» (bot/mes_otros.py) y el Staff de cada servidor traen su línea hecha (`d`)
  if (x.d !== undefined) {
    const fq = x.q ? liga.quien(x.q) : null;
    // 🪪 el nombre de la Lista, no el alias con que llegó (17/11/2026): «Over» es AKA de Mr Still Ballin y la misma
    // página lo mostraba con los dos nombres. Rapero y Revelación ya pasaban por `liga.quien()`; acá sólo cuando el
    // nominado ES la persona (n = q) o un cruce «A vs B», nunca el título de una promo o una publicación
    const nb = x.q && x.n === x.q ? (fq ? fq.n : x.n)
      : x.q && / vs /.test(x.n) ? x.n.split(' vs ').map((s) => (liga.quien(s) || {}).n || s).join(' vs ') : x.n;
    return { k: fq ? fq.k : '', n: limpio(nb), d: x.d, q: x.q || x.n };
  }
  const f = (cat === 'rapero' || cat === 'revelacion') ? liga.quien(x.op) : null;
  const d = cat === 'batalla' ? siglaDe(x.sv) + ' · ' + num(x.vistas) + ' vistas'
    : cat === 'servidor' ? num(x.gente) + ' raperos · ' + num(x.ev) + ' eventos'
      : num(x.pts) + ' pts' + (x.oro ? ' · ' + x.oro + (x.oro === 1 ? ' título' : ' títulos') : '') + ' · ' + x.ev + (x.ev === 1 ? ' evento' : ' eventos');
  return { k: f ? f.k : '', n: cat === 'batalla' ? limpio(x.n) : f ? limpio(f.n) : limpio(x.n), d, q: x.n };
}

// cada nominado: su cara (o la miniatura de la batalla, o el escudo del servidor), su nombre y su número del mes
export function Nominado({ liga, cat, x }) {
  const t = nomTexto(liga, cat, x);
  // 🏆 las de «Ver las demás nominaciones» traen qué se ve: un video, una imagen, el escudo del servidor, la bandera o
  // la cara de `q`
  // 🔎 la miniatura grande (`Miniatura`, 1280×720) en vez de la de 320×180
  const vis = x.d !== undefined ? (x.vid ? <Miniatura vid={x.vid} cls="ma-vid" />
    : x.img ? <img className="ma-vid" alt="" src={x.img} loading="lazy" />
      : x.cc ? <img className="ma-cara ma-flag" alt="" src={'/banderas/g/' + x.cc + '.webp'} />
        : x.sv && !x.q ? <img className="ma-cara" alt="" src={liga.logo(x.sv)} />
          : <Cara liga={liga} k={t.k} nombre={t.q} cls="ma-cara" />)
    : cat === 'batalla' ? <Miniatura vid={x.op} cls="ma-vid" />
      : cat === 'servidor' ? <img className="ma-cara" alt="" src={liga.logo(x.op)} />
        : <Cara liga={liga} k={t.k} nombre={x.n} cls="ma-cara" />;
  // 🪪 y su perfil, si es una persona (17/11/2026, Dlx: «hazlo más bonito con su foto y su cuenta»)
  return <>{t.k && cat !== 'batalla' && cat !== 'servidor' ? <FondoPropio liga={liga} k={t.k} /> : null}{vis}<span className="ma-t"><b>{t.k ? <a href={'#/r/' + encodeURIComponent(t.k)}>{t.n}</a> : t.n}</b><small>{t.d}</small></span></>;
}

// (la `Categoria` que se votaba acá se fue el 17/11/2026: el Salón y la página de cada servidor votan con las tarjetas
// de mesvoto.jsx)

// 📊 los porcentajes del cierre (Dlx, 18/10/2026: «me gusta lo de porcentajes»): el ganador y los que le siguen, como
// publican los FMS AWARDS. Sólo si se decidió por votos: si fue por los números, no hay reparto que mostrar
export function reparto(x, liga) {
  const cu = x.cuenta || {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  if (x.por !== 'votos' || !tot) return null;
  // 🪪 con el nombre de la Lista, como `Nominado` (17/11/2026): el nominado puede venir con su alias
  const nom = (op) => {
    const y = (x.nom || []).find((z) => z.op === op) || {};
    const n = y.n || op;
    const f = liga && (y.q ? n === y.q : !y.vid && !y.sv && !y.cc && !y.img && y.pts !== undefined) ? liga.quien(n) : null;
    return limpio(f ? f.n : n);
  };
  const orden = Object.keys(cu).sort((a, b) => cu[b] - cu[a]).slice(0, 4);
  return (
    <small className="ma-pct">{orden.map((op, i) => (
      // cada opción entera en su renglón y el «·» al final del de arriba, nunca al principio (16/11: los cortes de línea)
      <Fragment key={op}>{i ? '\u00a0· ' : ''}<span className="ma-rop">{op === x.gana ? <b>{nom(op)} {Math.round((100 * cu[op]) / tot)}%</b> : nom(op) + ' ' + Math.round((100 * cu[op]) / tot) + '%'}</span></Fragment>
    ))}{'\u00a0· ' + tot + (tot === 1 ? '\u00a0voto' : '\u00a0votos')}</small>
  );
}
