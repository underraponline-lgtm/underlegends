// El changelog (`#/cambios`): la primera página que el Inicio nuevo le saca a la de hoy. Dlx, 01/10/2026: «1. A».
// Lee el mismo `cambios.json` (estático: no pasa por el Worker). La vieja se sigue dibujando escondida, así que si
// ésta se rompe vuelve aquélla (`Respaldo` en App.jsx).
// Hoy eran las 60 versiones abiertas de una: 31.000 px en el celular. Ahora van por día, con la última abierta y las
// demás plegadas; lo que no habías visto, marcado y abierto. Cada versión tiene su link (`#/cambios/1.59`).
import { useEffect, useMemo, useRef, useState } from 'react';
import { hora } from './liga.js';
import { Chevron, Compartir, Sec, enlace } from './piezas.jsx';

// «1.10» es más nueva que «1.9»: se comparan los números, no el texto (la regla de `nuevaQue()` de app.js)
export function nuevaQue(a, b) {
  const pa = String(a || '').split('.').map(Number);
  const pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (isNaN(x) || isNaN(y)) return String(a) > String(b);
    if (x !== y) return x > y;
  }
  return false;
}

// **negrita** y `código`, como `mdCorto()` de app.js, pero en nodos y no en HTML
function md(t) {
  return String(t || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
    if (/^`[^`]+`$/.test(p)) return <code key={i}>{p.slice(1, -1)}</code>;
    return p;
  });
}

const instante = (x) => x.cuando || (x.dia ? x.dia + 'T12:00:00Z' : '');

function Version({ x, nueva, abierta, onToggle }) {
  return (
    <article className={'cb-v' + (nueva ? ' nueva' : '') + (abierta ? ' abierta' : '')} id={'v' + x.version}>
      <button type="button" className="cb-s" aria-expanded={abierta} onClick={onToggle}>
        <span className="cb-n">v{x.version}</span>
        <span className="cb-t"><b>{x.titulo}</b>
          <small>{x.cuando ? hora(x.cuando) : 'sin hora'}{nueva ? <em>NUEVO</em> : null}</small></span>
        <Chevron />
      </button>
      {abierta ? (
        <div className="cb-c">
          <ul className="cb-i">{(x.items || []).map((it, i) => <li key={i}>{md(it)}</li>)}</ul>
          <Compartir cls="btn borde2 chico" url={enlace('#/cambios/' + x.version)}
            texto={'Lo nuevo de la Liga Global, v' + x.version + ': ' + x.titulo} />
        </div>
      ) : null}
    </article>
  );
}

export function Cambios({ liga, ver, antes }) {
  // app.js ya lo pidió al cargar (el punto de «nuevo» del menú): si está, no se vuelve a pedir
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
  // por día, en la zona de quien mira
  const grupos = useMemo(() => {
    const g = [];
    (lista || []).forEach((x) => {
      const t = instante(x);
      const k = liga.diaClave(t);
      const u = g[g.length - 1];
      if (u && u.k === k) u.xs.push(x); else g.push({ k, t, xs: [x] });
    });
    return g;
  }, [lista, liga]);
  // los días también se pliegan: con todas las versiones plegadas eran 8.000 px en el celular. Abiertos, los dos más
  // nuevos y los que tienen algo abierto (el de la dirección o lo que no habías visto)
  const [dias, setDias] = useState(null);
  useEffect(() => {
    if (dias || !abiertas || !grupos.length) return;
    const d = new Set(grupos.slice(0, 2).map((g) => g.k));
    grupos.forEach((g) => { if (g.xs.some((x) => abiertas.has(x.version))) d.add(g.k); });
    setDias(d);
  }, [dias, abiertas, grupos]);
  // el link a otra versión con la página ya abierta (#/cambios/1.30 desde #/cambios/1.25): su día también se abre
  useEffect(() => {
    if (!ver || !dias) return;
    const g = grupos.find((x) => x.xs.some((y) => y.version === ver));
    if (g && !dias.has(g.k)) setDias(new Set([...dias, g.k]));
  }, [ver, dias, grupos]);
  // la de la dirección, a la vista: cuando su día ya está abierto (antes no existe) y una sola vez por link
  const llevada = useRef('');
  useEffect(() => {
    if (!ver || !abiertas || !dias || llevada.current === ver) return undefined;
    const h = document.getElementById('inicio-nuevo');
    const el = h && h.shadowRoot && h.shadowRoot.getElementById('v' + ver);
    if (!el) return undefined;
    const t = setTimeout(() => { llevada.current = ver; el.scrollIntoView({ block: 'start' }); }, 60);
    return () => clearTimeout(t);
  }, [ver, abiertas, dias]);
  const ab = abiertas || new Set();
  const di = dias || new Set();
  const todas = !!lista && lista.length > 0 && lista.every((x) => ab.has(x.version)) && grupos.every((g) => di.has(g.k));
  const tocar = (v) => setAbiertas((a) => { const n = new Set(a || []); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const tocarDia = (k) => setDias((a) => { const n = new Set(a || []); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const primera = lista && lista[lista.length - 1];
  return (
    <>
      <div className="escena cb-esc" style={{ '--mo-c': '#29B298', '--mo-o': 0.9, '--mo-logo': 'url("/ul.png")' }}>
        <section className="cb-cab" id="cb-cab">
          <span className="tag">CHANGELOG</span>
          <h1 className="hero-ev largo">Lo nuevo de la página</h1>
          <p className="hero-p">Lo que cambió en la página y en el bot, de lo más nuevo a lo más viejo.
            {lista && primera ? ' ' + lista.length + ' versiones desde el ' + liga.fechaLarga(instante(primera)) + '.' : ''}</p>
        </section>
      </div>
      <Sec id="cb" titulo="Todas las versiones" enlace={lista && lista.length ? (todas ? 'Cerrar todas' : 'Abrir todas') : ''}
        onEnlace={() => {
          if (todas) { setAbiertas(new Set()); setDias(new Set(grupos.slice(0, 2).map((g) => g.k))); return; }
          setAbiertas(new Set((lista || []).map((x) => x.version)));
          setDias(new Set(grupos.map((g) => g.k)));
        }}>
        {mal ? <p className="pronto-p">No pude cargar el changelog. Probá recargar la página.</p> : null}
        {!lista && !mal ? <p className="pronto-p">Cargando…</p> : null}
        <div className="cb-lista">
          {grupos.map((g) => {
            const abierto = di.has(g.k);
            const nuevas = antes ? g.xs.filter((x) => nuevaQue(x.version, antes)).length : 0;
            return (
              <div className={'cb-dia' + (abierto ? ' abierto' : '')} key={g.k + g.xs[0].version}>
                <h2 className="cb-dh">
                  <button type="button" className="cb-d" aria-expanded={abierto} onClick={() => tocarDia(g.k)}>
                    <span>{liga.fechaLarga(g.t)}</span>
                    <small>{g.xs.length} {g.xs.length === 1 ? 'versión' : 'versiones'}{nuevas ? ' · ' + nuevas + ' nueva' + (nuevas > 1 ? 's' : '') : ''}</small>
                    <Chevron />
                  </button>
                </h2>
                {abierto ? (
                  <div className="cb-vs">
                    {g.xs.map((x) => <Version key={x.version} x={x} nueva={!!antes && nuevaQue(x.version, antes)}
                      abierta={ab.has(x.version)} onToggle={() => tocar(x.version)} />)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Sec>
    </>
  );
}
