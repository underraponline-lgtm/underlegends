// 🛠️ LAS HERRAMIENTAS DE MODS EN CADA PÁGINA (21/11/2026). Dlx, a la maqueta privada K3F14JmtDQvEYLMn6d2Pb9: «me gustaría
// que aparezca un botón sobresaliente en el menú también en la PC que tendrá mods tools que te permitirá hacer cosas de mods
// dependiendo de la página. Pero que obviamente la opción también esté en el mods menu», y para el resto, «lo que tú
// recomiendes» (la B: el botón M en el celular).
// - En la compu, un botón MODS en la cabecera, junto a la campana (`BotonModsCab`, lo pone arriba.jsx).
// - En el celular, la M abajo a la derecha, sólo en las páginas donde hay algo para hacer (`BotonModsFlot`, lo pone App.jsx).
// - Los dos abren el MISMO panel (`PanelMods`): los lápices, lo de esta página, ver como, lo último que hiciste y la
//   página Mods entera. Lo que hace cada cosa ya existía (los lápices de cada página, la lente, probar sin gastar):
//   esto sólo lo trae a donde estás. La lista de cada página vive en `herramientasDe()`.
// - Se esconde desde la página Mods (pestaña Corregir) o manteniendo apretada la M: `lg:mods-boton` = 'no'. El menú de tu
//   cara y la página Mods siguen siempre.
// ⚠️ Lo que se ve acá no da permisos: el Worker decide en cada pedido (igual que en mods.js).
import { useEffect, useRef, useState } from 'react';
import { ponerMod, prendidosMods, tieneMods, useHistorialMods, useModsEstado, useQuienMod } from './mods.js';
import { pedirRoles } from './panelsocio.js';
import { Ico } from './piezas.jsx';

const W = window;
const CLAVE_BOTON = 'lg:mods-boton';

/** ¿El botón de Mods se ve? (lo apaga quien lo esconde, desde la página Mods o manteniendo apretada la M) */
export function botonModsVisible() {
  try { return localStorage.getItem(CLAVE_BOTON) !== 'no'; } catch (e) { return true; }
}
export function ponerBotonMods(si) {
  try { if (si) localStorage.removeItem(CLAVE_BOTON); else localStorage.setItem(CLAVE_BOTON, 'no'); } catch (e) { /* sin almacenamiento */ }
  W.dispatchEvent(new Event('lg:mods-boton'));
}
export function useBotonMods() {
  const [v, setV] = useState(botonModsVisible);
  useEffect(() => {
    const f = () => setV(botonModsVisible());
    W.addEventListener('lg:mods-boton', f);
    return () => W.removeEventListener('lg:mods-boton', f);
  }, []);
  return v;
}

/** La ruta de ahora, como `['llave', '665']` (sin el `#/`), y que se entere cuando cambia */
function partesRuta() {
  let h = '';
  try { h = W.rutaLG ? W.rutaLG() : (location.hash || '').replace(/^#\/?/, ''); } catch (e) { h = ''; }
  return String(h || '').replace(/^#?\/?/, '').split('?')[0].split('/').filter((x, i) => i === 0 || x);
}
export function useRuta() {
  const [p, setP] = useState(partesRuta);
  useEffect(() => {
    const f = () => setP(partesRuta());
    W.addEventListener('lg:dir', f);
    W.addEventListener('hashchange', f);
    return () => { W.removeEventListener('lg:dir', f); W.removeEventListener('hashchange', f); };
  }, []);
  return p;
}

/** ¿Corrige llaves y ligas de cualquier servidor? Dlx, o un Admin o Moderador de la página (el Worker lo dice). */
function useDeLiga(dc) {
  const [s, setS] = useState(false);
  useEffect(() => {
    if (!dc) return undefined;
    let vivo = true;
    pedirRoles().then((r) => { if (vivo) setS(!!(r && (r.dlx || r.liga))); });
    return () => { vivo = false; };
  }, [dc && dc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

/**
 * 🧭 LO QUE SE PUEDE HACER EN ESTA PÁGINA. Cada cosa: `{t, d, lapiz?, ir?, mod?}`:
 * - `lapiz`: el selector de lo que aparece con los lápices (prende los lápices y baja hasta ahí)
 * - `ir`: a dónde lleva (otra página donde se hace)
 * - `mod`: un estado de mods.js que se prende y se apaga ahí mismo (`[clave, valor]`)
 * Quién ve cada una sale de las mismas reglas que la página Mods (mods_pag.jsx, «Dónde aparecen»).
 */
export function herramientasDe(partes, Q, deLiga) {
  const [p, a] = partes;
  const owner = !!Q.owner, admin = !!Q.admin, corrige = owner || deLiga;
  const xs = [];
  if (p === 'llave' && corrige) {
    xs.push({ t: 'Corregir esta llave', d: 'Quién ganó una batalla, un nombre o «la llave no cuenta»: un lápiz en cada batalla', lapiz: '.lk-lapiz' });
  }
  if (p === 'ligas' && corrige) {
    xs.push(a ? { t: 'Corregir esta liga', d: 'Quién ganó, una batalla que no cuenta, cargar una, un DF, un invitado o el campeón', lapiz: '.lp3-mods' }
      : { t: 'Corregir una liga', d: 'Abre la liga: al final de su página sale «Corregir esta liga»', lapiz: '' });
  }
  if (p === 'eventos') {
    if (owner) xs.push({ t: 'Marcar un evento de estilo', d: 'Abre un evento: sale «De estilo» arriba de sus datos', lapiz: '' });
    if (corrige) xs.push({ t: 'Corregir una llave', d: 'Abre la llave de un evento jugado: un lápiz en cada batalla', lapiz: '' });
  }
  if (p === 'publicaciones' && corrige) {
    xs.push({ t: 'Ocultar o fijar una publicación', d: 'En cada publicación: ocultarla del muro o ponerla de titular por 3 días', lapiz: '.om' });
    if (owner) xs.push({ t: 'Borrar un comentario', d: 'Desde el comentario mismo, siempre: no hace falta prender nada' });
  }
  if (p === 'r' && owner) {
    xs.push({ t: 'Quién es quién', d: 'Juntar a dos nombres que son la misma persona, o separarlos', lapiz: '.md-qe' });
  }
  if ((p === 'crews' || p === 'crew') && admin) {
    xs.push({ t: 'Entrar como su Líder', d: 'Los Ajustes, los rangos y los pedidos de cualquier crew', lapiz: '' });
  }
  if (p === 'competencias' && admin) {
    xs.push({ t: 'Ver todas las llaves', d: 'La Copa y la Rapid enteras, también donde no juegas', lapiz: '' });
  }
  if ((p === 'tienda' || p === 'inventario') && owner) {
    xs.push({ t: 'Tener todo', d: 'Todas las piezas y efectos como tuyos, para probártelos', mod: ['prueba', true] });
  }
  if (p === 'tienda' && owner) {
    xs.push({ t: 'Dinero de prueba', d: 'Puntos que no se terminan: compras y no se guarda nada', mod: ['dinero', true] });
  }
  if (p === 'pase' && owner) {
    xs.push({ t: 'El Pase en otro nivel', d: 'Tu Pase dibujado en el nivel que elijas', mod: ['pase', true], nivel: true });
  }
  if ((p === 'sv' || p === 'socio') && (owner || Q.socio)) {
    if (p === 'sv') xs.push({ t: 'El panel de este servidor', d: owner ? 'Como su dueño: sus números, el bot y su equipo' : 'Tu panel: tus números, el bot y tu equipo', ir: '#/socio' });
  }
  if (p === 'dashboard' && Q.mod) {
    xs.push({ t: 'Lo reportado', d: 'Las publicaciones y los perfiles que reportó la gente: en Pendientes', ir: '#/dashboard' });
  }
  return xs;
}

/** Baja hasta lo primero que aparece con los lápices (le da tiempo a la página de dibujarlo) */
function bajarA(sel) {
  if (!sel) return;
  let n = 0;
  const intentar = () => {
    const app = document.querySelector('#inicio-nuevo');
    const r = app && app.shadowRoot ? app.shadowRoot : document;
    const el = r.querySelector(sel);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('modt-brilla');
      setTimeout(() => el.classList.remove('modt-brilla'), 1600);
      return;
    }
    if (++n < 20) setTimeout(intentar, 150);
  };
  setTimeout(intentar, 120);
}

/** «hace 3 min», «hace 2 h» */
function hace(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
  return 'hace ' + Math.floor(s / 86400) + ' d';
}

/** Lo que dice arriba del panel: dónde estás */
function dondeEstas(partes) {
  const [p, a] = partes;
  const N = { llave: 'esta llave', ligas: a ? 'esta liga' : 'las ligas', eventos: 'Eventos', publicaciones: 'Publicaciones', r: 'este perfil',
    crews: 'las crews', crew: 'esta crew', competencias: 'Competencias', tienda: 'la Tienda', inventario: 'tu Inventario', pase: 'el Pase',
    sv: 'este servidor', socio: 'tu panel', dashboard: 'el Dashboard', mods: 'Mods' };
  return N[p] || (p ? 'esta página' : 'el Inicio');
}

/**
 * 🧰 EL PANEL: lo mismo en la compu (debajo del botón de la cabecera) y en el celular (una hoja que sube). Arriba los
 * lápices; después lo de esta página; ver como (Owner y Admin); lo último que hiciste; y la página Mods entera.
 */
export function PanelMods({ dc, k, abajo = false, onCerrar }) {
  const partes = useRuta();
  const Q = useQuienMod(dc, k, partes[0] === 'sv' ? partes[1] : '');
  const deLiga = useDeLiga(dc);
  const M = useModsEstado();
  const H = useHistorialMods();
  const xs = herramientasDe(partes, Q, deLiga);
  const caja = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') cerrar.current(); };
    const fuera = (e) => {
      const p = e.composedPath();
      if (!caja.current || p.includes(caja.current)) return;
      // el botón mismo abre y cierra (si cuenta como «afuera», se cerraba y se volvía a abrir)
      if (p.some((n) => n && n.classList && n.classList.contains('modt-b'))) return;
      cerrar.current();
    };
    W.addEventListener('keydown', tecla);
    const t = setTimeout(() => W.addEventListener('pointerdown', fuera), 0);
    const b = caja.current && caja.current.querySelector('button,a');
    if (b) b.focus();
    return () => { W.removeEventListener('keydown', tecla); W.removeEventListener('pointerdown', fuera); clearTimeout(t); };
  }, []);
  const lapices = Q.owner || Q.admin || deLiga;
  const usar = (x) => {
    if (x.mod) { ponerMod(x.mod[0], M[x.mod[0]] ? (typeof x.mod[1] === 'boolean' ? false : '') : x.mod[1]); return; }
    if (x.ir) { cerrar.current(); location.hash = x.ir; return; }
    if (x.lapiz !== undefined) {
      if (!M.lapices) ponerMod('lapices', true);
      cerrar.current();
      bajarA(x.lapiz);
    }
  };
  const ult = H.find((x) => !x.deshecha);
  const n = prendidosMods(M);
  return (
    <div className={'modt-panel' + (abajo ? ' abajo' : '')} ref={caja} role="dialog" aria-label={'Mods en ' + dondeEstas(partes)}>
      {abajo ? <i className="modt-asa" aria-hidden="true" /> : null}
      <div className="modt-h">
        <span className="modt-ic" aria-hidden="true"><Ico n="escudo" t={18} /></span>
        <h2>Mods <small>en {dondeEstas(partes)}</small></h2>
        <button type="button" className="modt-x" aria-label="Cerrar" onClick={() => cerrar.current()}><Ico n="cerrar" t={16} /></button>
      </div>
      {lapices ? (
        <div className={'modt-sw-f' + (M.lapices ? ' on' : '')}>
          <span><b>Lápices para corregir</b><small>{M.lapices ? 'Prendidos: un lápiz magenta en lo que puedes corregir' : 'Un lápiz magenta en cada cosa que puedes corregir'}</small></span>
          <button type="button" role="switch" aria-checked={!!M.lapices} aria-label="Lápices para corregir" className={'modt-sw' + (M.lapices ? ' on' : '')}
            onClick={() => ponerMod('lapices', !M.lapices)} />
        </div>
      ) : null}
      <p className="modt-s">En {dondeEstas(partes)}</p>
      {xs.length ? (
        <ul className="modt-l">{xs.map((x) => (
          <li key={x.t}>
            <button type="button" className={'modt-acc' + (x.mod && M[x.mod[0]] ? ' on' : '')} onClick={() => usar(x)} disabled={!x.mod && !x.ir && x.lapiz === undefined}>
              <span className="modt-acc-ic" aria-hidden="true"><Ico n={x.mod ? 'xp' : x.ir ? 'flecha' : 'lapiz'} t={16} /></span>
              <span className="modt-acc-t"><b>{x.t}</b><small>{x.d}</small></span>
              {x.mod ? <span className={'modt-sw chico' + (M[x.mod[0]] ? ' on' : '')} aria-hidden="true" /> : <i aria-hidden="true">›</i>}
            </button>
            {x.nivel && M.pase ? (
              <label className="modt-nivel"><span>Nivel</span>
                <input type="range" min="1" max="50" value={Number(M.paseN) || 1} onChange={(e) => ponerMod('paseN', Number(e.target.value))} aria-label="Nivel del Pase" />
                <b>{Number(M.paseN) || 1}</b></label>
            ) : null}
          </li>
        ))}</ul>
      ) : <p className="modt-nada">En esta página no hay nada para corregir. Las llaves, las ligas, Publicaciones y los perfiles sí tienen.</p>}
      {Q.owner || Q.admin ? (
        <>
          <p className="modt-s">Ver como</p>
          <div className="modt-pild" role="radiogroup" aria-label="Ver la página como">
            {[['', 'Tú'], ['usuario', 'Un usuario'], ['sincuenta', 'Sin cuenta']].map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={(M.vista || '') === v} className={(M.vista || '') === v ? 'on' : ''} onClick={() => ponerMod('vista', v)}>{t}</button>
            ))}
          </div>
        </>
      ) : null}
      {ult ? (
        <>
          <p className="modt-s">Lo último que hiciste</p>
          <a className="modt-ult" href="#/mods/registro" onClick={() => cerrar.current()}><b>{ult.que}</b><small>{ult.donde} · {hace(ult.t)}{ult.deshacer ? ' · se puede deshacer' : ''}</small></a>
        </>
      ) : null}
      <div className="modt-pie">
        <a href="#/mods" className="modt-todo" onClick={() => cerrar.current()}>Abrir Mods entero ›</a>
        {n ? <button type="button" className="modt-apagar" onClick={() => ponerMod(null)}>Apagar todo ({n})</button> : null}
      </div>
    </div>
  );
}

/** ¿Hay algo que mostrar para esta persona? (los mismos que ven Mods en el menú de su cara) */
function useHayMods(dc, k) {
  const partes = useRuta();
  const Q = useQuienMod(dc, k, partes[0] === 'sv' ? partes[1] : '');
  const deLiga = useDeLiga(dc);
  return { Q, partes, hay: !!dc && tieneMods(Q), xs: herramientasDe(partes, Q, deLiga) };
}

/**
 * 🖥️ EL BOTÓN DE LA CABECERA (sólo en la compu: en el celular lo esconde vivo.css y está la M). Dice MODS, lleva cuántas
 * cosas hay en esta página, y se pone magenta con algo prendido.
 */
export function BotonModsCab({ dc, k }) {
  const visible = useBotonMods();
  const { hay, xs } = useHayMods(dc, k);
  const M = useModsEstado();
  const [ab, setAb] = useState(false);
  if (!hay || !visible) return null;
  const on = prendidosMods(M);
  return (
    <span className="modt-envol">
      <button type="button" className={'modt-b modt-cab' + (on ? ' on' : '') + (ab ? ' ab' : '')} aria-haspopup="dialog" aria-expanded={ab}
        title="Mods: lo que puedes hacer en esta página" onClick={() => setAb((v) => !v)}>
        <Ico n="escudo" t={17} /><span>Mods</span>{xs.length ? <i aria-label={xs.length + (xs.length === 1 ? ' cosa' : ' cosas') + ' en esta página'}>{xs.length}</i> : null}
      </button>
      {ab ? <PanelMods dc={dc} k={k} onCerrar={() => setAb(false)} /> : null}
    </span>
  );
}

/**
 * 📱 LA M (sólo en el celular, y sólo donde hay algo para hacer): abajo a la derecha, arriba de la flecha de subir.
 * Mantenerla apretada la esconde (vuelve desde la página Mods).
 */
export function BotonModsFlot({ dc, k }) {
  const visible = useBotonMods();
  const { hay, xs } = useHayMods(dc, k);
  const M = useModsEstado();
  const [ab, setAb] = useState(false);
  const [aviso, setAviso] = useState(false);
  const largo = useRef(0);
  // 🙈 SE VA AL BAJAR Y VUELVE AL SUBIR (revisión 21/11, G6#17): quieta abajo a la derecha tapaba el jurado de la llave, el
  // multiplicador del Dashboard, la vitrina del perfil y la escena del Pase. Leyendo hacia abajo no estorba; para usarla
  // alcanza con subir un poco. Con el panel abierto no se mueve.
  // 🙈 Y ARRANCA ESCONDIDA (revisión 22/11/2026, G6#5): «arriba de todo se ve siempre» era justo la pantalla que se mira primero,
  // y ahí tapaba «VITRI[NA]» del perfil, la 3.ª casilla del Pase y «47 se anotaron» de la llave. Es un atajo que se repite (Mods
  // está en el menú de tu cara): aparece cuando subes, que es cuando lo buscas (Fitts y Hick)
  const [fuera, setFuera] = useState(true);
  useEffect(() => {
    let antes = window.scrollY || 0, cuadro = 0;
    const mirar = () => {
      cuadro = 0;
      const y = window.scrollY || 0, d = y - antes;
      if (d > 6) setFuera(true);
      else if (d < -6) setFuera(false);
      if (Math.abs(d) > 6) antes = y;
    };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(mirar); };
    window.addEventListener('scroll', pedir, { passive: true });
    return () => { window.removeEventListener('scroll', pedir); if (cuadro) cancelAnimationFrame(cuadro); };
  }, []);
  if (!hay || !visible || (!xs.length && !prendidosMods(M))) return null;
  const on = prendidosMods(M);
  const apretar = () => { largo.current = setTimeout(() => { largo.current = -1; setAviso(true); }, 650); };
  const soltar = () => { if (largo.current > 0) clearTimeout(largo.current); };
  return (
    <>
      <button type="button" className={'modt-b modt-flot' + (on ? ' on' : '') + (fuera && !ab ? ' fuera' : '')} aria-haspopup="dialog" aria-expanded={ab}
        aria-label={'Mods en esta página' + (xs.length ? ': ' + xs.length + (xs.length === 1 ? ' cosa' : ' cosas') : '')}
        onPointerDown={apretar} onPointerUp={soltar} onPointerLeave={soltar} onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (largo.current === -1) { largo.current = 0; return; } setAb((v) => !v); }}>
        M{xs.length ? <i aria-hidden="true">{xs.length}</i> : null}
      </button>
      {ab ? <><div className="modt-velo" aria-hidden="true" /><PanelMods dc={dc} k={k} abajo onCerrar={() => setAb(false)} /></> : null}
      {aviso ? (
        <div className="modt-esconder" role="dialog" aria-label="Esconder el botón de Mods">
          <p><b>¿Esconder la M?</b> Vuelve desde la página Mods, en Corregir. Mods sigue en el menú de tu cara.</p>
          <span><button type="button" className="btn borde2 chico" onClick={() => setAviso(false)}>No</button>
            <button type="button" className="btn verde chico" onClick={() => { setAviso(false); ponerBotonMods(false); }}>Esconder</button></span>
        </div>
      ) : null}
    </>
  );
}

