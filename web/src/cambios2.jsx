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
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, hora, norm, nuevaQue } from './liga.js';
import { Chevron, Compartir, Ico, Sec, enlace } from './piezas.jsx';
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

export function Cambios({ liga, ver, antes }) {
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
  const meses = useMemo(() => {
    const ms = [];
    (lista || []).forEach((x) => {
      const t = instante(x);
      const k = liga.diaClave(t);
      let m = ms[ms.length - 1];
      if (!m || m.k !== k.slice(0, 7)) { m = { k: k.slice(0, 7), dias: [], n: 0 }; ms.push(m); }
      let d = m.dias[m.dias.length - 1];
      if (!d || d.k !== k) { d = { k, t, xs: [] }; m.dias.push(d); }
      d.xs.push(x);
      m.n += 1;
    });
    return ms;
  }, [lista, liga]);
  const dias0 = useMemo(() => meses.flatMap((m) => m.dias), [meses]);
  const esNueva = (x) => !!antes && nuevaQue(x.version, antes);
  // abiertas: la de la dirección (o, si no hay, la última) y lo que no habías visto, hasta cinco
  const [abiertas, setAbiertas] = useState(null);
  useEffect(() => {
    if (!lista) return;
    const a = new Set();
    if (ver && lista.some((x) => x.version === ver)) a.add(ver);
    else if (lista[0]) a.add(lista[0].version);
    if (antes) lista.filter((x) => nuevaQue(x.version, antes)).slice(0, 5).forEach((x) => a.add(x.version));
    setAbiertas(a);
  }, [lista, ver, antes]);
  // los días abiertos (los dos más nuevos y los que tienen algo abierto) y los meses abiertos (el más nuevo y los de esos días)
  const [dias, setDias] = useState(null);
  const [mesesAb, setMesesAb] = useState(null);
  useEffect(() => {
    if (dias || !abiertas || !dias0.length) return;
    const d = new Set(dias0.slice(0, 2).map((g) => g.k));
    dias0.forEach((g) => { if (g.xs.some((x) => abiertas.has(x.version))) d.add(g.k); });
    setDias(d);
    setMesesAb(new Set([meses[0].k, ...[...d].map((k) => k.slice(0, 7))]));
  }, [dias, abiertas, dias0, meses]);
  // el link a otra versión con la página ya abierta (o un resultado del buscador): su mes y su día también se abren
  useEffect(() => {
    if (!ver || !dias || !mesesAb) return;
    const g = dias0.find((x) => x.xs.some((y) => y.version === ver));
    if (!g) return;
    if (!dias.has(g.k)) setDias(new Set([...dias, g.k]));
    if (!mesesAb.has(g.k.slice(0, 7))) setMesesAb(new Set([...mesesAb, g.k.slice(0, 7)]));
  }, [ver, dias, mesesAb, dias0]);
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
  }, [ver, abiertas, dias, mesesAb, q]);
  const ab = abiertas || new Set();
  const di = dias || new Set();
  const me = mesesAb || new Set();
  const todas = !!lista && lista.length > 0 && lista.every((x) => ab.has(x.version)) && dias0.every((g) => di.has(g.k)) && meses.every((m) => me.has(m.k));
  const alternar = (set, v) => { const n = new Set(set || []); if (n.has(v)) n.delete(v); else n.add(v); return n; };
  const primera = lista && lista[lista.length - 1];
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
        <section className="cx-cab" id="cx-cab">
          <div className="cx-cab-tx">
            <span className="tag">CHANGELOG</span>
            <h1 className="hero-ev largo">Lo nuevo de la página</h1>
            <p className="hero-p">Lo que cambió en la página y en el bot, de lo más nuevo a lo más viejo.
              {lista && primera ? ' ' + versiones(lista.length) + ' desde el ' + liga.fechaLarga(instante(primera)) + '.' : ''}</p>
          </div>
          <div className="cx-busca">
            <Ico n="buscar" t={20} />
            <input type="search" value={q0} onChange={(e) => setQ(e.target.value)} placeholder="¿Cuándo cambió…? Tienda, crews, 4.18…"
              aria-label="Buscar en el changelog" enterKeyHint="search" />
            {/* la × del navegador está escondida (no se ve en todos): ésta se toca con el dedo */}
            {q0 ? <button type="button" className="cx-x" aria-label="Borrar la búsqueda" onClick={() => setQ('')}><Ico n="cerrar" t={18} /></button> : null}
          </div>
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
          {nuevasTodas.length ? (
            <section className="sec cx-desde" aria-label="Desde tu última visita">
              <div className="cx-desde-c">
                <b className="cx-desde-t">{nuevasTodas.length === 1 ? '1 cambio' : nuevasTodas.length + ' cambios'} desde tu última visita</b>
                <ul>{nuevasTodas.slice(0, 6).map((x) => (
                  <li key={x.version}><a href={'#/cambios/' + x.version} onClick={() => { llevada.current = ''; }}><span className="cx-n">v{x.version}</span><b>{x.titulo}</b></a></li>
                ))}</ul>
                {nuevasTodas.length > 6 ? <small>Y {nuevasTodas.length - 6} más, marcadas con NUEVO abajo.</small> : null}
              </div>
            </section>
          ) : null}
          <Sec id="cx" titulo="Todas las versiones" enlace={lista && lista.length ? (todas ? 'Cerrar todas' : 'Abrir todas') : ''}
            onEnlace={() => {
              if (todas) { setAbiertas(new Set()); setDias(new Set(dias0.slice(0, 2).map((g) => g.k))); setMesesAb(new Set(meses.length ? [meses[0].k] : [])); return; }
              setAbiertas(new Set((lista || []).map((x) => x.version)));
              setDias(new Set(dias0.map((g) => g.k)));
              setMesesAb(new Set(meses.map((m) => m.k)));
            }}>
            {mal ? <p className="pronto-p">No pude cargar el changelog. Prueba recargar la página.</p> : null}
            {!lista && !mal ? <p className="pronto-p">Cargando…</p> : null}
            {meses.map((m) => {
              const abiertoM = me.has(m.k);
              const nM = antes ? m.dias.reduce((s, d) => s + d.xs.filter(esNueva).length, 0) : 0;
              return (
                <section key={m.k} className={'cx-mes' + (abiertoM ? ' abierto' : '')}>
                  <h3 className="cx-mh">
                    <button type="button" aria-expanded={abiertoM} onClick={() => setMesesAb((s) => alternar(s, m.k))}>
                      <span>{nombreMes(m.k)}</span><small>{versiones(m.n)} · {m.dias.length} {m.dias.length === 1 ? 'día' : 'días'}{nM ? ' · ' + nuevas(nM) : ''}</small>
                      <Chevron />
                    </button>
                  </h3>
                  {abiertoM ? m.dias.map((g) => {
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
                  }) : null}
                </section>
              );
            })}
          </Sec>
        </>
      )}
    </>
  );
}
