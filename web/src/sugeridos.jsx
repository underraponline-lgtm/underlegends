// ⭐ SEGUIR DE VERDAD (21/11/2026). Dlx: *«que la gente tenga más seguidores, seguidos»*, y que salga de con quién
// conversa cada uno en el chat. Se hace de verdad: la página SUGIERE y la persona sigue con un toque; nadie aparece
// siguiendo a otro sin haberlo hecho y no hay números inflados (la regla de los comentarios simulados). Tres piezas:
//   · GENTE PARA SEGUIR (Mi cuenta): quien te sigue y no sigues, con quien hablas en el chat de tu servidor (`ch` del
//     perfil, de la lectura diaria: `_charla()` de bot/subir_web.py), con quien te cruzaste en una llave (`rivales` del
//     lobby) y los primeros de tu servidor. Cada uno dice por qué
//   · BOTÓN SEGUIR, el mismo de todas partes (`alternarSigo()` de social.js): verificado para seguir, y sólo a verificados
//   · LA LIGA TE SIGUE: los personajes de la Liga (El Hype, ULAYA, El Jurado) siguen a la vista, con su pastilla y aparte
//     del número: El Jurado a quien hizo podio, ULAYA a quien ganó una llave, El Hype a quien recién empieza
import { useState } from 'react';
import { limpio } from './liga.js';
import { Cara, accion } from './piezas.jsx';
import CSS_PAGINA from './css/sugeridos.css?inline';
import { usarCss } from './css.js';
import { PJ } from './comentarios.jsx';

usarCss('sugeridos', CSS_PAGINA);
const W = typeof window !== 'undefined' ? window : {};

/** ⭐ Seguir / Siguiendo, con la regla de siempre: entrar, estar verificado, y que el otro también lo esté */
export function BotonSeguir({ liga, dc: dc0, k, de = false, chico = false }) {
  const [msg, setMsg] = useState('');
  // sin `dc` (la llave no lo pasa), el de la página
  const dc = dc0 === undefined ? W.DC || null : dc0;
  const si = liga.sigo(k);
  const f = liga.quienK(k);
  const tocar = () => {
    if (!si) {
      if (!dc) { accion.entrar(); return; }
      if (!dc.rapero) { setMsg('Verifícate para seguir'); return; }
      if (f && f.nv) { setMsg('Todavía no está verificado'); return; }
    }
    setMsg('');
    if (typeof W.alternarSigo === 'function') W.alternarSigo(k);
  };
  return (
    <span className="sg-bc">
      <button type="button" className={'sg-b' + (si ? ' on' : '') + (chico ? ' chico' : '')} aria-pressed={si} onClick={tocar}>
        {si ? '✓ Siguiendo' : de ? 'Seguir de vuelta' : '+ Seguir'}</button>
      {msg ? <small className="sg-msg" role="status">{msg}</small> : null}
    </span>
  );
}

/** Los que la página te sugiere seguir, con el porqué, sin los que ya sigues ni los que no están verificados */
export function sugeridos(liga, P, meSiguen, tope = 6, excluir = []) {
  const yo = liga.yo && liga.yo.k;
  if (!yo) return [];
  const out = [], vistos = new Set([yo, ...excluir]);
  const suma = (k, por, de = false) => {
    if (!k || vistos.has(k) || out.length >= tope) return;
    const f = liga.quienK(k);
    if (!f || f.nv || liga.sigo(k)) return;
    vistos.add(k);
    out.push({ k, f, por, de });
  };
  // 1 · te sigue y no lo sigues
  for (const k of (meSiguen && meSiguen.perfiles) || []) suma(k, 'Te sigue', true);
  // 2 · hablan seguido en el chat (de la lectura diaria del chat de cada servidor)
  const mio = P && P.p && P.p[yo];
  for (const k of (mio && mio.ch) || []) suma(k, 'Hablan en el chat');
  // 3 · te cruzaste con él en una llave (el cara a cara de la temporada)
  const cruces = [];
  for (const [par, c] of Object.entries((liga.d && liga.d.rivales) || {})) {
    const [a, b] = par.split('|');
    if (a !== yo && b !== yo) continue;
    const otro = a === yo ? b : a;
    cruces.push([otro, (c[yo] || 0) + (c[otro] || 0), c[yo] || 0, c[otro] || 0]);
  }
  cruces.sort((x, y) => y[1] - x[1]);
  for (const [k, n, g, p] of cruces) suma(k, n === 1 ? 'Se cruzaron una vez' : 'Se cruzaron ' + n + ' veces · ' + g + '-' + p);
  // 4 · los primeros de tu servidor
  const sv = liga.yo.sv;
  if (sv) {
    const del = Object.values(liga.T || {}).filter((f) => f && f.sv === sv && f.k).sort((x, y) => (x.pos || 9999) - (y.pos || 9999));
    for (const f of del) suma(f.k, 'De ' + sv + ' · #' + (f.pos || '—'));
  }
  return out;
}

export function GenteParaSeguir({ liga, dc, P, meSiguen, excluir }) {
  const xs = sugeridos(liga, P, meSiguen, 6, excluir);
  if (!xs.length) return null;
  return (
    <ul className="sg-lista" aria-label="Gente para seguir">
      {xs.map((x) => (
        <li key={x.k}>
          <a href={'#/r/' + encodeURIComponent(x.k)} className="sg-q"><Cara liga={liga} k={x.k} nombre={x.f.n} cls="sg-av" />
            <span><b>{limpio(x.f.n)}</b><small>{x.por}</small></span></a>
          <BotonSeguir liga={liga} dc={dc} k={x.k} de={x.de} chico />
        </li>
      ))}
    </ul>
  );
}

// 🤖 LA LIGA TE SIGUE: a la vista y aparte del número (no son personas). La regla sale de lo que esa fila ya dice
const LIGA_SIGUE = [
  ['ej', 'El Jurado', (f) => (f.pod || 0) > 0, 'porque hiciste podio esta temporada'],
  ['ul', 'ULAYA', (f) => (f.oro || 0) > 0, 'porque ganaste una llave esta temporada'],
  ['eh', 'El Hype', (f) => (f.ev || 0) > 0 && (f.ev || 0) <= 3, 'porque recién empiezas'],
];
/** Los personajes de la Liga que siguen a esa fila: `[[clave, nombre, porqué], …]` */
export function ligaSigue(f) {
  return f ? LIGA_SIGUE.filter((x) => x[2](f)).map((x) => [x[0], x[1], x[3]]) : [];
}
export function LigaTeSigue({ f, yo = false }) {
  const xs = ligaSigue(f);
  if (!xs.length) return null;
  const nombres = xs.map((x) => x[1]);
  const txt = nombres.length > 1 ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1] : nombres[0];
  return (
    <span className="sg-liga" title={xs.map((x) => x[1] + ' ' + (yo ? x[2] : x[2].replace('hiciste', 'hizo').replace('ganaste', 'ganó').replace('empiezas', 'empieza'))).join(' · ')}>
      <span className="sg-liga-c" aria-hidden="true">{xs.map((x) => <i key={x[0]} style={{ background: (PJ[x[0]] || [])[1] }}>{(PJ[x[0]] || ['LG'])[0]}</i>)}</span>
      <span><em>Liga</em> {txt} {xs.length > 1 ? (yo ? 'te siguen' : 'lo siguen') : (yo ? 'te sigue' : 'lo sigue')}</span>
    </span>
  );
}


/** 🏆 después de un evento (la llave, en tu camino): tus rivales de esa noche que todavía no sigues */
export function SigueRivales({ liga, ks }) {
  const yo = liga.yo && liga.yo.k;
  const xs = [...new Set(ks)].filter((k) => k && k !== yo && liga.quienK(k) && !liga.quienK(k).nv && !liga.sigo(k)).slice(0, 5);
  if (!yo || !xs.length) return null;
  return (
    <div className="sg-rivales"><b>Sigue a tus rivales de esta noche</b>
      <ul className="sg-lista">{xs.map((k) => (
        <li key={k}><a href={'#/r/' + encodeURIComponent(k)} className="sg-q"><Cara liga={liga} k={k} nombre={liga.quienK(k).n} cls="sg-av" />
          <span><b>{limpio(liga.quienK(k).n)}</b></span></a><BotonSeguir liga={liga} k={k} chico /></li>
      ))}</ul>
    </div>
  );
}
