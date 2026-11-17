// 🎒 TU INVENTARIO, «EL VESTIDOR» (remake del 16/11/2026, con el estilo del Inicio).
//
// Dlx, 16/11/2026: «asegúrate que la pestaña de mi inventario funcione correctamente, y no sólo conmigo»; a la maqueta
// A/B, «una fusión, pero eso no es un remake… y no sólo hay tags sino más cosas»; a la v2 (el vestidor), «cuando tú
// seleccionas algo, un tag, ese tiene que cambiar de la tarjeta misma… como si estuviésemos cambiando la ropa a un
// personaje», «haz que todo sea removable… vamos a añadir más tags, efectos, fondos, colores, formas y marcos… que el
// inventario sea capaz de resistir todo eso», y «hazle un remake, usa el estilo nuevo de la página de inicio».
//   · TU CARTA EN VIVO (`cartaviva.jsx`): la de verdad, no una imagen con algo pegado encima. Tocar una pieza la cambia
//     ADENTRO de la carta, también una que todavía no tienes (probarla no es tenerla: Guardar sólo con lo tuyo).
//   · TRES SECCIONES: Cartas (TAG, marco, foto, estilo, efecto), Perfil (carta principal, fondo, frase, emblemas) y
//     Colección (insignias, títulos y marcos: lo que tienes y lo que te falta, y cómo se gana). «Por abrir» arriba.
//   · CADA PIEZA, DE UN CATÁLOGO: los TAGs salen de `tags_catalogo.json` (todos, no sólo los tuyos), los títulos y los
//     marcos del Pase. Una pieza nueva entra sola en su sección: el Inventario no tiene listas escritas a mano.
//   · AL INSTANTE EN LA PÁGINA, DESPUÉS EN DISCORD (Dlx: «se deberían notar en la página al instante, pero no
//     necesariamente al instante en Discord… para que estemos bien con los límites de nuestras herramientas»).
// Los 🎯 de estado no se guardan: salen solos mientras se cumplen, con «Automático».
import { Suspense, useEffect, useMemo, useState } from 'react';
import CAT from './tags_catalogo.json';
import { pasePost, refrescarPases } from './pase.js';
import { Carta, Ico, accion } from './piezas.jsx';
import { FondoCaja, FotoCartaCaja } from './cuenta.jsx';
import CSS_PAGINA from './css/inventario.css?inline';
import { usarCss } from './css.js';
import { leerVisto, marcarVisto } from './inv_nuevos.js';
import { nombreMarco } from './marcos.jsx';
import { ValesPremium } from './vales.jsx';
import { CartaViva } from './cartaviva.jsx';
import { FraseEditor } from './frase.jsx';

usarCss('inventario', CSS_PAGINA);

const CARTAS = [['temporada', 'Temporada'], ['competitivo', 'Competitiva'], ['servidor', 'Servidor'], ['pais', 'País']];
const GRUPO = { siempre: 'para siempre', temporada: 'de temporada', pase: 'edición limitada' };
const RAREZA = (CAT.niveles || {});
const NIVELES = ['t1', 't2', 't3', 't4'];
const TIER = { premium: 'Premium', plata: 'Plata', oro: 'Oro' };
// 🖼️ los marcos del Pase premium, con el nivel que los da (`bot/pase.py` PREMIUM): para ver también los que faltan
const MARCOS_PASE = [['premium', 1], ['plata', 15], ['oro', 25]];
const ORDEN_T = ['oro', 'plata', 'premium'];
/** «El mejor»: el de nivel más alto que tengas, como `mejorMarco()` de bot/avisos.js */
const mejor = (ids) => ORDEN_T.map((t) => ids.find((id) => id.split(':')[1] === t)).find(Boolean) || '';
const sinNum = (t) => t.replace(' x%d', '').replace(' DE %d', '');
const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Extended_Pictographic}|\p{Regional_Indicator})*)\s*/u;
function partir(texto) {
  const m = String(texto || '').match(EMOJI);
  return m ? [m[1], texto.slice(m[0].length)] : ['', String(texto || '')];
}

/**
 * Todos los TAGs de `carta`, los tuyos y los que no: `[{tag, texto, desc, grupo, nivel, mio}]`, los tuyos primero y de
 * la rareza más alta a la más baja. La llave (`tag`) es la de las piezas de la carta (`comun/piezas.py`)
 */
function opciones(carta, yo) {
  const out = [];
  for (const [t, n, p, g] of (CAT.cat && CAT.cat[carta]) || []) {
    if (g !== 'siempre' && g !== 'temporada') continue;
    const x = ((yo.ganados || {})[carta] || {})[t];
    const mio = !!(yo.dueno || (x && (g === 'siempre' || x[1] === yo.temp)));
    out.push({ tag: t, texto: x ? x[0] : sinNum(t), desc: p, grupo: g, nivel: n, mio });
  }
  // ✨ los títulos del Pase que van en esta carta (`titulo_carta`): los tuyos y los que faltan
  const tc = yo.titulo_carta || {};
  const tuyos = new Set(yo.titulos || []);
  const deEsta = Object.keys(tc).length ? Object.keys(tc).filter((x) => tc[x] === carta) : (yo.titulos || []);
  for (const tit of deEsta) {
    out.push({ tag: 'pase:' + tit, texto: '✨ ' + tit.toUpperCase(), desc: 'Título del Pase de rapero.', grupo: 'pase', nivel: 't1', mio: !!(yo.dueno || tuyos.has(tit)) });
  }
  return out.sort((a, b) => (b.mio - a.mio) || (NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel)));
}

const CAND = <svg className="ves-cand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="1" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;

/** Un cuadro elegible: el ícono pintado por rareza, el nombre y debajo la rareza (o qué le falta). ⚠️ La rareza va como
 *  `r-t1`…: `.t3` a secas choca con una regla global del shadow root y desarmaba el grupo Raro (medido el 16/11/2026) */
function Cuadro({ on, puesto, prueba, nuevo, mio = true, ic, nombre, rar, nivel = '', onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={!!on} onClick={onClick}
      className={'ves-q' + (nivel ? ' r-' + nivel : '') + (mio ? '' : ' bloq') + (on ? ' on' : '') + (prueba ? ' prueba' : '')}>
      {puesto ? <i className="ves-pu">Puesto</i> : nuevo ? <i className="ves-nv">Nuevo</i> : null}
      {mio ? null : CAND}
      {children || <span className="ves-qi" aria-hidden="true">{ic}</span>}
      <b>{nombre}</b>
      {rar ? <small>{rar}</small> : null}
    </button>
  );
}

/** La ficha de lo que tocaste: qué es, cómo se gana y si es tuyo */
function Ficha({ o }) {
  if (!o) return null;
  const [ic, txt] = partir(o.texto);
  return (
    <div className={'ves-ficha ' + (o.nivel ? 'r-' + o.nivel : '') + (o.mio ? '' : ' bloq')}>
      <span className="ves-qi" aria-hidden="true">{ic || txt.charAt(0)}</span>
      <div>
        <em>{RAREZA[o.nivel] || ''}{o.nivel && GRUPO[o.grupo] ? ' · ' + GRUPO[o.grupo] : ''}{o.mio ? ' · lo tienes' : ''}</em>
        <b>{txt}</b>
        {o.mio ? (o.desc ? <p>{o.desc}</p> : null) : <p className="ves-falta">{CAND}<span><b>Cómo se gana:</b> {o.desc || 'todavía no se sabe'}</span></p>}
      </div>
    </div>
  );
}

/** Un título de sección con la raya blanca de arriba, como «Lo último» del Inicio */
const Titulo = ({ children, extra }) => <div className="ves-h"><h3>{children}</h3>{extra || null}</div>;

/** La barra de lo que se completa: `n` de `de` */
const Barra = ({ n, de, c }) => (
  <i className="ves-barra" aria-hidden="true"><u style={{ width: (de ? (100 * n) / de : 0) + '%', background: c || undefined }} /></i>
);

/**
 * 🎒 SIN CARTAS TODAVÍA: lo que ve casi todo el que entra. Qué le falta para la primera y, si ya ganó TAGs, cuáles lo
 * esperan (se ganan con o sin carta, y se ponen en cuanto la tenga)
 */
function SinCartas({ yo, k }) {
  const ganados = [];
  for (const [c, n] of CARTAS) for (const o of opciones(c, Object.assign({}, yo, { dueno: false, titulos: [] }))) if (o.mio) ganados.push(Object.assign({ carta: n }, o));
  const ver = ganados.slice(0, 8);
  return (
    <section className="ves-sin" aria-label="Todavía no tienes cartas">
      <div className="ves-sin-cab">
        <span className="ves-sin-ic" aria-hidden="true"><Ico n="tarjetas" t={26} /></span>
        <div><b>Todavía no tienes cartas</b><p>Tu TAG, tu marco y tu foto van sobre tus cartas. Las primeras dos se desbloquean en dos pasos:</p></div>
      </div>
      <ol className="ves-pasos">
        <li><i>1</i><span><b>Verifícate</b><small>Discord Rap Español, rol Miembro y tu país · tu carta de Servidor</small></span>
          <a className="ves-btn blanco" href="#/cuenta/verificar">Verificarme</a></li>
        <li><i>2</i><span><b>Tu primera Tarea del Pase</b><small>Tu carta de Temporada</small></span>
          <a className="ves-btn" href="#/pase">Ver el Pase</a></li>
      </ol>
      {ganados.length ? (
        <>
          <p className="ves-p"><b>{ganados.length === 1 ? 'Ya ganaste un TAG' : 'Ya ganaste ' + ganados.length + ' TAGs'}</b> jugando:
            {ganados.length === 1 ? ' te espera' : ' te esperan'} acá para ponérselos a tus cartas en cuanto las tengas.</p>
          <div className="ves-grid">
            {ver.map((o) => {
              const [ic, txt] = partir(o.texto);
              return <Cuadro key={o.carta + o.tag} nivel={o.nivel} ic={ic || txt.charAt(0)} nombre={txt} rar={o.carta} onClick={() => {}} />;
            })}
          </div>
          {ganados.length > ver.length ? <p className="ves-nota">Y {ganados.length - ver.length} más.</p> : null}
        </>
      ) : null}
      <a className="ves-lnk" href={k ? '#/tarjetas' : '#/guia'}>{k ? 'Ver qué me falta para cada carta →' : 'Cómo funciona →'}</a>
    </section>
  );
}

// 🧩 las ranuras de tus cartas: `[id, etiqueta]`. «Efecto» todavía no existe: va con candado y lo dice
const RANURAS = [['tag', 'TAG'], ['marco', 'Marco'], ['foto', 'Foto'], ['estilo', 'Estilo'], ['efecto', 'Efecto']];
const anchoDe = () => (typeof window !== 'undefined' && window.innerWidth < 760 ? 208 : 270);

export function Inventario({ liga, dc, carta0 = '', ranura0 = '' }) {
  const [yo, setYo] = useState(undefined);
  const [mk, setMk] = useState(null);
  const [sec, setSec] = useState(['principal', 'fondo', 'frase', 'emblemas'].includes(ranura0) ? 'perfil' : ranura0 === 'coleccion' ? 'col' : 'cartas');
  const [carta, setCarta] = useState(CARTAS.some(([c]) => c === carta0) ? carta0 : 'temporada');
  const [ran, setRan] = useState(RANURAS.some(([r]) => r === ranura0) ? ranura0 : 'tag');
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState(null);
  const [ocup, setOcup] = useState('');
  const [msg, setMsg] = useState('');
  const [estado, setEstado] = useState('buscando');
  const [perf, setPerf] = useState(null);
  // 👀 el borrador: `tags` por carta, `marco`, `estilo` y `principal`; lo que no está, es lo guardado
  const [bor, setBor] = useState({ tags: {} });
  const [visto] = useState(leerVisto);
  const [ancho, setAncho] = useState(anchoDe);
  useEffect(() => {
    const f = () => setAncho(anchoDe());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  useEffect(() => {
    pasePost('tags-mios', {}).then((d) => setYo(d && d._ok ? d : null));
    pasePost('marcos', {}).then((d) => setMk(d && d._ok ? d : null));
  }, []);
  useEffect(() => { if (yo) marcarVisto(yo); }, [yo]);
  const k = (dc && dc.clave) || (yo && yo.k) || '';
  // 🃏 tus cartas también desde tu perfil (quien está en la Liga sin competir), y tus insignias para la Colección
  useEffect(() => {
    if (!k || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => {
      const p = d && d.p && d.p[k];
      if (!vivo || !p) return;
      // su fila, para que `Carta` encuentre la imagen: `cartaUrl()` la busca en `liga.T` o `liga.X` (`fuera()`)
      if (p.f && Array.isArray(p.f.c) && !(liga.T && liga.T[k]) && !(liga.X && liga.X[k])) liga.fuera(Object.assign({ k }, p.f));
      setPerf(p);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [k, liga]);
  const tienes = useMemo(() => {
    const f = (liga.T && liga.T[k]) || (liga.X && liga.X[k]);
    const c = new Set([...((f && f.c) || []), ...((perf && perf.f && perf.f.c) || []), ...((dc && dc.cs) || [])]);
    return CARTAS.filter(([x]) => c.has(x));
  }, [liga, k, dc, perf]);
  useEffect(() => { if (tienes.length && !tienes.some(([x]) => x === carta)) setCarta(tienes[0][0]); }, [tienes]); // eslint-disable-line react-hooks/exhaustive-deps
  const nCambios = Object.keys(bor.tags).length + ('marco' in bor || 'estilo' in bor ? 1 : 0) + ('principal' in bor ? 1 : 0);
  useEffect(() => {
    if (!nCambios) return undefined;
    const f = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [nCambios]);

  if (!dc) {
    return (
      <div className="ves"><section className="ves-sin"><div className="ves-sin-cab"><span className="ves-sin-ic" aria-hidden="true"><Ico n="tarjetas" t={26} /></span>
        <div><b>Tu inventario</b><p>Tus TAGs, tus marcos y tus cartas, en un solo lugar. Entra con Discord para verlo.</p></div></div>
        <button type="button" className="ves-btn blanco" onClick={accion.entrar}>Entrar con Discord</button></section></div>
    );
  }
  if (yo === undefined) return <div className="ves"><p className="ves-nota">Buscando tu inventario…</p></div>;
  if (!yo) return <div className="ves"><p className="ves-nota">No pude leer tu inventario. Entra con Discord y prueba de nuevo.</p></div>;

  const cartas = tienes;
  const sinCartas = !cartas.length;
  const nombre = (CARTAS.find(([x]) => x === carta) || [])[1] || '';
  const ops = opciones(carta, yo);
  const mias = ops.filter((o) => o.mio);
  const elG = (yo.elegidos || {})[carta] || 'auto';
  const el = carta in bor.tags ? bor.tags[carta] : elG;
  const q = busca.trim().toLowerCase();
  const vistos = ops.filter((o) => (filtro === 'todos' || (filtro === 'mios' ? o.mio : !o.mio))
    && (!q || o.texto.toLowerCase().includes(q) || (o.desc || '').toLowerCase().includes(q)));
  const marcos = (mk && mk.tienes) || [];
  const idsMarcos = marcos.map(([id]) => id);
  const marcoG = (mk && mk.elegido) || '';
  const estiloG = (mk && mk.estilo) || 'camiseta';
  const principalG = yo.principal || '';
  const marcoAhora = 'marco' in bor ? bor.marco : marcoG;
  const estiloAhora = 'estilo' in bor ? bor.estilo : estiloG;
  const principalAhora = 'principal' in bor ? bor.principal : principalG;
  const temp = yo.temp || 't1';
  // el marco que se prueba sobre la carta (con la forma de `marcosPublicos()`): `null` sin marco
  const marcoVer = !('marco' in bor || 'estilo' in bor) ? undefined
    : marcoAhora === 'ninguno' || (!marcoAhora && !idsMarcos.length) ? null
      : [marcoAhora || mejor(idsMarcos), estiloAhora, (mk && mk.serie) || 0];
  const esNuevo = (clave) => !!visto && !visto.has(clave);
  const probando = carta in bor.tags ? ops.find((o) => o.tag === bor.tags[carta]) : null;
  const bloqueado = Object.entries(bor.tags).some(([c, t]) => t !== 'auto' && !(opciones(c, yo).find((o) => o.tag === t) || {}).mio)
    || ('marco' in bor && !!bor.marco && bor.marco !== 'ninguno' && !idsMarcos.includes(bor.marco));

  // tocar = probar, también lo que no tienes: lo igual a lo guardado sale del borrador
  const probar = (campo, v, guardado, enCarta = carta) => setBor((b) => {
    const n = { ...b, tags: { ...b.tags } };
    if (campo === 'tag') { if (v === guardado) delete n.tags[enCarta]; else n.tags[enCarta] = v; }
    else if (v === guardado) delete n[campo]; else n[campo] = v;
    return n;
  });
  const cancelar = () => { setBor({ tags: {} }); setMsg(''); setSel(null); };
  const guardar = async () => {
    setOcup('guardar');
    const avisos = [];
    let ok = true;
    for (const [c, tag] of Object.entries(bor.tags)) {
      const d = await pasePost('tag-elige', { carta: c, tag });
      if (d && d._ok) setYo(d);
      else {
        ok = false;
        avisos.push(d && d.error === 'no lo tienes' ? 'Ese TAG todavía no es tuyo.' : d && d.error === 'ese título va en otra carta'
          ? 'Ese título va en otra carta.' : 'Un TAG no se pudo guardar.');
      }
    }
    if ('marco' in bor || 'estilo' in bor) {
      const d = await pasePost('marco-elige', { marco: marcoAhora, estilo: estiloAhora });
      if (d && d._ok) setMk(d); else { ok = false; avisos.push('El marco no se pudo guardar.'); }
    }
    if ('principal' in bor) {
      const d = await pasePost('carta-principal', { carta: principalAhora });
      if (d && d._ok) setYo(d); else { ok = false; avisos.push('La carta principal no se pudo guardar.'); }
    }
    refrescarPases();
    setOcup('');
    setBor({ tags: {} });
    setSel(null);
    // ⚡ en la página, al instante; en /card y en la imagen que ven los demás, cuando se vuelve a dibujar
    setMsg(ok ? 'Guardado: ya se ve en tu carta. En /card y en la imagen que ven los demás se actualiza en un rato.'
      : 'Se guardó una parte. ' + [...new Set(avisos)].join(' '));
  };

  // 🃏 el escenario: tu carta viva, con lo que estás probando, y tus cartas debajo para cambiar de una a otra
  const escenario = (
    <div className="ves-esc">
      {nCambios ? <span className="ves-vp">Probando</span> : null}
      <CartaViva liga={liga} k={k} cual={carta} ancho={ancho} piezas={{ tag: el }} marco={marcoVer} onEstado={setEstado} cls="ves-ci" />
      {estado === 'imagen' ? <p className="ves-nota ves-aun">Tu carta se arma en vivo desde su próximo dibujo: hasta entonces, lo que pruebas se marca en la lista.</p> : null}
      <div className="ves-mano" role="tablist" aria-label="Qué carta vistes">
        {cartas.map(([c, n]) => (
          <button key={c} type="button" role="tab" aria-selected={carta === c} className={carta === c ? 'on' : ''}
            onClick={() => { setCarta(c); setSel(null); setBusca(''); }}>
            <span className="ves-mi"><Carta liga={liga} k={k} cual={c} cls="ves-mci" abre={false} /></span>
            <small>{n}{principalAhora === c ? ' ★' : ''}{c in bor.tags ? <i className="ves-pt" aria-label="sin guardar" /> : null}</small>
          </button>
        ))}
      </div>
    </div>
  );

  const cajonTag = () => {
    const sObj = ops.find((o) => o.tag === sel) || probando;
    return (
      <>
        <div className="ves-barra-f">
          <div className="ves-fil" role="radiogroup" aria-label="Qué TAGs ver">
            {[['todos', 'Todos', ops.length], ['mios', 'Tuyos', mias.length], ['faltan', 'Por ganar', ops.length - mias.length]].map(([id, n, c]) => (
              <button key={id} type="button" role="radio" aria-checked={filtro === id} className={filtro === id ? 'on' : ''} onClick={() => setFiltro(id)}>{n}<em>{c}</em></button>
            ))}
          </div>
          {ops.length > 12 ? <input className="ves-busca" type="search" placeholder="Buscar un TAG…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar un TAG" /> : null}
        </div>
        <Ficha o={sObj} />
        <div className="ves-grp">
          <div className="ves-grp-h">Automático <span>sale solo el TAG de estado de hoy</span></div>
          <div className="ves-grid" role="radiogroup" aria-label="Automático">
            <Cuadro on={el === 'auto'} puesto={elG === 'auto'} prueba={bor.tags[carta] === 'auto'} ic="🎯" nombre="Automático" rar="El de hoy"
              onClick={() => { setSel(null); probar('tag', 'auto', elG); }} />
          </div>
        </div>
        {NIVELES.map((n) => {
          const xs = vistos.filter((o) => o.nivel === n);
          const tot = ops.filter((o) => o.nivel === n);
          if (!xs.length) return null;
          const m = tot.filter((o) => o.mio).length;
          return (
            <div key={n} className={'ves-grp r-' + n}>
              <div className="ves-grp-h">{RAREZA[n]} <span>{m} de {tot.length}</span><Barra n={m} de={tot.length} /></div>
              <div className="ves-grid" role="radiogroup" aria-label={'TAGs ' + RAREZA[n]}>
                {xs.map((o) => {
                  const [ic, txt] = partir(o.texto);
                  return (
                    <Cuadro key={o.tag} nivel={o.nivel} mio={o.mio} on={el === o.tag} puesto={elG === o.tag} prueba={bor.tags[carta] === o.tag}
                      nuevo={o.mio && esNuevo(o.grupo === 'pase' ? o.tag.replace(/^pase:/, 'pase|') : carta + '|' + o.tag)}
                      ic={ic || txt.charAt(0)} nombre={txt} rar={o.mio ? RAREZA[o.nivel] : 'Por ganar'}
                      onClick={() => { setSel(o.tag); probar('tag', o.tag, elG); }} />
                  );
                })}
              </div>
            </div>
          );
        })}
        {q && !vistos.length ? <p className="ves-nota">Ningún TAG dice «{busca}».</p> : null}
      </>
    );
  };

  const cajonMarco = () => (
    <>
      <p className="ves-p">El marco va alrededor de <b>tus cuatro cartas</b>, en la página y en /card.</p>
      <div className="ves-grid" role="radiogroup" aria-label="El marco de tus cartas">
        <Cuadro on={!marcoAhora && !!idsMarcos.length} puesto={!marcoG && !!idsMarcos.length} ic="⭐" nombre="El mejor" rar="Automático"
          mio={!!idsMarcos.length} onClick={() => probar('marco', '', marcoG)} />
        {MARCOS_PASE.map(([t, nv]) => {
          const id = idsMarcos.find((x) => x.split(':')[1] === t) || temp + ':' + t;
          const mio = idsMarcos.includes(id);
          return (
            <Cuadro key={t} mio={mio} on={marcoAhora === id} puesto={marcoG === id} prueba={bor.marco === id} nombre={nombreMarco(id) || 'Marco ' + TIER[t]}
              rar={mio ? 'Marco ' + TIER[t] : 'Nivel ' + nv + ' del premium'} onClick={() => probar('marco', id, marcoG)}>
              <span className="ves-qi" aria-hidden="true"><i className={'ves-sw ' + t} /></span>
            </Cuadro>
          );
        })}
        <Cuadro on={marcoAhora === 'ninguno'} puesto={marcoG === 'ninguno'} ic="▢" nombre="Sin marco" rar="Como siempre" onClick={() => probar('marco', 'ninguno', marcoG)} />
      </div>
    </>
  );

  const cajon = () => {
    if (ran === 'tag') return cajonTag();
    if (ran === 'marco') return cajonMarco();
    if (ran === 'foto') return <Suspense fallback={<p className="ves-nota">Cargando…</p>}><FotoCartaCaja dc={dc} /></Suspense>;
    if (ran === 'estilo') {
      return (
        <>
          <p className="ves-p">Cómo se viste tu carta de <b>Servidor</b> cuando lleva marco.</p>
          <div className="ves-grid" role="radiogroup" aria-label="El estilo de tu carta de Servidor">
            {((mk && mk.estilos) || ['camiseta', 'cadena']).map((e) => (
              <Cuadro key={e} on={estiloAhora === e} puesto={estiloG === e} ic={e === 'cadena' ? '⛓️' : '👕'} nombre={e === 'cadena' ? 'La cadena' : 'La camiseta'}
                rar={e === 'cadena' ? 'Estilo' : 'Tus colores'} onClick={() => { setCarta('servidor'); probar('estilo', e, estiloG); }} />
            ))}
          </div>
        </>
      );
    }
    return <div className="ves-ficha bloq"><span className="ves-qi" aria-hidden="true">✨</span><div><em>Pronto</em><b>Efectos</b>
      <p className="ves-falta">{CAND}<span>Brillos y animaciones para tu carta, en la página y en Discord. Llegan con la Tienda.</span></p></div></div>;
  };

  const valor = {
    tag: el === 'auto' ? 'Automático' : partir((ops.find((o) => o.tag === el) || {}).texto || '')[1] || 'Automático',
    marco: marcoAhora === 'ninguno' ? 'Sin marco' : marcoAhora ? nombreMarco(marcoAhora) : idsMarcos.length ? 'El mejor' : 'Ninguno todavía',
    foto: 'Tu foto', estilo: estiloAhora === 'cadena' ? 'La cadena' : 'La camiseta', efecto: 'Pronto',
  };
  const cuantos = { tag: mias.length + '/' + ops.length, marco: idsMarcos.length + '/' + MARCOS_PASE.length };
  const ranuras = RANURAS.filter(([r]) => r !== 'estilo' || cartas.some(([c]) => c === 'servidor'));

  // 🏅 la colección: insignias (de tu perfil), títulos y marcos
  const insCat = (liga.d && liga.d.insignias) || [];
  const insMias = new Set(((perf && perf.ins) || []).map((x) => x[0]));
  const titulos = Object.keys(yo.titulo_carta || {});
  const titMios = new Set(yo.titulos || []);
  const tagsTot = CARTAS.reduce((a, [c]) => a + opciones(c, yo).filter((o) => o.mio).length, 0);

  return (
    <div className="ves">
      <header className="ves-cab">
        <div>
          <span className="ves-ceja">Lo tuyo</span>
          <h2>Inventario</h2>
          <p>Toca una pieza y tu carta se la prueba. Guardas cuando te guste.{yo.dueno ? ' · 👑 como dueño, tienes todo desbloqueado' : ''}</p>
        </div>
        <dl className="ves-num">
          <div><dt>TAGs</dt><dd>{tagsTot}</dd></div>
          <div><dt>Marcos</dt><dd>{idsMarcos.length}</dd></div>
          <div><dt>Insignias</dt><dd>{insMias.size}<small>/{insCat.length}</small></dd></div>
        </dl>
      </header>

      {/* 🎁 por abrir: el Pase premium de campeón de liga, arriba de todo (sin ninguno, no se dibuja) */}
      <ValesPremium />

      <div className="ves-sec" role="tablist" aria-label="Qué miras">
        {[['cartas', 'Cartas', sinCartas ? 'Ninguna todavía' : cartas.length + ' de 4'], ['perfil', 'Perfil', 'Fondo, frase y más'],
          ['col', 'Colección', insMias.size + ' insignias']].map(([id, n, s]) => (
          <button key={id} type="button" role="tab" aria-selected={sec === id} className={sec === id ? 'on' : ''} onClick={() => { setSec(id); setSel(null); }}>
            <b>{n}</b><small>{s}</small></button>
        ))}
      </div>
      {msg ? <p className="ves-msg" role="status">{msg}</p> : null}

      {sec === 'cartas' && sinCartas ? <SinCartas yo={yo} k={k} /> : null}
      {sec === 'cartas' && !sinCartas ? (
        <div className="ves-cuerpo">
          <aside className="ves-izq">{escenario}</aside>
          <section className="ves-der" aria-label="Lo que le pones a tu carta">
            <div className="ves-ran" role="tablist" aria-label="Qué le cambias">
              {ranuras.map(([id, et]) => (
                <button key={id} type="button" role="tab" aria-selected={ran === id}
                  className={(ran === id ? 'on' : '') + (id === 'efecto' ? ' lk' : '') + ((id === 'tag' && carta in bor.tags) || (id === 'marco' && 'marco' in bor) || (id === 'estilo' && 'estilo' in bor) ? ' sg' : '')}
                  onClick={() => { setRan(id); setSel(null); }}>
                  <small>{et}{cuantos[id] ? ' · ' + cuantos[id] : ''}</small><b>{valor[id]}</b>
                </button>
              ))}
            </div>
            <Titulo extra={<small className="ves-de">tu {nombre}</small>}>{(RANURAS.find(([r]) => r === ran) || [])[1]}</Titulo>
            {cajon()}
          </section>
        </div>
      ) : null}

      {sec === 'perfil' ? (
        <div className="ves-perfil">
          {!sinCartas ? (
            <section className="ves-panel">
              <Titulo>Tu carta principal</Titulo>
              <p className="ves-p">La que te representa: sale primero en /card, en tu perfil y en el ranking.</p>
              <div className="ves-grid cartas" role="radiogroup" aria-label="Tu carta principal">
                <Cuadro on={!principalAhora} puesto={!principalG} ic="🎯" nombre="La de siempre" rar="Según dónde" onClick={() => probar('principal', '', principalG)} />
                {cartas.map(([c, n]) => (
                  <Cuadro key={c} on={principalAhora === c} puesto={principalG === c} nombre={n} onClick={() => probar('principal', c, principalG)}>
                    <span className="ves-qc" aria-hidden="true"><Carta liga={liga} k={k} cual={c} cls="ves-qci" abre={false} /></span>
                  </Cuadro>
                ))}
              </div>
            </section>
          ) : null}
          <section className="ves-panel"><Titulo>Tu fondo</Titulo><Suspense fallback={<p className="ves-nota">Cargando…</p>}><FondoCaja dc={dc} /></Suspense></section>
          {k ? <section className="ves-panel"><Titulo>Tu frase</Titulo><FraseEditor k={k} /></section> : null}
          {k ? (
            <section className="ves-panel"><Titulo>Tus emblemas</Titulo>
              <p className="ves-p">Se eligen mirando tu perfil: tócalos al lado de tu nombre y marca los que quieres que se vean.</p>
              <a className="ves-btn" href={'#/r/' + encodeURIComponent(k)}>Ir a mi perfil</a></section>
          ) : null}
        </div>
      ) : null}

      {sec === 'col' ? (
        <div className="ves-col">
          <section className="ves-panel ancha">
            <Titulo extra={<span className="ves-de">{insMias.size} de {insCat.length}</span>}>Insignias</Titulo>
            <Barra n={insMias.size} de={insCat.length} c="#F5C542" />
            {sel && sel.startsWith('in:') ? (() => {
              const x = insCat.find((i) => i[0] === sel.slice(3));
              return x ? <Ficha o={{ texto: x[1] + ' ' + x[2], desc: x[3], mio: insMias.has(x[0]) }} /> : null;
            })() : null}
            <div className="ves-grid">
              {[...insCat].sort((a, b) => insMias.has(b[0]) - insMias.has(a[0])).map(([id, ic, n]) => (
                <Cuadro key={id} mio={insMias.has(id)} on={sel === 'in:' + id} ic={ic} nombre={n} rar={insMias.has(id) ? 'La tienes' : 'Por ganar'}
                  onClick={() => setSel('in:' + id)} />
              ))}
            </div>
          </section>
          {titulos.length ? (
            <section className="ves-panel">
              <Titulo extra={<span className="ves-de">{titulos.filter((t) => titMios.has(t) || yo.dueno).length} de {titulos.length}</span>}>Títulos del Pase</Titulo>
              <p className="ves-p">Cada uno va en una carta y se pone como su TAG: tócalo para probártelo.</p>
              <div className="ves-grid">
                {titulos.map((t) => {
                  const c = yo.titulo_carta[t];
                  const mio = titMios.has(t) || !!yo.dueno;
                  const en = (CARTAS.find(([x]) => x === c) || [])[1] || '';
                  return <Cuadro key={t} mio={mio} nivel="t1" ic="✨" nombre={t} rar={mio ? 'En tu ' + en : 'Del Pase'}
                    onClick={() => {
                      if (!cartas.some(([x]) => x === c)) return;
                      setSec('cartas'); setCarta(c); setRan('tag'); setSel('pase:' + t);
                      probar('tag', 'pase:' + t, (yo.elegidos || {})[c] || 'auto', c);
                    }} />;
                })}
              </div>
            </section>
          ) : null}
          <section className="ves-panel">
            <Titulo extra={<span className="ves-de">{idsMarcos.length} de {MARCOS_PASE.length}</span>}>Marcos</Titulo>
            <p className="ves-p">Del Pase premium: tócalo para probártelo en tus cartas.</p>
            <div className="ves-grid">
              {MARCOS_PASE.map(([t, nv]) => {
                const mio = idsMarcos.some((x) => x.split(':')[1] === t);
                return <Cuadro key={t} mio={mio} nombre={'Marco ' + TIER[t]} rar={mio ? 'Lo tienes' : 'Nivel ' + nv + ' del premium'}
                  onClick={() => { if (sinCartas) return; setSec('cartas'); setRan('marco'); probar('marco', idsMarcos.find((x) => x.split(':')[1] === t) || temp + ':' + t, marcoG); }}>
                  <span className="ves-qi" aria-hidden="true"><i className={'ves-sw ' + t} /></span></Cuadro>;
              })}
            </div>
          </section>
        </div>
      ) : null}

      {/* 💾 la barra de guardar: con cambios, pegada abajo, con tu carta chica para ver lo que pruebas */}
      {nCambios ? (
        <div className="ves-guardar" role="region" aria-label="Cambios sin guardar">
          {sec === 'cartas' && !sinCartas ? <span className="ves-gmini" aria-hidden="true"><CartaViva liga={liga} k={k} cual={carta} ancho={46} piezas={{ tag: el }} marco={marcoVer} /></span> : null}
          <span className="ves-gtx">
            {bloqueado ? <><b>Lo estás probando</b> · todavía no es tuyo: en su ficha dice cómo se gana</>
              : <><b>{nCambios === 1 ? '1 cambio' : nCambios + ' cambios'}</b> sin guardar</>}
          </span>
          <button type="button" className="ves-btn" disabled={!!ocup} onClick={cancelar}>{bloqueado ? 'Volver' : 'Cancelar'}</button>
          {!bloqueado ? <button type="button" className="ves-btn blanco" disabled={!!ocup} onClick={guardar}>{ocup === 'guardar' ? 'Guardando…' : 'Guardar'}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

/** La página: `#/inventario/<carta>/<ranura>` */
export function PaginaInventario({ liga, dc, carta, ranura }) {
  return <Inventario liga={liga} dc={dc} carta0={carta || ''} ranura0={ranura || ''} />;
}
