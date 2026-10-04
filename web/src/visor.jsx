// 🃏 LA VENTANA DE UNA TARJETA, NUEVA (03/10/2026, con la llave: el plan del remake, «1. A»). La de app.js (`abrir()`)
// era de la página vieja —oscura, con brillo— y se abría encima de las nuevas. Hace lo mismo: el puesto, el país y la
// crew (se tocan), una pestaña por tarjeta (y tus Bloqueadas, si es la tuya y no estás en la tabla), la imagen de R2
// con su versión, el aviso de «se está redibujando», sus números, Descargar y Ver su perfil. Se cierra con ✕, tocando
// afuera o con Escape, y mientras está abierta la página de atrás no se mueve
import { useEffect, useRef, useState } from 'react';
import { limpio, num, siglaDe } from './liga.js';
import { Bandera, nombrePais } from './piezas.jsx';

const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];

// quien entró con Discord y no está en la tabla (no jugó la temporada): sus tarjetas y sus Bloqueadas (`filaCuenta()`)
function filaDe(liga, dc, k) {
  const f = liga.T[k];
  if (f) return f;
  if (!dc || dc.clave !== k) return null;
  return { k, n: dc.rapero || dc.n, cc: dc.cc, sv: dc.sv, pos: null, ovr: null, pts: 0, ev: dc.ev || 0, wr: '', c: dc.cs || [], bl: dc.bl || [], cuenta: true };
}

// 🔴 BAJAR UNA CARTA NO ES UN `<a download>`: con otro origen (R2) el navegador ignora `download` y abre la imagen.
// Se baja con fetch y se guarda un blob (R2 deja leer desde la página); si falla, se abre en otra pestaña: un botón que
// no hace nada es peor que uno que hace algo parecido (`bajarCarta()` de app.js). El nombre lo pone la página: en R2
// todas se llaman `temporada.webp`
function bajar(url, nombre, fin) {
  fetch(url, { mode: 'cors' }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  }).then((bl) => {
    const u = URL.createObjectURL(bl);
    const a = document.createElement('a');
    a.href = u;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }).catch(() => { window.open(url, '_blank', 'noopener'); }).then(fin, fin);
}

export function VisorCarta({ liga, dc, k, inicial = '', onCerrar }) {
  const f = filaDe(liga, dc, k);
  const cs = f ? ORDEN.filter((c) => (f.c || []).includes(c)) : [];
  const bl = f && f.cuenta ? ORDEN.filter((c) => (f.bl || []).includes(c) && !cs.includes(c)) : [];
  const pest = cs.map((c) => [c, NOMBRE[c]]).concat(bl.map((c) => ['bloq-' + c, NOMBRE[c] + ' 🔒']));
  const primera = inicial && pest.some((p) => p[0] === inicial) ? inicial : (pest[0] ? pest[0][0] : '');
  const [cual, setCual] = useState(primera);
  useEffect(() => { setCual(primera); }, [k, inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const [yendo, setYendo] = useState(false);
  const cerrarB = useRef(null);
  // Escape cierra, la página de atrás no se mueve, y el foco vuelve a donde estaba
  useEffect(() => {
    const antes = document.activeElement;
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    const o = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    if (cerrarB.current) cerrarB.current.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', tecla);
      document.documentElement.style.overflow = o;
      if (antes && antes.focus) { try { antes.focus({ preventScroll: true }); } catch (e) { /* ya no está */ } }
    };
  }, [onCerrar]);
  if (!f) return null;
  const nombre = limpio(f.n);
  const bloq = cual.indexOf('bloq-') === 0;
  const tipo = bloq ? cual.slice(5) : cual;
  const url = !cual ? null : bloq ? liga.d.r2 + '/' + encodeURIComponent(k) + '/' + cual + '.webp' : liga.cartaUrl(k, cual);
  const vieja = !bloq && cual && liga.cartaVieja(k, cual);
  const crew = liga.crewDe ? liga.crewDe(f) : null;
  const sv = f.sv && liga.svs[f.sv];
  const enTabla = !!liga.T[k];
  return (
    <div className="vc" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="vc-caja" role="dialog" aria-modal="true" aria-label={'Las tarjetas de ' + nombre}>
        <header className="vc-cab">
          <div className="vc-q">
            <span className="vc-pos">{f.pos && !f.fc ? '#' + f.pos + ' de la temporada' : f.fc ? 'Fuera de concurso' : 'Sin eventos esta temporada'}</span>
            <h2>{nombre}</h2>
            <p className="vc-sub">
              {f.cc ? <a href={'#/pais/' + f.cc} onClick={onCerrar}><Bandera cc={f.cc} cls="vc-flag" />{nombrePais(f.cc)}</a> : null}
              {f.sv ? <a href={'#/sv/' + siglaDe(f.sv)} onClick={onCerrar}>{(sv && sv.nombre) || siglaDe(f.sv)}</a> : null}
              {crew ? <a href={'#/crew/' + encodeURIComponent(crew.clave || crew.crew)} onClick={onCerrar}>{limpio(crew.crew)}</a> : null}
            </p>
          </div>
          <button type="button" className="vc-x" ref={cerrarB} onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        {pest.length > 1 ? (
          <div className="vc-pest" role="tablist" aria-label="Sus tarjetas">
            {pest.map(([c, et]) => <button key={c} type="button" role="tab" aria-selected={c === cual} className={c === cual ? 'on' : ''} onClick={() => setCual(c)}>{et}</button>)}
          </div>
        ) : null}
        <div className={'vc-img tj-' + tipo}>
          {url ? <img key={url} className="tj-c" src={url} alt={'Tarjeta ' + (NOMBRE[tipo] || tipo) + ' de ' + nombre + (bloq ? ', bloqueada' : '')} />
            : <p className="vc-sin">Todavía no tiene ninguna tarjeta emitida.</p>}
        </div>
        {vieja ? <p className="vc-aviso">⏳ Esta tarjeta se está redibujando con los datos de ahora. Los números de abajo ya son los actuales.</p> : null}
        <dl className="vc-num">
          <div><dt>OVR</dt><dd>{f.ovr || '—'}</dd></div>
          <div><dt>Puntos</dt><dd>{num(f.pts || 0)}</dd></div>
          <div><dt>Eventos</dt><dd>{f.ev || 0}</dd></div>
          <div><dt>Win%</dt><dd>{f.wr ? String(f.wr).replace('.', ',') : '—'}</dd></div>
        </dl>
        <div className="vc-acc">
          {url ? (
            <button type="button" className="btn verde chico" disabled={yendo}
              onClick={() => { setYendo(true); bajar(url, nombre.replace(/[\\/:*?"<>|]/g, '') + ' - ' + (NOMBRE[tipo] || tipo) + (bloq ? ' (bloqueada)' : '') + '.webp', () => setYendo(false)); }}>
              {yendo ? 'Bajando…' : 'Descargar'}
            </button>
          ) : null}
          {enTabla ? <a className="btn borde2 chico" href={'#/r/' + encodeURIComponent(k)} onClick={onCerrar}>Ver su perfil</a> : null}
        </div>
      </div>
    </div>
  );
}
