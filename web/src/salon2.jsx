// 🏛️ EL SALÓN DE LA FAMA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo
// día («Publica y haz todo»), en lugar de salon.jsx. Lo mismo, con lo que dejó el research de 21st
// (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - LOS NÚMEROS DE ARRIBA LLEVAN A SU SECCIÓN, y un índice pegado arriba.
// - LOS RÉCORDS CON EL NÚMERO PRIMERO, agrupados (la temporada, los títulos, los duelos, los eventos), y quién tiene más.
// - LAS INSIGNIAS CON SU RAREZA en palabras (única, muy rara, rara, escasa) y las caras juntas.
// - FIGURAS Y REVELACIONES, una fila por semana.
// ⚠️ NO CALCULA NADA NUEVO: lo mismo que salon.jsx (los récords del lobby, las insignias de `/api/perfiles`, `/api/salon`).
//
// 🏆 Y DESDE EL 17/11/2026, LA «D» (Dlx la eligió de la maqueta del remake de los MES AWARDS). Desde noviembre cada mes
// es de cada servidor y lo de toda la Liga va a una gala al cierre de la temporada (`sv_desde` y `gala` de /api/salon,
// bot/mes_awards.py), así que la página se arma según el momento del mes:
// - MIENTRAS SE VOTA (y el día que salen los nominados), ABRE CON LA VOTACIÓN: la de tu servidor, con la franja blanca
//   de cuántas votaste y el Cajón de discos por votarlas todas (mesvoto.jsx, la misma que en la página del servidor).
// - EL RESTO DEL MES, ABRE CON LA VITRINA: quién va primero para ser campeón de la temporada, con sus cartas.
// - SIEMPRE, LA TEMPORADA MES A MES: la regla OCT · NOV · DIC · GALA y la grilla servidores × meses con el ganador de
//   cada uno; tocar uno abre sus ganadores debajo. Octubre, el único mes de toda la Liga, queda en su fila.
// - LO DEMÁS DEL SALÓN EN PESTAÑAS (récords, insignias, ligas, figuras, el Pase): eran seis bloques apilados, 6.584 px en
//   la compu y 14.139 en el celular, y la mitad eran insignias de los MES AWARDS (ahora no van: ya están en la grilla).
// 🏆 Y LA GALA DE LA TEMPORADA (17/11/2026), lo de toda la Liga al cierre (`gala` de /api/salon): con los nominados afuera
// la página ABRE CON LA GALA (le gana al mes: los de diciembre de cada servidor se votan los mismos días y van debajo); ya
// cerrada, sus ganadores van arriba los 30 días que sigue en el payload; y antes, la última columna de la grilla dice
// cuándo salen sus nominados y qué se lleva cada ganador.
import { useEffect, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe } from './liga.js';
import { Cara, Carta, Ico, usePerfiles } from './piezas.jsx';
import { usePases } from './pase.js';
import { SelloPremium, esPremium } from './sello.jsx';
import { Nominado, nomTexto, reparto, useSalon } from './mesawards.jsx';
import { CatCompacta, CatVoto, CatsSv, ChipsSv, Franja, FranjaGala, QUIEN_VOTA, QUIEN_VOTA_GALA, deTemporada, mayus, mesDe, premiosGala } from './mesvoto.jsx';
import { svElegido, useElegidos } from './elegidos.js';
import { useIndice } from './indice.js';
import CSS_PAGINA from './css/salon2.css?inline';
import { usarCss } from './css.js';
import FondoVideo from './fondovideo.jsx';

usarCss('salon2', CSS_PAGINA);

const DIFICIL = 25;
const VER_CARAS = 6;
// «Temporada 1» no se parte: «TEMPORADA / 1» dejaba el número solo (16/11)
const nombreTemp = (t) => (!t || /prueba/i.test(t) ? 'Temporada 1' : 'Temporada ' + String(t).replace(/^t/i, ''));
const tempDe = (liga) => (liga.temp && !/prueba/i.test(liga.temp) ? liga.temp.toUpperCase() : 'T1');
function diaSin(d) {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  return y && m && dd ? dd + ' de ' + MESES[m - 1] : '';
}
const diaSemana = (d) => {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  return y ? DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] : '';
};
// 👥 la cara y el nombre de quien sea, también de los que quedan fuera de las 200 de la tabla (18/11/2026): miraban sólo
// `liga.T`, y en las insignias (que salen de los 856 de /api/perfiles) «Joven shenlong» salía con la inicial y con su
// clave («jovenshenlong») como nombre. `quienK()`/`nombreDe()` buscan también en los perfiles y en los de fuera
function Persona({ liga, k, n, cls = 'sl-cara' }) {
  const f = k && liga.quienK(k);
  return <Cara liga={liga} k={f ? k : ''} nombre={(f && f.n) || n || k || '?'} cls={cls} />;
}
const nomDe = (liga, k, n) => liga.nombreDe(k, n);
// bajar hasta algo de adentro del shadow root
const raiz = () => { const h = document.getElementById('inicio-nuevo'); return h && h.shadowRoot; };

// cuánto se llevó el ganador, en las de la lista corta (el reparto entero va en las cuatro principales). Sólo si se
// decidió por votos, como `reparto()`
function pctGana(x) {
  const cu = x.cuenta || {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  return x.por === 'votos' && tot ? <em>{Math.round((100 * (Number(cu[x.gana]) || 0)) / tot)}%</em> : null;
}

// ── 🏆 LOS MES AWARDS, MES A MES ────────────────────────────────────────────────────────────────────────────────────
// la fila de toda la Liga en la grilla: octubre fue el único mes de la Liga entera (`sv_desde`), y sus ganadores siguen
const LIGA = '__liga';
const sigMes = (m) => { const [y, mm] = m.split('-').map(Number); return mm === 12 ? (y + 1) + '-01' : y + '-' + String(mm + 1).padStart(2, '0'); };
const mesCorto = (m) => mesDe(m).slice(0, 3).toUpperCase();
// los nominados de un mes salen el día 1 del siguiente
const diaNom = (m) => '1/' + Number(sigMes(m).slice(5, 7));
// «vie 4» y «vie 1/1», en la zona de quien mira
function diaCorto(liga, t, conMes) {
  const d = liga.diaClave(t);
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()].slice(0, 3) + ' ' + dd + (conMes ? '/' + m : '');
}

// los meses de la temporada que corre: desde el primero con MES AWARDS hasta el del cierre (los que faltan, también)
function mesesTemp(liga, S) {
  const fase = liga.d.fase || {};
  const ini = String(fase.arranca || '').slice(0, 7);
  const fin = String(fase.termina || '').slice(0, 7);
  const hay = (S.hist || []).map((m) => m.mes).concat([S.abierto && S.abierto.mes, S.vivo && S.vivo.mes])
    .filter((m) => m && (!ini || m >= ini) && (!fin || m <= fin)).sort();
  if (!hay.length) return [];
  const hasta = fin && fin > hay[hay.length - 1] ? fin : hay[hay.length - 1];
  const out = [hay[0]];
  while (out[out.length - 1] < hasta && out.length < 12) out.push(sigMes(out[out.length - 1]));
  return out;
}
const datosMes = (S, m) => (S.hist || []).find((x) => x.mes === m) || (S.abierto && S.abierto.mes === m ? S.abierto : null);
function estadoMes(S, m) {
  if ((S.hist || []).some((x) => x.mes === m)) return 'cerrado';
  if (S.abierto && S.abierto.mes === m) return S.abierto.votando ? 'votando' : 'nominados';
  if (S.vivo && S.vivo.mes === m) return 'corre';
  return 'luego';
}
// las categorías con nominados de un servidor (o de la Liga) en un mes, como [clave, nombre, de qué]
function catsDe(S, md, sv) {
  if (!md) return [];
  if (sv === LIGA) return (S.cats || []).filter(([c]) => ((((md.cats || {})[c] || {}).nom) || []).length);
  const s = (md.sv || {})[sv];
  return s ? (S.cats_sv || []).filter(([c]) => ((((s.cats || {})[c] || {}).nom) || []).length) : [];
}
const xDe = (md, sv, c) => (sv === LIGA ? (md.cats || {})[c] : (((md.sv || {})[sv] || {}).cats || {})[c]) || {};

// los servidores de los MES AWARDS: los Tier 1 de hoy y cualquiera que tenga algo en un mes (uno que cambió de tier sigue
// en el archivo con lo que ganó). En el orden del payload: el que más se mueve primero
function svsAwards(liga, S) {
  const con = new Set();
  (S.hist || []).concat(S.abierto ? [S.abierto] : []).forEach((m) => Object.keys(m.sv || {}).forEach((x) => con.add(x)));
  return Object.values(liga.svs || {}).filter((s) => s.tier === 1 || con.has(s.sv)).map((s) => s.sv);
}
// 🏠 «tu servidor»: el que elegiste en Mi cuenta; si no, donde más jugaste (el de tu carta de Servidor, `liga.yo.sv`),
// como `PnServidor` del panel. Sin cuenta (o si el tuyo no tiene MES AWARDS), el Tier 1 que más se mueve
function tuSv(liga, el, svs) {
  const yo = liga.yo;
  const p = yo ? svElegido(liga, el, yo.k) || yo.sv : '';
  if (p && svs.includes(p)) return p;
  return svs.map((x) => liga.svs[x]).filter((s) => s && s.tier === 1)
    .sort((a, b) => (b.ev || 0) - (a.ev || 0) || (b.n || 0) - (a.n || 0)).map((s) => s.sv)[0] || svs[0] || '';
}

// 🏆 la gala, según el momento: 'antes' (sin nominados), 'nominados' (salieron, todavía no se vota), 'vota' o 'cerrada'.
// `de`: la gala del payload es la de ESTA temporada (la grilla y la regla son de la temporada que corre: la de la anterior,
// cerrada, sigue 30 días en el payload y va sólo en su bloque de ganadores)
function estadoGala(liga, S) {
  const g = (S && S.gala) || null;
  const de = !!(g && String(g.temp || '').toUpperCase() === tempDe(liga));
  const e = !g ? '' : g.cerrado && g.cats ? 'cerrada' : g.abre && g.cats ? (g.votando ? 'vota' : 'nominados') : 'antes';
  return { g, e, de };
}
// el ganador del Rapero de la temporada, en una gala cerrada
function raperoGala(liga, g) {
  const x = ((g && g.cats) || {}).rapero || {};
  const f = (x.nom || []).find((y) => y.op === x.gana);
  return f ? nomTexto(liga, 'rapero', f) : null;
}

// lo que va en una celda de la grilla (y en una fila del celular): el ganador, los nominados o la fecha
function infoCelda(liga, S, sv, m) {
  const e = estadoMes(S, m);
  if (e === 'corre' || e === 'luego') return { tipo: 'fecha', txt: diaNom(m) };
  const md = datosMes(S, m);
  const cs = catsDe(S, md, sv);
  if (!cs.length) return { tipo: 'nada' };
  const [c, nc] = cs[0];
  const x = xDe(md, sv, c);
  if (e === 'cerrado') {
    const f = (x.nom || []).find((y) => y.op === x.gana) || x.nom[0];
    return { tipo: 'gana', c, nc, t: nomTexto(liga, c, f), mas: cs.length - 1 };
  }
  return { tipo: 'nom', c, caras: x.nom.slice(0, 5).map((y) => nomTexto(liga, c, y)), vota: e === 'votando' };
}
function CuerpoCelda({ liga, i, corto }) {
  if (i.tipo === 'gana') {
    return <><Cara liga={liga} k={i.t.k} nombre={i.t.q} cls="sd-mini" /><b>{i.t.n}</b>
      {corto ? <small>{i.nc}</small> : i.mas ? <small>+{i.mas}</small> : null}</>;
  }
  if (i.tipo === 'nom') {
    return <><span className="sd-apila">{i.caras.map((t, j) => <Cara key={j} liga={liga} k={t.k} nombre={t.q} cls="sd-mini" />)}</span>
      <span className="sd-vivo">{i.vota ? 'Votando' : 'Nominados'}</span></>;
  }
  return i.tipo === 'fecha' ? <span className="sd-nada">{corto ? 'Nominados el ' + i.txt : i.txt}</span>
    : <span className="sd-nada"><span aria-hidden="true">—</span><span className="sd-sr">sin premios</span></span>;
}
const nombreFila = (liga, sv) => (sv === LIGA ? 'La Liga' : siglaDe(sv));
function CabFila({ liga, sv }) {
  return sv === LIGA ? <><span className="sd-copa-ic" aria-hidden="true"><Ico n="copa" t={16} /></span><span>La Liga</span></>
    : <><img alt="" src={liga.logo(sv)} /><span>{siglaDe(sv)}</span></>;
}
const colorFila = (liga, sv) => (sv === LIGA ? '#E5B800' : (liga.svs[sv] || {}).color || 'transparent');

// la regla de la temporada: cada mes con lo que pasa ahí, el de ahora en blanco y la gala al final
function Regla({ liga, S, meses, actual, mesVer, onMes, onGala }) {
  const G = estadoGala(liga, S);
  const g = G.de ? G.g : null;
  const temp = (g && g.temp) || tempDe(liga);
  const gr = g && G.e === 'cerrada' ? raperoGala(liga, g) : null;
  // la celda de la gala: cuándo salen los nominados; ya nominada, se vota o cierra (en dorado, como el mes de ahora en
  // blanco); cerrada, quién ganó el Rapero de la temporada
  const galaTx = !g ? 'Al cierre · la Liga Global'
    : G.e === 'vota' ? 'Votando · cierra ' + diaCorto(liga, g.cierra)
      : G.e === 'nominados' ? 'Nominados · se vota el ' + diaCorto(liga, g.abre)
        : G.e === 'cerrada' ? 'Cerrada' + (gr ? ' · ganó ' + gr.n : '')
          : (g.nominados ? 'Nominados ' + diaCorto(liga, g.nominados, true) : 'Al cierre') + ' · la Liga Global';
  const galaC = <><b>GALA {temp}</b><small>{galaTx}</small></>;
  return (
    <ol className="sd-regla" style={{ '--m': meses.length }} aria-label="Los meses de la temporada">
      {meses.map((m) => {
        const e = estadoMes(S, m);
        const md = datosMes(S, m);
        const nSv = md ? Object.keys(md.sv || {}).filter((x) => catsDe(S, md, x).length).length : 0;
        const conLiga = md && catsDe(S, md, LIGA).length;
        const txt = e === 'cerrado' ? (conLiga ? 'La Liga y ' : '') + nSv + (nSv === 1 ? ' servidor' : ' servidores') + ' · cerrado'
          : e === 'votando' ? 'Votando · cierra ' + diaCorto(liga, S.abierto.cierra)
            : e === 'nominados' ? 'Nominados · se vota el ' + diaCorto(liga, S.abierto.abre)
              : e === 'corre' ? 'Corre · nominados ' + diaNom(m) : 'Nominados ' + diaNom(m);
        const cuerpo = <><b>{mesCorto(m)}</b><small>{txt}</small></>;
        const cls = (m === actual ? 'sd-on' : e === 'cerrado' ? 'sd-ya' : '') + (m === mesVer ? ' sd-sel' : '');
        return (
          <li key={m} className={cls.trim() || undefined}>
            {e === 'corre' || e === 'luego' ? <span className="sd-rc">{cuerpo}</span>
              : <button type="button" className="sd-rc" aria-pressed={m === mesVer} aria-label={mayus(mesDe(m)) + ': ' + txt} onClick={() => onMes(m)}>{cuerpo}</button>}
          </li>
        );
      })}
      <li className={'sd-gl' + (G.e === 'vota' || G.e === 'nominados' ? ' sd-gl-on' : '')}>
        {g && G.e !== 'antes' ? <button type="button" className="sd-rc" onClick={onGala} aria-label={'La gala de la ' + temp + ': ' + galaTx}>{galaC}</button>
          : <span className="sd-rc">{galaC}</span>}</li>
    </ol>
  );
}

// 🏆 lo que se lleva cada ganador de la gala: [quiénes, qué], de su `drop`
function PremiosGala({ g, cls = '' }) {
  const ps = premiosGala(g);
  return ps.length ? <ul className={'sd-premios ' + cls}>{ps.map(([q, que]) => <li key={q}><b>{q}</b> · {que}</li>)}</ul> : null;
}
// la gala, en la última columna (y en el celular, debajo de las filas): antes, cuándo salen sus nominados, sus cuatro
// principales y los premios; nominada o votándose, sus nominados al Rapero y el botón a votar; cerrada, el Rapero de la
// temporada y el botón a los ganadores
function Gala({ liga, S, onGala }) {
  const G = estadoGala(liga, S);
  const g = G.de ? G.g : null;
  const temp = (g && g.temp) || tempDe(liga);
  const fin = (liga.d.fase || {}).termina;
  const princ = (S.cats || []).filter((c) => !c[3]);
  if (g && (G.e === 'vota' || G.e === 'nominados')) {
    const nom = ((g.cats.rapero || {}).nom || []).slice(0, 5).map((y) => nomTexto(liga, 'rapero', y));
    return (
      <>
        <b>Gala {temp}</b>
        <small>{G.e === 'vota' ? 'Se vota hasta el ' + diaCorto(liga, g.cierra, true) + '. ' + QUIEN_VOTA_GALA : 'Salieron los nominados: se vota desde el ' + diaCorto(liga, g.abre, true) + '.'}</small>
        {nom.length ? <span className="sd-apila">{nom.map((t, j) => <Cara key={j} liga={liga} k={t.k} nombre={t.q} cls="sd-mini" />)}</span> : null}
        <button type="button" className="sd-gala-ir" onClick={onGala}>{G.e === 'vota' ? 'Votar la gala →' : 'Ver los nominados →'}</button>
      </>
    );
  }
  if (g && G.e === 'cerrada') {
    const t = raperoGala(liga, g);
    return (
      <>
        <b>Gala {temp}</b>
        {t ? <span className="sd-gala-r"><Cara liga={liga} k={t.k} nombre={t.q} cls="sd-cara" /><span><small>Rapero de la temporada</small><strong>{t.n}</strong></span></span> : null}
        <button type="button" className="sd-gala-ir" onClick={onGala}>Ver los ganadores →</button>
      </>
    );
  }
  return (
    <>
      <b>Gala {temp}</b>
      <small>La Liga Global, con toda la temporada.{g && g.nominados ? ' Los nominados salen el ' + diaCorto(liga, g.nominados, true) + '.'
        : fin ? ' Al cierre, el ' + diaSin(fin) + '.' : ''}</small>
      {princ.length ? <ul>{princ.map(([c, n]) => <li key={c}>{deTemporada(n)}</li>)}</ul> : null}
      <PremiosGala g={g} />
    </>
  );
}

// la grilla servidores × meses (en la compu)
function Grilla({ liga, S, meses, filas, ver, mesVer, onGana, onVota, onGala }) {
  const desde = S.sv_desde || '';
  const celda = (sv, m) => {
    const i = infoCelda(liga, S, sv, m);
    const sel = !!(ver && ver.sv === sv && ver.mes === m);
    const lbl = nombreFila(liga, sv);
    const b = i.tipo === 'gana' ? <button type="button" className="sd-gb" aria-pressed={sel} onClick={() => onGana(sv, m)}
      aria-label={'Los ganadores de ' + lbl + ' en ' + mesDe(m)}><CuerpoCelda liga={liga} i={i} /></button>
      : i.tipo === 'nom' ? <button type="button" className="sd-gb" onClick={() => onVota(sv)} aria-label={'Los nominados de ' + lbl + ' en ' + mesDe(m)}>
        <CuerpoCelda liga={liga} i={i} /></button> : <CuerpoCelda liga={liga} i={i} />;
    return <span key={m} role="cell" className={'sd-gc' + (sel ? ' sd-sel' : '') + (i.tipo === 'fecha' || i.tipo === 'nada' ? ' sd-tenue' : '')}>{b}</span>;
  };
  return (
    <div className="sd-grilla" role="table" aria-label="Los MES AWARDS de cada servidor, mes a mes" style={{ '--m': meses.length }}>
      <div role="row" className="sd-gr">
        <span role="columnheader" className="sd-gc sd-gh">Servidor</span>
        {meses.map((m) => <span key={m} role="columnheader" className={'sd-gc sd-gh' + (m === mesVer ? ' sd-mv' : '')}>{mayus(mesDe(m))}</span>)}
        <span role="columnheader" className="sd-gc sd-gh">La gala</span>
      </div>
      {filas.map((sv, i) => {
        // la Liga desde `sv_desde`: una sola celda que dice adónde se fue
        const hasta = sv === LIGA && desde ? meses.filter((m) => m < desde) : meses;
        const resto = meses.length - hasta.length;
        return (
          <div role="row" className="sd-gr" key={sv}>
            <span role="rowheader" className="sd-gc sd-gs" style={{ '--c': colorFila(liga, sv) }}><CabFila liga={liga} sv={sv} /></span>
            {hasta.map((m) => celda(sv, m))}
            {resto ? <span role="cell" className="sd-gc sd-tenue sd-gl-va" style={{ gridColumn: 'span ' + resto }}>
              <span className="sd-nada">Desde {mesDe(desde)}, lo de toda la Liga va a la gala</span></span> : null}
            {i === 0 ? <span role="cell" className="sd-gc sd-gala" style={{ gridRow: '2 / span ' + filas.length, gridColumn: meses.length + 2 }}>
              <Gala liga={liga} S={S} onGala={onGala} /></span> : null}
          </div>
        );
      })}
    </div>
  );
}

// en el celular, un servidor por fila con el mes elegido en la regla
function Filas({ liga, S, filas, mesVer, ver, onGana, onVota }) {
  const e = estadoMes(S, mesVer);
  const md = datosMes(S, mesVer);
  const xs = filas.filter((sv) => sv !== LIGA || catsDe(S, md, LIGA).length);
  return (
    <div className="sd-filas">
      <p className="sd-filas-t">{mayus(mesDe(mesVer))} · {e === 'cerrado' ? 'toca un servidor para ver sus ganadores' : e === 'votando' ? 'se vota en cada servidor' : 'los nominados de cada servidor'}</p>
      <ul>{xs.map((sv) => {
        const i = infoCelda(liga, S, sv, mesVer);
        const sel = !!(ver && ver.sv === sv && ver.mes === mesVer);
        const cuerpo = <><span className="sd-fl-s"><CabFila liga={liga} sv={sv} /></span><span className="sd-fl-c"><CuerpoCelda liga={liga} i={i} corto /></span></>;
        return (
          <li key={sv} style={{ '--c': colorFila(liga, sv) }} className={sel ? 'sd-sel' : undefined}>
            {i.tipo === 'gana' ? <button type="button" aria-pressed={sel} onClick={() => onGana(sv, mesVer)}>{cuerpo}</button>
              : i.tipo === 'nom' ? <button type="button" onClick={() => onVota(sv)}>{cuerpo}</button> : <div>{cuerpo}</div>}
          </li>
        );
      })}</ul>
    </div>
  );
}

// los ganadores de octubre de toda la Liga (el único mes de la Liga entera): las cuatro con su reparto, y las demás
function ArchivoLiga({ liga, S, m }) {
  const filas = (S.cats || []).map(([c, n, , tipo]) => {
    const x = (m.cats || {})[c] || {};
    const f = (x.nom || []).find((y) => y.op === x.gana);
    return f ? { c, n, tipo, x, f } : null;
  }).filter(Boolean);
  const resto = filas.filter((y) => y.tipo);
  return (
    <div className="sd-archivo sl-hm" id="sl-archivo">
      <h3 className="sd-panel-t">La Liga Global · {m.nombre} · los ganadores</h3>
      {S.sv_desde && m.mes < S.sv_desde ? <p className="sd-arch-n">{mayus(m.nombre)} fue el único mes de toda la Liga: desde {mesDe(S.sv_desde)}, cada mes es de
        cada servidor y lo de toda la Liga va a la gala.</p> : null}
      <ul>{filas.filter((y) => !y.tipo).map(({ c, n, x, f }) => (
        <li key={c}><span className="sl-sello">{n}</span><span className="sl-nom"><Nominado liga={liga} cat={c} x={f} /></span>{reparto(x, liga)}</li>
      ))}</ul>
      {resto.length ? (
        <ul className="sl-hm-resto">{resto.map(({ c, n, x, f }) => (
          <li key={c}><small>{n}</small><span className="sl-nom"><Nominado liga={liga} cat={c} x={f} /></span>{pctGana(x)}</li>
        ))}</ul>
      ) : null}
    </div>
  );
}
// los ganadores de un servidor en un mes cerrado: el ganador primero, con «GANÓ»
function Archivo({ liga, enc, S, ver }) {
  const md = ver ? (S.hist || []).find((x) => x.mes === ver.mes) : null;
  if (!md) return null;
  if (ver.sv === LIGA) return <ArchivoLiga liga={liga} S={S} m={md} />;
  const s = liga.svs[ver.sv] || {};
  return (
    <div className="sd-archivo" id="sl-archivo">
      <h3 className="sd-panel-t">{limpio(s.nombre) || siglaDe(ver.sv)} · {md.nombre} · los ganadores</h3>
      <CatsSv liga={liga} enc={enc} S={S} sv={ver.sv} m={md} cerrado />
    </div>
  );
}

// la sección mes a mes: (la franja de cuándo salen los nominados) la regla, la grilla o las filas y lo que se abrió
function MesAMes({ liga, enc, S, svs, ver, mesVer, onMes, onGana, onVota, onGala, franja }) {
  const meses = mesesTemp(liga, S);
  if (!meses.length) return null;
  const actual = S.abierto ? S.abierto.mes : S.vivo ? S.vivo.mes : '';
  const conLiga = meses.some((m) => catsDe(S, datosMes(S, m), LIGA).length);
  const filas = (conLiga ? [LIGA] : []).concat(svs);
  const mv = meses.includes(mesVer) ? mesVer : meses[0];
  return (
    <section className="sec negra sd-meses" id="sl-meses">
      {franja}
      <div className="sec-t"><h2>MES AWARDS</h2></div>
      <p className="sec-baj">Cada mes en cada servidor Tier 1, y al cierre de la temporada, la gala de toda la Liga.</p>
      <Regla liga={liga} S={S} meses={meses} actual={actual} mesVer={mv} onMes={onMes} onGala={onGala} />
      <Grilla liga={liga} S={S} meses={meses} filas={filas} ver={ver} mesVer={mv} onGana={onGana} onVota={onVota} onGala={onGala} />
      <div className="sd-meses-c">
        <Archivo liga={liga} enc={enc} S={S} ver={ver} />
        <Filas liga={liga} S={S} filas={filas} mesVer={mv} ver={ver} onGana={onGana} onVota={onVota} />
        {/* en el celular no hay grilla: la gala va acá, con lo mismo que su columna */}
        <div className="sd-gala-cel"><Gala liga={liga} S={S} onGala={onGala} /></div>
      </div>
    </section>
  );
}

// ── la votación, arriba: tu servidor, la franja y sus nominados ──
// `bajoGala`: va debajo de la gala (se votan los mismos días), así que lleva su título y quién vota
function Votacion({ liga, enc, S, svs, sv, propio, onSv, bajoGala }) {
  const ab = S.abierto;
  const cuenta = (x) => catsDe(S, ab, x).length;
  const s = liga.svs[sv] || {};
  return (
    <section className="sec negra sd-vota" id="sl-mes" aria-label={'Los MES AWARDS de ' + ab.nombre + ' en ' + siglaDe(sv)}>
      {bajoGala ? <>
        <div className="sec-t"><h2>MES AWARDS de {ab.nombre}</h2></div>
        <p className="sec-baj">Se votan los mismos días que la gala, cada servidor los suyos. {QUIEN_VOTA(siglaDe(sv), ab.nombre)}</p>
      </> : null}
      <Franja liga={liga} enc={enc} S={S} sv={sv} modo={ab.votando ? 'vota' : 'nominados'} />
      <ChipsSv liga={liga} svs={svs} sv={sv} onSv={onSv} cuenta={cuenta} etiqueta="Los nominados de cada servidor" />
      {propio && propio !== sv && !cuenta(propio) ? <p className="sd-aviso">{siglaDe(propio)} no tiene nominados en {ab.nombre}: mira los de los demás servidores.</p> : null}
      <div className="sd-panel">
        <h2 className="sd-panel-t">{limpio(s.nombre) || siglaDe(sv)} · {sv === propio && liga.yo ? 'tus nominados' : 'los nominados de ' + ab.nombre}</h2>
        {cuenta(sv) ? <CatsSv liga={liga} enc={enc} S={S} sv={sv} m={ab} votando={ab.votando} />
          : <p className="sd-vacio">{siglaDe(sv)} no tiene nominados en {ab.nombre}.</p>}
      </div>
    </section>
  );
}

// ── 🏆 la gala con los nominados afuera: la franja, las 4 principales en tarjetas y las otras 22, compactas ──
// ⚠️ Las otras 22 detrás de un botón, en la compu también: abiertas son ~1.500 px más (una fila por categoría) y la gala
// es lo primero de la página; las 4 principales, que son las del Flight case, quedan a la vista
function GalaVoto({ liga, enc, S, g }) {
  const [otras, setOtras] = useState(false);
  const vota = !!g.votando;
  const temp = String(g.temp || '').toLowerCase();
  const x = (c) => (g.cats || {})[c] || {};
  const encDe = (c) => (vota && (x(c).nom || []).length >= 2 ? 'mes:' + temp + ':' + c : '');
  const princ = (S.cats || []).filter((c) => !c[3] && (x(c[0]).nom || []).length);
  const resto = (S.cats || []).filter((c) => c[3] && (x(c[0]).nom || []).length);
  return (
    <section className="sec negra sd-vota" id="sl-gala" aria-label={'La gala de ' + g.nombre}>
      <FranjaGala liga={liga} enc={enc} S={S} modo={vota ? 'vota' : 'nominados'} />
      <div className="sd-panel">
        <h2 className="sd-panel-t">Las {princ.length} principales · {g.nombre}</h2>
        <div className="sd-cats">{princ.map(([c, n, de]) => (
          <CatVoto key={c} liga={liga} enc={enc} cat={c} nombre={deTemporada(n)} de={deTemporada(de)} x={x(c)} encId={encDe(c)} gala />
        ))}</div>
      </div>
      {resto.length ? (
        <>
          <div className="sd-otras-b">
            <button type="button" className="btn borde" aria-expanded={otras} aria-controls="sd-otras" onClick={() => setOtras((v) => !v)}>
              {otras ? 'Esconder las otras ' + resto.length : 'Ver las otras ' + resto.length}</button>
            <span>{resto.slice(0, 4).map(([, n]) => deTemporada(n).replace(/ de la temporada$/, '')).join(', ')} y más</span>
          </div>
          {otras ? (
            <div className="sd-panel" id="sd-otras">
              <h2 className="sd-panel-t">Las otras {resto.length}</h2>
              {resto.map(([c, n, de]) => <CatCompacta key={c} liga={liga} enc={enc} cat={c} nombre={deTemporada(n)} de={deTemporada(de)} x={x(c)} encId={encDe(c)} />)}
            </div>
          ) : null}
        </>
      ) : null}
      <PremiosGala g={g} cls="sd-premios-pie" />
    </section>
  );
}
// ── 🏆 la gala cerrada: sus ganadores, arriba, los 30 días que sigue en el payload ──
function GalaGanadores({ liga, enc, S, g }) {
  const x = (c) => (g.cats || {})[c] || {};
  const princ = (S.cats || []).filter((c) => !c[3] && (x(c[0]).nom || []).length);
  const resto = (S.cats || []).filter((c) => c[3]).map(([c, n]) => {
    const f = (x(c).nom || []).find((y) => y.op === x(c).gana);
    return f ? { c, n, f } : null;
  }).filter(Boolean);
  const cerro = g.cerrado ? liga.diaClave(g.cerrado) : '';
  return (
    <section className="sec negra sd-galaw" id="sl-gala">
      <div className="sec-t"><h2>Los ganadores de la gala de la {g.temp}</h2></div>
      <p className="sec-baj">Lo mejor de toda {g.nombre} en la Liga Global, votado por la gente{cerro ? ': cerró el ' + diaSin(cerro) : ''}.</p>
      <div className="sd-panel">
        <div className="sd-cats">{princ.map(([c, n, de]) => (
          <CatVoto key={c} liga={liga} enc={enc} cat={c} nombre={deTemporada(n)} de={deTemporada(de)} x={x(c)} cerrado gala />
        ))}</div>
      </div>
      {resto.length ? (
        <div className="sl-hm sd-galaw-resto">
          <h3 className="sd-panel-t">Las otras {resto.length}</h3>
          <ul className="sl-hm-resto">{resto.map(({ c, n, f }) => (
            <li key={c}><small>{deTemporada(n)}</small><span className="sl-nom"><Nominado liga={liga} cat={c} x={f} /></span>{pctGana(x(c))}</li>
          ))}</ul>
        </div>
      ) : null}
    </section>
  );
}

// ── la vitrina: quién va primero para ser campeón de la temporada, con sus cartas ──
// el #1 de la Temporada y el #1 del Competitivo de hoy (el Competitivo pide 10 eventos: sin letra no entra)
function primeros(liga) {
  const t = liga.d.tabla || [];
  return [t.filter((f) => f.pos && !f.fc).sort((a, b) => a.pos - b.pos)[0], t.filter((f) => f.rg && !f.fc).sort((a, b) => (b.sc || 0) - (a.sc || 0))[0]];
}
function Estante({ liga }) {
  const [tem, comp] = primeros(liga);
  if (!tem && !comp) return null;
  const fin = String((liga.d.fase || {}).termina || '');
  const cuando = fin ? 'se define el ' + Number(fin.slice(8, 10)) + '/' + Number(fin.slice(5, 7)) : 'al cierre';
  return (
    <div className="sd-estante">
      <span className="sd-est-t">Campeón de la {tempDe(liga)} · {cuando}</span>
      <div className="sd-est-dos">
        {[['#1 de la Temporada', tem, '#/ranking/temporada'], ['#1 del Competitivo', comp, '#/ranking/competitivo']].map(([q, f, href]) => (f ? (
          <figure key={q}>
            <Carta liga={liga} k={f.k} cual="temporada" cls="sd-est-ct" nombre={f.n} />
            <figcaption><a href={href}>{q} · va primero</a><a href={'#/r/' + encodeURIComponent(f.k)}><b>{limpio(f.n)}</b></a></figcaption>
          </figure>
        ) : null))}
      </div>
    </div>
  );
}

// lo que también se define al cierre de la temporada: los campeones de la Clausura y de la Superliga (los nombraba el riel
// de las temporadas que se fue con la D). Mientras se vota, llenan la columna de la vitrina al lado de las cartas
function AlCierre() {
  return (
    <ul className="sd-cierre" aria-label="También se define al cierre">
      <li><a href="#/ligas/clausura"><small>Campeón de la Clausura</small><b>Al cierre</b></a></li>
      <li><a href="#/ligas/superliga"><small>Campeón de la Superliga</small><b>Al cierre</b></a></li>
    </ul>
  );
}

// ── los récords: el número primero, agrupados, y quién tiene más ──
// el grupo de cada uno sale de su id (`_records()` de bot/subir_web.py); uno nuevo que todavía no esté acá va a «Más»
const GRUPOS_REC = [['La temporada', ['ovr', 'pts', 'ev', 'srv', 'racha']], ['Los títulos', ['oro', 'fin', 'sem', 'pod']],
  ['Los duelos', ['wr', 'duv', 'rdu']], ['Los eventos', ['mev', 'grande', 'dia']]];
// la unidad, sólo donde el nombre del récord no la dice: «Más títulos · 22» ya se entiende, «Racha más larga · 14» no.
// ⚠️ La racha es de EVENTOS seguidos (`_rachas()`), y la de duelos, de duelos GANADOS seguidos
const UNIDAD = { racha: 'eventos seguidos', mev: 'pts', grande: 'raperos', dia: 'eventos', rdu: 'ganados seguidos' };
// lo que va debajo del dueño: el servidor de la llave más grande, el evento del mejor puntaje. El `x` de los otros
// es su unidad, que ya va al lado del número
function detalle(r) {
  if (!r.x || r.id === 'dia' || r.id === 'rdu') return '';
  // con la sigla y no el código interno (18/11/2026): `_records()` manda «raperos · ACAD» y se leía «ACAD» donde toda la
  // página dice «LCW»
  if (r.id === 'grande') return siglaDe(String(r.x).replace(/^raperos\s*·\s*/, '').trim());
  return (r.id === 'mev' ? 'en ' : '') + limpio(r.x);
}
function Records({ liga }) {
  const rs = liga.d.records || [];
  const por = Object.fromEntries(rs.map((r) => [r.id, r]));
  const usados = new Set();
  const grupos = GRUPOS_REC.map(([t, ids]) => [t, ids.map((id) => por[id]).filter(Boolean)]).filter(([, xs]) => xs.length);
  grupos.forEach(([, xs]) => xs.forEach((r) => usados.add(r.id)));
  const resto = rs.filter((r) => !usados.has(r.id));
  if (resto.length) grupos.push(['Más', resto]);
  // quién tiene más récords: sólo los de personas, y desde dos (uno solo no es «el que más tiene»)
  const cuenta = {};
  rs.forEach((r) => { if (r.k) cuenta[r.k] = (cuenta[r.k] || 0) + 1; });
  const reyes = Object.entries(cuenta).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <>
      <p className="sd-tab-baj">De la {nombreTemp(liga.temp)}, y se mueven con cada evento.</p>
      {reyes.length ? (
        <div className="sl-reyes">
          <small>Los que más tienen</small>
          {reyes.map(([k, n], i) => (
            <a key={k} href={'#/r/' + encodeURIComponent(k)} className={i ? '' : 'uno'}>
              <Persona liga={liga} k={k} cls="sl-mini" /><b>{nomDe(liga, k)}</b><em>{n} récords</em></a>
          ))}
        </div>
      ) : null}
      <div className="sl-recs">{grupos.map(([t, xs]) => (
        <div key={t} className="sl-rg">
          <h3 className="sl-st">{t}</h3>
          <ul>{xs.map((r) => {
            // el win rate viaja como «86.4%»: con coma, como el «75,3» del Score más arriba
            const v = typeof r.v === 'number' ? num(r.v) : r.id === 'wr' ? String(r.v).replace('.', ',') : String(r.v);
            const det = detalle(r);
            const cuerpo = <>
              <span className="sl-rv"><b className={v.length > 6 ? 'largo' : undefined}>{v}</b>{UNIDAD[r.id] ? <small>{UNIDAD[r.id]}</small> : null}</span>
              <span className="sl-rt">
                <small>{r.que}</small>
                <span className="sl-rn">{r.k ? <Persona liga={liga} k={r.k} n={r.n} cls="sl-mini" /> : null}<b>{r.k ? nomDe(liga, r.k, r.n) : limpio(r.n)}</b></span>
                {det ? <em>{det}</em> : null}
              </span>
            </>;
            return <li key={r.id}>{r.k ? <a href={'#/r/' + encodeURIComponent(r.k)}>{cuerpo}</a> : <div>{cuerpo}</div>}</li>;
          })}</ul>
        </div>
      ))}</div>
    </>
  );
}

// ── las insignias más difíciles, con su rareza en palabras ──
// [hasta cuántos la tienen, la palabra, la clase]. Los colores son los de las bandas de rareza de los TAG en la Guía
const RAREZA = [[1, 'ÚNICA', 'unica'], [3, 'MUY RARA', 'muy'], [10, 'RARA', 'rara'], [DIFICIL, 'ESCASA', 'escasa']];
const rareza = (n) => RAREZA.find(([tope]) => n <= tope) || RAREZA[RAREZA.length - 1];
// hasta tres, con su nombre: una cara sola no dice quién es
const CON_NOMBRE = 3;
// las caras de quienes la tienen: encimadas en la compu y de 44 px y sueltas en el celular, para poder tocarlas. Más de
// seis, con «+N», que las muestra todas (era un texto que no se podía tocar)
function Caras({ liga, quien, nombres }) {
  const [todas, setTodas] = useState(false);
  return (
    <span className={'sl-ins-caras' + (nombres ? ' con-n' : '')}>
      {(todas ? quien : quien.slice(0, VER_CARAS)).map(([k]) => (
        <a key={k} href={'#/r/' + encodeURIComponent(k)} title={nombres ? undefined : nomDe(liga, k)} aria-label={nombres ? undefined : nomDe(liga, k)}>
          <Persona liga={liga} k={k} cls="sl-mini" />{nombres ? <b>{nomDe(liga, k)}</b> : null}</a>
      ))}
      {quien.length > VER_CARAS ? (
        <button type="button" className="sl-mas-c" aria-expanded={todas} onClick={() => setTodas(!todas)}
          aria-label={todas ? 'Mostrar menos' : 'Ver a los ' + quien.length}>{todas ? '−' : '+' + (quien.length - VER_CARAS)}</button>
      ) : null}
    </span>
  );
}
// 🏆 SIN LAS DE LOS MES AWARDS (`mes_…`, 17/11/2026): eran 24 de las 34 y llenaban media página en el celular, y con un
// ganador por categoría en cada servidor cada mes iban a ser muchas más. Sus ganadores ya están en la grilla de cada mes
function insDificiles(liga, perf) {
  const cat = liga.d.insignias || [];
  const P = (perf && perf.p) || null;
  if (!cat.length || !P) return [];
  const por = {};
  Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => { (por[id] = por[id] || []).push([k, t]); }));
  // 🏆 ni las de la gala (`gala_*`, 17/11/2026): son 22 por temporada, todas ÚNICAS, y sus ganadores ya están en la gala
  return cat.filter(([id]) => !String(id).startsWith('mes_') && !String(id).startsWith('gala_'))
    .map(([id, ic, n, desc]) => ({ id, ic, n, desc, quien: (por[id] || []).sort((a, b) => String(a[1]).localeCompare(String(b[1]))) }))
    .filter((x) => x.quien.length && x.quien.length <= DIFICIL)
    .sort((a, b) => a.quien.length - b.quien.length);
}
function Insignias({ liga, xs }) {
  return (
    <>
      <p className="sd-tab-baj">Las que tienen pocos, de la más rara a la menos. Quedan para siempre.</p>
      <ul className="sl-ins">{xs.map((x) => {
        const [, palabra, cls] = rareza(x.quien.length);
        const nombres = x.quien.length <= CON_NOMBRE;
        return (
          <li key={x.id} className={'sl-r-' + cls}>
            <span className="sl-ins-ic" aria-hidden="true">{x.ic}</span>
            <span className="sl-ins-t"><span className="sl-rare">{palabra}</span><b>{x.n}</b><small>{x.desc}</small></span>
            <span className="sl-ins-n"><b>{x.quien.length}</b><small>{x.quien.length === 1 ? 'la tiene' : 'la tienen'}</small></span>
            <Caras liga={liga} quien={x.quien} nombres={nombres} />
          </li>
        );
      })}</ul>
    </>
  );
}

function CampeonesLigas({ liga, xs }) {
  return (
    <>
      <p className="sd-tab-baj">Cada liga cerrada, con su campeón y su podio. <a href="#/ligas">Todas las ligas</a></p>
      <ul className="sl-lista">{xs.map((x) => {
        const k = (x.ks || {})[x.c] || (liga.fila(x.c) || {}).k;
        return (
          <li key={x.id + x.ult}>
            <Persona liga={liga} k={k} n={x.c} />
            <span><small><img alt="" src={liga.logo(x.sv)} />{x.n} · {siglaDe(x.sv)} · {nombreTemp(x.temp)}</small>
              <b>{k ? <a href={'#/r/' + encodeURIComponent(k)}>{limpio(x.c)}</a> : limpio(x.c)}</b>
              {(x.p || []).length > 1 ? <em>2º {limpio(x.p[1])}{x.p[2] ? ' · 3º ' + limpio(x.p[2]) : ''}</em> : null}</span>
          </li>
        );
      })}</ul>
    </>
  );
}

// 🎟️ los que se pueden nombrar, con su puesto de llegada (18/11/2026): la lista filtraba por `liga.T` y la pestaña contaba
// a todos, así que con dlx (#226, fuera de las 200) solo, «Salón del Pase» salía con la lista vacía; y el «N.º» se
// numeraba después de filtrar, así que si el 1.º quedaba afuera el 2.º se leía «1.º». `[[clave, cuándo], índice]`
const vistosPase = (liga, xs) => (xs || []).map((x, i) => [x, i]).filter(([[k]]) => liga.existe(k));
const tempsPase = (liga, pub) => { const por = (pub && pub.salon) || {}; return Object.keys(por).filter((t) => vistosPase(liga, por[t]).length).sort().reverse(); };
function SalonPase({ liga, pub, temps }) {
  const por = (pub && pub.salon) || {};
  return (
    <>
      <p className="sd-tab-baj">Los que completaron el Pase de rapero, en el orden en que llegaron. <a href="#/pase">El Pase</a></p>
      {temps.map((t) => (
        <ol key={t} className="sl-lista">{vistosPase(liga, por[t]).map(([[k, cuando], i]) => (
          <li key={k}>
            {/* 💎 con el premium, el aro dorado en la cara y el sello al lado del nombre */}
            <Persona liga={liga} k={k} cls={'sl-cara' + (esPremium(pub, k) ? ' sp-prem-aro' : '')} />
            <span><small>{nombreTemp(t)} · {i + 1}.º EN COMPLETARLO</small>
              <b><a href={'#/r/' + encodeURIComponent(k)}>{nomDe(liga, k)}</a>{esPremium(pub, k) ? <SelloPremium t={14} cls="sp-prem-in" /> : null}</b>
              <em>{liga.cuando(new Date(cuando).toISOString())}</em></span>
          </li>
        ))}</ol>
      ))}
    </>
  );
}

// ── figuras y revelaciones: una fila por semana ──
// 🔴 DE LOS PREMIOS DE CADA SEMANA (`semanas` de /api/salon, `mes_awards.figuras_semana()`) Y NO DE LAS INSIGNIAS, que
// se guardan una vez por persona: armada con las insignias, la semana del 02/11 decía que no había habido figura, y era
// Makmah, que ya la tenía del 26/10 (la crítica de la tanda 2). Con un Salón subido antes de eso, sin `semanas`, sale de
// las insignias, y lo que falta no se dibuja: un «—» diría que no hubo. ⚠️ Y NO MIENTRAS LLEGA /api/salon: armada con
// las insignias de mientras, la semana del 02/11 salía un momento sin su figura y después aparecía (medido en la página
// publicada, a 1333). Hasta que llega, la pestaña no está, como los MES AWARDS
function filasFig(liga, S, perf) {
  if (!S) return [];
  // [día, [clave, nombre, pts] de la figura, ídem de la revelación]
  if (Array.isArray(S.semanas)) {
    const de = (n, p) => { if (!n) return null; const f = liga.fila(n); return [f ? f.k : '', f ? f.n : n, p]; };
    return S.semanas.map(([fin, fn, fp, rn, rp]) => [liga.diaClave(fin), de(fn, fp), de(rn, rp)]).filter(([d]) => d);
  }
  const P = (perf && perf.p) || null;
  if (!P) return [];
  const sem = {};
  Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => {
    if (id === 'figura' || id === 'revelacion') { const d = String(t || '').slice(0, 10); (sem[d] = sem[d] || {})[id] = [k, nomDe(liga, k), 0]; }
  }));
  return Object.keys(sem).filter(Boolean).sort().reverse().map((d) => [d, sem[d].figura || null, sem[d].revelacion || null]);
}
function Figuras({ liga, filas }) {
  const icono = (id) => ((liga.d.insignias || []).find((x) => x[0] === id) || [])[1] || '';
  const quien = (que, x) => {
    if (!x) return null;
    const cuerpo = <><Persona liga={liga} k={x[0]} n={x[1]} cls="sl-mini" /><b>{limpio(x[1])}</b></>;
    return (
      <div className="sl-fq">
        <small>{que}</small>
        {x[0] ? <a href={'#/r/' + encodeURIComponent(x[0])}>{cuerpo}</a> : <span>{cuerpo}</span>}
        {x[2] ? <em>{num(x[2])} pts</em> : null}
      </div>
    );
  };
  return (
    <>
      <p className="sd-tab-baj">Al cerrar cada semana: la figura es la que más puntos hizo, y la revelación, la figura de los que debutaron.</p>
      <ol className="sl-fig">{filas.map(([d, f, r]) => {
        const [, m, dd] = d.split('-').map(Number);
        return (
          <li key={d}>
            <time className="sl-fd" dateTime={d} title={mayus(diaSemana(d)) + ' ' + diaSin(d)}><b>{dd}</b><small>{(MESES[m - 1] || '').slice(0, 3)}</small></time>
            {quien((icono('figura') + ' Figura').trim(), f)}
            {quien((icono('revelacion') + ' Revelación').trim(), r)}
          </li>
        );
      })}</ol>
    </>
  );
}

// las pestañas de «Lo demás del Salón»: [clave, nombre, el corto del índice]. Las que no tienen nada no se dibujan
const PESTANAS = [['rec', 'Récords', 'Récords'], ['ins', 'Insignias', 'Insignias'], ['ligas', 'Campeones de las ligas', 'Ligas'],
  ['fig', 'Figuras', 'Figuras'], ['pase', 'Salón del Pase', 'El Pase']];
function LoDemas({ liga, tabs, tab, setTab, carga }) {
  if (!tabs.length) return carga ? <p className="sec sl-carga" role="status">Cargando las insignias…</p> : null;
  const t = tabs.find((x) => x[0] === tab) || tabs[0];
  // ← y → mueven de pestaña, como en cualquier lista de pestañas
  const tecla = (e) => {
    const i = tabs.indexOf(t);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -9;
    if (j === -9) return;
    e.preventDefault();
    const n = tabs[(j + tabs.length) % tabs.length];
    setTab(n[0]);
    const b = e.currentTarget.querySelector('[data-tab="' + n[0] + '"]');
    if (b) b.focus();
  };
  return (
    <section className="sec sd-resto" id="sl-resto">
      {/* las pestañas en el renglón del título: en la compu van a su derecha (debajo de un título corto quedaba un hueco
          de 750 × 160 px); en el celular, debajo y de costado */}
      <div className="sec-t sd-resto-t">
        <h2>Lo demás del Salón</h2>
        <div className="sd-tabs" role="tablist" aria-label="Lo demás del Salón" onKeyDown={tecla}>
          {tabs.map(([k, n]) => (
            <button key={k} type="button" role="tab" id={'sd-tab-' + k} data-tab={k} aria-selected={k === t[0]} aria-controls="sd-panel-resto"
              tabIndex={k === t[0] ? 0 : -1} className={k === t[0] ? 'sd-on' : undefined} onClick={() => setTab(k)}>{n}</button>
          ))}
        </div>
      </div>
      <div className="sd-tabp" role="tabpanel" id="sd-panel-resto" aria-labelledby={'sd-tab-' + t[0]}>{t[3]}</div>
      {carga ? <p className="sl-carga" role="status">Cargando las insignias…</p> : null}
    </section>
  );
}

export function SalonFama({ liga, enc }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const perf = usePerfiles();
  const S = useSalon();
  const pub = usePases();
  const el = useElegidos();
  const [svVota, setSvVota] = useState('');
  const [ver0, setVer] = useState(undefined);
  const [mesVer0, setMesVer] = useState('');
  const [tab0, setTab] = useState('');
  const { act, ir, tira, hay } = useIndice(['sl-gala', 'sl-mes', 'sl-meses', 'sl-vitrina', 'sl-resto']);

  // ── los MES AWARDS: en qué momento del mes estamos, tu servidor y lo que se abrió ──
  const ab = S && S.abierto && Object.keys(S.abierto.sv || {}).length ? S.abierto : null;
  // 🏆 la gala: con los nominados afuera manda arriba; cerrada, sus ganadores van arriba
  const G = estadoGala(liga, S);
  const galaAb = G.e === 'vota' || G.e === 'nominados' ? G.g : null;
  const galaCe = G.e === 'cerrada' ? G.g : null;
  const svs = S ? svsAwards(liga, S) : [];
  const propio = S ? tuSv(liga, el, svs) : '';
  const conNom = (x) => !!(ab && catsDe(S, ab, x).length);
  // se vota en el tuyo; si el tuyo no tiene nominados, en el que más se mueve de los que sí
  const sv = svVota || (conNom(propio) ? propio : svs.find(conNom) || propio);
  const hist = (S && S.hist) || [];
  // lo que se abre debajo de la grilla: el resto del mes, los ganadores del último mes cerrado de tu servidor (si no tuvo,
  // los del primero que tuvo); mientras se vota, nada hasta que se toca
  const verDef = () => {
    if (ab || !hist.length) return null;
    const m = hist.find((x) => catsDe(S, x, propio).length);
    if (m) return { sv: propio, mes: m.mes };
    const x = svs.find((y) => catsDe(S, hist[0], y).length);
    return x ? { sv: x, mes: hist[0].mes } : catsDe(S, hist[0], LIGA).length ? { sv: LIGA, mes: hist[0].mes } : null;
  };
  const ver = ver0 === undefined ? (S ? verDef() : null) : ver0;
  const mesVer = mesVer0 || (ab ? ab.mes : ver ? ver.mes : hist.length ? hist[0].mes : '');
  const ir2 = (id, adentro) => requestAnimationFrame(() => {
    const r = raiz();
    const x = r && r.getElementById(adentro || id);
    if (x) ir(id, adentro ? x : undefined);
  });
  const onGana = (x, m) => { setVer({ sv: x, mes: m }); setMesVer(m); ir2('sl-meses', 'sl-archivo'); };
  const onVota = (x) => { setSvVota(x); ir2('sl-mes'); };
  const onGala = () => ir2('sl-gala');
  const onMes = (m) => {
    setMesVer(m);
    if (estadoMes(S, m) !== 'cerrado') return;
    const md = datosMes(S, m);
    const quien = ver && catsDe(S, md, ver.sv).length ? ver.sv : catsDe(S, md, propio).length ? propio : svs.find((y) => catsDe(S, md, y).length) || LIGA;
    setVer({ sv: quien, mes: m });
  };

  // ── lo demás del Salón, en pestañas ──
  const ins = insDificiles(liga, perf);
  const ligasX = ((liga.d.ligas || {}).salon) || [];
  const figs = filasFig(liga, S, perf);
  const temps = tempsPase(liga, pub);
  const tabs = PESTANAS.map(([k, n, c]) => [k, n, c,
    k === 'rec' ? ((liga.d.records || []).length ? <Records liga={liga} /> : null)
      : k === 'ins' ? (ins.length ? <Insignias liga={liga} xs={ins} /> : null)
        : k === 'ligas' ? (ligasX.length ? <CampeonesLigas liga={liga} xs={ligasX} /> : null)
          : k === 'fig' ? (figs.length ? <Figuras liga={liga} filas={figs} /> : null)
            : temps.length ? <SalonPase liga={liga} pub={pub} temps={temps} /> : null]).filter((x) => x[3]);
  const tab = tabs.some((x) => x[0] === tab0) ? tab0 : (tabs[0] || [''])[0];

  // ── el índice pegado arriba: las secciones y, de «Lo demás», cada pestaña ──
  const aTab = (k) => { setTab(k); ir('sl-resto'); };
  const chips = [['sl-gala', 'La gala'], ['sl-mes', galaAb ? 'Tu servidor' : ab && ab.votando ? 'Votar' : 'Nominados'], ['sl-meses', 'MES AWARDS'],
    ['sl-vitrina', 'Campeón ' + tempDe(liga)]]
    .filter(([id]) => hay.includes(id)).map(([id, t]) => ({ id, t, on: act === id, ir: () => ir(id) }))
    .concat(hay.includes('sl-resto') ? tabs.map(([k, , c]) => ({ id: 'tab-' + k, t: c, on: act === 'sl-resto' && tab === k, ir: () => aTab(k) })) : []);

  const ins0 = (liga.d.insignias || []).length;
  const nTemp = Number(String(liga.temp || 't1').replace(/\D/g, '')) || 1;
  const numero = (t, v, f) => <div><dt>{t}</dt><dd>{f ? <button type="button" className="sl-num-b" onClick={f}>{v}</button> : v}</dd></div>;
  const numeros = (
    <dl className="sl-num">
      {numero('RÉCORDS', (liga.d.records || []).length, tabs.some((x) => x[0] === 'rec') ? () => aTab('rec') : null)}
      {numero('INSIGNIAS', ins0, tabs.some((x) => x[0] === 'ins') ? () => aTab('ins') : null)}
      {numero('EVENTOS', num(liga.d.eventos || 0), null)}
      {numero('TEMPORADAS', nTemp, ab || galaAb ? () => ir('sl-vitrina') : null)}
    </dl>
  );
  const escena = (hijos) => (
    // 🎬 «la historia de la Liga» (Dlx, 12/11/2026: «sí, las dos»): el mismo montaje, más oscuro y al 75 % de la
    // velocidad: se lee como un recuerdo y no como acción
    <div className="escena sl-esc con-video" style={{ '--mo-c': '#E5B800', '--mo-o': 0.9, '--mo-c2': '#E41373' }}>
      <FondoVideo liga={liga} lento={0.75} cls="tenue" />
      <section className="sl-cab">{hijos}</section>
    </div>
  );
  const vota = !!(ab && ab.votando);
  const mesAMes = S ? <MesAMes liga={liga} enc={enc} S={S} svs={svs} ver={ver} mesVer={mesVer} onMes={onMes} onGana={onGana} onVota={onVota} onGala={onGala}
    franja={!ab && S.vivo ? <Franja liga={liga} enc={enc} S={S} sv={propio} modo="espera" /> : null} /> : null;
  const indice = chips.length > 1 ? (
    <nav className="sl-ix" aria-label="Qué hay en el Salón">
      <ol ref={tira}>{chips.map((c) => (
        <li key={c.id}><button type="button" className={c.on ? 'on' : ''} aria-current={c.on ? 'true' : undefined} onClick={c.ir}>{c.t}</button></li>
      ))}</ol>
    </nav>
  ) : null;
  const demas = <LoDemas liga={liga} tabs={tabs} tab={tab} setTab={setTab} carga={!perf} />;
  const vitrina = (
    <section className="sec negra sd-vit" id="sl-vitrina">
      <div className="sec-t"><h2>Salón de la fama</h2></div>
      <div className="sd-vit-c">
        <div className="sd-vit-tx">
          <p>Los campeones de cada temporada, los premios de cada mes, los récords y las insignias más difíciles. Lo que se gana acá queda para siempre.</p>
          {numeros}
          <AlCierre />
        </div>
        <Estante liga={liga} />
      </div>
    </section>
  );
  const ganadoresGala = galaCe ? <GalaGanadores liga={liga} enc={enc} S={S} g={galaCe} /> : null;

  if (galaAb) {
    // 🏆 LA GALA, CON LOS NOMINADOS AFUERA: la página abre con ella (le gana al mes), y los de cada servidor, debajo
    return (
      <>
        {escena(<>
          <div className="sl-cab-tx">
            <span className="tag">LIGA GLOBAL · {galaAb.temp}</span>
            <h1 className="hero-ev largo">La gala de {galaAb.nombre}</h1>
            <p className="hero-p">Lo mejor de toda la temporada en la Liga Global. {QUIEN_VOTA_GALA}{' '}
              {galaAb.votando ? 'Una vez por categoría, y puedes cambiar tu voto hasta que cierra: nadie ve a quién votaste.'
                : 'La votación abre ' + liga.dia(galaAb.abre) + '.'}</p>
          </div>
          <div className="sl-copa" aria-hidden="true"><Ico n="copa" t={150} /></div>
        </>)}
        {indice}
        <GalaVoto liga={liga} enc={enc} S={S} g={galaAb} />
        {ab ? <Votacion liga={liga} enc={enc} S={S} svs={svs} sv={sv} propio={propio} onSv={setSvVota} bajoGala /> : null}
        {mesAMes}
        {vitrina}
        {demas}
      </>
    );
  }
  if (ab) {
    // 🗳️ MIENTRAS SE VOTA (o ya salieron los nominados): la página abre con la votación de tu servidor
    return (
      <>
        {escena(<>
          <div className="sl-cab-tx">
            <span className="tag">MES AWARDS · {String(ab.nombre).toUpperCase()}</span>
            <h1 className="hero-ev largo">{vota ? 'Vota lo mejor de ' + ab.nombre + ' en ' + siglaDe(sv) : 'Los nominados de ' + ab.nombre + ' en ' + siglaDe(sv)}</h1>
            <p className="hero-p">{QUIEN_VOTA(siglaDe(sv), ab.nombre)}{' '}
              {vota ? 'Una vez por categoría, y puedes cambiar tu voto hasta que cierra: nadie ve a quién votaste.' : 'La votación abre ' + liga.dia(ab.abre) + '.'}
              {vota && !(enc && enc.yoDiscord) ? ' Para votar entras con Discord.' : ''}</p>
          </div>
          <div className="sl-copa" aria-hidden="true"><Ico n="copa" t={150} /></div>
        </>)}
        {indice}
        <Votacion liga={liga} enc={enc} S={S} svs={svs} sv={sv} propio={propio} onSv={setSvVota} />
        {ganadoresGala}
        {mesAMes}
        {vitrina}
        {demas}
      </>
    );
  }
  // 🏛️ EL RESTO DEL MES: la vitrina arriba, y la franja de cuándo salen los nominados
  const estante = primeros(liga).some(Boolean) ? <Estante liga={liga} /> : null;
  return (
    <>
      {escena(<>
        <div className="sl-cab-tx">
          <span className="tag">LIGA GLOBAL · {tempDe(liga)}</span>
          <h1 className="hero-ev largo">Salón de la fama</h1>
          <p className="hero-p">Los campeones de cada temporada, los premios de cada mes en cada servidor, los récords y las insignias más difíciles. Lo que se gana acá queda para siempre.</p>
          {numeros}
        </div>
        {estante || <div className="sl-copa" aria-hidden="true"><Ico n="copa" t={150} /></div>}
      </>)}
      {indice}
      {ganadoresGala}
      {mesAMes}
      {demas}
    </>
  );
}
