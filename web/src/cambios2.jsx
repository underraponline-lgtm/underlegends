// 📜 EL CHANGELOG, EL REMAKE (02/11/2026). Dlx: «terminar de remakear las restantes»; para todos desde el mismo día
// («Publica y haz todo»), en lugar de cambios.jsx. Lee el mismo `cambios.json` y abre lo mismo con un link (`#/cambios/4.18`),
// con lo que dejó el research de 21st (scratchpad/remake2/research_publicaciones_cambios.md):
// - POR MES: el más nuevo abierto, los anteriores en una fila con cuántas versiones (eran 323 en una sola lista de días).
// - UN DÍA CERRADO DICE QUÉ TRAE: sus títulos, y no sólo «6 versiones». Abierto, cada versión con su título a la vista y
//   sus cambios plegados.
// - LA FECHA PEGADA AL COSTADO de sus versiones en la compu (en el celular, arriba), la misma grilla para todos los días.
// - UN BUSCADOR: «¿cuándo cambió la Tienda?» busca en los títulos y en cada cambio, y lleva a la versión.
// - «DESDE TU ÚLTIMA VISITA»: los títulos nuevos juntos arriba (con `antes`, la última que viste; los mismos de NUEVO).
// - EL LINK DE CADA VERSIÓN, adentro de su fila.
// ⚠️ Lo que queda abierto al entrar es lo mismo que en cambios.jsx: la de la dirección (o la última) y lo que no habías
// visto, hasta cinco; los dos días más nuevos y los que tienen algo abierto.
//
// 🏁 6.82, CON LA ESTRUCTURA DE LA LLAVE (Dlx, 19/11/2026, «sigue remakeando todo» y, a la maqueta
// https://claude.ai/artifact/UFSGMC2yrybq8Gg5jnkYAN, «A · Como la llave»). Arriba, en la escena: el buscador, la franja
// de cuatro cifras (hoy, esta semana, los días seguidos con algo nuevo y el total), LA ÚLTIMA VERSIÓN EN LA PIEZA BLANCA,
// «desde tu última visita» y UN CALENDARIO DE CALOR con cuántas versiones salieron cada día. Abajo, en el papel, los meses
// como pestañas y cada día con sus versiones en renglones, que se llenan de tinta al abrirse. Todo lo de antes sigue: el
// buscador, NUEVO, el link y el compartir de cada versión, «Abrir todas» y los días viejos plegados con sus títulos.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, hora, norm, nuevaQue } from './liga.js';
import { Chevron, Compartir, Ico, Sec, enlace } from './piezas.jsx';
import { Franja } from './ranking_a.jsx';
import CSS_PAGINA from './css/cambios2.css?inline';
import { usarCss } from './css.js';

usarCss('cambios2', CSS_PAGINA);

// **negrita** y `código`, como en cambios.jsx; y el texto plano, para buscar
function md(t) {
  return String(t || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
    if (/^`[^`]+`$/.test(p)) return <code key={i}>{p.slice(1, -1)}</code>;
    return p;
  });
}
const plano = (t) => String(t || '').replace(/\*\*|`/g, '');
const instante = (x) => x.cuando || (x.dia ? x.dia + 'T12:00:00Z' : '');
const nombreMes = (k) => { const [y, m] = k.split('-').map(Number); return (MESES[m - 1] || '') + ' ' + y; };
const versiones = (n) => n + (n === 1 ? ' versión' : ' versiones');
const nuevas = (n) => n + (n === 1 ? ' nueva' : ' nuevas');
// la palabra buscada, marcada
function Marca({ t, q }) {
  const i = q ? norm(t).indexOf(q) : -1;
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
}

function Version({ x, nueva, abierta, onToggle }) {
  return (
    <article className={'cx-v' + (nueva ? ' nueva' : '') + (abierta ? ' abierta' : '')} id={'v' + x.version}>
      <div className="cx-vf">
        <button type="button" className="cx-s" aria-expanded={abierta} onClick={onToggle}>
          <span className="cx-n">v{x.version}</span>
          <span className="cx-t"><b>{x.titulo}</b><small>{x.cuando ? hora(x.cuando) : 'sin hora'}{nueva ? <em>NUEVO</em> : null}</small></span>
          <Chevron />
        </button>
        <Compartir cls="cx-sh" etiqueta="" url={enlace('#/cambios/' + x.version)} texto={'Lo nuevo de la Liga Global, v' + x.version + ': ' + x.titulo} />
      </div>
      {abierta ? <ul className="cx-i">{(x.items || []).map((it, i) => <li key={i}>{md(it)}</li>)}</ul> : null}
    </article>
  );
}

// los días como claves «AAAA-MM-DD» (en la zona de quien mira, de `liga.diaClave`): sumar días sin pasar por horas
const diaMas = (k, n) => new Date(Date.parse(k + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const diaSem = (k) => (new Date(k + 'T12:00:00Z').getUTCDay() + 6) % 7; // 0 = lunes
// 🟩 EL CALENDARIO DE CALOR: un cuadrado por día desde la primera versión, de lunes a domingo por columna, con la tinta
// por cuántas versiones salieron ese día. Arriba de cada semana, el mes si en ella cae su día 1
function Calor({ porDia, desde, hoy }) {
  const nivel = (n) => (!n ? '' : n <= 5 ? 'n1' : n <= 15 ? 'n2' : n <= 35 ? 'n3' : 'n4');
  const celdas = [];
  for (let k = diaMas(desde, -diaSem(desde)); k <= hoy; k = diaMas(k, 1)) {
    if (diaSem(k) === 0) {
      let m = '';
      for (let j = 0; j < 7; j += 1) { const x = diaMas(k, j); if (x.endsWith('-01') || k <= desde) { m = MESES[Number(x.slice(5, 7)) - 1].slice(0, 3); break; } }
      celdas.push(<b key={'m' + k}>{m}</b>);
    }
    const n = porDia[k] || 0;
    celdas.push(<i key={k} className={(k < desde ? 'no' : nivel(n)) + (k === hoy ? ' hoy' : '')} title={k + ': ' + versiones(n)} />);
  }
  return (
    <>
      <div className="cx-calor" role="img" aria-label="Cuántas versiones salieron cada día">{celdas}</div>
      <div className="cx-ley" aria-hidden="true">Menos <i /><i className="n1" /><i className="n2" /><i className="n3" /><i className="n4" /> más</div>
    </>
  );
}

export function Cambios({ liga, ver, antes: antes0 }) {
  // 🔒 LA ÚLTIMA QUE HABÍAS VISTO, UNA VEZ: tocar una versión vuelve a pasar por `pintaCambios`, que la marca como vista, y
  // con el primer toque se iban la caja «desde tu última visita» y todos los NUEVO (revisión del 04/11/2026)
  const fijo = useRef('');
  if (!fijo.current && antes0) fijo.current = antes0;
  const antes = fijo.current;
  const [lista, setLista] = useState(() => (Array.isArray(window.CAMBIOS) && window.CAMBIOS.length ? window.CAMBIOS : null));
  const [mal, setMal] = useState(false);
  useEffect(() => {
    if (lista) return undefined;
    let vivo = true;
    fetch('/cambios.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (vivo) setLista((d && d.cambios) || []); })
      .catch(() => { if (vivo) setMal(true); });
    return () => { vivo = false; };
  }, [lista]);
  const [q0, setQ] = useState('');
  const q = norm(q0).trim();
  // por mes y por día, en la zona de quien mira
  // 📅 EL GRUPO SE BUSCA POR SU CLAVE, NO SE MIRA SÓLO EL ÚLTIMO (18/11/2026): `cambios.json` va por número de versión, no
  // por hora (varias sesiones publican a la vez: la 6.40 es de las 00:05 del 18 y viene entre la 6.41 y la 6.39, del 17),
  // y el día se repetía: «hoy», «ayer», «hoy», «ayer»…, con claves repetidas que se abrían y cerraban juntas y el mes
  // contando días de más. Adentro de cada día sigue el orden por versión; los meses y los días, del más nuevo al más viejo
  const meses = useMemo(() => {
    const ms = [];
    (lista || []).forEach((x) => {
      const t = instante(x);
      const k = liga.diaClave(t);
      let m = ms.find((y) => y.k === k.slice(0, 7));
      if (!m) { m = { k: k.slice(0, 7), dias: [], n: 0 }; ms.push(m); }
      let d = m.dias.find((y) => y.k === k);
      if (!d) { d = { k, t, xs: [] }; m.dias.push(d); }
      d.xs.push(x);
      m.n += 1;
    });
    const desc = (a, b) => (a.k < b.k ? 1 : a.k > b.k ? -1 : 0);
    ms.sort(desc);
    ms.forEach((m) => m.dias.sort(desc));
    return ms;
  }, [lista, liga]);
  const dias0 = useMemo(() => meses.flatMap((m) => m.dias), [meses]);
  const esNueva = (x) => !!antes && nuevaQue(x.version, antes);
  // abiertas: la de la dirección (o, si no hay, la última) y lo que no habías visto, hasta cinco
  const [abiertas, setAbiertas] = useState(null);
  useEffect(() => {
    if (!lista) return;
    // 🏁 6.82: abajo arranca cerrado, salvo la de la dirección. La última ya está entera en la pieza blanca y las nuevas,
    // en «desde tu última visita»: abiertas también abajo, la misma versión salía dos veces
    const a = new Set();
    if (ver && lista.some((x) => x.version === ver)) a.add(ver);
    setAbiertas(a);
  }, [lista, ver, antes]);
  // los días abiertos (los dos más nuevos y los que tienen algo abierto) y el mes de la pestaña (el de la dirección o el más
  // nuevo). 🏁 6.82: los meses son pestañas; antes eran cajas que se abrían y cerraban
  const [dias, setDias] = useState(null);
  const [mes, setMes] = useState('');
  useEffect(() => {
    if (dias || !abiertas || !dias0.length) return;
    const d = new Set(dias0.slice(0, 2).map((g) => g.k));
    dias0.forEach((g) => { if (g.xs.some((x) => abiertas.has(x.version))) d.add(g.k); });
    setDias(d);
    const g = ver ? dias0.find((x) => x.xs.some((y) => y.version === ver)) : null;
    setMes((m) => m || (g ? g.k.slice(0, 7) : meses[0].k));
  }, [dias, abiertas, dias0, meses, ver]);
  // el link a otra versión con la página ya abierta (o un resultado del buscador): su pestaña y su día también se abren
  // ⚠️ una vez por link: mirando `dias` en cada cambio, el día de esa versión no se podía cerrar
  const abrioVer = useRef('');
  useEffect(() => {
    if (!ver || !dias || abrioVer.current === ver) return;
    const g = dias0.find((x) => x.xs.some((y) => y.version === ver));
    if (!g) return;
    abrioVer.current = ver;
    if (!dias.has(g.k)) setDias(new Set([...dias, g.k]));
    setMes(g.k.slice(0, 7));
  }, [ver, dias, dias0]);
  // la de la dirección, a la vista: cuando ya está dibujada, y una sola vez por link
  const llevada = useRef('');
  useEffect(() => {
    if (!ver || !abiertas || !dias || q || llevada.current === ver) return undefined;
    const h = document.getElementById('inicio-nuevo');
    const el = h && h.shadowRoot && h.shadowRoot.getElementById('v' + ver);
    if (!el) return undefined;
    const t = setTimeout(() => {
      llevada.current = ver;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  }, [ver, abiertas, dias, mes, q]);
  const ab = abiertas || new Set();
  const di = dias || new Set();
  const todas = !!lista && lista.length > 0 && lista.every((x) => ab.has(x.version)) && dias0.every((g) => di.has(g.k));
  // 🏁 lo de la escena: cuántas por día, hoy, la semana, los días seguidos y la última
  const porDia = useMemo(() => Object.fromEntries(dias0.map((g) => [g.k, g.xs.length])), [dias0]);
  const hoy = liga.diaClave(liga.ahora);
  const lunes = diaMas(hoy, -diaSem(hoy));
  const semana = dias0.filter((g) => g.k >= lunes).reduce((t, g) => t + g.xs.length, 0);
  let racha = 0;
  for (let k = porDia[hoy] ? hoy : diaMas(hoy, -1); porDia[k]; k = diaMas(k, -1)) racha += 1;
  const desdeRacha = racha ? diaMas(porDia[hoy] ? hoy : diaMas(hoy, -1), 1 - racha) : '';
  const ultima = lista && lista[0];
  const mesK = mes || (meses[0] ? meses[0].k : '');
  const franja = lista && lista.length ? [
    { l: 'Hoy', v: porDia[hoy] || 0, em: (porDia[hoy] || 0) === 1 ? 'versión' : 'versiones', c: porDia[hoy] && ultima.cuando ? 'la última a las ' + hora(ultima.cuando) : 'la última fue ' + liga.cuando(instante(ultima)) },
    { l: 'Esta semana', v: semana, em: semana === 1 ? 'versión' : 'versiones', c: 'desde el lunes' },
    racha ? { l: 'Días seguidos con algo nuevo', v: racha, em: racha === 1 ? 'día' : 'días', c: 'desde el ' + liga.fechaLarga(desdeRacha + 'T12:00:00') } : null,
    { l: 'En total', v: lista.length, em: 'versiones', c: 'desde el ' + liga.fechaLarga(instante(lista[lista.length - 1])) },
  ].filter(Boolean) : [];
  const alternar = (set, v) => { const n = new Set(set || []); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  const nuevasTodas = antes ? (lista || []).filter((x) => nuevaQue(x.version, antes)) : [];
  // 🔎 en el número de versión («4.18» o «v4.18»), en los títulos y en cada cambio: primero la versión exacta, después
  // las que lo dicen en el título
  const qv = q.replace(/^v/, '');
  const res = q.length >= 2 ? (lista || []).map((x) => {
    const exacta = x.version === qv;
    const enV = exacta || (/^\d+\.\d*$/.test(qv) && x.version.startsWith(qv));
    const enT = norm(x.titulo).includes(q);
    const it = (x.items || []).map(plano).find((s) => norm(s).includes(q));
    return enV || enT || it ? { x, orden: exacta ? 3 : enV ? 2 : enT ? 1 : 0, it } : null;
  }).filter(Boolean).sort((a, b) => b.orden - a.orden).slice(0, 40) : [];
  const corte = (s) => { const j = norm(s).indexOf(q); const a = Math.max(0, j - 60); return (a ? '…' : '') + s.slice(a, a + 170) + (s.length > a + 170 ? '…' : ''); };
  return (
    <>
      <div className="escena cx-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.9, '--mo-logo': 'url("/ul.png")', '--mo-c2': '#E41373' }}>
        <section className="cx-cab rka" id="cx-cab">
          <div className="cx-cabeza">
            <div className="cx-cab-tx">
              <span className="tag">CHANGELOG</span>
              <h1 className="hero-ev largo">Lo nuevo de la página</h1>
              <p className="hero-p">Lo que cambió en la página y en el bot, de lo más nuevo a lo más viejo.</p>
            </div>
            <div className="cx-busca">
              <Ico n="buscar" t={20} />
              <input type="search" value={q0} onChange={(e) => setQ(e.target.value)} placeholder="¿Cuándo cambió…? Tienda, crews, 4.18…"
                aria-label="Buscar en el changelog" enterKeyHint="search" />
              {/* la × del navegador está escondida (no se ve en todos): ésta se toca con el dedo */}
              {q0 ? <button type="button" className="cx-x" aria-label="Borrar la búsqueda" onClick={() => setQ('')}><Ico n="cerrar" t={18} /></button> : null}
            </div>
          </div>
          {franja.length ? <Franja items={franja} /> : null}
          {ultima ? (
            <div className="cx-dos">
              <div className="cx-izq">
                {/* 🏁 la última, en la pieza blanca: su título, todos sus cambios y su link */}
                <article className="cx-ult">
                  <div className="cx-ult-c"><a className="cx-n" href={'#/cambios/' + ultima.version}>v{ultima.version}</a>
                    <small>{liga.fechaLarga(instante(ultima))}{ultima.cuando ? ' · ' + hora(ultima.cuando) : ''}</small>
                    <Compartir cls="cx-sh" etiqueta="" url={enlace('#/cambios/' + ultima.version)} texto={'Lo nuevo de la Liga Global, v' + ultima.version + ': ' + ultima.titulo} /></div>
                  <h2>{ultima.titulo}</h2>
                  <ul>{(ultima.items || []).map((it, i) => <li key={i}>{md(it)}</li>)}</ul>
                </article>
                {nuevasTodas.length > 1 ? (
                  <div className="rka-caja cx-desde">
                    <h2 className="rka-h">Desde tu última visita<small>{nuevas(nuevasTodas.length)} · viste la {antes}</small></h2>
                    <ul>{nuevasTodas.slice(1, 6).map((x) => (
                      <li key={x.version}><a href={'#/cambios/' + x.version} onClick={() => { llevada.current = ''; }}><span className="cx-n">v{x.version}</span><b>{x.titulo}</b></a></li>
                    ))}</ul>
                    {nuevasTodas.length > 6 ? <small>Y {nuevasTodas.length - 6} más, marcadas con NUEVO abajo.</small> : null}
                  </div>
                ) : null}
              </div>
              <div className="rka-caja cx-cal">
                <h2 className="rka-h">Cada día desde el {liga.fechaLarga(instante(lista[lista.length - 1]))}<small>versiones por día</small></h2>
                <Calor porDia={porDia} desde={dias0.length ? dias0[dias0.length - 1].k : hoy} hoy={hoy} />
                {dias0.length ? (() => {
                  const top = dias0.reduce((a, g) => (g.xs.length > a.xs.length ? g : a), dias0[0]);
                  return <dl className="cx-rec"><div><dt>El día con más</dt><dd>{liga.fechaLarga(top.t)} · {top.xs.length}</dd></div>
                    <div><dt>Días con algo nuevo</dt><dd>{dias0.length}</dd></div></dl>;
                })() : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
      {q.length >= 2 ? (
        <Sec id="cx-res" titulo={res.length ? (res.length === 1 ? '1 versión' : res.length + (res.length === 40 ? '+' : '') + ' versiones') + ' con «' + q0.trim() + '»' : 'Nada con «' + q0.trim() + '»'}
          enlace="Borrar" onEnlace={() => setQ('')}>
          {res.length ? (
            <ul className="cx-res">{res.map(({ x, it }) => (
              <li key={x.version}><a href={'#/cambios/' + x.version} onClick={() => { llevada.current = ''; setQ(''); }}>
                <span className="cx-n">v{x.version}</span>
                <span className="cx-res-t"><b><Marca t={x.titulo} q={q} /></b><small>{liga.fechaLarga(instante(x))}</small>
                  {it ? <span><Marca t={corte(it)} q={q} /></span> : null}</span>
              </a></li>
            ))}</ul>
          ) : <p className="pronto-p">Prueba con otra palabra: el nombre de una página («Tienda», «Ranking») o de una cosa («crew», «carta»).</p>}
        </Sec>
      ) : (
        <>
          <Sec id="cx" titulo="Todas las versiones" extra="rka-papel cx-papel" enlace={lista && lista.length ? (todas ? 'Cerrar todas' : 'Abrir todas') : ''}
            onEnlace={() => {
              if (todas) { setAbiertas(new Set()); setDias(new Set(dias0.slice(0, 2).map((g) => g.k))); return; }
              setAbiertas(new Set((lista || []).map((x) => x.version)));
              setDias(new Set(dias0.map((g) => g.k)));
            }}>
            {mal ? <p className="pronto-p">No pude cargar el changelog. Prueba recargar la página.</p> : null}
            {!lista && !mal ? <p className="pronto-p">Cargando…</p> : null}
            {meses.length > 1 ? (
              <div className="rka-pes cx-pes" role="tablist" aria-label="Qué mes ver">
                {meses.map((m) => {
                  const nM = antes ? m.dias.reduce((s, d) => s + d.xs.filter(esNueva).length, 0) : 0;
                  return (
                    <button key={m.k} type="button" role="tab" aria-selected={mesK === m.k} className={mesK === m.k ? 'on' : ''} onClick={() => setMes(m.k)}>
                      {nombreMes(m.k)}<small>{m.n}{nM ? ' · ' + nuevas(nM) : ''}</small></button>
                  );
                })}
              </div>
            ) : null}
            {meses.filter((m) => m.k === mesK).map((m) => {
              return (
                <section key={m.k} className="cx-mes abierto">
                  {m.dias.map((g) => {
                    const abierto = di.has(g.k);
                    const nD = antes ? g.xs.filter(esNueva).length : 0;
                    return (
                      <div key={g.k} className={'cx-dia' + (abierto ? ' abierto' : '')}>
                        <div className="cx-dc">
                          <button type="button" className="cx-d" aria-expanded={abierto} onClick={() => setDias((s) => alternar(s, g.k))}>
                            <b>{liga.fechaLarga(g.t)}</b><small>{versiones(g.xs.length)}{nD ? ' · ' + nuevas(nD) : ''}</small><Chevron />
                          </button>
                        </div>
                        {abierto ? (
                          <div className="cx-vs">
                            {g.xs.map((x) => <Version key={x.version} x={x} nueva={esNueva(x)} abierta={ab.has(x.version)}
                              onToggle={() => setAbiertas((s) => alternar(s, x.version))} />)}
                          </div>
                        ) : (
                          // cerrado, dice qué trae: los títulos, y no sólo cuántas
                          // el «+N» va afuera del recorte de dos renglones: adentro, en 8 de 25 días no se llegaba a ver
                          <button type="button" className="cx-prev" onClick={() => setDias((s) => alternar(s, g.k))} aria-label={'Abrir el ' + liga.fechaLarga(g.t)}>
                            <span className="cx-prev-t">{g.xs.slice(0, 3).map((x, i) => <span key={x.version}>{i ? ' · ' : ''}{x.titulo}</span>)}</span>
                            {g.xs.length > 3 ? <em>+{g.xs.length - 3}</em> : null}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </Sec>
        </>
      )}
    </>
  );
}
