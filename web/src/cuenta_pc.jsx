// 🖥️ TU CUENTA EN LA COMPU (17/11/2026, la B de la maqueta Rsok68VBzdTCvZXGX6grH4, v8). Dlx: «en celular está bien…
// en PC es muy incómodo», «me gusta B, pero sólo hazla para computadora… agrega más opciones a la izquierda», «Tus
// paneles que esté arriba… que cada bloque tenga todo lo necesario», «me gusta eso de buscar en tu cuenta» y «publícalo».
//   · un MENÚ FIJO a la izquierda, por grupos: Tus paneles (sólo a quien los tiene), Lo tuyo (con Tu cuenta, la app y
//     la ayuda, desde la 6.09), Tú y Tu gente. Antes también «Tu cuenta» y «La
//     app y ayuda, con un buscador arriba y Salir abajo
//   · cada página con la MISMA CABECERA (el grupo, el nombre, una línea y «Ver mi perfil público»): lo propio baja al cuerpo
//   · las páginas se arman con las cajas de siempre (`Parte` de cuenta.jsx): no hay dos versiones de un mismo ajuste
//   · el celular sigue con la página de antes (Dlx: «me gusta cómo se ve en celular»)
//   · los links de antes (`#/cuenta/algo-mal`, `#/cuenta/hora`…) abren la página nueva que los tiene y bajan hasta su caja
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, num } from './liga.js';
import { Cara, Ico, accion, usePerfiles } from './piezas.jsx';
import { CaraDc } from './arriba.jsx';
import { crewDe } from './crews.js';
import { useRacha } from './racha.js';
import { useFondos } from './fondos.js';
import { Parte, RachaNivel } from './cuenta.jsx';

const W = window;
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };

// las páginas: [id, grupo, nombre, ícono, las partes que junta (las cajas de `Parte`)]
const PAGINAS = [
  ['resumen', 'Lo tuyo', 'Tu cuenta', 'yo', []],
  ['perfil', 'Tú', 'Tu perfil', 'perfil', ['perfil']],
  ['temas', 'Tú', 'Tus temas', 'tema', ['apariencia']],
  ['fondos', 'Tú', 'Tus fondos', 'imagen', ['fondo']],
  ['estilo', 'Tú', 'Tu estilo', 'micro', ['estilo']],
  // 👥 TU GENTE, UNA SOLA PÁGINA (18/11/2026, Dlx: «Yes, merge them»). Tu crew, Tu servidor y Siguiendo eran tres
  // páginas cortas al lado de un menú más alto, y debajo quedaba blanco (1.016×528 en Tu crew, medido con sesión a 1333).
  // En el menú siguen las tres (`MENU_GENTE`): cada una abre esta página y baja hasta su caja si no se ve
  ['gente', 'Tu gente', 'Tu gente', 'crews', ['crew', 'servidor', 'siguiendo']],
  ['app', 'Lo tuyo', 'La app', 'reloj', ['hora', 'avisos', 'accesibilidad', 'instalar']],
  ['privacidad', 'Lo tuyo', 'Privacidad y datos', 'candado', ['privacidad']],
  ['ayuda', 'Lo tuyo', 'Ayuda', 'soporte', ['algo-mal', 'introduccion', 'guia', 'novedades', 'legal']],
];
// los nombres de cada parte cuando van juntas en una página (cada una con su título)
const NOMBRE_PARTE = { hora: 'Hora y zona', avisos: 'Avisos de eventos', accesibilidad: 'Accesibilidad',
  instalar: 'Instalar la app', 'algo-mal': 'Algo está mal', introduccion: 'La introducción', guia: 'Guía', novedades: 'Novedades', legal: 'Términos y privacidad',
  crew: 'Tu crew', servidor: 'Tu servidor', siguiendo: 'Siguiendo' };
// las partes que ya traen su título en su caja («Mi crew», «Tu servidor · …», «Sigues a 10»): sin el de la parte encima
const SIN_TITULO = ['crew', 'servidor', 'siguiendo'];
// lo que el menú muestra en «Tu gente»: las tres de antes, cada una a su caja de la misma página
const MENU_GENTE = [['crew', 'crews', 'Tu crew'], ['servidor', 'servidor', 'Tu servidor'], ['siguiendo', 'seguir', 'Siguiendo']];
// 🧱 LAS PÁGINAS DE VARIAS PARTES, EN DOS COLUMNAS PAREJAS (18/11/2026): en la grilla de a dos de antes cada fila medía
// lo que su parte más alta (medido con sesión a 1333 px: 552×736 sin nada abajo de Accesibilidad, 520×336 al lado de
// la Introducción). Repartidas por alto: en La app, Hora y zona (con las zonas de a dos, 505), Avisos y Accesibilidad
// contra Instalar (850): 931 contra 850; en Ayuda, Algo está mal (498) y la Guía contra las otras tres: 707 contra 587
const COLUMNAS = { app: [['hora', 'avisos', 'accesibilidad'], ['instalar']], ayuda: [['algo-mal', 'guia'], ['introduccion', 'novedades', 'legal']] };
// en Tu gente lo que cambia el alto es a cuántos sigues: con más de tres, la lista de caras (de a dos) va sola a la derecha
// y la crew y el servidor apilados a la izquierda; con tres o menos, las tres cajas miden parecido y van de a tres
const columnasGente = (n) => (n > 3 ? [['crew', 'servidor'], ['siguiendo']] : [['crew'], ['servidor'], ['siguiendo']]);
// las de una parte con varias cajas que van en dos columnas (`cols` de `Parte`); Tu estilo, con tres cajas de alto
// parecido, va de a tres (`cpc-tres`). Siguiendo NO: su lista de caras en media columna medía el doble y al lado
// quedaba 520×568 vacío debajo de los organizadores (medido con la 6.56); apiladas, la lista va de a cinco
const EN_DOS = ['perfil', 'privacidad'];
// 🔗 los links de antes: a qué página van (y bajan hasta su caja)
const DE_ANTES = { cuenta: 'resumen', fondo: 'fondos', apariencia: 'temas', hora: 'app', accesibilidad: 'app', avisos: 'app', instalar: 'app',
  'algo-mal': 'ayuda', introduccion: 'ayuda', guia: 'ayuda', novedades: 'ayuda', legal: 'ayuda', crew: 'gente', servidor: 'gente', siguiendo: 'gente' };
export const paginaPc = (parte) => (PAGINAS.some((p) => p[0] === parte) ? parte : DE_ANTES[parte] || 'resumen');

// 🔎 EL BUSCADOR (de la maqueta, «Buscar en tu cuenta»): palabras que la gente usa → la página y su caja
const PALABRAS = [
  ['tema temas clara noche colores apariencia modo oscuro servidor', 'temas', ''], ['hora zona horario 12 24', 'app', 'hora'],
  ['avisos notificaciones campana eventos', 'app', 'avisos'], ['animaciones accesibilidad movimiento', 'app', 'accesibilidad'],
  ['instalar app pantalla de inicio', 'app', 'instalar'], ['foto avatar imagen cara', 'perfil', ''], ['frase', 'perfil', ''],
  ['redes instagram tiktok youtube', 'perfil', ''], ['videos batallas', 'perfil', ''], ['fondo portada', 'fondos', ''],
  ['estilo de juego tag marco cartas emblemas looks', 'estilo', ''], ['crew invitaciones', 'gente', 'crew'],
  ['servidor representas', 'gente', 'servidor'], ['seguir siguiendo seguidores organizadores', 'gente', 'siguiendo'],
  ['privacidad datos borrar ocultar comentarios dispositivo', 'privacidad', ''],
  ['perdí cuenta no soy yo país bandera video soporte ayuda', 'ayuda', 'algo-mal'], ['guía cómo funciona', 'ayuda', 'guia'],
  ['novedades changelog', 'ayuda', 'novedades'], ['introducción bienvenida', 'ayuda', 'introduccion'], ['términos', 'ayuda', 'legal'],
  ['racha nivel xp', 'resumen', ''],
];
const sinTilde = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Buscador() {
  const [q, setQ] = useState('');
  const n = sinTilde(q).trim();
  const res = n.length >= 2 ? PALABRAS.filter(([p]) => sinTilde(p).includes(n) || n.split(/\s+/).every((w) => sinTilde(p).includes(w))).slice(0, 5) : [];
  const ir = (pag, sec) => { setQ(''); location.hash = '#/cuenta/' + (sec || pag); };
  return (
    <div className="cpc-busca">
      <label className="cpc-busca-c"><Ico n="buscar" t={16} /><input type="search" value={q} placeholder="Buscar en tu cuenta" aria-label="Buscar en tu cuenta"
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) ir(res[0][1], res[0][2]); if (e.key === 'Escape') setQ(''); }} /></label>
      {res.length ? (
        <ul className="cpc-busca-r">{res.map(([p, pag, sec]) => {
          const P = PAGINAS.find((x) => x[0] === pag);
          return <li key={p}><button type="button" onClick={() => ir(pag, sec)}><b>{sec && NOMBRE_PARTE[sec] ? NOMBRE_PARTE[sec] : P[2]}</b><small>{P[2]}</small></button></li>;
        })}</ul>
      ) : n.length >= 2 ? <p className="cpc-busca-no">Nada con «{q}».</p> : null}
    </div>
  );
}

/** ✅ «Completa tu cuenta»: lo que ya está y lo que falta, con lo que la página ya sabe (sin pedir nada nuevo). */
function useCompleta(liga, dc) {
  const P = usePerfiles();
  const F = useFondos();
  const k = (liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const p = (P && P.p && k && P.p[k]) || null;
  if (!dc || !k) return null;
  return [
    ['verificado', 'Verificado', !!(dc.rapero || dc.clave), '#/cuenta/verificar'],
    ['frase', 'Frase', !!(p && p.fr), '#/cuenta/perfil'],
    ['redes', 'Redes', !!(p && p.redes && p.redes.length), '#/cuenta/perfil'],
    ['avisos', 'Avisos', !!leer('campana:activada', false), '#/cuenta/avisos'],
    ['crew', 'Crew', !!crewDe(k), '#/crews'],
    ['fondo', 'Fondo', !!(F && F[k]), '#/cuenta/fondos'],
  ];
}

function Resumen({ liga, dc }) {
  const R = useRacha(!!dc);
  const yo = liga.yo;
  const C = useCompleta(liga, dc);
  const faltan = C ? C.filter((x) => !x[2]) : [];
  const n = R && R.nivel;
  const tramo = n ? Math.max(1, n.sig - n.base) : 1;
  const crew = crewDe((yo && yo.k) || (dc && dc.clave));
  return (
    <>
      <div className="cpc-nums">
        <div><b>{yo && yo.pos ? '#' + yo.pos : '—'}</b><small>{yo && yo.pos ? 'de la ' + liga.temp + ' · OVR ' + (yo.ovr || '—') : 'sin puesto todavía'}</small></div>
        <div><b>{num((yo && yo.ev) || 0)}</b><small>{(yo && yo.ev) === 1 ? 'evento esta temporada' : 'eventos esta temporada'}</small></div>
        <div><b>{R && R.racha && R.racha.actual ? R.racha.actual + (R.racha.actual === 1 ? ' día' : ' días') : '—'}</b><small>{R && R.racha ? 'seguidos · tu mejor: ' + (R.racha.maxima || 0) : 'tu racha'}</small></div>
        <div><b>{n ? 'Nivel ' + n.n : '—'}</b><small>{n ? (n.xp - n.base) + ' de ' + tramo + ' para el ' + (n.n + 1) : 'tu nivel'}</small>
          {n ? <i className="cpc-barra"><u style={{ width: Math.min(100, Math.round((100 * (n.xp - n.base)) / tramo)) + '%' }} /></i> : null}</div>
      </div>
      {C && faltan.length ? (
        <div className="cpc-completa">
          <div><small>Completa tu cuenta · {C.length - faltan.length} de {C.length}</small>
            <h3>{faltan.length === 1 ? 'Te falta ' + faltan[0][1].toLowerCase() : 'Te faltan ' + faltan.length + ': ' + faltan.map((x) => x[1].toLowerCase()).join(', ')}</h3>
            <span className="cpc-chips">{C.map(([id, t, ok, h]) => <a key={id} href={h} className={'cpc-chip' + (ok ? ' ok' : '')}>{ok ? '✓ ' : ''}{t}</a>)}</span></div>
          <a className="btn negro" href={faltan[0][3]}>Completar {faltan[0][1].toLowerCase()}</a>
        </div>
      ) : null}
      <div className="cpc-dos"><RachaNivel dc={dc} liga={liga} /></div>
      <div className="cpc-tres">
        <div className="cpc-parte" data-parte="cuenta"><Parte id="cuenta" liga={liga} dc={dc} /></div>
        <section className="cu-caja"><h3>Tu gente</h3>
          <p className="cu-d">{crew ? 'Tu crew: ' + limpio(crew.c.nombre) + '.' : 'Todavía no estás en una crew.'} Sigues a {liga.sigue.length} {liga.sigue.length === 1 ? 'rapero' : 'raperos'}.</p>
          <div className="cu-btns"><a className="btn borde2 chico" href="#/cuenta/crew">Tu crew</a><a className="btn borde2 chico" href="#/cuenta/siguiendo">Siguiendo</a></div></section>
        <section className="cu-caja"><h3>Ayuda</h3>
          <p className="cu-d">Si algo está mal (perdiste tu cuenta, tu país, un video que no es tuyo), o para repasar cómo funciona la Liga.</p>
          <div className="cu-btns"><a className="btn borde2 chico" href="#/cuenta/algo-mal">Algo está mal</a><a className="btn borde2 chico" href="#/cuenta/guia">Guía</a></div></section>
      </div>
    </>
  );
}

export function CuentaPC({ liga, dc, parte, tema, onTema, temaSv, onTemaSv, socio, dueno }) {
  const pag = paginaPc(parte || 'resumen');
  const P = PAGINAS.find((x) => x[0] === pag);
  const yo = liga.yo;
  const k = (yo && yo.k) || (dc && dc.clave) || '';
  const R = useRacha(!!dc);
  const caja = useRef(null);
  const crew = crewDe(k);
  // ⤵️ un link de antes (`#/cuenta/hora`) baja hasta su caja, si no se ve entera: en Tu gente las tres entran en la
  // primera pantalla, y bajar escondía la cabecera sin mostrar nada nuevo
  useEffect(() => {
    const id = parte && DE_ANTES[parte] && parte !== pag ? parte : '';
    if (!id || !caja.current) return undefined;
    const t = setTimeout(() => {
      const el = caja.current && caja.current.querySelector('[data-parte="' + id + '"]');
      if (!el || !el.scrollIntoView) return;
      const r = el.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= W.innerHeight) return;
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  }, [parte, pag]);
  const sub = useMemo(() => ({
    resumen: [dc && (dc.rapero || dc.clave) ? 'Verificado' : dc ? 'Con Discord' : 'Sin entrar', yo && yo.rg ? 'Rango ' + yo.rg : yo ? 'Sin rango todavía' : '',
      yo && liga.svs[yo.sv] ? limpio(liga.svs[yo.sv].nombre || yo.sv) : ''].filter(Boolean).join(' · '),
    perfil: 'tu foto, tu frase, tus redes y tus videos', temas: 'Clara o Noche, y los colores de un servidor de la Liga', fondos: 'qué va detrás de ti en tu perfil, el VS, tu carta, Discord y tu ficha', estilo: 'tu estilo de juego y cómo se ven tus cartas',
    gente: [crew ? 'tu crew: ' + limpio(crew.c.nombre) : 'tus invitaciones de crew', 'el servidor que representas',
      liga.sigue.length ? 'sigues a ' + liga.sigue.length : 'a quién sigues'].join(' · '),
    app: 'la hora, los avisos, las animaciones y la app en tu pantalla',
    privacidad: 'tu foto, lo que guardamos y este dispositivo', ayuda: 'algo está mal, la guía, la introducción y lo nuevo',
  }), [dc, yo, liga, crew]);
  const nItems = (R && R.nivel) ? R.nivel.n : null;
  const cols = pag === 'gente' ? columnasGente(liga.sigue.length) : COLUMNAS[pag] || [P[4]];
  const grupos = [
    socio || dueno ? ['Tus paneles', [socio ? ['#/socio', 'servidor', 'Panel del servidor', 'las estadísticas de tus servidores'] : null,
      dueno ? ['#/dashboard', 'tablero', 'Dashboard', 'lo que espera que decidas'] : null].filter(Boolean)] : null,
    // 🧺 LO TUYO, ARRIBA Y CON TODO (Dlx, 17/11/2026: «tu cuenta y ayuda súbelo a lo tuyo… que no haya cuenta y ayuda,
    // simplemente sube esos arriba, y tu cuenta encima de inventario»): sin los grupos «Tu cuenta» ni «La app y ayuda»
    ['Lo tuyo', [['#/cuenta/resumen', 'yo', 'Tu cuenta', '', 'resumen'], ['#/inventario', 'mochila', 'Inventario', 'tus TAGs, marcos y cartas'],
      ['#/pase', 'pase', 'Pase rapero', 'tu nivel y tus premios'], ['#/tienda', 'tienda', 'Tienda', 'tus Puntos de Tienda'],
      k ? ['#/r/' + encodeURIComponent(k), 'perfil', 'Mi perfil público', 'lo que ven los demás'] : null,
      ...PAGINAS.filter((x) => x[1] === 'Lo tuyo' && x[0] !== 'resumen').map(([id, , n, ico]) => ['#/cuenta/' + id, ico, n, '', id])].filter(Boolean)],
    ['Tú', PAGINAS.filter((x) => x[1] === 'Tú').map(([id, , n, ico]) => ['#/cuenta/' + id, ico, n, '', id])],
    ['Tu gente', MENU_GENTE.map(([id, ico, n]) => ['#/cuenta/' + id, ico, n, id === 'crew' && crew ? limpio(crew.c.nombre) : '', id])],
  ].filter(Boolean);
  // en el menú se marca la que se abrió: en Tu gente, la de las tres que se tocó (la crew si se entró por `#/cuenta/gente`)
  const activo = pag === 'gente' ? (MENU_GENTE.some((x) => x[0] === parte) ? parte : 'crew') : pag;
  return (
    <div className="cpc">
      <aside data-tuto="cu-nav" className="cpc-menu" aria-label="Tu cuenta">
        <div className="cpc-yo">
          {yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="cpc-cara" /> : dc ? <CaraDc dc={dc} cls="cpc-cara" /> : <span className="cpc-cara"><Ico n="yo" t={22} /></span>}
          <span><b>{limpio(yo ? yo.n : dc ? dc.n : 'Sin entrar')}</b>
            <small>{[yo && yo.pos ? '#' + yo.pos : '', nItems ? 'nivel ' + nItems : '', R && R.racha && R.racha.actual ? R.racha.actual + ' días' : ''].filter(Boolean).join(' · ') || 'tu cuenta'}</small></span>
        </div>
        <Buscador />
        {grupos.map(([g, xs]) => (
          <div className="cpc-g" key={g}><span className="cpc-gt">{g}</span>
            <ul>{xs.map(([h, ico, n, s, id]) => (
              <li key={h}><a href={h} className={id === activo ? 'on' : ''} aria-current={id === activo ? 'page' : undefined}>
                <i aria-hidden="true"><Ico n={ico} t={16} /></i><span><b>{n}</b>{s ? <small>{s}</small> : null}</span></a></li>
            ))}</ul></div>
        ))}
        {dc ? <button type="button" className="cpc-salir" onClick={accion.salir}><Ico n="salir" t={16} />Salir de tu cuenta</button>
          : <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button>}
      </aside>
      <div className="cpc-pag">
        {/* 🧱 LA MISMA CABECERA EN TODAS LAS PÁGINAS (Dlx, v7 de la maqueta): el grupo, el nombre, una línea y tu perfil */}
        <section className="escena cpc-cab">
          <div className="cpc-cab-t"><span className="tag">{P[1]}</span><h1 className="hero-ev">{P[2]}</h1><p>{sub[pag]}</p></div>
          {k ? <a className="btn verde" href={'#/r/' + encodeURIComponent(k)}>Ver mi perfil público</a> : null}
        </section>
        <div data-tuto="cu-parte" className="cpc-cuerpo" ref={caja}>
          {pag === 'resumen' ? <Resumen liga={liga} dc={dc} />
            : P[4].length > 1 ? (
              // 🧱 dos columnas que bajan cada una a su ritmo (ver `DosCol` en cuenta.jsx), con las partes repartidas
              <div className={'cpc-2c' + (cols.length === 3 ? ' tres' : '')}>{cols.map((ids) => (
                <div key={ids[0]}>{ids.map((id) => (
                  <section key={id} className="cpc-parte" data-parte={id}>{SIN_TITULO.includes(id) ? null : <h2 className="cpc-pt">{NOMBRE_PARTE[id] || id}</h2>}
                    <Parte id={id} liga={liga} dc={dc} tema={tema} onTema={onTema} temaSv={temaSv} onTemaSv={onTemaSv} /></section>
                ))}</div>
              ))}</div>
            ) : (
              <div className={'cpc-una' + (pag === 'estilo' ? ' cpc-tres' : '')} data-parte={P[4][0]}>
                <Parte id={P[4][0]} liga={liga} dc={dc} tema={tema} onTema={onTema} temaSv={temaSv} onTemaSv={onTemaSv} sinServidor cols={EN_DOS.includes(pag)} />
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
