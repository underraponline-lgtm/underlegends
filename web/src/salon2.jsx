// 🏛️ EL SALÓN DE LA FAMA, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo
// día («Publica y haz todo»), en lugar de salon.jsx. Lo mismo, con lo que dejó el research de 21st
// (scratchpad/remake2/research_tienda_salon_guia_socios.md):
// - LOS NÚMEROS DE ARRIBA LLEVAN A SU SECCIÓN, y un índice pegado arriba.
// - LOS VOTOS que se leen honestos: una pista fina de % debajo del nombre (no la fila entera pintada), cuántos votos van
//   en la cabecera de cada categoría —«50 %» de dos votos no es lo mismo que de doscientos— y «✓ TU VOTO».
//   ⚠️ LAS CUATRO A LA VISTA y las demás detrás de su botón, como decidió Dlx (16/10/2026): no van en pestañas.
// - LAS TEMPORADAS COMO UN RIEL: la T1 en juego y la que viene, con candado.
// - LOS RÉCORDS CON EL NÚMERO PRIMERO, agrupados (la temporada, los títulos, los duelos, los eventos), y quién tiene más.
// - LAS INSIGNIAS CON SU RAREZA en palabras (única, muy rara, rara, escasa) y las caras juntas.
// - FIGURAS Y REVELACIONES, una fila por semana.
// ⚠️ NO CALCULA NADA NUEVO: lo mismo que salon.jsx (los récords del lobby, las insignias de `/api/perfiles`, `/api/salon`).
import { useEffect, useState } from 'react';
import { DIAS, MESES, limpio, num, siglaDe } from './liga.js';
import { Cara, Ico, Sec, accion, usePerfiles } from './piezas.jsx';
import { usePases } from './pase.js';
import { Nominado, reparto, useSalon } from './mesawards.jsx';
import { useIndice } from './indice.js';
import CSS_PAGINA from './css/salon2.css?inline';
import { usarCss } from './css.js';
import FondoVideo from './fondovideo.jsx';

usarCss('salon2', CSS_PAGINA);

const DIFICIL = 25;
const VER_CARAS = 6;
const nombreTemp = (t) => (!t || t === 'prueba' ? 'Temporada 1' : 'Temporada ' + String(t).replace(/^t/i, ''));
function diaSin(d) {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  return y && m && dd ? dd + ' de ' + MESES[m - 1] : '';
}
const diaSemana = (d) => {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number);
  return y ? DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()] : '';
};
const capM = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function Persona({ liga, k, n, cls = 'sl-cara' }) {
  const f = k && liga.T[k];
  return <Cara liga={liga} k={f ? k : ''} nombre={(f && f.n) || n || k || '?'} cls={cls} />;
}
const nomDe = (liga, k, n) => limpio((k && liga.T[k] && liga.T[k].n) || n || k || '');

// 📊 una categoría que se vota: la pista fina del %, el total arriba y tu voto marcado
export function Categoria({ liga, enc, cat, nombre, de, nom, encId, gana }) {
  const E = encId ? ((liga.d.enc || []).find((e) => e.id === encId) || null) : null;
  const cu = E && enc ? enc.cuenta(E.id) : {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  const mio = E && enc ? enc.mio[E.id] : '';
  const est = (E && enc && enc.est[E.id]) || {};
  return (
    <article className="sl-cat">
      <header><b>{nombre}</b><small>Por {de}</small>{E ? <em>{tot ? num(tot) + (tot === 1 ? ' voto' : ' votos') : 'sin votos todavía'}</em> : null}</header>
      <ol className="sl-noms">{nom.map((x, i) => {
        const n = Number(cu[x.op] || 0);
        const p = tot ? Math.round((100 * n) / tot) : 0;
        const cuerpo = (
          <>
            <span className="sl-i">{gana ? (x.op === gana ? '🏆' : '') : i + 1}</span>
            <span className="sl-nom"><Nominado liga={liga} cat={cat} x={x} />{E && tot ? <i className="sl-pista" aria-hidden="true"><i style={{ width: p + '%' }} /></i> : null}</span>
            {E ? <em className="sl-p">{mio === x.op ? <span className="sl-tuyo">✓ TU VOTO</span> : null}{tot ? p + '%' : ''}</em> : null}
          </>
        );
        return (
          <li key={x.op} className={(gana && x.op === gana ? 'gana ' : '') + (mio === x.op ? 'mio' : '')}>
            {E ? (
              <button type="button" className={'sl-op' + (est.va === x.op ? ' va' : '')} onClick={() => accion.votar(E.id, x.op)}
                aria-pressed={mio === x.op} aria-label={'Votar a ' + limpio(x.n) + (tot ? ' · ' + p + '% de los votos' : '')}>{cuerpo}</button>
            ) : <div className="sl-op">{cuerpo}</div>}
          </li>
        );
      })}</ol>
      {E && enc ? <p className="sl-pie" aria-live="polite">{enc.pie(E, (op) => limpio((nom.find((x) => x.op === op) || {}).n || op))}</p> : null}
    </article>
  );
}

// cuánto se llevó el ganador, en las de la lista corta (el reparto entero va en las cuatro principales). Sólo si se
// decidió por votos, como `reparto()`
function pctGana(x) {
  const cu = x.cuenta || {};
  const tot = Object.values(cu).reduce((s, n) => s + (Number(n) || 0), 0);
  return x.por === 'votos' && tot ? <em>{Math.round((100 * (Number(cu[x.gana]) || 0)) / tot)}%</em> : null;
}

function MesAwards({ liga, enc }) {
  const S = useSalon();
  const [todas, setTodas] = useState(false);
  const [staff, setStaff] = useState(false);
  if (!S) return null;
  const principales = (S.cats || []).filter((c) => !c[3]);
  const demas = todas ? (S.cats || []).filter((c) => c[3] === 1) : [];
  const catsStaff = staff ? (S.cats || []).filter((c) => c[3] === 2) : [];
  const nOtras = (S.cats || []).filter((c) => c[3] === 1).length;
  const nStaff = (S.cats || []).filter((c) => c[3] === 2).length;
  const ab = S.abierto;
  const viv = S.vivo;
  const hist = S.hist || [];
  let cab = null;
  let cuerpo = null;
  if (ab) {
    const votando = ab.votando;
    cab = votando ? <>Vota lo mejor de <b>{ab.nombre}</b>: cierra {liga.dia(ab.cierra)}.</> : <>Los nominados de <b>{ab.nombre}</b>: la votación abre {liga.dia(ab.abre)}.</>;
    const una = ([c, n, de]) => {
      const nom = ((ab.cats || {})[c] || {}).nom || [];
      return nom.length ? <Categoria key={c} liga={liga} enc={enc} cat={c} nombre={n} de={de} nom={nom} encId={votando && nom.length >= 2 ? 'mes:' + ab.mes + ':' + c : ''} /> : null;
    };
    const st = catsStaff.map(una).filter(Boolean);
    const dem = demas.map(una).filter(Boolean);
    const arriba = () => {
      const h = document.getElementById('inicio-nuevo');
      const s = h && h.shadowRoot ? h.shadowRoot.getElementById('sl-mes') : null;
      if (s) window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
    };
    // los botones van al final de las columnas de las cuatro: llenan el hueco que deja la categoría más corta (la
    // Batalla, con dos videos, al lado de las de cinco) y se quedan donde se tocaron, porque lo que abren va debajo
    const botones = nOtras || nStaff ? (
      <div className="sl-botones">
        {nOtras ? <button type="button" className="btn borde chico" aria-expanded={todas} onClick={() => setTodas((v) => !v)}>
          {todas ? 'Ver sólo las principales' : 'Ver las demás nominaciones (' + nOtras + ')'}</button> : null}
        {nStaff ? <button type="button" className="btn borde chico" aria-expanded={staff} onClick={() => setStaff((v) => !v)}>
          {staff ? 'Esconder las del staff' : 'Ver las del staff (' + nStaff + ')'}</button> : null}
      </div>
    ) : null;
    cuerpo = (
      <>
        <div className="sl-cats">{principales.map(una)}{botones}</div>
        {/* las demás, debajo y en filas: en las mismas columnas que las cuatro se mezclaban con ellas y la lectura saltaba
            4.900 px para arriba (la crítica de la tanda 2). Al final, otro botón para cerrarlas sin volver a subir */}
        {dem.length ? (
          <>
            <h3 className="sl-st">Las demás nominaciones</h3>
            <div className="sl-cats-g">{dem}</div>
            <div className="sl-botones"><button type="button" className="btn borde chico" onClick={() => { setTodas(false); arriba(); }}>Ver sólo las principales</button></div>
          </>
        ) : null}
        {st.length ? <><h3 className="sl-st">El staff · jurado, host y DJ</h3><div className="sl-cats-g tres">{st}</div></> : null}
      </>
    );
  } else if (viv) {
    cab = <>Los nominados de <b>{viv.nombre}</b> se conocen cuando termina el mes. Se vota {liga.dia(viv.vota)}.</>;
  }
  return (
    <Sec id="sl-mes" titulo="MES AWARDS" extra="negra sl-mes">
      <p className="sl-mes-cab">{cab || <>Cada mes, lo mejor de la Liga, votado por la gente.</>}</p>
      <p className="sl-mes-como">Los nominados salen solos de los números del mes; vota cualquiera con Discord, una vez por categoría, y se puede cambiar
        hasta que cierra. El ganador se lleva su insignia{S.premio ? ', Puntos de Tienda' : ''} y su lugar en este Salón.
        {nOtras ? ' Los de crew, país, liga y servidor se llevan el Salón y la publicación.' : ''}
        {S.cats_sv ? ' Y cada servidor Tier 1 tiene los suyos, en su página, votados por los que jugaron ahí.' : ''}</p>
      {cuerpo}
      {hist.length ? (
        <div className="sl-hist">
          <h3 className="sl-st">Los ganadores</h3>
          {hist.map((m, i) => {
            // todas las categorías, como pidió la pasada del 19/10: con el mes cerrado, los ganadores de «las demás» y
            // del staff también se ven. Las cuatro principales con su reparto, y las otras en una lista corta.
            // El mes más nuevo abierto y los de antes plegados: cada mes cerrado suma 1.600 px en el celular, y en
            // diciembre «Los ganadores» iban a ser 4.800 antes de llegar a las temporadas
            const filas = (S.cats || []).map(([c, n, , tipo]) => {
              const x = (m.cats || {})[c] || {};
              const f = (x.nom || []).find((y) => y.op === x.gana);
              return f ? { c, n, tipo, x, f } : null;
            }).filter(Boolean);
            const resto = filas.filter((y) => y.tipo);
            return (
              <details key={m.mes} className="sl-hm" open={i === 0}>
                <summary><b className="sl-hm-mes">{capM(m.nombre)} {m.mes.slice(0, 4)}</b><small>{filas.length} {filas.length === 1 ? 'ganador' : 'ganadores'}</small></summary>
                <ul>{filas.filter((y) => !y.tipo).map(({ c, n, x, f }) => (
                  <li key={c}><span className="sl-sello">{n}</span><span className="sl-nom"><Nominado liga={liga} cat={c} x={f} /></span>{reparto(x)}</li>
                ))}</ul>
                {resto.length ? (
                  <ul className="sl-hm-resto">{resto.map(({ c, n, x, f }) => (
                    <li key={c}><small>{n}</small><span className="sl-nom"><Nominado liga={liga} cat={c} x={f} /></span>{pctGana(x)}</li>
                  ))}</ul>
                ) : null}
              </details>
            );
          })}
        </div>
      ) : null}
    </Sec>
  );
}

// ── las temporadas, como un riel: la que está en juego y la que viene ──
function Temporadas({ liga }) {
  const t = liga.d.tabla || [];
  const tem = t.filter((f) => f.pos && !f.fc).sort((a, b) => a.pos - b.pos)[0];
  const comp = t.filter((f) => f.rg && !f.fc).sort((a, b) => (b.sc || 0) - (a.sc || 0))[0];
  const fin = (liga.d.fase || {}).termina;
  const fila = (que, f, dato, href) => (
    <li>
      <small>{que}</small>
      {f ? <a className="sl-tp" href={'#/r/' + encodeURIComponent(f.k)}><Persona liga={liga} k={f.k} n={f.n} /><b>{limpio(f.n)}</b><i>{dato}</i></a>
        : <a className="sl-tp vacia" href={href}><b>Al cierre</b><i>Cómo se juega</i></a>}
    </li>
  );
  const num0 = Number(String(liga.temp || 't1').replace(/\D/g, '')) || 1;
  return (
    <Sec id="sl-temporadas" titulo="Los campeones de cada temporada" extra="negra">
      <div className="sl-riel">
        <article className="sl-temp vivo">
          <header>
            <span className="tag">{(liga.temp && liga.temp !== 'prueba' ? liga.temp : 'T1').toUpperCase()} · EN JUEGO</span>
            <h3>{nombreTemp(liga.temp)}</h3>
            <p>{fin ? <>Se define el <b>{diaSin(fin)}</b>. </> : null}Hasta entonces, quién va primero; al cierre, los campeones quedan acá para siempre.</p>
          </header>
          <ul className="sl-temp-l">
            {fila('#1 DE LA TEMPORADA · VA PRIMERO', tem, tem ? 'OVR ' + (tem.ovr || '—') : '', '#/ranking/temporada')}
            {fila('#1 DEL COMPETITIVO · VA PRIMERO', comp, comp ? (comp.rg || '') + ' · ' + String(comp.sc || '').replace('.', ',') : '', '#/ranking/competitivo')}
            {fila('CAMPEÓN DE LA CLAUSURA', null, '', '#/ligas/clausura')}
            {fila('CAMPEÓN DE LA SUPERLIGA', null, '', '#/ligas/superliga')}
          </ul>
        </article>
        {/* ⚠️ `sl-luego` y no `prox`: `.prox` es una grilla global de estilo.css (ya chocó una vez) */}
        <article className="sl-temp sl-luego" aria-label={'Temporada ' + (num0 + 1) + ', todavía no empezó'}>
          <span className="sl-candado" aria-hidden="true"><Ico n="candado" t={34} /></span>
          <h3>Temporada {num0 + 1}</h3>
          <p>Arranca cuando termine la {nombreTemp(liga.temp)}. Sus campeones van acá, al lado.</p>
        </article>
      </div>
    </Sec>
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
  if (r.id === 'grande') return String(r.x).replace(/^raperos\s*·\s*/, '');
  return (r.id === 'mev' ? 'en ' : '') + limpio(r.x);
}
function Records({ liga }) {
  const rs = liga.d.records || [];
  if (!rs.length) return null;
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
    <Sec id="sl-records" titulo="Los récords" bajada={'De la ' + nombreTemp(liga.temp) + ', y se mueven con cada evento.'}>
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
    </Sec>
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
function Insignias({ liga, perf }) {
  const cat = liga.d.insignias || [];
  const P = (perf && perf.p) || null;
  if (!cat.length || !P) return null;
  const por = {};
  Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => { (por[id] = por[id] || []).push([k, t]); }));
  const xs = cat.map(([id, ic, n, desc]) => ({ id, ic, n, desc, quien: (por[id] || []).sort((a, b) => String(a[1]).localeCompare(String(b[1]))) }))
    .filter((x) => x.quien.length && x.quien.length <= DIFICIL)
    .sort((a, b) => a.quien.length - b.quien.length);
  if (!xs.length) return null;
  return (
    <Sec id="sl-insignias" titulo="Las insignias más difíciles" bajada="Las que tienen pocos, de la más rara a la menos. Quedan para siempre.">
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
    </Sec>
  );
}

function CampeonesLigas({ liga }) {
  const xs = ((liga.d.ligas || {}).salon) || [];
  if (!xs.length) return null;
  return (
    <Sec id="sl-ligas" titulo="Campeones de las ligas" enlace="Ligas" href="#/ligas">
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
    </Sec>
  );
}

function SalonPase({ liga }) {
  const pub = usePases();
  const por = (pub && pub.salon) || {};
  const temps = Object.keys(por).filter((t) => (por[t] || []).length).sort().reverse();
  if (!temps.length) return null;
  return (
    <Sec id="sl-pase" titulo="Salón del Pase" enlace="El Pase" href="#/pase" bajada="Los que completaron el Pase de rapero, en el orden en que llegaron.">
      {temps.map((t) => (
        <ol key={t} className="sl-lista">{por[t].filter(([k]) => liga.T[k]).map(([k, cuando], i) => (
          <li key={k}>
            <Persona liga={liga} k={k} />
            <span><small>{nombreTemp(t)} · {i + 1}.º EN COMPLETARLO</small>
              <b><a href={'#/r/' + encodeURIComponent(k)}>{nomDe(liga, k)}</a></b>
              <em>{liga.cuando(new Date(cuando).toISOString())}</em></span>
          </li>
        ))}</ol>
      ))}
    </Sec>
  );
}

// ── figuras y revelaciones: una fila por semana ──
// 🔴 DE LOS PREMIOS DE CADA SEMANA (`semanas` de /api/salon, `mes_awards.figuras_semana()`) Y NO DE LAS INSIGNIAS, que
// se guardan una vez por persona: armada con las insignias, la semana del 02/11 decía que no había habido figura, y era
// Makmah, que ya la tenía del 26/10 (la crítica de la tanda 2). Con un Salón subido antes de eso, sin `semanas`, sale de
// las insignias, y lo que falta no se dibuja: un «—» diría que no hubo. ⚠️ Y NO MIENTRAS LLEGA /api/salon: armada con
// las insignias de mientras, la semana del 02/11 salía un momento sin su figura y después aparecía (medido en la página
// publicada, a 1333). Hasta que llega, la sección no está, como los MES AWARDS
function Figuras({ liga, perf }) {
  const S = useSalon();
  if (!S) return null;
  const icono = (id) => ((liga.d.insignias || []).find((x) => x[0] === id) || [])[1] || '';
  // [día, [clave, nombre, pts] de la figura, ídem de la revelación]
  let filas;
  if (Array.isArray(S.semanas)) {
    const de = (n, p) => { if (!n) return null; const f = liga.fila(n); return [f ? f.k : '', f ? f.n : n, p]; };
    filas = S.semanas.map(([fin, fn, fp, rn, rp]) => [liga.diaClave(fin), de(fn, fp), de(rn, rp)]).filter(([d]) => d);
  } else {
    const P = (perf && perf.p) || null;
    if (!P) return null;
    const sem = {};
    Object.entries(P).forEach(([k, p]) => (p.ins || []).forEach(([id, t]) => {
      if (id === 'figura' || id === 'revelacion') { const d = String(t || '').slice(0, 10); (sem[d] = sem[d] || {})[id] = [k, nomDe(liga, k), 0]; }
    }));
    filas = Object.keys(sem).filter(Boolean).sort().reverse().map((d) => [d, sem[d].figura || null, sem[d].revelacion || null]);
  }
  if (!filas.length) return null;
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
    <Sec id="sl-figuras" titulo="Figuras y revelaciones" bajada="Al cerrar cada semana: la figura es la que más puntos hizo, y la revelación, la figura de los que debutaron.">
      <ol className="sl-fig">{filas.map(([d, f, r]) => {
        const [, m, dd] = d.split('-').map(Number);
        return (
          <li key={d}>
            <time className="sl-fd" dateTime={d} title={capM(diaSemana(d)) + ' ' + diaSin(d)}><b>{dd}</b><small>{(MESES[m - 1] || '').slice(0, 3)}</small></time>
            {quien((icono('figura') + ' Figura').trim(), f)}
            {quien((icono('revelacion') + ' Revelación').trim(), r)}
          </li>
        );
      })}</ol>
    </Sec>
  );
}

// las secciones del índice; los chips de las que no se dibujaron (sin datos) no salen: lo mira useIndice en la página
const SECCIONES = [['sl-mes', 'MES AWARDS'], ['sl-temporadas', 'Temporadas'], ['sl-records', 'Récords'], ['sl-insignias', 'Insignias'],
  ['sl-ligas', 'Ligas'], ['sl-pase', 'El Pase'], ['sl-figuras', 'Figuras']];

export function SalonFama({ liga, enc }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const perf = usePerfiles();
  // lo que sus secciones piden por su cuenta también se pide acá (va a la misma memoria, no dos veces): así la página se
  // vuelve a dibujar cuando llega, y el índice se entera de que esa sección apareció
  useSalon();
  usePases();
  const ins = (liga.d.insignias || []).length;
  const nTemp = Number(String(liga.temp || 't1').replace(/\D/g, '')) || 1;
  const { act, ir, tira, hay } = useIndice(SECCIONES.map((s) => s[0]));
  const numero = (t, v, id) => <div><dt>{t}</dt><dd>{id ? <button type="button" className="sl-num-b" onClick={() => ir(id)}>{v}</button> : v}</dd></div>;
  return (
    <>
      {/* 🎬 «la historia de la Liga» (Dlx, 12/11/2026: «sí, las dos»): el mismo montaje, más oscuro y al 75 % de la
          velocidad: se lee como un recuerdo y no como acción. La caja del trofeo queda adelante */}
      <div className="escena sl-esc con-video" style={{ '--mo-c': '#E5B800', '--mo-o': 0.9, '--mo-c2': '#E41373' }}>
        <FondoVideo liga={liga} lento={0.75} cls="tenue" />
        <section className="sl-cab">
          <div className="sl-cab-tx">
            <span className="tag">LIGA GLOBAL · {liga.temp && liga.temp !== 'prueba' ? liga.temp.toUpperCase() : 'T1'}</span>
            <h1 className="hero-ev largo">Salón de la fama</h1>
            <p className="hero-p">Lo mejor de la Liga Global: los campeones de cada temporada, los récords, las insignias más difíciles y los que ya entraron a un salón. Lo que se gana acá queda para siempre.</p>
            <dl className="sl-num">
              {numero('RÉCORDS', (liga.d.records || []).length, 'sl-records')}
              {/* sin flecha: son todas las del catálogo, y la sección de abajo muestra las más difíciles */}
              {numero('INSIGNIAS', ins, '')}
              {numero('EVENTOS', num(liga.d.eventos || 0), '')}
              {numero('TEMPORADAS', nTemp, 'sl-temporadas')}
            </dl>
          </div>
          <div className="sl-copa" aria-hidden="true"><Ico n="copa" t={150} /></div>
        </section>
      </div>
      {hay.length > 1 ? (
        <nav className="sl-ix" aria-label="Qué hay en el Salón">
          <ol ref={tira}>{SECCIONES.filter(([id]) => hay.includes(id)).map(([id, t]) => (
            <li key={id}><button type="button" className={act === id ? 'on' : ''} aria-current={act === id ? 'true' : undefined} onClick={() => ir(id)}>{t}</button></li>
          ))}</ol>
        </nav>
      ) : null}
      <MesAwards liga={liga} enc={enc} />
      <Temporadas liga={liga} />
      <Records liga={liga} />
      <Insignias liga={liga} perf={perf} />
      <CampeonesLigas liga={liga} />
      <SalonPase liga={liga} />
      <Figuras liga={liga} perf={perf} />
      {!perf ? <p className="sec sl-carga" role="status">Cargando las insignias…</p> : null}
    </>
  );
}
