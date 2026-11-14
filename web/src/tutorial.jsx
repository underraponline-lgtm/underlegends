// 🧭 EL TUTORIAL. Nació el 12/10/2026 (Dlx: «A pero que no sea necesariamente con jugar tu primer evento… B me gusta, C me
// gusta pero que sea lo que B no mostró, D me gusta así atrapamos la atracción, E. Dale») y se rehízo el 13/11/2026, con el
// Inicio nuevo (Dlx: «remakear también el tutorial para nuevos usuarios… no solo en el inicio sino en general… un tutorial
// corto y la opción de tener un tutorial más completo»; a la maqueta: el corto da 3 Dragón Drops, el completo 1 cofre, los
// dos si estás vinculado —si no, «te esperan»—, y «el completo en la guía tmb»). Quién es nuevo y lo que se cuenta, en
// primera.js; qué señala cada paso, en capitulos.js; acá lo que se dibuja:
//
//   A · `PrimerosPasos`: una lista que se tilda sola, en la Guía (y en el Inicio pasada la primera semana)
//   B · `Recorrido`: elegir rápido o completo; el corto (cinco pasos en el Inicio) y cada capítulo del completo en su página
//   C · `NOTAS`: una línea la primera vez en una página que no tiene capítulo (las que lo tienen llevan su «¿Cómo funciona?»)
//   D · la franja: quien entra por un link (un perfil, una llave) ve primero eso, y arriba «¿primera vez?»
//   E · lo cuenta `contar()`, y lo muestra el Dashboard
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { Ico, accion } from './piezas.jsx';
import { usePase } from './pase.js';
import { CAPITULOS, CORTO, capituloDe } from './capitulos.js';
import { pedirNuevo, txtPremio } from './nuevos.jsx';
import { LLEGADA, PRIMERA_VISITA, contar, enSemanaNueva, pedirRecorrido, reciente, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
const leerLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// ── B · el recorrido ─────────────────────────────────────────────────────────────────────────────────────────────
/** Lo señalado: el `data-tuto` que se ve (el del menú de arriba en la compu, el de la tira en el celular) */
function blanco(raiz, sel) {
  if (!raiz || !sel) return null;
  const xs = Array.from(raiz.querySelectorAll('[data-tuto="' + sel + '"]'));
  return xs.find((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
}
/** La página que se ve, como la llama App.jsx ('' es el Inicio) */
const paginaVista = () => {
  const r = W.rutaLG ? W.rutaLG() : String(location.hash || '').replace(/^#\/?/, '');
  return String(r || '').split('?')[0].split('/')[0];
};
/** Ir a una página y esperar a que aparezca `sel` (hasta 3 s: si no aparece, la caja va al centro) */
function irYEsperar(ruta, sel, raiz, listo) {
  const pag = ruta.replace(/^#\/?/, '').split('/')[0];
  if (paginaVista() !== pag) location.hash = ruta;
  const t0 = Date.now();
  const mirar = () => {
    if ((paginaVista() === pag && blanco(raiz(), sel)) || Date.now() - t0 > 3000) { listo(); return; }
    setTimeout(mirar, 120);
  };
  setTimeout(mirar, 60);
}

function Foco({ paso, n, de, onSig, onAtras, onSaltar, ultimo, txtUltimo }) {
  const [caja, setCaja] = useState(null);
  const yo = useRef(null);
  const sig = useRef(null);
  const medir = useCallback(() => {
    const el = blanco(yo.current && yo.current.getRootNode(), paso.sel);
    if (!el) { setCaja(null); return; }
    const r = el.getBoundingClientRect();
    setCaja({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [paso]);
  useLayoutEffect(() => {
    const el = blanco(yo.current && yo.current.getRootNode(), paso.sel);
    if (el) {
      // en el celular la tira de abajo se desliza: se corre ella, nunca la página
      const tira = el.closest('.tb-tira');
      if (tira) tira.scrollLeft = Math.max(0, el.offsetLeft - (tira.clientWidth - el.offsetWidth) / 2);
      else {
        const r = el.getBoundingClientRect(), vh = W.innerHeight || 640;
        if (r.top < 70 || r.bottom > vh - 20) el.scrollIntoView({ block: r.height > vh * 0.6 ? 'start' : 'center' });
      }
    }
    medir();
    const t = setTimeout(medir, 350);
    return () => clearTimeout(t);
  }, [medir, paso]);
  useEffect(() => {
    W.addEventListener('resize', medir);
    W.addEventListener('scroll', medir, { passive: true });
    return () => { W.removeEventListener('resize', medir); W.removeEventListener('scroll', medir); };
  }, [medir]);
  useEffect(() => { if (sig.current) sig.current.focus({ preventScroll: true }); }, [paso]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onSaltar(); };
    W.addEventListener('keydown', k);
    return () => W.removeEventListener('keydown', k);
  }, [onSaltar]);
  const vw = W.innerWidth || 360, vh = W.innerHeight || 640;
  const ancho = Math.min(380, vw - 32);
  let pos = { left: Math.round((vw - ancho) / 2), top: Math.round(vh * 0.2) };
  if (caja) {
    const left = Math.round(Math.min(Math.max(16, caja.x + caja.w / 2 - ancho / 2), vw - ancho - 16));
    if (vh - (caja.y + caja.h) > 230) pos = { left, top: Math.round(caja.y + caja.h + 14) };
    else if (caja.y > 230) pos = { left, bottom: Math.round(vh - caja.y + 14) };
    else pos = { left, bottom: 16 };
  }
  return (
    <div className="rc" ref={yo}>
      <div className="rc-tapa" />
      {caja ? <div className="rc-luz" style={{ left: caja.x - 6, top: caja.y - 6, width: caja.w + 12, height: caja.h + 12 }} />
        : <div className="rc-luz rc-todo" />}
      <div className="rc-caja" role="dialog" aria-modal="true" aria-labelledby="rc-h" style={Object.assign({ width: ancho }, pos)}>
        <div className="rc-cab"><span className="tag">{paso.k}</span><small>{n} de {de}</small></div>
        <span className="rc-seg" aria-hidden="true">{Array.from({ length: de }, (_, j) => <i key={j} className={j < n ? 'si' : ''} />)}</span>
        <h2 id="rc-h">{paso.h}</h2>
        <p>{paso.p}</p>
        <div className="rc-acc">
          <button type="button" className="btn verde chico" ref={sig} onClick={onSig}>{ultimo ? txtUltimo : 'Siguiente'}</button>
          {n > 1 ? <button type="button" className="btn borde2 chico" onClick={onAtras}>Atrás</button> : null}
          <button type="button" className="rc-saltar" onClick={onSaltar}>Saltar</button>
        </div>
      </div>
    </div>
  );
}

/** Una ventana al centro (elegir, y los finales) */
function Centro({ children, onCerrar, et }) {
  const yo = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onCerrar(); };
    W.addEventListener('keydown', k);
    // el foco, en lo principal (no en la ✕ de arriba)
    const b = yo.current && (yo.current.querySelector('.rc-acc .btn, .rc-op') || yo.current.querySelector('button, a'));
    if (b) b.focus({ preventScroll: true });
    return () => W.removeEventListener('keydown', k);
  }, [onCerrar]);
  return (
    <div className="rc">
      <div className="rc-luz rc-todo" />
      <div className="rc-caja rc-centro" role="dialog" aria-modal="true" aria-labelledby="rc-h" ref={yo}>
        <div className="rc-cab"><span className="tag">{et}</span>
          <button type="button" className="btn-ico rc-x" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Los drops que esperan, con candado si no está vinculado */
function Huevos({ n, cofre, lock }) {
  return (
    <span className="rc-huevos" aria-hidden="true">
      {Array.from({ length: n }, (_, j) => <i key={j} className={(cofre ? 'cofre' : '') + (lock ? ' lock' : '')}>{lock ? <Ico n="candado" t={13} /> : null}</i>)}
    </span>
  );
}

/**
 * El recorrido entero. `inicio`: 'elegir', 'corto' o 'cap:<id>'. Al terminar el corto o el último capítulo se avisa al
 * objeto (`pedirNuevo`), que paga si esa persona tiene la pista de nuevos; la ventana del final dice lo que pasó de verdad
 */
function Recorrido({ liga, dc, inicio, onCerrar }) {
  const [modo, setModo] = useState(null);   // 'elegir' | 'corto' | 'cap' | 'fin' | 'espera'
  const [cap, setCap] = useState(null);
  const [i, setI] = useState(0);
  const [fin, setFin] = useState(null);     // { que: 'corto' | 'cap' | 'completo', premio: bool | null }
  const raiz = useRef(null);
  const c = liga.d.comunidad || {};
  const deRaiz = () => (raiz.current ? raiz.current.getRootNode() : null);

  const empezarCorto = useCallback(() => {
    setModo('espera');
    irYEsperar('#/', CORTO[0].sel, deRaiz, () => { setI(0); setModo('corto'); contar('tour'); });
  }, []);
  const empezarCap = useCallback((id) => {
    const C = CAPITULOS.find((x) => x.id === id);
    if (!C) { onCerrar('salto', 0); return; }
    setModo('espera');
    irYEsperar(C.ruta, C.pasos[0].sel, deRaiz, () => { setCap(C); setI(0); setModo('cap'); contar('cap_' + C.id); });
  }, [onCerrar]);
  useEffect(() => {
    if (inicio === 'corto') empezarCorto();
    else if (String(inicio).startsWith('cap:')) empezarCap(String(inicio).slice(4));
    else setModo('elegir');
  }, [inicio, empezarCorto, empezarCap]);

  // ¿cobró? Se le pregunta al objeto (sólo con cuenta); sin cuenta, lo que dice este navegador
  const cobrar = (que, id) => {
    const ok = (D) => {
      const P = D && D.pista;
      if (!P) return false;
      const m = P.dias.flatMap((x) => x.mis).find((x) => x.id === id);
      return !!(m && m.ok);
    };
    setFin({ que, premio: dc ? null : (enSemanaNueva() ? 'espera' : false) });
    setModo('fin');
    if (dc) pedirNuevo(dc, true).then((D) => setFin({ que, premio: ok(D) }));
  };
  const terminarCorto = () => {
    tutoPoner({ corto: 'fin', tour: 'fin' });
    contar('tour_fin');
    cobrar('corto', 'corto');
  };
  const terminarCap = () => {
    const T = tuto() || {};
    const caps = Object.assign({}, T.caps || {}, { [cap.id]: 1 });
    const todos = CAPITULOS.every((x) => caps[x.id]);
    tutoPoner(Object.assign({ caps }, todos ? { completo: 1 } : {}));
    if (todos && !T.completo) { contar('completo'); cobrar('completo', 'completo'); return; }
    setFin({ que: 'cap' }); setModo('fin');
  };
  const cerrar = (como) => onCerrar(como || 'salto', i + 1);

  let dentro = null;
  if (modo === 'elegir') {
    dentro = (
      <Centro et="BIENVENIDO" onCerrar={() => cerrar('salto')}>
        <h2 id="rc-h">¿Cómo quieres conocer la Liga?</h2>
        <p>{c.personas && c.servidores ? <>{num(c.personas)} raperos de {num(c.servidores)} servidores de Discord compiten en un mismo ranking. </> : null}
          Te lo mostramos sobre la página de verdad.</p>
        <div className="rc-ops">
          <button type="button" className="rc-op" onClick={empezarCorto}>
            <b>Rápido</b><span>Un minuto: cinco pasos acá en el Inicio.</span>
            <small>{enSemanaNueva() ? 'Te llevas 3 Dragón Drops' : '5 pasos · 1 min'}</small></button>
          <button type="button" className="rc-op" onClick={() => { cerrar('completo'); location.hash = '#/guia'; setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>
            <b>Completo</b><span>Nueve capítulos de un minuto, cada uno en su página.</span>
            <small>{enSemanaNueva() ? 'Te llevas 1 cofre' : '9 capítulos'}</small></button>
        </div>
        {(W.innerWidth || 0) < 900 ? <p className="rc-nota">Todo está en la barra de abajo, que se desliza de costado.</p> : null}
        <div className="rc-acc"><button type="button" className="rc-saltar" onClick={() => cerrar('salto')}>Ahora no</button></div>
      </Centro>
    );
  } else if (modo === 'corto') {
    const paso = CORTO[i];
    dentro = <Foco paso={!dc && paso.pSin ? Object.assign({}, paso, { p: paso.pSin }) : paso} n={i + 1} de={CORTO.length} ultimo={i === CORTO.length - 1} txtUltimo="Terminar"
      onSig={() => (i === CORTO.length - 1 ? terminarCorto() : setI(i + 1))} onAtras={() => setI(Math.max(0, i - 1))} onSaltar={() => cerrar('salto')} />;
  } else if (modo === 'cap' && cap) {
    dentro = <Foco paso={cap.pasos[i]} n={i + 1} de={cap.pasos.length} ultimo={i === cap.pasos.length - 1} txtUltimo="Terminar el capítulo"
      onSig={() => (i === cap.pasos.length - 1 ? terminarCap() : setI(i + 1))} onAtras={() => setI(Math.max(0, i - 1))} onSaltar={() => cerrar('salto')} />;
  } else if (modo === 'fin' && fin) {
    const sinCuenta = fin.premio === 'espera';
    const gano = fin.premio === true;
    if (fin.que === 'cap') {
      const T = tuto() || {};
      const hechos = CAPITULOS.filter((x) => (T.caps || {})[x.id]).length;
      const sigue = CAPITULOS.find((x) => !(T.caps || {})[x.id]);
      dentro = (
        <Centro et={'CAPÍTULO ' + (CAPITULOS.indexOf(cap) + 1) + ' DE ' + CAPITULOS.length} onCerrar={() => cerrar('fin')}>
          <h2 id="rc-h">{cap.t}: listo</h2>
          <p>Llevas {hechos} de {CAPITULOS.length}.{enSemanaNueva() ? ' Al terminar los nueve te llevas un cofre.' : ''}</p>
          <span className="rc-barra" aria-hidden="true"><i style={{ width: (100 * hechos) / CAPITULOS.length + '%' }} /></span>
          <div className="rc-acc">
            {sigue ? <button type="button" className="btn verde chico" onClick={() => { setFin(null); empezarCap(sigue.id); }}>Siguiente: {sigue.t}</button> : null}
            <a className="btn borde2 chico" href="#/guia" onClick={() => { cerrar('fin'); setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>Los capítulos</a>
          </div>
        </Centro>
      );
    } else {
      const corto = fin.que === 'corto';
      dentro = (
        <Centro et={corto ? 'TUTORIAL CORTO · ' + CORTO.length + ' DE ' + CORTO.length : 'TUTORIAL COMPLETO'} onCerrar={() => cerrar('fin')}>
          <h2 id="rc-h">{corto ? 'Ya conoces la Liga' : 'Terminaste el tutorial completo'}</h2>
          {fin.premio === null ? <p>Un momento…</p>
            : gano ? <><p>Te ganaste {corto ? <b>3 Dragón Drops</b> : <b>un cofre</b>}: ábrelos cuando quieras.</p><Huevos n={corto ? 3 : 1} cofre={!corto} /></>
              : sinCuenta ? <><p>Te ganaste {corto ? <b>3 Dragón Drops</b> : <b>un cofre</b>}. Te esperan en cuanto vincules tu cuenta de Discord: es gratis y tarda diez segundos.</p>
                <Huevos n={corto ? 3 : 1} cofre={!corto} lock /></>
                : <p>{corto ? 'Ya sabes dónde está cada cosa.' : 'Ya pasaste por todas las páginas de la Liga.'} Lo que sigue: entra a un evento o sube el Pase con Tareas.</p>}
          <div className="rc-acc">
            {gano ? <button type="button" className="btn verde chico" onClick={() => { cerrar('fin'); W.dispatchEvent(new Event('lg:abrir-drops')); }}>{corto ? 'Abrirlos' : 'Abrir el cofre'}</button>
              : sinCuenta ? <button type="button" className="btn chico rc-dc" onClick={() => { cerrar('fin'); accion.entrar(); }}>Vincular con Discord y recibirlos</button>
                : <button type="button" className="btn verde chico" onClick={() => cerrar('fin')}>Listo</button>}
          </div>
          {corto ? (
            <p className="rc-mas">¿Quieres más? El <b>tutorial completo</b> son nueve capítulos de un minuto{enSemanaNueva() ? <> y da <b>1 cofre</b> al terminarlo</> : null}.{' '}
              <a href="#/guia" onClick={() => { cerrar('fin'); setTimeout(() => W.dispatchEvent(new Event('lg:aprende')), 300); }}>Ver los capítulos</a></p>
          ) : null}
        </Centro>
      );
    }
  }
  return <span ref={raiz} className="rc-raiz">{dentro}</span>;
}

// ── C · la primera vez en cada página que no tiene capítulo ───────────────────────────────────────────────────
// ⚠️ UN CONSEJO DE QUÉ HACER, NO QUÉ ES. Las páginas con capítulo (capitulos.js) llevan su «¿Cómo funciona?» en vez de esto
const NOTAS = {
  socios: '¿Tu servidor no está? Escríbele a @itsdlx en Discord.',
  r: 'Con «Seguir» te avisa cuando gana algo, y con el botón de compartir mandas su perfil.',
  llave: 'Si se está jugando, se actualiza sola: déjala abierta y mira quién pasa.',
  sv: 'En Eventos, en «Cuándo suele jugar», puedes seguir a sus organizadores: te avisa cuando anuncian.',
  pais: 'Los raperos de un país en la temporada, y cómo le va al país en el ranking mundial.',
};

// ── D · quien llega por un link ve primero eso; arriba, la invitación a mirar cómo funciona ──────────────────────
const FRANJA = {
  r: '¿Primera vez en la Liga? Así se consigue una tarjeta como ésta.',
  tarjetas: '¿Primera vez en la Liga? Así se consigue la tuya.',
  llave: '¿Primera vez en la Liga? Así funciona cada evento.',
};
// donde alguien vino a hacer algo puntual, no se le cruza nada
const SIN_FRANJA = { cuenta: 1, ajustes: 1, dashboard: 1, cambios: 1, guia: 1 };

/**
 * Lo del tutorial que vive en toda la página: el recorrido (solo la primera vez por el Inicio, o pedido), la franja de
 * quien llegó por un link y la nota de cada página. Va arriba del contenido, debajo de la cabecera. `pedido`:
 * `{n, que}` de App.jsx (cada pedido, un número nuevo)
 */
export function Tutorial({ liga, dc, pagina, sv, pedido }) {
  const T = tuto();
  const [abierto, setAbierto] = useState(null);
  const [franja, setFranja] = useState(() => !!(PRIMERA_VISITA && T && !T.tour && T.franja !== 'no' && LLEGADA
    && !SIN_FRANJA[LLEGADA]));
  const clave = sv ? 'sv' : pagina;
  const [nota, setNota] = useState(null);
  const enInicio = useRef(pagina === '');
  enInicio.current = pagina === '';

  // B · solo, una vez: la primera visita, entrando por el Inicio, después de que se vea la página
  useEffect(() => {
    if (!T || !T.nuevo || T.tour || !PRIMERA_VISITA || LLEGADA !== '') return undefined;
    // ⏳ y no ENCIMA de una historia o una tarjeta abierta (18/10/2026): espera a que la cierre
    const hayVentana = () => {
      try { return !!document.getElementById('inicio-nuevo').shadowRoot.querySelector('.hv-ov, .vc, [aria-modal="true"]'); } catch (e) { return false; }
    };
    let t = 0;
    const probar = () => {
      if (!enInicio.current || tuto().tour) return;
      if (hayVentana()) { t = setTimeout(probar, 1500); return; }
      setAbierto({ que: 'elegir', n: 0 });
    };
    t = setTimeout(probar, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // y pedido (la Guía, el «¿Cómo funciona?» de cada página, la pista de nuevos), las veces que se quiera
  useEffect(() => {
    if (!pedido || !pedido.n) return;
    setFranja(false); setAbierto({ que: pedido.que || 'elegir', n: pedido.n }); contar('repite');
  }, [pedido]);
  useEffect(() => { if (franja) contar('franja'); }, [franja]);
  // C · la nota, una vez por página: no mientras esté la franja (una sola invitación arriba) ni con el recorrido abierto
  useEffect(() => {
    const t = tuto();
    if (!t || !reciente() || !NOTAS[clave] || capituloDe(clave) || (t.notas || {})[clave] || franja) { setNota(null); return; }
    setNota(clave);
    tutoPoner({ notas: Object.assign({}, t.notas || {}, { [clave]: 1 }) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cerrar = useCallback((como, n) => {
    setAbierto(null);
    const t = tuto();
    if (t && !t.tour) tutoPoner({ tour: como === 'fin' ? 'fin' : 'salto' });
    if (como === 'salto') contar('salta' + Math.min(4, n || 0));
  }, []);
  const verFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); contar('franja_si'); setAbierto({ que: 'elegir', n: -1 }); };
  const cerrarFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); };

  return (
    <>
      {franja && !abierto ? (
        <div className="rc-franja" role="region" aria-label="Primera vez">
          <p>{FRANJA[LLEGADA] || '¿Primera vez en la Liga? Mira cómo funciona.'}</p>
          <button type="button" className="btn verde chico" onClick={verFranja}>Ver cómo · 1 min</button>
          <button type="button" className="btn-ico rc-x" aria-label="Cerrar" onClick={cerrarFranja}><Ico n="cerrar" t={18} /></button>
        </div>
      ) : null}
      {nota && nota === clave && !abierto ? (
        <div className="rc-nota-p" role="note">
          <span className="rc-nota-t">PRIMERA VEZ ACÁ</span>
          <p>{NOTAS[nota]}</p>
          <button type="button" className="btn-ico rc-x" aria-label="Entendido" onClick={() => setNota(null)}><Ico n="cerrar" t={18} /></button>
        </div>
      ) : null}
      {abierto ? <Recorrido key={abierto.n} liga={liga} dc={dc} inicio={abierto.que} onCerrar={cerrar} /> : null}
    </>
  );
}

// ── el completo, en la Guía ───────────────────────────────────────────────────────────────────────────────────
/** «Aprende la Liga»: los nueve capítulos, con dónde quedaste */
export function Capitulos() {
  const [, setN] = useState(0);
  const yo = useRef(null);
  useEffect(() => {
    const ir = () => { if (yo.current) yo.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    W.addEventListener('lg:aprende', ir);
    const vuelve = () => setN((n) => n + 1);
    W.addEventListener('focus', vuelve);
    return () => { W.removeEventListener('lg:aprende', ir); W.removeEventListener('focus', vuelve); };
  }, []);
  const T = tuto() || {};
  const caps = T.caps || {};
  const hechos = CAPITULOS.filter((c) => caps[c.id]).length;
  const sigue = CAPITULOS.find((c) => !caps[c.id]);
  return (
    <div className="ap" ref={yo} id="aprende">
      <div className="ap-cab">
        <p>Nueve capítulos de un minuto. Cada uno te lleva a su página y te muestra lo que hay. Se guarda dónde quedaste.
          {enSemanaNueva() && !T.completo ? <> Al terminar los nueve te llevas <b>{txtPremio(['cofre'])}</b>.</> : null}</p>
        <span className="ap-av"><b>{hechos} de {CAPITULOS.length}</b><span className="rc-barra" aria-hidden="true"><i style={{ width: (100 * hechos) / CAPITULOS.length + '%' }} /></span></span>
        <button type="button" className="ap-corto" onClick={() => pedirRecorrido('corto')}>¿Apurado? El corto · 1 min</button>
      </div>
      <ol className="ap-l">
        {CAPITULOS.map((c, j) => {
          const ok = !!caps[c.id], ahora = sigue && sigue.id === c.id;
          return (
            <li key={c.id}>
              <button type="button" className={'ap-cap' + (ok ? ' hecho' : '') + (ahora ? ' sigue' : '')} onClick={() => pedirRecorrido('cap:' + c.id)}>
                <span className="ap-n">{j + 1}</span>
                <span className="ap-tx"><b>{c.t}</b><small>{c.d}</small>
                  <em>{ok ? <><Ico n="ok" t={13} /> Hecho</> : ahora ? 'Sigue acá' : 'Sin ver'} · {c.pasos.length} pasos · 1 min</em></span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── A · primeros pasos ────────────────────────────────────────────────────────────────────────────────────────
/**
 * La lista que se tilda sola. `enGuia`: siempre, con «Ver el recorrido» y sin ✕; en el Inicio, hasta completarla o
 * cerrarla (`pasosEnInicio()` decide si se monta)
 */
export function PrimerosPasos({ liga, dc, enGuia }) {
  const [cerrado, setCerrado] = useState(false);
  const verificado = !!(dc && dc.rapero);
  const P = usePase(verificado, false);
  const nivel = P && P.listo ? P.nivel || 0 : 0;
  const pasos = [
    ['entrar', !!dc, 'Entra con Discord', 'Con tu cuenta: tu perfil, tus avisos, votar y seguir.',
      dc ? null : <button key="b" type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>],
    ['verif', verificado, 'Verifícate', 'En Discord Rap Español, con tu país. Se abre tu tarjeta de Servidor.',
      <a key="b" className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>],
    ['pase', nivel >= 1, 'Llega al nivel 1 del Pase', 'Dos Tareas del día o una de la semana, sin necesidad de jugar. Se abre tu tarjeta de Temporada.',
      <a key="b" className="btn verde chico" href="#/pase">Ver mis Tareas</a>],
    ['campana', !!leerLS('campana:activada'), 'Prende la campana', 'Te avisa al minuto cuando un servidor anuncia un evento.',
      <a key="b" className="btn verde chico" href="#/avisos">Activar</a>],
    ['seguir', liga.sigue.length > 0, 'Sigue a un rapero', 'Te avisa cuando gana algo.',
      <a key="b" className="btn verde chico" href="#/ranking">Ver el ranking</a>],
  ];
  const hechos = pasos.filter((p) => p[1]).length;
  const sigue = pasos.find((p) => !p[1]);
  const completo = hechos === pasos.length;
  useEffect(() => { if (!enGuia) contar('pasos'); }, [enGuia]);
  // ⚠️ en la Guía cuenta sólo si llegó hace poco: quien ya venía la ve completa y no la completó por el tutorial
  useEffect(() => {
    if (!completo) return;
    if (!enGuia || reciente()) contar('pasos_fin');
    if (!enGuia) tutoPoner({ pasos: 'fin' });
  }, [completo, enGuia]);
  if (cerrado) return null;
  // en la Guía va adentro de su sección «Cómo empezar», que ya trae el título
  const Raiz = enGuia ? 'div' : 'section';
  return (
    <Raiz className={'pp' + (enGuia ? ' pp-guia' : ' sec')} aria-labelledby={enGuia ? undefined : 'pp-h'}>
      <div className="pp-cab">
        <div>
          {enGuia ? null : <><span className="pp-k">PRIMEROS PASOS</span>
            <h2 id="pp-h">{completo ? 'Ya diste los primeros pasos' : 'Empieza por acá'}</h2></>}
          <small>{hechos} de {pasos.length}{completo ? ' · listo' : ''}</small>
        </div>
        {!enGuia ? <button type="button" className="btn-ico rc-x" aria-label="Cerrar los primeros pasos"
          onClick={() => { setCerrado(true); tutoPoner({ pasos: 'cerrado' }); }}><Ico n="cerrar" t={18} /></button> : null}
      </div>
      <span className="pp-barra" role="img" aria-label={hechos + ' de ' + pasos.length + ' pasos'}>
        {pasos.map((p) => <i key={p[0]} className={p[1] ? 'si' : ''} />)}
      </span>
      <ol className="pp-lista">
        {pasos.map(([id, ok, h, d, acc]) => (
          <li key={id} className={ok ? 'ok' : sigue && sigue[0] === id ? 'ahora' : ''}>
            <span className="pp-i">{ok ? <Ico n="ok" t={16} /> : null}</span>
            <span className="pp-t"><b>{h}</b><small>{d}</small></span>
            {!ok && sigue && sigue[0] === id ? acc : null}
          </li>
        ))}
      </ol>
      <p className="pp-pie">¿Y jugar? Cuando quieras: con una participación ya estás en el ranking. <a href="#/eventos">Ver los eventos</a>
        {enGuia ? <> · <button type="button" className="pp-rec" onClick={() => pedirRecorrido('corto')}>Ver el tutorial corto</button></> : null}</p>
    </Raiz>
  );
}
