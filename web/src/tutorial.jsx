// 🧭 EL TUTORIAL (Dlx, 12/10/2026: «A pero que no sea necesariamente con jugar tu primer evento, o sea con participar
// en la temporada, ya sea haciendo misiones etc… B me gusta, C me gusta pero que sea lo que B no mostró, D me gusta así
// atrapamos la atracción, E. Dale»). Quién es nuevo y lo que se cuenta, en primera.js; acá lo que se dibuja:
//
//   A · `PrimerosPasos`: una lista que se tilda sola. Ninguno pide jugar: el Pase sube con Tareas, y su nivel 1 da la
//       Temporada. En el Inicio para quien llegó hace poco; en la Guía, para todos
//   B · `Recorrido`: cuatro pasos sobre el menú (Eventos, Ranking, Tarjetas, Pase), la primera vez que se entra por el
//       Inicio. Se saltea, y se vuelve a ver desde la Guía
//   C · `NOTAS`: una línea la primera vez que se abre una página que el recorrido no mostró
//   D · la franja: quien entra por un link (un perfil, una llave) ve primero eso, y arriba «¿primera vez?»
//   E · lo cuenta `contar()`, y lo muestra el Dashboard
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { num } from './liga.js';
import { Ico, accion } from './piezas.jsx';
import { usePase } from './pase.js';
import { LLEGADA, PRIMERA_VISITA, contar, pedirRecorrido, reciente, tuto, tutoPoner } from './primera.js';

const W = typeof window !== 'undefined' ? window : {};
const leerLS = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// ── B · el recorrido ─────────────────────────────────────────────────────────────────────────────────────────────
// ⚠️ SEÑALA EL MENÚ, NO LA PÁGINA: el menú está en todas (arriba en la compu, la tira de abajo en el celular), así que
// el recorrido corre igual desde el Inicio o desde la Guía, sin mover a nadie de donde está
const PASOS = [
  { a: '#/eventos', tag: 'EVENTOS', h: 'Cuándo se juega',
    p: 'Cada servidor de la Liga organiza sus eventos, y acá está el calendario de todos. La campana te avisa al minuto cuando anuncian uno.' },
  { a: '#/ranking', tag: 'RANKING', h: 'Un solo ranking',
    p: 'Jugá un evento en cualquier servidor de la Liga y ya entrás. Cada puesto suma puntos a tu temporada.' },
  { a: '#/tarjetas', tag: 'TARJETAS', h: 'Tu tarjeta',
    p: 'Cada rapero tiene sus tarjetas estilo FIFA, con sus números de verdad. Las tuyas salen cuando te verificás en Discord Rap Español.' },
  { a: '#/pase', tag: 'PASE DE RAPERO', h: 'Sin jugar también se sube',
    p: 'Las Tareas del Pase te suben de nivel con lo que hacés en la página y en el bot. El nivel 1 te da tu tarjeta de Temporada.' },
];

/** El link del menú que se ve: el de arriba en la compu, el de la tira en el celular (que se corre hasta mostrarlo) */
function blanco(raiz, href) {
  if (!raiz) return null;
  const xs = Array.from(raiz.querySelectorAll('.cab .menu a, .tabbar a')).filter((a) => a.getAttribute('href') === href);
  return xs.find((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
}

function Recorrido({ liga, dc, onCerrar }) {
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState(null);
  const yo = useRef(null);
  const sig = useRef(null);
  const paso = i > 0 ? PASOS[i - 1] : null;
  const c = liga.d.comunidad || {};

  // dónde está lo señalado; se vuelve a medir si cambia el tamaño o se mueve la página
  const medir = useCallback(() => {
    if (!paso) { setCaja(null); return; }
    const el = blanco(yo.current && yo.current.getRootNode(), paso.a);
    if (!el) { setCaja(null); return; }
    const r = el.getBoundingClientRect();
    setCaja({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [paso]);
  useLayoutEffect(() => {
    if (paso) {
      const el = blanco(yo.current && yo.current.getRootNode(), paso.a);
      // en el celular la tira se desliza: se corre ella, nunca la página
      const tira = el && el.closest('.tb-tira');
      if (tira) tira.scrollLeft = Math.max(0, el.offsetLeft - (tira.clientWidth - el.offsetWidth) / 2);
    }
    medir();
  }, [medir, paso]);
  useEffect(() => {
    W.addEventListener('resize', medir);
    W.addEventListener('scroll', medir, { passive: true });
    return () => { W.removeEventListener('resize', medir); W.removeEventListener('scroll', medir); };
  }, [medir]);
  useEffect(() => { if (sig.current) sig.current.focus(); }, [i]);
  // al cerrar, la tira del celular vuelve al principio (con el Inicio a la vista), como estaba
  // ⚠️ la raíz se toma al abrir: al cerrar, React ya soltó la referencia
  useEffect(() => {
    const r = yo.current && yo.current.getRootNode();
    return () => {
      const t = r && r.querySelector ? r.querySelector('.tb-tira') : null;
      if (t) t.scrollLeft = 0;
    };
  }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onCerrar('salto', i); };
    W.addEventListener('keydown', k);
    return () => W.removeEventListener('keydown', k);
  }, [i, onCerrar]);

  const ultimo = i === PASOS.length;
  // la caja va arriba de lo señalado si está en la mitad de abajo (la tira del celular) y abajo si no (el menú de arriba)
  const vw = W.innerWidth || 360, vh = W.innerHeight || 640;
  const ancho = Math.min(360, vw - 32);
  let pos = { left: Math.round((vw - ancho) / 2), top: Math.round(vh * 0.18) };
  if (caja) {
    const left = Math.round(Math.min(Math.max(16, caja.x + caja.w / 2 - ancho / 2), vw - ancho - 16));
    pos = caja.y > vh / 2 ? { left, bottom: Math.round(vh - caja.y + 16) } : { left, top: Math.round(caja.y + caja.h + 16) };
  }
  let fin = null;
  if (ultimo) {
    fin = !dc ? <button type="button" className="btn verde chico" ref={sig} onClick={() => { onCerrar('fin'); accion.entrar(); }}>Entrar con Discord</button>
      : !dc.rapero ? <a className="btn verde chico" ref={sig} href="#/cuenta/verificar" onClick={() => onCerrar('fin')}>Verificarme</a>
        : <a className="btn verde chico" ref={sig} href="#/pase" onClick={() => onCerrar('fin')}>Ver mis Tareas</a>;
  }
  return (
    <div className="rc" ref={yo}>
      {/* lo de atrás no se toca mientras dura; el hueco lo hace la sombra del recuadro */}
      <div className="rc-tapa" />
      {caja ? <div className="rc-luz" style={{ left: caja.x - 6, top: caja.y - 6, width: caja.w + 12, height: caja.h + 12 }} />
        : <div className="rc-luz rc-todo" />}
      <div className="rc-caja" role="dialog" aria-modal="true" aria-labelledby="rc-h" style={Object.assign({ width: ancho }, pos)}>
        {paso ? (
          <>
            <div className="rc-cab"><span className="tag">{paso.tag}</span><small>{i} de {PASOS.length}</small></div>
            <h2 id="rc-h">{paso.h}</h2>
            <p>{paso.p}</p>
            {!caja ? <p className="rc-nota">Está en el menú{W.innerWidth < 900 ? ' de abajo' : ' de arriba'}.</p> : null}
            <div className="rc-acc">
              {ultimo ? fin : <button type="button" className="btn verde chico" ref={sig} onClick={() => setI((x) => Math.min(x + 1, PASOS.length))}>Siguiente</button>}
              {ultimo ? <button type="button" className="btn borde2 chico" onClick={() => onCerrar('fin')}>Listo</button>
                : <button type="button" className="btn borde2 chico" onClick={() => setI((x) => Math.max(x - 1, 0))}>Atrás</button>}
              {!ultimo ? <button type="button" className="rc-saltar" onClick={() => onCerrar('salto', i)}>Saltar</button> : null}
            </div>
          </>
        ) : (
          <>
            <div className="rc-cab"><span className="tag">BIENVENIDO</span></div>
            <h2 id="rc-h">Esto es la Liga Global de Freestyle</h2>
            <p>{c.personas && c.servidores ? <>{num(c.personas)} raperos de {num(c.servidores)} servidores de Discord compiten en un mismo ranking. </>
              : <>Raperos de muchos servidores de Discord compiten en un mismo ranking. </>}Te muestro cómo funciona en cuatro pasos.
              {/* 👉 en el celular, que sepa dónde está todo (17/10/2026: «enseñar que hay una barra abajo que se puede deslizar») */}
              {(W.innerWidth || 0) < 900 ? <> Todo está en la <b>barra de abajo</b>, que se desliza de costado.</> : null}</p>
            <div className="rc-acc">
              <button type="button" className="btn verde chico" ref={sig} onClick={() => setI(1)}>Mostrame</button>
              <button type="button" className="btn borde2 chico" onClick={() => onCerrar('salto', 0)}>Ahora no</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── C · la primera vez en cada página que el recorrido no mostró ──────────────────────────────────────────────
// ⚠️ UN CONSEJO DE QUÉ HACER, NO QUÉ ES: lo que es ya lo dice el título de cada página (la Tienda, Socios), y repetirlo
// arriba eran dos bloques diciendo lo mismo. La nota dice lo que no se ve a simple vista
const NOTAS = {
  publicaciones: 'Tocá 👏 en un logro para felicitar: a quien felicitás le llega el aviso, y se ve cuántos, nunca quiénes.',
  tienda: 'Ponele precio a la cabeza de alguien con tus Puntos de Tienda: el primero que le gane en un evento se los lleva. Si nadie lo caza en la semana, vuelven a vos.',
  socios: '¿Tu servidor no está? Escribile a @itsdlx en Discord.',
  r: 'Con «Seguir» te avisa cuando gana algo, y con el botón de compartir mandás su perfil.',
  llave: 'Si se está jugando, se actualiza sola: dejala abierta y mirá quién pasa.',
  sv: 'En Eventos, en «Cuándo suele jugar», podés seguir a sus organizadores: te avisa cuando anuncian.',
  crew: 'Una crew suma los puntos de su gente; para tener puesto necesita tres raperos en la temporada.',
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
 * Lo del tutorial que vive en toda la página: el recorrido (solo la primera vez por el Inicio, o pedido desde la Guía),
 * la franja de quien llegó por un link y la nota de cada página. Va arriba del contenido, debajo de la cabecera.
 */
export function Tutorial({ liga, dc, pagina, sv, repite }) {
  const T = tuto();
  const [abierto, setAbierto] = useState(false);
  const [franja, setFranja] = useState(() => !!(PRIMERA_VISITA && T && !T.tour && T.franja !== 'no' && LLEGADA
    && !SIN_FRANJA[LLEGADA]));
  const clave = sv ? 'sv' : pagina;
  const [nota, setNota] = useState(null);
  const enInicio = useRef(pagina === '');
  enInicio.current = pagina === '';

  // B · solo, una vez: la primera visita, entrando por el Inicio, después de que se vea la página
  useEffect(() => {
    if (!T || !T.nuevo || T.tour || !PRIMERA_VISITA || LLEGADA !== '') return undefined;
    const t = setTimeout(() => { if (enInicio.current && !tuto().tour) { setAbierto(true); contar('tour'); } }, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // y desde la Guía, las veces que se quiera
  useEffect(() => {
    if (!repite) return;
    setFranja(false); setAbierto(true); contar('repite');
  }, [repite]);
  useEffect(() => { if (franja) contar('franja'); }, [franja]);
  // C · la nota, una vez por página: no mientras esté la franja (una sola invitación arriba) ni con el recorrido abierto
  useEffect(() => {
    const t = tuto();
    if (!t || !reciente() || !NOTAS[clave] || (t.notas || {})[clave] || franja) { setNota(null); return; }
    setNota(clave);
    tutoPoner({ notas: Object.assign({}, t.notas || {}, { [clave]: 1 }) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cerrar = useCallback((como, n) => {
    setAbierto(false);
    const t = tuto();
    if (t && t.tour !== 'fin') tutoPoner({ tour: como });
    contar(como === 'fin' ? 'tour_fin' : 'salta' + (n || 0));
  }, []);
  const verFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); contar('franja_si'); setAbierto(true); };
  const cerrarFranja = () => { setFranja(false); tutoPoner({ franja: 'no' }); };

  return (
    <>
      {franja && !abierto ? (
        <div className="rc-franja" role="region" aria-label="Primera vez">
          <p>{FRANJA[LLEGADA] || '¿Primera vez en la Liga? Mirá cómo funciona.'}</p>
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
      {abierto ? <Recorrido liga={liga} dc={dc} onCerrar={cerrar} /> : null}
    </>
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
    ['entrar', !!dc, 'Entrá con Discord', 'Con tu cuenta: tu perfil, tus avisos, votar y seguir.',
      dc ? null : <button key="b" type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button>],
    ['verif', verificado, 'Verificate', 'En Discord Rap Español, con tu país. Se abre tu tarjeta de Servidor.',
      <a key="b" className="btn verde chico" href="#/cuenta/verificar">Verificarme</a>],
    ['pase', nivel >= 1, 'Llegá al nivel 1 del Pase', 'Dos Tareas del día o una de la semana, sin necesidad de jugar. Se abre tu tarjeta de Temporada.',
      <a key="b" className="btn verde chico" href="#/pase">Ver mis Tareas</a>],
    ['campana', !!leerLS('campana:activada'), 'Prendé la campana', 'Te avisa al minuto cuando un servidor anuncia un evento.',
      <a key="b" className="btn verde chico" href="#/avisos">Activar</a>],
    ['seguir', liga.sigue.length > 0, 'Seguí a un rapero', 'Te avisa cuando gana algo.',
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
            <h2 id="pp-h">{completo ? 'Ya diste los primeros pasos' : 'Empezá por acá'}</h2></>}
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
        {enGuia ? <> · <button type="button" className="pp-rec" onClick={pedirRecorrido}>Ver el recorrido otra vez</button></> : null}</p>
    </Raiz>
  );
}
