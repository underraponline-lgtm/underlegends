// Lo de arriba del Inicio: la cabecera negra, las historias, el escenario (el carrusel de momentos), la Tira de
// «Esta semana» y la barra IR A. Traducido de docs/remake/reales.py (cabecera, historias, momentos, hero, semana, ir_a).
import { useEffect, useMemo, useRef, useState } from 'react';
import { MESES, capital, diaISO, ksDe, limpio, mult, norm, num, recorte, resultado, siglaDe, srcLogo, utc } from './liga.js';
import { Escudo, escudoDe } from './escudo.jsx';
import { Anotados, Cara, Carta, Chevron, Compartir, Ico, Poster, aDiscord, accion, enlace, nombrePais, silueta, subirSiEsta, useCampana } from './piezas.jsx';
import { Miniatura, abrirVideo } from './video.jsx';
import { useRacha } from './racha.js';
import { YoMenu } from './yomenu.jsx';
import { ERR_LIBRE, libreAccion, pedirLibres, useLibres } from './libres.js';

// 🧭 EL ORDEN, EL DEL MENÚ DE ARRIBA AGRUPADO (12/11/2026, ver `GRUPOS`): lo que va suelto arriba, primero, y después lo
// de cada grupo. Es el de la tira de abajo del celular, así que las cuatro y media que se ven sin deslizar son Inicio,
// Ranking, Eventos, Pase rapero y Publicaciones —las que se quiere que la gente mire—. La Tienda ya no está: vive en «Tu
// cuenta» (Dlx: «Tienda me gusta en tu cuenta… ahí nos ahorramos un espacio»), en el panel del Inicio y en el ☰
export const MENU = [
  ['Inicio', '#/'], ['Ranking', '#/ranking'], ['Eventos', '#/eventos'], ['Pase rapero', '#/pase'], ['Publicaciones', '#/publicaciones'],
  ['Competencias', '#/competencias'], ['Ligas', '#/ligas'], ['Crews', '#/crews'], ['Tarjetas', '#/tarjetas'], ['Salón de la fama', '#/salon'],
  ['Socios', '#/socios'], ['Guía', '#/guia'],
];
// el ☰ sigue teniendo todas, con la Tienda
export const MENU_TODO = [...MENU, ['Tienda', '#/tienda']];
// 🧭 EL MENÚ DE ARRIBA, AGRUPADO (Dlx, 12/11/2026: «los títulos de arriba… no se ven en todas las resoluciones», y su
// idea: «INICIO, Ranking ahí con todos sus rankings… la sección de eventos que abre Torneos, Competencias y Ligas… PASE
// RAPERO solo, Publicaciones solo y comunidad»; eligió esa, la D de la maqueta). Eran 13 en fila y medido a 1100 px no
// entraban. Seis botones entran en cualquier compu; los que llevan lista la abren al tocarlos o al pasar el mouse
// 🎨 cada ranking con su ícono (Dlx, 12/11/2026: «que cada ícono de cada ranking en ese submenú sea diferente»): eran diez
// iguales. El cuarto lugar es el ícono (`Ico` de piezas.jsx)
const RK_SUBS = [['Temporada', 'temporada', 'Los puntos y el OVR de la temporada', 'ranking'], ['Competitivo', 'competitivo', 'El Score y el rango', 'escudo'],
  ['ELO', 'divisiones', 'Las batallas uno contra uno, por divisiones', 'cruce'], ['Duelos', 'duelos', 'Quién gana más duelos', 'micro'],
  ['Podios', 'podios', 'Campeones y finalistas', 'copa'], ['Rachas', 'rachas', 'Eventos seguidos llegando lejos', 'fuego'],
  ['Países', 'paises', 'Por los puntos de su gente', 'mundo'], ['Crews', 'crews', 'Por los puntos de sus miembros', 'crews'],
  ['Most Wanted', 'mw', 'Los buscados de la semana', 'mira'], ['Misiones', 'misiones', 'Las de la semana, para todos', 'ok']];
export const GRUPOS = [
  ['Inicio', '#/'],
  ['Ranking', '#/ranking', RK_SUBS.map(([n, s, d, i]) => [n, '#/ranking/' + s, d, i])],
  ['Eventos', '#/eventos', [['Calendario', '#/eventos', 'Todos los torneos y la campana', 'eventos'], ['Competencias', '#/competencias', 'La Copa, la Liga de 10 y la Rapid', 'competencias'],
    ['Ligas', '#/ligas', 'Las ligas de cada servidor', 'ligas']]],
  ['Pase rapero', '#/pase'],
  ['Publicaciones', '#/publicaciones'],
  ['Comunidad', '', [['Crews', '#/crews', 'Arma la tuya o súmate a una', 'crews'], ['Tarjetas', '#/tarjetas', 'Las de cada rapero', 'tarjetas'],
    ['Salón de la fama', '#/salon', 'Los que ya ganaron', 'salon'], ['Socios', '#/socios', 'Los servidores de la Liga', 'socios']]],
  // 📖 la Guía, suelta al lado de Comunidad (Dlx, 12/11/2026: «agreguemos la opción llamada Guía al costado de
  // Comunidad»): adentro de la lista no se encontraba
  ['Guía', '#/guia'],
];
// las páginas de cada grupo, para marcarlo cuando estás adentro
const PAGINAS_DE = { Ranking: ['ranking', 'duelos'], Eventos: ['eventos', 'competencias', 'ligas', 'avisos'], Comunidad: ['crews', 'crew', 'tarjetas', 'salon', 'socios', 'mundo'] };

function Grupo({ n, items, on, pagina }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const t = useRef(null);
  // se cierra tocando afuera (dentro del shadow root: por `composedPath`, como el buscador), con Escape y al cambiar de página
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); const b = caja.current && caja.current.querySelector('button'); if (b) b.focus(); } };
    const cambio = () => setAbierto(false);
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', tecla);
    window.addEventListener('lg:dir', cambio);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('keydown', tecla); window.removeEventListener('lg:dir', cambio); };
  }, [abierto]);
  // con el mouse se abre al pasar por encima; se cierra con un respiro, así cruzar el hueco hasta la lista no la cierra
  const entra = (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(t.current); setAbierto(true); };
  const sale = (e) => { if (e.pointerType !== 'mouse') return; clearTimeout(t.current); t.current = setTimeout(() => setAbierto(false), 160); };
  useEffect(() => () => clearTimeout(t.current), []);
  const id = 'grp-' + norm(n).replace(/[^a-z]/g, '');
  return (
    <div className={'grp' + (abierto ? ' abierto' : '')} ref={caja} onPointerEnter={entra} onPointerLeave={sale}>
      <button type="button" className={'grp-b' + (on ? ' on' : '')} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((v) => !v)}>
        {n}<Chevron /></button>
      {abierto ? (
        <div className={'grp-lista' + (items.length > 6 ? ' dos' : '')} id={id}>
          {items.map(([nn, h, d, k]) => (
            <a key={h} href={h} onClick={(e) => { subirSiEsta(h)(e); setAbierto(false); }}
              className={pagina && h === '#/' + pagina ? 'on' : ''}>
              <Ico n={k} t={20} /><span><b>{nn}</b><small>{d}</small></span></a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// 📰 «N NUEVAS» EN PUBLICACIONES (12/11/2026, la maqueta: «Publicaciones · 3 nuevas»): lo que salió desde la última vez que
// la abriste (`lg:pub-visto`, lo anota publicaciones2.jsx). La primera vez, nada: si no, a quien nunca entró le saldrían
// cien. Con tope en 99
export function pubNuevas(liga, pagina) {
  if (!liga || pagina === 'publicaciones') return 0;
  let visto = 0;
  try { visto = Number(localStorage.getItem('lg:pub-visto')) || 0; } catch (e) { visto = 0; }
  if (!visto) return 0;
  return Math.min(99, (liga.muro || []).filter((it) => { const t = Date.parse(it.t || ''); return t > visto; }).length);
}

function MenuArriba({ pagina, nuevas }) {
  return (
    <nav className="menu" aria-label="Secciones">
      {GRUPOS.map(([n, r, items]) => {
        if (!items) {
          const on = n === 'Inicio' ? !pagina : pagina && r === '#/' + pagina;
          const badge = r === '#/publicaciones' && nuevas ? <i className="m-nuevas" aria-label={nuevas + ' nuevas'}>{nuevas}</i> : null;
          return <a key={n} href={r} title={QUE_ES[r]} onClick={subirSiEsta(r)} className={on ? 'on' : ''}>{n}{badge}</a>;
        }
        return <Grupo key={n} n={n} items={items} pagina={pagina} on={!!pagina && (PAGINAS_DE[n] || []).includes(pagina)} />;
      })}
    </nav>
  );
}
// «Socios» es lo que era «Mundo» (Dlx, 03/10/2026: «1. A»); `#/mundo` sigue abriéndolo (App.jsx). «Ligas», al lado de
// Tarjetas desde el 16/10/2026 (Dlx: «que ligas tenga su propio espacio aparte de ranking… al costado de tarjetas»)
// Y «Pase rapero» y «Publicaciones», intercambiados el mismo día (Dlx: «intercambiá eso»), y Ligas a la IZQUIERDA de
// Tarjetas (Dlx: «Ligas tiene que estar al lado izquierdo de tarjetas»). Y el Salón de la fama, una sección más (Dlx, el
// mismo día, a «¿dónde va?»: «en el menú, como sección»)
// 🗣️ QUÉ ES CADA UNA, en palabras comunes (Dlx, 12/10/2026, el research «página sencilla»: «hacé todo menos los dos
// puntos que chocan»). Los nombres se quedan —«Pase rapero» y «Socios» son de la Liga— y llevan al lado lo que son: en
// el menú ☰ debajo del nombre, y arriba en la compu al pasar el mouse
export const QUE_ES = {
  '#/': 'Lo que pasa ahora en la Liga', '#/eventos': 'Cuándo se juega, y la campana para enterarte',
  '#/ranking': 'Las tablas de la temporada', '#/competencias': 'La Copa, la Liga de 10 y la Rapid de la semana', '#/publicaciones': 'Campeones, rangos nuevos y anuncios',
  '#/tarjetas': 'Las tarjetas de cada rapero', '#/ligas': 'Las ligas de los servidores, con su tabla',
  '#/crews': 'Arma tu crew o súmate a una, con su tier',
  '#/salon': 'Los campeones, los récords y lo más difícil de la Liga',
  '#/pase': 'Premios por participar en la temporada',
  '#/tienda': 'Tus Puntos de Tienda, y el precio por cabeza', '#/socios': 'Los servidores que forman la Liga',
  '#/guia': 'Cómo funciona todo',
};

function Marca({ liga }) {
  return (
    <a className="marca" href="#/">
      <img alt="" src="/ul.png" />
      <span className="lockup"><b>DISCORD RAP</b> <b>EN ESPAÑOL</b><small className="lg">LIGA GLOBAL · {liga.temp}</small></span>
    </a>
  );
}

// ── el buscador: raperos, y también servidores, países y crews (Dlx, 01/10/2026: «sí», la E). Primero lo que es
// exactamente lo buscado, después lo que empieza así y al final lo que lo contiene; a igual coincidencia, raperos
// primero. Vive arriba en la computadora y en el menú ☰ en el celular, donde arriba no entra
const TIPOS = { rapero: 0, servidor: 1, pais: 2, crew: 3, pagina: 4, evento: 5 };
const ETIQUETA_TIPO = { rapero: 'rapero', servidor: 'servidor', pais: 'país', crew: 'crew', pagina: 'página', evento: 'evento' };
// 🔎 «QUE TE DEJE BUSCAR CUALQUIER COSA» (Dlx, 13/11/2026): también las páginas (las del menú, cada ranking y lo de tu
// cuenta) y los eventos (los que vienen y los de las últimas semanas)
const PAGINAS_EXTRA = [['Tienda', '#/tienda', 'tienda'], ['Inventario', '#/inventario', 'tarjetas'], ['Tu cuenta', '#/cuenta', 'perfil'],
  ['Ajustes', '#/ajustes', 'engranaje'], ['Novedades de la página', '#/cambios', 'novedades']];
// 🔑 Y POR SUS AKAS (Dlx, 07/10/2026: «cuando buscan a alguien con cualquiera de sus akas, que le aparezca el mismo
// rapero… si alguien busca vice, que aparezca el nombre principal»). El payload ya trae `alias` —{aka: clave}, los de
// quien tiene perfil; lo arma `subir_web._alias()` y lo usa la llave en vivo—, con la clave como `respaldo._norm()`:
// minúsculas, sin tildes y sólo letras y números. Un aka cuenta medio punto menos que el nombre: si alguien SE LLAMA así,
// sale primero
const normAka = (s) => norm(s).replace(/[^\p{L}\p{N}]/gu, '');
// 🔎 EL BUSCADOR CON EJEMPLOS (Dlx, 19/10/2026, «me gustan todas», a «Command Search» de 21st): mientras está vacío, el
// placeholder va mostrando qué se puede buscar, uno por vez. Sin tipeo letra por letra: en el celular cansa, y con
// «Menos animaciones» se queda en el primero
const EJEMPLOS = ['Busca un rapero…', 'Busca un servidor…', 'Busca una crew…', 'Busca un país…', 'Buscar en la Liga'];
function useEjemplo(activo) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const app = document.querySelector('#inicio-nuevo');
    const calma = !!(app && app.shadowRoot && app.shadowRoot.querySelector('.app.calma'));
    if (calma || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % EJEMPLOS.length), 2800);
    return () => clearInterval(t);
  }, [activo]);
  return EJEMPLOS[i];
}

// 🕘 LO ÚLTIMO QUE ABRISTE DESDE EL BUSCADOR (13/11/2026, Dlx: «que por default te muestre recomendaciones»): sólo en este
// navegador, los cinco últimos, con lo justo para dibujarlos
const REC_K = 'lg:busca-rec';
const leerRec = () => { try { const v = JSON.parse(localStorage.getItem(REC_K) || '[]'); return Array.isArray(v) ? v.slice(0, 5) : []; } catch (e) { return []; } };
const guardarRec = (r) => {
  const x = { tipo: r.tipo, id: r.id, n: r.n, href: r.href, k: r.k, cc: r.cc, logo: r.logo, ico: r.ico, sub: r.sub,
    crew: r.crew ? { crew: r.crew.crew, clave: r.crew.clave, logo: r.crew.logo } : undefined };
  try { localStorage.setItem(REC_K, JSON.stringify([x].concat(leerRec().filter((y) => y.id !== x.id)).slice(0, 5))); } catch (e) { /* sin guardar */ }
};
// los atajos de abajo del panel: las páginas que más se abren
const ATAJOS_BUSCA = [['Ranking', '#/ranking'], ['Eventos', '#/eventos'], ['Pase rapero', '#/pase'], ['Crews', '#/crews'], ['Publicaciones', '#/publicaciones'], ['Tienda', '#/tienda']];

export function Buscar({ liga, onIr, sugerencias = false }) {
  const [q, setQ] = useState('');
  const [rec, setRec] = useState(leerRec);
  const ejemplo = useEjemplo(!q);
  // 🔴 TODOS LOS QUE TIENEN PERFIL, NO SÓLO LOS 200 DE LA TABLA (13/10/2026, Dlx: «a pesar de que existe Lil Drako no
  // aparece en el buscador»). Desde la 2.97 tiene perfil todo el que jugó, pero los que no están en el top 200 viajan en
  // `/api/perfiles` (`p[k].f`) y el buscador sólo miraba la tabla del lobby. Se piden la primera vez que se escribe
  // (`window.perfiles()`, la misma copia que usan el perfil y Tarjetas): quien no busca no los baja
  const [todos, setTodos] = useState(null);
  useEffect(() => {
    if (todos || q.trim().length < 2 || typeof window.perfiles !== 'function') return undefined;
    let vivo = true;
    Promise.resolve(window.perfiles()).then((d) => { if (vivo && d && d.p) setTodos(d.p); }).catch(() => {});
    return () => { vivo = false; };
  }, [q, todos]);
  const akas = useMemo(() => {
    const m = {};
    Object.entries(liga.d.alias || {}).forEach(([a, k]) => { (m[k] = m[k] || []).push(a); });
    return m;
  }, [liga]);
  const res = useMemo(() => {
    const t = norm(q).trim();
    if (!t) return [];
    // 🔴 Y SIN ESPACIOS: «lildrako» no encontraba a «Lil Drako». Se compara también todo junto (`normAka`), con un
    // poquito menos de puntaje que lo escrito igual
    const tc = normAka(q);
    const nota = (...xs) => Math.min(...xs.map((x) => {
      const n = norm(x).trim(), c = normAka(x);
      const a = n === t ? 0 : (n.startsWith(t) ? 1 : (n.includes(t) ? 2 : 9));
      const b = tc.length < 2 ? 9 : c === tc ? 0.25 : (c.startsWith(tc) ? 1.25 : (c.includes(tc) ? 2.25 : 9));
      return Math.min(a, b);
    }));
    const ta = normAka(q);
    const porAka = (k) => {
      let mejor = [9, ''];
      if (ta.length >= 2) {
        (akas[k] || []).forEach((a) => {
          const x = a === ta ? 0.5 : a.startsWith(ta) ? 1.5 : a.includes(ta) ? 2.5 : 9;
          if (x < mejor[0]) mejor = [x, a];
        });
      }
      return mejor;
    };
    const todo = [];
    (liga.d.tabla || []).forEach((f) => {
      const x = nota(f.n), [xa, a] = porAka(f.k);
      todo.push({ tipo: 'rapero', id: 'r' + f.k, n: limpio(f.n), href: '#/r/' + encodeURIComponent(f.k), k: f.k,
        x: Math.min(x, xa), aka: xa < x ? a : '' });
    });
    // los que tienen perfil y no están en la tabla (ver `todos`, arriba)
    if (todos) {
      const ya = new Set((liga.d.tabla || []).map((f) => f.k));
      Object.entries(todos).forEach(([k, v]) => {
        const f = v && v.f;
        if (!f || !f.n || ya.has(k)) return;
        const x = nota(f.n), [xa, a] = porAka(k);
        todo.push({ tipo: 'rapero', id: 'r' + k, n: limpio(f.n), href: '#/r/' + encodeURIComponent(k), k, x: Math.min(x, xa), aka: xa < x ? a : '' });
      });
    }
    Object.values(liga.svs).forEach((s) => todo.push({ tipo: 'servidor', id: 's' + s.sv, n: limpio(s.nombre || siglaDe(s.sv)), sub: siglaDe(s.sv), href: '#/sv/' + siglaDe(s.sv), logo: liga.logo(s.sv),
      x: nota(s.sv, siglaDe(s.sv), s.nombre || '') }));
    (liga.d.paises || []).filter((p) => p.n).forEach((p) => todo.push({ tipo: 'pais', id: 'p' + p.cc, n: nombrePais(p.cc), href: '#/pais/' + p.cc, cc: p.cc, x: nota(nombrePais(p.cc)) }));
    (liga.d.crews || []).forEach((c) => todo.push({ tipo: 'crew', id: 'c' + (c.clave || c.crew), n: limpio(c.crew), href: '#/crew/' + encodeURIComponent(c.clave || c.crew), crew: c, x: nota(c.crew) }));
    // las páginas: las del menú de arriba (con lo de adentro de cada grupo) y lo de tu cuenta
    const vistas = new Set();
    const pagina = (n, href, ico, sub) => {
      if (!href || vistas.has(href + n)) return;
      vistas.add(href + n);
      todo.push({ tipo: 'pagina', id: 'g' + href + n, n, href, ico, sub, x: nota(n, sub ? sub + ' ' + n : n) });
    };
    GRUPOS.forEach(([n, href, sub]) => {
      if (href) pagina(n, href, sub ? (sub[0] || [])[3] : 'inicio');
      (sub || []).forEach(([sn, sh, , si]) => pagina(n === 'Ranking' ? 'Ranking ' + sn : sn, sh, si, n === 'Ranking' ? '' : n));
    });
    PAGINAS_EXTRA.forEach(([n, href, ico]) => pagina(n, href, ico));
    // los eventos: los que vienen y los que pasaron hace poco, por su nombre
    const evVistos = new Set();
    (liga.proximos ? liga.proximos() : []).concat((liga.d.calendario || []).map((c) => ({ nombre: c.n, sv: c.sv, cuando: c.t })))
      .forEach((e) => {
        const n = limpio(e.nombre || '');
        const id = (e.sv || '') + '|' + norm(n);
        if (!n || evVistos.has(id)) return;
        evVistos.add(id);
        todo.push({ tipo: 'evento', id: 'e' + id, n, sub: siglaDe(e.sv), href: '#/eventos', logo: e.sv ? liga.logo(e.sv) : '', x: nota(n) + 0.5 });
      });
    return todo.filter((r) => r.x < 9).sort((a, b) => (a.x - b.x) || (TIPOS[a.tipo] - TIPOS[b.tipo]) || a.n.localeCompare(b.n)).slice(0, 8);
  }, [q, liga, todos]);
  const ir = (r) => { if (r && r.href) guardarRec(r); setQ(''); if (onIr) onIr(); };
  // ⚠️ se cierra al tocar afuera y al cambiar de página: quedaba abierto encima de la siguiente (revisión del 03/10/2026)
  const caja = useRef(null);
  useEffect(() => {
    if (!q) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setQ(''); };
    const cambio = () => setQ('');
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('lg:dir', cambio);
    return () => { document.removeEventListener('pointerdown', fuera, true); window.removeEventListener('lg:dir', cambio); };
  }, [q]);
  const icono = (r) => {
    if (r.tipo === 'rapero') return <Cara liga={liga} k={r.k} nombre={r.n} cls="cara" />;
    if (r.tipo === 'servidor') return <span className="cara"><img alt="" src={r.logo} /></span>;
    if (r.tipo === 'pais') return <span className="cara"><img alt="" src={'/banderas/g/' + r.cc + '.webp'} /></span>;
    if (r.tipo === 'pagina') return <span className="cara br-ico"><Ico n={r.ico || 'flecha'} t={16} /></span>;
    if (r.tipo === 'evento') return r.logo ? <span className="cara"><img alt="" src={r.logo} /></span> : <span className="cara br-ico"><Ico n="eventos" t={16} /></span>;
    return <CrewCirculo c={r.crew} cls="cara" />;
  };
  return (
    <div className="buscar-w" ref={caja}>
      <label className="buscar">
        <Ico n="buscar" t={18} />
        <input type="search" placeholder={ejemplo} aria-label="Buscar raperos, servidores, países, crews, páginas y eventos" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) { location.hash = res[0].href; ir(res[0]); } if (e.key === 'Escape') setQ(''); }} />
      </label>
      {res.length ? (
        <ul className="busca-res">
          {res.map((r) => <li key={r.id}><a href={r.href} onClick={() => ir(r)}>{icono(r)}<span>{r.n}{r.aka ? <small className="br-aka">aka «{r.aka}»</small> : null}</span><small className="br-t">{ETIQUETA_TIPO[r.tipo]}{r.sub && r.sub !== r.n ? ' · ' + r.sub : ''}</small></a></li>)}
        </ul>
      ) : sugerencias && !q.trim() ? <Sugerencias liga={liga} rec={rec} icono={icono} ir={ir} borrar={() => { try { localStorage.removeItem(REC_K); } catch (e) { /* nada */ } setRec([]); }} />
        : sugerencias && q.trim() ? <div className="bs-panel"><p className="bs-nada">Nada con «{q.trim()}». Prueba con otro nombre o un aka.</p></div> : null}
    </div>
  );
}

// 💡 LO QUE MUESTRA EL BUSCADOR ANTES DE ESCRIBIR (13/11/2026, Dlx: «que por default te muestre recomendaciones sobre lo de
// abajo, o sea un panel semi transparente»): lo último que abriste, lo de hoy en la Liga, raperos (los que sigues o los de
// arriba de la Temporada) y atajos. Cada parte se apaga sola si no tiene con qué
function Sugerencias({ liga, rec, icono, ir, borrar }) {
  const hoy = liga.diaClave(liga.ahora);
  const vivos = liga.vivo();
  const hoyEv = vivos.concat(liga.luego().filter((x) => liga.diaClave(x.cuando) === hoy && !vivos.includes(x))).slice(0, 3);
  const sigo = (liga.sigue || []).slice(0, 5);
  const raperos = (sigo.length ? sigo.map((k) => liga.T[k]) : liga.oficiales().slice(0, 5)).filter(Boolean);
  return (
    <div className="bs-panel">
      {rec.length ? (
        <section>
          <p className="bs-s">Lo último que abriste <button type="button" className="bs-borrar" onClick={borrar}>Borrar</button></p>
          <ul className="bs-lista">{rec.map((r) => (
            <li key={r.id}><a href={r.href} onClick={() => ir(r)}>{icono(r)}<span>{r.n}</span><small className="br-t">{ETIQUETA_TIPO[r.tipo]}</small></a></li>
          ))}</ul>
        </section>
      ) : null}
      {hoyEv.length ? (
        <section>
          <p className="bs-s">Hoy en la Liga</p>
          <ul className="bs-lista">{hoyEv.map((x, i) => {
            const v = vivos.includes(x);
            return (
              <li key={'ev' + i}><a href="#/eventos" onClick={() => ir()}>
                <span className="cara"><img alt="" src={liga.logo(x.sv)} /></span><span>{limpio(x.nombre)}</span>
                <small className={'br-t' + (v ? ' bs-vivo' : '')}>{v ? 'EN VIVO' : liga.dia(x.cuando).replace(/^hoy /, '')}</small></a></li>
            );
          })}</ul>
        </section>
      ) : null}
      {raperos.length ? (
        <section>
          <p className="bs-s">{sigo.length ? 'Los que sigues' : 'Arriba en la Temporada'}</p>
          <ul className="bs-caras">{raperos.map((f) => (
            <li key={f.k}><a href={'#/r/' + encodeURIComponent(f.k)} onClick={() => ir({ tipo: 'rapero', id: 'r' + f.k, n: limpio(f.n), href: '#/r/' + encodeURIComponent(f.k), k: f.k })}>
              <Cara liga={liga} k={f.k} nombre={f.n} cls="cara" /><span>{limpio(f.n)}</span></a></li>
          ))}</ul>
        </section>
      ) : null}
      <section>
        <p className="bs-s">Ir a</p>
        <div className="bs-atajos">{ATAJOS_BUSCA.map(([n, h]) => <a key={h} href={h} onClick={() => ir()}>{n}</a>)}</div>
      </section>
      <p className="bs-pie">Busca raperos (también por su aka), servidores, países, crews, páginas y eventos<span> · Ctrl K abre · Esc cierra</span></p>
    </div>
  );
}

// la cara de la cuenta de Discord con la que entraste (`lg:dc`), aunque no seas rapero: Dlx, 30/09/2026, «arriba
// debería estar el círculo de mi cuenta conectada con Discord». El `av` es `id/hash`, como el de la tabla.
export function CaraDc({ dc, cls = 'cara' }) {
  const [mal, setMal] = useState(null);
  if (dc && dc.av && mal !== dc.av) {
    return <span className={cls}><img alt="" src={'https://cdn.discordapp.com/avatars/' + dc.av + '.webp?size=128'} onError={() => setMal(dc.av)} /></span>;
  }
  return <span className={cls + ' ini'}>{(limpio(dc && dc.n).slice(0, 1) || '?').toUpperCase()}</span>;
}

// 🔎 EL BUSCADOR EN EL CELULAR, CON SU LUPA ARRIBA (Dlx, 16/10/2026: «agrega el ícono de búsqueda para celulares»): hasta
// ahora vivía sólo adentro del menú ☰. La lupa abre el mismo buscador solo, con el teclado listo
// 🔝 Y SE ABRE ENCIMA DEL MENÚ, EN LA MISMA LÍNEA (13/11/2026, Dlx: «para que no alargue la línea de la nada, o sea esa
// búsqueda aparezca sobre el menú»): en la compu tapa justo el menú (se mide dónde está); en el celular, la fila entera.
// Las sugerencias y los resultados bajan en un panel por encima de la página
function BarraBuscar({ liga, onCerrar }) {
  const caja = useRef(null);
  const [lugar, setLugar] = useState(null);
  useEffect(() => {
    const medir = () => {
      const el = caja.current, cab = el && el.parentElement;
      const nav = cab && cab.querySelector('nav.menu');
      const r = nav && nav.getBoundingClientRect(), rc = cab && cab.getBoundingClientRect();
      setLugar(r && r.width > 120 && rc ? { left: Math.round(r.left - rc.left), width: Math.round(r.width) } : null);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { const i = caja.current && caja.current.querySelector('input'); if (i) i.focus(); }, 30);
    const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
    // 👆 tocar en cualquier otro lado de la página lo cierra (Dlx, 13/11/2026: «si se presiona en cualquier lado de la página
    // se quita el buscador»). La lupa no cuenta: ella misma abre y cierra. Por `composedPath`: vive en el shadow root
    const fuera = (e) => {
      const p = e.composedPath ? e.composedPath() : [];
      if (caja.current && p.includes(caja.current)) return;
      if (p.some((n) => n && n.classList && n.classList.contains('lupa-b'))) return;
      onCerrar();
    };
    window.addEventListener('keydown', esc);
    window.addEventListener('lg:dir', onCerrar);
    document.addEventListener('pointerdown', fuera, true);
    return () => {
      clearTimeout(t); window.removeEventListener('keydown', esc); window.removeEventListener('lg:dir', onCerrar);
      document.removeEventListener('pointerdown', fuera, true);
    };
  }, [onCerrar]);
  return (
    <div className={'cab-busca sobre' + (lugar ? '' : ' fila')} role="search" ref={caja} style={lugar || undefined}>
      <Buscar liga={liga} onIr={onCerrar} sugerencias />
      <button className="btn-ico cab-busca-x" type="button" aria-label="Cerrar el buscador" onClick={onCerrar}><Ico n="cerrar" t={18} /></button>
    </div>
  );
}

export function Cabecera({ liga, dc, onMenu, pagina = '' }) {
  const yo = liga.yo;
  const [busca, setBusca] = useState(false);
  // 👤 tu cara abre el menú de lo tuyo, con el Inventario primero (yomenu.jsx)
  const [yoM, setYoM] = useState(false);
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} /> : (dc ? <CaraDc dc={dc} /> : null);
  const nombre = yo ? limpio(yo.n) : (dc ? limpio(dc.n) : '');
  // 🔥 tu racha diaria, al lado de tu cuenta (sólo si entraste con Discord: pedirla cuenta el día)
  const R = useRacha(!!dc);
  const fuego = R && R.racha.actual ? R.racha.actual : 0;
  // ⭐ tu nivel (el general: el de entrar, jugar y lo que hacés en la Liga; no el del Pase), con su barra hasta el siguiente
  // (Dlx, 13/11/2026: «al costado del círculo de perfil una barra… no de Pase de rapero sino nivel de XP en general»)
  const nv = R && R.nivel && R.nivel.n ? R.nivel : null;
  const enInicio = !pagina || pagina === 'inicio';
  const nvPct = nv && nv.sig > nv.base ? Math.max(0, Math.min(100, Math.round((100 * (nv.xp - nv.base)) / (nv.sig - nv.base)))) : 0;
  // ⌨️ Ctrl K (o ⌘ K, o «/» fuera de un campo) abre el buscador, como la paleta de 21st que se tomó de referencia
  useEffect(() => {
    const tecla = (e) => {
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test((e.composedPath ? e.composedPath()[0] : e.target).tagName || '');
      if (((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') || (e.key === '/' && !enCampo)) { e.preventDefault(); setBusca(true); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  return (
    // 🅰 UNA FILA (13/11/2026, la A de la maqueta; Dlx: «la A, pero asegúrate de que se vea bien en todas las pantallas»):
    // marca, menú y lo tuyo en una sola línea en la compu (de 131 a ~62 px), y en el celular una línea con botones
    // livianos. El título es LIGA GLOBAL · T1; el buscador, una lupa que abre el mismo buscador. Ver `.cab.una` en vivo.css
    <header className="cab negra una">
      <Marca liga={liga} />
      <MenuArriba pagina={pagina} nuevas={pubNuevas(liga, pagina)} />
      <div className="cab-der">
        <Buscar liga={liga} />
        <button className={'btn-ico lupa-b' + (busca ? ' on' : '')} type="button" aria-label={busca ? 'Cerrar el buscador' : 'Buscar (Ctrl K)'} aria-expanded={busca}
          title="Buscar · Ctrl K" onClick={() => setBusca((v) => !v)}><Ico n="buscar" t={20} /></button>
        <Campanita liga={liga} />
        {/* ⚙️ SIN EL ENGRANAJE (Dlx, 12/11/2026: «quitar eso del ícono de ajustes porque se puede entrar desde tu cuenta»):
            los ajustes están en Tu cuenta, que abre tu cara arriba y «Tu cuenta» abajo en el celular, y en el ☰ */}
        {cara ? (
          <span className="yo-envol">
            <button type="button" className="yo-chip" aria-haspopup="menu" aria-expanded={yoM} onClick={() => setYoM((v) => !v)}
              aria-label={'Lo tuyo: inventario, perfil y cuenta' + (fuego ? ' · ' + fuego + (fuego === 1 ? ' día seguido' : ' días seguidos') : '')}>
              {cara}<span>{nombre}</span>
              {nv ? <span className="yo-nv" title={'Nivel ' + nv.n + ' · ' + num(nv.sig - nv.xp) + ' XP para el ' + (nv.n + 1)} aria-hidden="true">
                <b><Ico n="xp" t={12} />Nivel {nv.n}</b><i><u style={{ width: nvPct + '%' }} /></i></span> : null}
              {/* 🔥 la racha, salvo en el Inicio, donde ya está abajo con sus días (Dlx, 13/11/2026: «que desaparezca eso de la
                  racha si eso está abajo») */}
              {fuego && !enInicio ? <span className="yo-racha" aria-hidden="true"><Ico n="fuego" t={13} />{fuego}</span> : null}</button>
            {yoM ? <YoMenu k={yo ? yo.k : (dc && dc.clave) || ''} dc={dc} nombre={nombre} cara={cara} onCerrar={() => setYoM(false)} /> : null}
          </span>
        ) : (
          <button type="button" className="btn verde chico entrar" onClick={accion.entrar}>Entrar</button>
        )}
        <button className="btn-ico hamb" type="button" aria-label="Menú" onClick={onMenu}><Ico n="menu" t={22} /></button>
      </div>
      {/* 🔎 EL BUSCADOR, UNA BARRA DEBAJO DE LA CABECERA (Dlx, 13/11/2026: «que no aparezca un pop up sino que aparezca una
          barra abajo de eso y te deje buscar cualquier cosa»): la lupa (o Ctrl K) la abre con el teclado listo; se cierra con
          la ✕, con Escape o al elegir algo */}
      {busca ? <BarraBuscar liga={liga} onCerrar={() => setBusca(false)} /> : null}
    </header>
  );
}

// ── 🔔 la campana: el panel de notificaciones ───────────────────────────────────────────────────────
// Dlx, 02/10/2026: «que en esa campanita, aparte de activar tus notificaciones, sea como un panel de notificaciones
// recientes, quizás algo como Instagram», y a «¿también los eventos del día?», «A». Arriba lo de hoy en la Liga (para
// todos); después lo tuyo, «Nuevas» y «Antes» (la bandeja de app.js: `BANDEJA`, `pedirBandeja()`); abajo, la campana
// del teléfono. Para todos desde la 2.02 (Dlx, 03/10/2026: «3. a»); `#/avisos` sigue abriendo la campana de Eventos
function useBandeja() {
  const leer = () => Object.assign({ items: [], nuevas: 0, listo: false }, window.BANDEJA || {});
  const [b, setB] = useState(leer);
  useEffect(() => {
    const f = () => setB(leer());
    const pedir = () => { if (window.pedirBandeja && document.visibilityState === 'visible') window.pedirBandeja(false); };
    window.addEventListener('lg:bandeja', f);
    window.addEventListener('lg:cuenta', pedir);
    pedir();
    // lo nuevo, cada diez minutos con la pestaña a la vista, y en cuanto se vuelve a ella (`pedirBandeja()` no pide dos
    // veces en un minuto). ⚡ Eran tres (10/11/2026): un POST sin caché —el Worker y dos pedidos al objeto— cada tres
    // minutos por cada pestaña con cuenta, lo mire alguien o no. Abrir la campana pide igual en el momento
    const t = setInterval(pedir, 600000);
    document.addEventListener('visibilitychange', pedir);
    return () => {
      window.removeEventListener('lg:bandeja', f); window.removeEventListener('lg:cuenta', pedir); clearInterval(t);
      document.removeEventListener('visibilitychange', pedir);
    };
  }, []);
  return b;
}
const ICONO_AVISO = { seguidor: '⭐', aplauso: '👏', seguido: '★', personal: '🔔' };
// la dirección de un aviso (`https://underlegends.pages.dev/freestyle-rap/r/x`, `/cuenta/siguiendo`) como ruta `#/…`
const rutaDe = (u) => {
  const p = String(u || '').replace(/^https:\/\/underlegends\.pages\.dev/, '').replace(/^\/freestyle-rap(?=\/|$)/, '').replace(/^#/, '');
  return '#' + (p || '/');
};

function Campanita({ liga }) {
  const B = useBandeja();
  const [abierta, setAbierta] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierta) return undefined;
    // afuera del panel lo cierra (adentro del shadow root el evento llega con su camino entero)
    const fuera = (e) => { if (caja.current && !e.composedPath().includes(caja.current)) setAbierta(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierta(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierta]);
  const abrir = () => {
    const v = !abierta;
    setAbierta(v);
    // al abrirlo, lo nuevo queda visto (el panel todavía muestra cuáles eran)
    if (v && window.pedirBandeja) window.pedirBandeja(true);
  };
  return (
    <div className="nt" ref={caja}>
      <button type="button" className={'btn-ico nt-b' + (abierta ? ' on' : '')} aria-expanded={abierta}
        aria-label={'Notificaciones' + (B.nuevas ? ', ' + B.nuevas + (B.nuevas === 1 ? ' nueva' : ' nuevas') : '')} onClick={abrir}>
        <Ico n="campana" t={20} />{B.nuevas ? <span className="nt-n">{B.nuevas > 9 ? '9+' : B.nuevas}</span> : null}
      </button>
      {abierta ? <PanelAvisos liga={liga} B={B} onCerrar={() => setAbierta(false)} /> : null}
    </div>
  );
}

// 🔔 EL PANEL, REHECHO (Dlx, 13/11/2026, a la maqueta https://claude.ai/artifact/APL7sTvmkpADw1GyMqupHJ: «A pero que
// aparezca todo, y que si alguien te reta que aparezca ahí pues también»; y después, «que sea igual al de la maqueta así
// exactamente»: las piezas y las medidas son las de la opción A —`.nt-*` en vivo.css copia su CSS—). Arriba lo de hoy en
// la Liga como tira; después «Para hacer» —lo que pide algo de ti y se contesta ahí: quién ganó tu batalla libre, la
// batalla que espera ganador en tu panel—; y lo demás por día (Hoy, Ayer, Esta semana, Antes), con filtros por tipo.
// 🗂️ CUATRO FILTROS Y NO SEIS (Dlx, 13/11/2026: «creo que sólo debería haber 4 categorías… renombra alguna para meter a las
// que quedan fuera»): la gente por un lado, y tu ranking, el Pase, los eventos y las correcciones juntos en «Liga»
const CAT_AVISO = { seguidor: 'gente', aplauso: 'gente', comentario: 'gente', seguido: 'gente', organiza: 'gente' };
const FILTROS_AVISO = [['todo', 'Todo'], ['hacer', 'Para hacer'], ['gente', 'Gente'], ['liga', 'Liga']];
const catDe = (x) => CAT_AVISO[x.tipo] || 'liga';
const DIA_MS_AV = 86400000;
// «+150 Puntos de Tienda» del cuerpo pasa a una pastilla: el número se ve de un vistazo
const PDT_RE = /\s*\+\s?([\d.]+)\s+Puntos de Tienda\.?/;
// lo que pide una respuesta del dueño o su equipo: vence a las 48 h (`finales.py`), después lo cierra la Liga
const esFinal = (x) => /^se:fin:/.test(String(x.clave || ''));
const sinEmoji = (t) => String(t || '').replace(/^\p{Extended_Pictographic}️?\s*/u, '');
// el color de la esquina de la cara, por lo que dice el emoji (en la maqueta: rojo si bajaste, magenta lo de la gente)
const TINTE_AVISO = { '📉': '#E5484D', '📈': '#29B298', '⭐': '#E41373', '★': '#E41373', '👏': '#E41373', '💬': '#E41373', '⚔️': '#F2B705', '🏁': '#F2B705' };

function PanelAvisos({ liga, B, onCerrar }) {
  const e = useCampana();
  const C = window.Campana;
  const [fil, setFil] = useState('todo');
  const [ocup, setOcup] = useState(0);
  const [msg, setMsg] = useState('');
  // «Marcar leídas»: abrir ya las da por vistas (`pedirBandeja(true)`); esto apaga el resaltado de las que eran nuevas
  const [leidas, setLeidas] = useState(false);
  const dc = !B.sinCuenta && !!window.DC;
  const LBd = useLibres(dc);
  // lo de las batallas libres se vuelve a preguntar al abrir: pudo cambiar desde que se bajó
  useEffect(() => { if (dc) pedirLibres(); }, [dc]);
  const ahora = liga.ahora;
  const hoy = liga.diaClave(ahora);
  const ayer = liga.diaClave(new Date(ahora - DIA_MS_AV));
  // 📅 lo de hoy en la Liga, para todos: lo que se está jugando y lo que viene hoy
  const vivos = liga.vivo();
  const hoyEv = vivos.concat(liga.luego().filter((x) => liga.diaClave(x.cuando) === hoy && !vivos.includes(x))).slice(0, 4);
  const ir = (ruta) => { onCerrar(); location.hash = ruta; };

  // ⚔️ PARA HACER: tus batallas libres pendientes (libres.js, la misma lista que el Inicio) y lo que espera ganador
  const yoK = LBd && LBd.yo;
  const libres = ((LBd && LBd.libres) || []).filter((x) => x.estado === 'pend' && !(utc(x.t) <= ahora && x.mio));
  const pendientes = new Set(libres.map((x) => 'libre:' + x.id));
  const items = (B.items || []).filter((x) => !pendientes.has(x.clave));
  const finales = items.filter((x) => esFinal(x) && ahora - x.t < 2 * DIA_MS_AV);
  const resto = items.filter((x) => !esFinal(x));
  const nHacer = libres.length + finales.length;
  const cuenta = { todo: resto.length + nHacer, hacer: nHacer, liga: hoyEv.length };
  for (const x of resto) cuenta[catDe(x)] = (cuenta[catDe(x)] || 0) + 1;
  const ver = (c) => fil === 'todo' || fil === c;
  const decir = async (id, gane) => {
    setOcup(id); setMsg('');
    const j = await libreAccion('libre-resultado', { id, gane });
    setOcup(0);
    setMsg(j && j.ok ? (j.estado === 'hecha' ? 'Listo: los dos dijeron lo mismo.' : j.estado === 'sin_acuerdo' ? 'Cada uno dijo otro ganador: queda sin acuerdo.' : 'Listo: falta que tu rival lo diga.')
      : (j && ERR_LIBRE[j.error]) || 'No se pudo guardar: prueba de nuevo.');
  };
  const nombre = (k) => { const f = liga.T[k]; return f ? limpio(f.n) : k; };
  const nueva = (x) => !x.visto && !leidas;

  // la cara con su esquinita, o el ícono solo en el círculo cuando no hay cara
  const cara = (k, ico) => {
    const f = k ? liga.T[k] : null;
    if (!f) return <span className="nt-cara nt-ico" aria-hidden="true">{ico}</span>;
    return (
      <span className="nt-cara">
        <Cara liga={liga} k={f.k} nombre={f.n} cls="nt-c" />
        {ico ? <i className="nt-badge" style={TINTE_AVISO[ico] ? { background: TINTE_AVISO[ico] } : null} aria-hidden="true">{ico}</i> : null}
      </span>
    );
  };
  const fila = (x) => {
    const emoji = /^(\p{Extended_Pictographic}️?)\s*/u.exec(String(x.titulo || ''));
    const tit = emoji ? x.titulo.slice(emoji[0].length) : x.titulo;
    const ico = emoji ? emoji[1] : ICONO_AVISO[x.tipo] || '🔔';
    const pdt = PDT_RE.exec(String(x.cuerpo || ''));
    const cuerpo = pdt ? x.cuerpo.replace(PDT_RE, '').trim() : x.cuerpo;
    return (
      <li key={x.clave}>
        <button type="button" className={'nt-f' + (nueva(x) ? ' nueva' : '')} onClick={() => ir(rutaDe(x.url))}>
          {cara(x.cara, ico)}
          <span className="nt-t"><b>{tit}{pdt ? <span className="nt-pdt">+{pdt[1]} PdT</span> : null}</b>{cuerpo ? <small>{cuerpo}</small> : null}</span>
          <span className="nt-hora">{liga.cuando(new Date(x.t))}</span>
        </button>
      </li>
    );
  };
  // lo demás, por día
  const grupos = [['Hoy', []], ['Ayer', []], ['Esta semana', []], ['Antes', []]];
  for (const x of resto) {
    if (!ver(catDe(x))) continue;
    const d = liga.diaClave(new Date(x.t));
    grupos[d === hoy ? 0 : d === ayer ? 1 : ahora - x.t < 7 * DIA_MS_AV ? 2 : 3][1].push(x);
  }
  // la campana del teléfono, al pie: lo que falta para que también llegue ahí
  let pie = null;
  if (e && C) {
    if (e.activa && e.yo && e.yo.id) pie = <><span><b className="nt-ok-p">●</b> También te llega al teléfono</span><a href="#/avisos" onClick={onCerrar}>Ajustes</a></>;
    else if (!e.soporta || e.negado) pie = <><span>No te llega al teléfono</span><a href="#/avisos" onClick={onCerrar}>Cómo hacerlo</a></>;
    else if (!e.activa) pie = <><span>Que también te llegue al teléfono</span><button type="button" className="nt-btn v" onClick={() => C.activar()}>Activar avisos</button></>;
    else pie = <><span>Para que te lleguen también los tuyos</span><button type="button" className="nt-btn" onClick={() => C.vincular()}>Vincular Discord</button></>;
  }
  const filtros = FILTROS_AVISO.filter(([k]) => k === 'todo' || cuenta[k]);
  const hayNuevas = !leidas && (B.items || []).some((x) => !x.visto);
  return (
    <div className="nt-p" role="dialog" aria-label="Notificaciones">
      <div className="nt-arr">
        <div className="nt-h">
          <h2>Notificaciones</h2>
          {hayNuevas ? <button type="button" className="nt-lnk" onClick={() => setLeidas(true)}>Marcar leídas</button> : null}
          <a className="nt-ib" href="#/avisos" aria-label="Ajustes de avisos" onClick={onCerrar}>⚙</a>
          <button type="button" className="nt-ib" aria-label="Cerrar" onClick={onCerrar}><Ico n="cerrar" t={16} /></button>
        </div>
        {filtros.length > 2 ? (
          <div className="nt-chips" role="group" aria-label="Filtrar">{filtros.map(([k, t]) => (
            <button key={k} type="button" className={'nt-chip' + (fil === k ? ' on' : '')} aria-pressed={fil === k} onClick={() => setFil(k)}>
              {t}<em>{cuenta[k] || 0}</em></button>
          ))}</div>
        ) : null}
      </div>
      <div className="nt-cuerpo">
      {hoyEv.length && ver('liga') ? hoyEv.map((x, i) => {
        const v = vivos.includes(x);
        return (
          <button key={'ev' + i} type="button" className={'nt-vivo' + (v ? '' : ' luego')} onClick={() => ir('#/eventos')}>
            <span className="nt-pt" aria-hidden="true" />
            <b>{limpio(x.nombre)}<small>{siglaDe(x.sv)}{v ? ' · se está jugando' : ''}</small></b>
            <em>{v ? 'EN VIVO' : liga.dia(x.cuando).replace(/^hoy /, '').toUpperCase()}</em>
          </button>
        );
      }) : null}
      {nHacer && ver('hacer') ? (
        <>
          <p className="nt-s hacer">Para hacer <span>{nHacer}</span></p>
          <ul>
            {libres.map((x) => {
              const otro = x.a === yoK ? x.b : x.a;
              const ya = utc(x.t) <= ahora;
              return (
                <li key={'lb' + x.id} className="nt-f nueva">
                  {cara(otro, '⚔️')}
                  <span className="nt-t">
                    <b>{ya ? '¿Quién ganó tu batalla libre con ' + nombre(otro) + '?' : nombre(otro) + (x.a === yoK ? ': tu batalla libre' : ' te retó a una batalla libre')}</b>
                    <small>{ya ? (x.suyo ? nombre(otro) + ' ya lo dijo: falta que lo digas tú' : 'Si los dos dicen lo mismo, queda en su cara a cara')
                      : 'Es ' + liga.dia(x.t).replace(/^hoy /, 'hoy a las ') + '. Cuando la jueguen, dicen quién ganó'}</small>
                    {ya ? (
                      <span className="nt-vs">
                        <button type="button" className="nt-btn" disabled={!!ocup} onClick={() => decir(x.id, true)}>Yo</button>
                        <span>VS</span>
                        <button type="button" className="nt-btn" disabled={!!ocup} onClick={() => decir(x.id, false)}>{nombre(otro)}</button>
                      </span>
                    ) : <span className="nt-acc"><button type="button" className="nt-btn" onClick={() => ir('#/')}>Ver</button></span>}
                  </span>
                  <span className="nt-hora">{ya ? 'ya' : liga.cuando(x.t)}</span>
                </li>
              );
            })}
            {finales.map((x) => (
              <li key={x.clave} className={'nt-f' + (nueva(x) ? ' nueva' : '')}>
                {cara('', '🏁')}
                <span className="nt-t"><b>{sinEmoji(x.titulo)}</b><small>{String(x.cuerpo || '').replace(/\s*Márcalo en tu panel\.?$/, '')}</small>
                  <span className="nt-acc"><button type="button" className="nt-btn v" onClick={() => ir(rutaDe(x.url))}>Marcarlo en tu panel</button></span></span>
                <span className="nt-hora">{liga.cuando(new Date(x.t))}</span>
              </li>
            ))}
          </ul>
          {msg ? <p className="nt-msg" role="status">{msg}</p> : null}
        </>
      ) : null}
      {B.sinCuenta ? (
        <div className="nt-vacio">
          <p>Entra con Discord y acá te llega lo tuyo: quién te sigue, quién te felicita, quién te reta, tus rangos y tus cartas, y cuando gana alguien que sigues.</p>
          <button type="button" className="nt-btn v" onClick={() => { onCerrar(); accion.entrar(); }}>Entrar con Discord</button>
        </div>
      ) : !B.listo ? <p className="nt-vacio">Cargando…</p> : resto.length || nHacer ? (
        grupos.filter(([, xs]) => xs.length).map(([t, xs]) => <div key={t}><p className="nt-s">{t}</p><ul>{xs.map(fila)}</ul></div>)
      ) : <p className="nt-vacio">Todavía no te llegó nada. Cuando alguien te siga, te felicite, te rete o subas de rango, aparece acá.</p>}
      </div>
      {pie ? <div className="nt-pie">{pie}</div> : null}
    </div>
  );
}

// ── las historias: lo que se abre al tocar cada círculo de arriba ─────────────────────────────────────
// un título de video de 70 letras ocupaba seis renglones del escenario: pasado de 42, un cuerpo menos
const largo = (t) => 'hero-ev largo' + (String(t || '').length > 42 ? ' muy-largo' : '');
// «RAP EXHIBITION 2 8» (el «/» se pierde en el dato) partía el 8 solo en el tercer renglón: los números van juntos
const juntos = (t) => String(t || '').replace(/(\d) (\d)/g, '$1' + String.fromCharCode(160) + '$2');
// 🔴 EL TÍTULO DEL ESCENARIO NO PARTE PALABRAS (Dlx, 02/10/2026, con una captura: «GENERACION / ES UN DESTINO»).
// `.mo-txt h1` tiene `overflow-wrap:anywhere`, así que una palabra más ancha que la columna se partía donde caía. Ahora
// el tamaño lo manda la palabra más larga: `--pal` son sus letras, y `.ev-pal` (vivo.css) achica la letra hasta que
// entra. Partir queda sólo para una palabra imposible, por debajo de los 20 px
const texto = (x) => (typeof x === 'string' || typeof x === 'number' ? String(x)
  : Array.isArray(x) ? x.map(texto).join('') : (x && x.props ? texto(x.props.children) : ''));
function Tit({ c, children }) {
  const pal = Math.max(1, ...texto(children).split(/\s+/).map((w) => [...w].length));
  return <h1 className={c}><span className="ev-pal" style={{ '--pal': pal }}>{children}</span></h1>;
}
// `id`: lo que se marca como visto, historia por historia (ver `Visor`); `t`: la hora de lo que cuenta, para el orden
function Slide(tag, cuerpo, cuando, cta, ir, id, t) { return { tag, cuerpo, cuando, cta, ir, id, t: t || '' }; }
// los logros que se felicitan (los de `LOGROS` de publicaciones.jsx que tienen historia)
const FELICITABLE = { campeon: 1, rango: 1, caza: 1 };

function slidesDe(liga, items) {
  const grupos = [];
  items.forEach((it) => {
    const g = grupos[grupos.length - 1];
    if (g && it.tipo === 'tarjeta' && g[0].tipo === 'tarjeta' && g[0].t === it.t) g.push(it);
    else grupos.push([it]);
  });
  const out = [];
  grupos.forEach((g) => {
    const it = g[0];
    // cada historia lleva la hora de lo que cuenta: el visor abre en la primera que no viste (ver `Visor`)
    const n0 = out.length;
    const q = (it.quien || []).map(limpio);
    const ks = ksDe(it);
    const c = liga.cuando(it.t);
    if (it.tipo === 'tarjeta' && g.length > 1) {
      const quienes = [];
      g.forEach((o) => { const x = limpio((o.quien || [])[0]); if (x && !quienes.includes(x)) quienes.push(x); });
      const txt = quienes.length > 1 ? quienes.slice(0, -1).join(', ') + ' y ' + quienes[quienes.length - 1] : quienes[0];
      out.push(Slide('CARTAS NUEVAS', <><div className="st-minis">{g.slice(0, 4).map((o, i) => <Carta key={i} liga={liga} k={(o.ks || [])[0]} cual={o.carta} cls="st-mini-c" abre={false} />)}</div>
        <h3 className="st-h">{txt} ya tienen sus cartas</h3></>, c, 'Ver sus perfiles', { perfil: ks[0] }));
    } else if (it.tipo === 'tarjeta') {
      const nombre = { pais: 'de País', temporada: 'de Temporada', servidor: 'de Servidor', competitivo: 'Competitiva' }[it.carta];
      out.push(Slide('CARTA NUEVA', <><Carta liga={liga} k={ks[0]} cual={it.carta} cls="st-carta" abre={false} /><h3 className="st-h">{q[0]} ya tiene su carta {nombre}</h3></>,
        c, 'Ver su carta', { carta: ks[0], cual: it.carta }));
    } else if (it.tipo === 'rango') {
      const f = ks.length ? liga.T[ks[0]] : null;
      const vis = f && (f.c || []).includes('competitivo') ? <Carta liga={liga} k={ks[0]} cual="competitivo" cls="st-carta" abre={false} />
        : <span className="st-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</span>;
      out.push(Slide('RANGO', <>{vis}<h3 className="st-h">{it.primero ? q[0] + ' consigue su primera letra: ' + it.rg : q[0] + ' pasa a rango ' + it.rg}</h3></>,
        c, 'Ver su perfil', { perfil: ks[0] }));
    } else if (it.tipo === 'campeon') {
      const ll = (liga.d.llaves || {})[String(it.ll)] || {};
      const k = ks[0] || '';
      const f = liga.T[k];
      // 🏆 EL RESUMEN DEL EVENTO: EL PODIO CON LAS TRES CARTAS (Dlx, 18/10/2026, a las ideas de historias: «todas»). El 1º
      // al medio y más alto; sin carta, la cara. Sin llave cargada queda la carta del campeón sola, como antes
      // 🔴 POR PUESTO, NO POR RENGLÓN (pasada del 19/10/2026): la tabla tiene un renglón por persona, y en un evento de
      // equipos los tres campeones salían 1º, 2º y 3º y el subcampeón no salía. Uno por puesto, con todos sus nombres
      const lugares = [['Campeón', 1], ['Subcampeón', 2], ['Tercero', 3]].map(([p, m]) => {
        const rs = (ll.tabla || []).filter((r) => r[1] === p);
        return rs.length ? { z: rs[0], m, n: rs.map((r) => limpio(r[0])).join(' · ') } : null;
      });
      const top = lugares.filter(Boolean);
      const kDe = (z) => z[3] || (liga.fila(z[0]) || {}).k || '';
      const pieza = (x) => {
        if (!x) return null;
        const kz = kDe(x.z);
        const cz = kz ? liga.cartaDe(kz, { sv: it.sv }) : null;
        return (
          <li key={x.m} className={'p' + x.m}>
            {cz ? <Carta liga={liga} k={kz} cual={cz} cls="st-p3-c" abre={false} />
              : <Cara liga={liga} k={kz} nombre={x.z[0]} cls="st-p3-cara" />}
            <b>{x.m}º</b><span>{x.n}</span>
          </li>
        );
      };
      const vis = top.length >= 2 ? <ol className="st-podio3" aria-label="El podio">{[pieza(lugares[1]), pieza(lugares[0]), pieza(lugares[2])]}</ol>
        : f && (f.c || []).includes('temporada') ? <Carta liga={liga} k={k} cual="temporada" cls="st-carta" abre={false} /> : <Cara liga={liga} k={k} nombre={q[0]} cls="st-cara" grande />;
      out.push(Slide('CAMPEÓN · ' + siglaDe(it.sv), <><h3 className="st-h">{limpio(it.ev)}</h3>{vis}
        <small className="st-s">{top.length >= 2 ? 'Campeón: ' + q.join(' y ') + ' · ' : ''}{it.part || 0} raperos</small></>, c, 'Ver la llave', { llave: it.ll }));
    } else if (it.tipo === 'caza') {
      const a = liga.fila(it.a);
      out.push(Slide('SE BUSCA · CAZADO', <><div className="st-caza"><Cara liga={liga} k={a ? a.k : ''} nombre={it.a} cls="st-cara" grande /><span className="sello">CAZADO</span></div>
        <h3 className="st-h">{q[0]} cazó a {it.a}</h3><small className="st-s">{it.cat} · cobra {num(it.pts)}</small></>, c, 'Ver Se busca', { ancla: 'sebusca' }));
    } else if (it.tipo === 'anuncio') {
      const e = liga.proximos().find((x) => limpio(x.nombre) === limpio(it.ev));
      let cu = '';
      if (e) {
        cu = liga.vivo().includes(e) ? 'en vivo desde las ' + liga.dia(e.cuando).replace(/^hoy /, '') : liga.dia(e.cuando);
        if (e.modalidad) cu += ' · ' + e.modalidad;
      }
      out.push(Slide('ANUNCIÓ · ' + siglaDe(it.sv), <><img className="st-logo" alt="" src={liga.logo(it.sv)} /><h3 className="st-h">{limpio(it.ev)}</h3>
        {liga.esDorado(it.ev, it.sv) ? <span className="st-dor">EVENTO DORADO ×3</span> : null}<small className="st-s">{cu || c}</small></>,
        c, 'Quiero aviso', { ruta: '#/avisos' }));
    } else if (it.tipo === 'flyer') {
      // 🖼️ el flyer de una liga de ese servidor (Dlx, 14/10/2026: «Flyers en Publicaciones e Historias»): el afiche
      // entero, y a su liga
      out.push(Slide('LIGA · ' + siglaDe(it.sv), <><img className="st-flyer" alt="" src={it.img} /><h3 className="st-h">{limpio(it.ln)}</h3>
        {it.tit ? <small className="st-s">{limpio(it.tit)}</small> : null}</>,
      c, 'Ver la liga', { ruta: '#/ligas/' + encodeURIComponent(it.liga || '') }));
    }
    // la identidad de la historia es la de su publicación (`id` del muro, ver bot/muro.py); las cartas juntas, la de todas
    // 🔴 CORTO (pasada del 19/10/2026): las cartas nuevas juntas armaban un id con TODOS los suyos —69 cartas del 29/09, ~900
    // letras—, que no entraba en lo visto de la cuenta y llenaba lo del navegador. La primera y cuántas son
    const id0 = (o) => o.id || o.tipo + (o.t || '') + (o.quien || []).join(',');
    const id = 'm:' + (g.length > 1 ? id0(g[0]) + '+' + g.length : id0(g[0]));
    for (let i = n0; i < out.length; i++) {
      out[i].t = String(it.t || '');
      out[i].id = id;
      // 👏 los logros se felicitan desde la historia (Dlx, 18/10/2026: «reaccionar desde la historia y que le llegue a la
      // persona, como Felicitar»): los mismos que en Publicaciones (`LOGROS`), por el id de su publicación del muro
      if (g.length === 1 && it.id && FELICITABLE[it.tipo]) out[i].fel = { id: it.id, ks };
    }
  });
  return out;
}

// 🔁 DE LA MÁS VIEJA A LA MÁS NUEVA, COMO INSTAGRAM (Dlx, 04/10/2026: «el orden… está invertido, fijate cómo lo hace
// Instagram»). El 02/10 había pedido «lo más reciente PRIMERO» porque el visor le volvía a pasar lo ya visto: eso lo
// resuelve abrir en la primera que no viste (ver `Visor`), no dar vuelta el orden. Lo que no tiene hora, al final
const masViejo = (a, b) => (!a.t - !b.t) || String(a.t || '').localeCompare(String(b.t || ''));

/** La fila de círculos como Instagram: lo en vivo primero, después lo que tiene algo sin ver y al final lo ya visto
 * (gris), cada parte en su orden de siempre. `vistos` es una foto de cuando el visor estaba cerrado (ver App.jsx): así
 * los círculos no se corren mientras mirás. */
// 🎞️ LA TIRA, OPCIÓN A (Dlx, 13/11/2026, de la maqueta https://claude.ai/artifact/YH2C21cWzGMPVaFL1sxUev: «La A»). Dos
// estados y no tres: aro magenta = tienes algo sin ver; aro gris fino y logo apagado = nada (ya lo viste, o el servidor,
// tu país, tu crew o alguien que sigues no tiene nada nuevo). Antes el aro verde estaba en casi todos y se leía como
// adorno, y SNK, CYH y FVS sin novedades quedaban en un tercer estado, ni verdes ni grises, en el medio de la tira
export const apagadoH = (g, vistos) => g.slides.every((s) => vistos[s.id])
  || (['sv', 'pais', 'crew', 'gente'].includes(g.tipo) && !g.nuevo && !g.espera);
// y lo tuyo adelante: tu país y tu crew justo después de La Liga, Promos y Tu semana. Iban después de los trece
// servidores, o sea detrás de la flecha a 1333 px, y son lo único de la tira que es tuyo
const TRAMO_H = { vivo: 0, liga: 1, yo: 1, promos: 1, pais: 2, crew: 2, sv: 3, gente: 4 };
export const tramoH = (g) => (g.tipo in TRAMO_H ? TRAMO_H[g.tipo] : 3);
// los nombres que no entran en el círculo: «Estados Un…» se cortaba (el de la crew sale de su sigla, si tiene)
const PAIS_CORTO = { us: 'EE. UU.', do: 'R. Dominicana', gb: 'R. Unido', ae: 'EAU' };
// logos con mucho borde vacío alrededor: el de la Academia es un escudo chico sobre negro y se veía la mitad que los demás
const ZOOM_LOGO = { ACAD: 1.2 };
export function ordenHistorias(grupos, vistos) {
  const vivo = grupos.filter((g) => g.tipo === 'vivo');
  const resto = grupos.filter((g) => g.tipo !== 'vivo');
  const conAlgo = resto.filter((g) => !apagadoH(g, vistos)).sort((a, b) => tramoH(a) - tramoH(b));
  return vivo.concat(conAlgo, resto.filter((g) => apagadoH(g, vistos)));
}

// las caras de una lista de filas de la tabla, con lo que dice debajo de cada una
const Gente = ({ liga, fs, txt }) => (
  <ul className="st-gente">{fs.map((f) => <li key={f.k}><Cara liga={liga} k={f.k} nombre={f.n} cls="st-mini" /><span>{txt(f)}</span></li>)}</ul>
);

/** Las historias de «Tu semana»: lo que jugaste desde el lunes y tu próximo evento. Ver `gruposHistorias`. */
function historiasTuyas(liga, mm) {
  const yo = liga.yo;
  if (!yo) return [];
  const desde = utc(mm.ini || '');
  const mios = liga.semanaDe(yo.k).filter(([ll]) => !isNaN(desde) && utc(liga.fechaLlave(ll)) >= desde);
  mios.sort((a, b) => utc(liga.fechaLlave(a[0])) - utc(liga.fechaLlave(b[0])));
  const pts = mios.reduce((t, x) => t + (Number(x[2]) || 0), 0);
  const mv = yo.mv || 0;
  const mueve = mv > 0 ? '▲ subiste ' + mv + (mv === 1 ? ' puesto' : ' puestos') : mv < 0 ? '▼ bajaste ' + (-mv) + (mv === -1 ? ' puesto' : ' puestos') : '';
  const out = [];
  const ultimo = mios.length ? liga.fechaLlave(mios[mios.length - 1][0]) : String(mm.ini || '');
  out.push(Slide('TU SEMANA', <><Cara liga={liga} k={yo.k} nombre={yo.n} cls="st-cara" grande />
    <h3 className="st-h">{mios.length ? 'Jugaste ' + mios.length + (mios.length === 1 ? ' evento' : ' eventos') : 'Esta semana todavía no jugaste'}</h3>
    {mios.length ? <ul className="st-l">{mios.slice(-5).map(([ll, p, n], i) => <li key={i}><b>{limpio(String(p || ''))}</b>{limpio(ll.nombre)} · {num(Number(n) || 0)} pts</li>)}</ul> : null}
    <small className="st-s">{[yo.pos ? '#' + yo.pos + ' en el Ranking' : '', mueve ? mueve + ' desde el lunes' : '', mios.length ? num(pts) + ' pts esta semana' : 'Juega uno y sumas para tu Temporada'].filter(Boolean).join(' · ')}</small></>,
  'esta semana', 'Ver tu perfil', { perfil: yo.k }, 'yo:sem:' + (mm.ini || '') + ':' + mios.length, ultimo));
  // tu próximo evento: el primero de un servidor donde jugaste; si no, el primero que viene
  const svs = new Set(liga.semanaDe(yo.k).map(([ll]) => ll.sv));
  const prox = liga.luego();
  const e = prox.find((x) => svs.has(x.sv)) || prox[0];
  if (e) {
    const m = liga.multSv(e.sv);
    out.push(Slide('TU PRÓXIMO EVENTO', <><img className="st-logo" alt="" src={liga.logo(e.sv)} /><h3 className="st-h">{limpio(e.nombre)}</h3>
      <small className="st-s">{liga.dia(liga.cuandoDe(e))} · {siglaDe(e.sv)}{m ? ' · ' + mult(m) + ' esta semana' : ''}</small></>,
    'lo que viene', 'Quiero aviso', { ruta: '#/avisos' }, 'yo:prox:' + e.sv + ':' + limpio(e.nombre) + ':' + liga.cuandoDe(e), ultimo));
  }
  return out;
}

/** Las historias del círculo «La Liga», en este orden. Ver `gruposHistorias`. */
function historiasLiga(liga, mm) {
  const out = [];
  const T = liga.d.tabla || [];
  const hoy = liga.diaClave(liga.ahora);
  const semana = String(mm.ini || '');
  // 📅 lo que se juega hoy y todavía no empezó
  const hoyEv = liga.luego().filter((e) => liga.diaClave(e.cuando) === hoy);
  // 🏟️ y la fecha de hoy de cada liga de los servidores (Dlx, 14/10/2026: «Ligas en el Inicio», como un evento más)
  const hoyLg = liga.fechasHoy();
  if (hoyEv.length || hoyLg.length) {
    const n = hoyEv.length + hoyLg.length;
    const cuantos = n === 1 ? (hoyEv.length ? 'Un evento hoy' : 'Una liga hoy')
      : n + (!hoyLg.length ? ' eventos hoy' : !hoyEv.length ? ' ligas hoy' : ' fechas hoy');
    out.push(Slide('HOY SE JUEGA', <><h3 className="st-h">{cuantos}</h3>
      <ul className="st-l">{hoyEv.slice(0, 5).map((e, i) => <li key={i}><b>{liga.dia(e.cuando).replace(/^hoy /, '')} · {siglaDe(e.sv)}</b>{limpio(e.nombre)}</li>)}
        {hoyLg.slice(0, Math.max(0, 6 - Math.min(hoyEv.length, 5))).map((x) => <li key={x.L.id}><b>{x.t ? liga.dia(x.t).replace(/^hoy /, '') + ' · ' : ''}{siglaDe(x.L.sv)} · LIGA</b>
          {x.L.n}{x.j ? ', jornada ' + x.j : ''}</li>)}</ul></>,
    'hoy', hoyEv.length ? 'Ver Eventos' : 'Ver las ligas', { ruta: hoyEv.length ? '#/eventos' : '#/ligas' },
    'hoy:' + hoy + ':' + hoyEv.length + ':' + hoyLg.length));
  }
  // 🎯 los buscados del Most Wanted que siguen sueltos
  const mw = liga.d.mw || {};
  const sueltos = (mw.b || []).filter((b) => b.e === 'suelto');
  if (sueltos.length) {
    out.push(Slide('SE BUSCA · MOST WANTED', <><h3 className="st-h">{sueltos.length === 1 ? 'Un buscado suelto' : sueltos.length + ' buscados sueltos'}</h3>
      <ul className="st-gente">{sueltos.slice(0, 6).map((b) => <li key={b.k || b.n}><Cara liga={liga} k={b.k || ''} nombre={b.n} cls="st-mini" /><span>{limpio(b.n)} · {num(b.v)}</span></li>)}</ul>
      <small className="st-s">Ganale a uno en un evento y cobras su precio.</small></>,
    'hasta ' + liga.dia(mw.fin), 'Ver Se busca', { ancla: 'sebusca' }, 'mw:' + mw.id + ':' + sueltos.length));
  }
  // ▲ los que más subieron en el Ranking desde el lunes
  const suben = T.filter((f) => (f.mv || 0) > 0).sort((a, b) => b.mv - a.mv).slice(0, 3);
  if (suben.length) {
    out.push(Slide('ESTA SEMANA · SUBIERON', <><h3 className="st-h">{limpio(suben[0].n)} subió {suben[0].mv} {suben[0].mv === 1 ? 'puesto' : 'puestos'}</h3>
      <Gente liga={liga} fs={suben} txt={(f) => '▲' + f.mv + ' · #' + f.pos} /><small className="st-s">desde el lunes, en el Ranking de la Temporada</small></>,
    // 🔑 POR SEMANA, NO POR DÍA (18/10/2026, Dlx: «al reiniciar el día… me sale como si todo fuese nuevo»): es lo de
    // «desde el lunes», y con el día en el id volvía a salir sin ver cada mañana aunque dijera lo mismo
    'esta semana', 'Ver el Ranking', { ruta: '#/ranking' }, 'subio:' + semana + ':' + suben[0].k));
  }
  // 🆕 los que jugaron su primer evento esta semana
  const nuevos = T.filter((f) => f.nu);
  if (nuevos.length) {
    out.push(Slide('ESTA SEMANA · DEBUTARON', <><h3 className="st-h">{nuevos.length === 1 ? 'Un debut' : nuevos.length + ' debutaron'}</h3>
      <Gente liga={liga} fs={nuevos.slice(0, 8)} txt={(f) => limpio(f.n)} />
      <small className="st-s">jugaron su primer evento en la Liga{nuevos.length > 8 ? ' · y ' + (nuevos.length - 8) + ' más' : ''}</small></>,
    'esta semana', 'Ver el Ranking', { ruta: '#/ranking' }, 'debut:' + semana + ':' + nuevos.length));
  }
  // 🔥 la racha más larga de las que siguen vivas
  const r = (liga.d.rachas || []).filter((x) => x.r >= 2)[0];
  if (r) {
    out.push(Slide('EN RACHA', <><Cara liga={liga} k={r.k} nombre={r.n} cls="st-cara" grande /><h3 className="st-h">{limpio(r.n)} lleva {r.r} seguidos</h3>
      <small className="st-s">eventos seguidos llegando arriba de la llave</small></>,
    'ahora', 'Ver las rachas', { ruta: '#/ranking/rachas' }, 'racha:' + r.k + ':' + r.r));
  }
  // ⚔️ el cruce que más se repitió en la temporada
  let cl = null;
  Object.entries(liga.d.rivales || {}).forEach(([par, c]) => {
    const [a, b] = par.split('|');
    const n = (c[a] || 0) + (c[b] || 0);
    if (n >= 2 && (!cl || n > cl.n || (n === cl.n && Math.abs(c[a] - c[b]) < Math.abs(cl.ga - cl.gb)))) cl = { a, b, ga: c[a] || 0, gb: c[b] || 0, n };
  });
  const fa = cl ? liga.T[cl.a] : null;
  const fb = cl ? liga.T[cl.b] : null;
  if (fa && fb) {
    out.push(Slide('EL CLÁSICO', <><ul className="st-gente st-vs"><li><Cara liga={liga} k={fa.k} nombre={fa.n} cls="st-cara" grande /><span>{limpio(fa.n)}</span></li>
      <li className="st-vs-n">{cl.ga}–{cl.gb}</li><li><Cara liga={liga} k={fb.k} nombre={fb.n} cls="st-cara" grande /><span>{limpio(fb.n)}</span></li></ul>
      <small className="st-s">se cruzaron {cl.n} veces en la temporada</small></>,
    'esta temporada', 'Ver a ' + limpio(fa.n), { perfil: fa.k }, 'clasico:' + cl.a + '|' + cl.b + ':' + cl.n));
  }
  // 🥇 los premios de la semana que cerró (del muro)
  const pr = (liga.muro || []).find((it) => it.tipo === 'premios' && liga.ahora - utc(it.t) < 7 * 86400000);
  if (pr) {
    const fila = (rol, et) => (pr[rol] ? <li key={rol}><b>{et}</b>{rol === 'servidor' ? siglaDe(String(pr[rol][0])) : limpio(String(pr[rol][0]))}{rol !== 'servidor' && pr[rol][1] ? ' · ' + num(pr[rol][1]) : ''}</li> : null);
    out.push(Slide('PREMIOS DE LA SEMANA', <><h3 className="st-h">Los premios de la semana</h3>
      <ul className="st-l">{fila('figura', 'FIGURA')}{fila('revelacion', 'REVELACIÓN')}{fila('cazador', 'CAZADOR')}{fila('servidor', 'SERVIDOR')}</ul></>,
    liga.cuando(pr.t), 'Ver Publicaciones', { ruta: '#/publicaciones' }, 'm:' + (pr.id || 'premios' + pr.t)));
  }
  return out;
}

function claveCrew(n) {
  return limpio(n).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// 🛡️ sin logo, el escudo de su nombre; con el escudo armado, ése (escudo.jsx). Nunca las iniciales (29/10/2026)
export function CrewCirculo({ c, cls = 'h-c' }) {
  const e = escudoDe(c.logo, limpio(c.crew || c.nombre || ''));
  if (e) return <span className={cls + ' con-esc'}><Escudo e={e} /></span>;
  return <span className={cls}><img alt="" src={srcLogo(c.logo)} /></span>;
}

const firma = (items, resto = '') => items.reduce((m, it) => (String(it.t) > m ? String(it.t) : m), '') || resto;

export function gruposHistorias(liga) {
  // 🖼️ y los flyers de las ligas (14/10/2026): van al círculo de su servidor (`svDe()`: el flyer trae su `sv`)
  const muro = liga.muroLimpio().filter((it) => ['campeon', 'anuncio', 'caza', 'tarjeta', 'rango', 'flyer'].includes(it.tipo));
  const grupos = [];
  // ⏳ mientras el muro no llega, «no tiene nada nuevo» no se sabe todavía: nadie se apaga por eso (`apagadoH`)
  const espera = !liga.muroListo;
  liga.vivo().forEach((e) => {
    const m = liga.multSv(e.sv);
    const dd = aDiscord(liga, e, true);
    // 🎮 un toque a la llave, cuando ya está (13/10/2026, el research de los lobbies: «en vivo primero, y un toque te
    // lleva a la llave», como el aro de Instagram o de Twitch); si todavía no, a Discord como antes
    const L = llaveEnVivo(e, typeof window !== 'undefined' ? window.VIVO_L : null);
    // 🔴 EN VIVO DE VERDAD (Dlx, 18/10/2026, a las ideas de historias: «todas»): con la llave ya cargada, la ronda que
    // se juega, quién acaba de pasar y quién sigue (`momentosLlave()`, lo mismo que la llave corta)
    let mo = null;
    try { mo = L ? momentosLlave(L) : null; } catch (err) { mo = null; }
    const sinB = (x) => String(x || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    const enVivo = mo && mo.ahora ? (
      <div className="st-vivo">
        <p className="ahora"><b>AHORA · {String(mo.ahora.r).toUpperCase()}</b>{mo.ahora.lados.map(sinB).join(' vs ')}</p>
        {mo.antes && mo.antes.pasan.length ? <p><b>PASÓ</b>{mo.antes.pasan.map(sinB).join(' y ')}</p> : null}
        {mo.sigue ? <p><b>SIGUE</b>{mo.sigue.lados.map(sinB).join(' vs ')}</p> : null}
        <small>{mo.jugados} de {mo.total} batallas</small>
      </div>
    ) : null;
    grupos.push({
      id: 'vivo-' + e.sv + '-' + limpio(e.nombre).toLowerCase(), tipo: 'vivo', nombre: 'En vivo · ' + siglaDe(e.sv), logo: liga.logo(e.sv), nom: limpio(e.nombre), firma: 'vivo:' + e.nombre + e.cuando,
      slides: [Slide('EN VIVO AHORA · ' + siglaDe(e.sv), <><img className={'st-logo' + (enVivo ? '' : ' grande')} alt="" src={liga.logo(e.sv, true)} /><h3 className={'st-h' + (enVivo ? '' : ' grande')}>{limpio(e.nombre)}</h3>
        {enVivo || <small className="st-s">Empezó a las {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' esta semana' : ''}.{L ? (L.enJuego ? ' ' + L.enJuego + ' en juego.' : '') : ' La llave aparece acá apenas la carguen.'}</small>}</>,
      'ahora', L ? 'Ver la llave' : dd ? dd.txt : 'Mirar en Discord', L ? { llave: 'v:' + L.id } : { link: dd ? dd.url : e.link },
      'vivo:' + e.sv + ':' + limpio(e.nombre) + ':' + e.cuando)],
    });
  });
  const mm = liga.d.mult || {};
  // 🙋 «TU SEMANA» (Dlx, 18/10/2026, a las ideas de historias: «todas»): un círculo tuyo, primero después de lo en vivo,
  // con lo que jugaste desde el lunes, cómo te movió el Ranking y tu próximo evento. Sólo con tu cuenta y si estás en la
  // tabla; cambia cuando jugás (su id lleva cuántos eventos van)
  const yoS = historiasTuyas(liga, mm);
  if (yoS.length) {
    grupos.push({ id: 'yo', tipo: 'yo', nombre: 'Tu semana', k: liga.yo.k, cc: liga.yo.cc, nom: 'Tu semana', nuevo: true, firma: 'yo', slides: yoS });
  }
  // 🔑 «LA LIGA»: lo de toda la Liga en un círculo propio, el primero después de lo en vivo. Dlx, 02/10/2026, a «más
  // variedad en las historias»: «sí» (y a los rumores del chat general, «C»: nada). Todo sale de lo que el payload ya
  // trae; cada historia se ve una vez (por día, por semana o hasta que cambie lo que cuenta) y sin dato no hay historia
  const ligaS = historiasLiga(liga, mm);
  if (ligaS.length) {
    grupos.push({ id: 'liga', tipo: 'liga', nombre: 'La Liga', nom: 'La Liga', nuevo: true, firma: 'liga', slides: ligaS });
  }
  // 📣 «PROMOS»: lo que los raperos compartieron en el canal de promoción de su servidor (Dlx, 16/10/2026: «podríamos
  // hacer una historia, o sea un círculo para promociones») y los videos de nuestros participantes que promociona la
  // Liga (`o: 'liga'`: «nosotros promocionar los videos de nuestros participantes»). Cada una está hasta su `hasta` —una
  // semana, o más si se alargó en la Tienda—, y el círculo está SIEMPRE (*«que siempre esté ahí»*: si en la semana no
  // hubo, el ciclo deja las más nuevas, `bot/promos.py`). Hasta doce; el video se mira acá
  const PL = { yt: 'YouTube', sp: 'Spotify', sc: 'SoundCloud', ig: 'Instagram', tt: 'TikTok', dc: 'Discord', web: 'la página' };
  const proms = (liga.muro || []).filter((it) => it.tipo === 'promo' && (it.hasta ? utc(it.hasta) > liga.ahora : liga.ahora - utc(it.t) < 7 * 86400000)).slice(0, 12);
  if (proms.length) {
    const slides = proms.map((it) => {
      const qs = (it.quien || []).map(limpio).filter(Boolean);
      const q = qs[0] || '';
      // 🔎 la miniatura grande (1280×720, `Miniatura`): la historia va a pantalla completa y la de 480×360 se veía borrosa
      const vis = it.vid ? <Miniatura vid={it.vid} cls="st-promo" />
        : it.img ? <img className="st-promo" alt="" src={it.img} /> : <Cara liga={liga} k={ksDe(it)[0] || ''} nombre={q} cls="st-cara" grande />;
      // ✋ las que agrega Dlx a mano (`o: 'mano'`) se presentan como las de la Liga
      const deLiga = it.o === 'liga' || it.o === 'mano';
      // 📏 los títulos de YouTube vienen largos y sin espacios («MAKMA VS TRUST/SEMIFINAL/LIGA…»): se cortan en las barras
      // (un espacio invisible después de cada una) y, pasados los 48 caracteres, van más chicos
      const tit = it.tit ? limpio(it.tit).replace(/([/|·_])/g, '$1\u200b') : q + ' en ' + (PL[it.plat] || 'su link');
      return Slide(deLiga ? 'LA LIGA PROMOCIONA' : 'PROMO · ' + siglaDe(it.sv), <>{vis}<h3 className={'st-h' + (tit.length > 48 ? ' largo' : '')}>{tit}</h3>
        <small className="st-s">{deLiga ? <>{qs.join(' y ')}{it.de ? ' · ' + limpio(it.de) : ''}</> : <>Lo comparte {q} · {PL[it.plat] || ''}</>}</small></>,
      liga.cuando(it.t), it.vid ? 'Mirar el video' : (it.plat === 'sp' || it.plat === 'sc' ? 'Escuchar en ' : 'Ver en ') + (PL[it.plat] || 'su link'),
      it.vid ? { video: { vid: it.vid, tit: limpio(it.tit || ''), link: it.url }, promo: it.id } : { link: it.url, promo: it.id },
      'promo:' + (it.pid || it.url), String(it.t || ''));
    });
    slides.sort(masViejo);
    // el círculo es un orbe que gira (`Orbe`), no la tapa de la más nueva: Dlx, «que el icono sea como ese círculo de
    // Siri, algo como una galaxia o un vórtice»
    grupos.push({ id: 'promos', tipo: 'promos', nombre: 'Promos', nom: 'Promos', nuevo: true, firma: firma(proms), slides });
  }
  // 🎮 tu servidor primero (13/10/2026, el research de los lobbies: «las historias por cercanía»), y después por tamaño
  const miSv = liga.yo ? liga.yo.sv : '';
  Object.values(liga.svs).sort((a, b) => (Number(b.sv === miSv) - Number(a.sv === miSv)) || b.n - a.n).forEach((s) => {
    const sv = s.sv;
    const slides = [];
    const m = (mm.sv || {})[sv];
    const lineas = [];
    const g = liga.doradoVigente();
    if (g && g.sv === sv) lineas.push(<li key="d"><b>DORADO ×3</b>{limpio(g.n)}, {utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t)}</li>);
    const par = ((mm.guerra || {}).pares || []).find((p) => p.includes(sv));
    if (par) lineas.push(<li key="g"><b>GUERRA</b>contra {siglaDe(par[0] === sv ? par[1] : par[0])}: gana el que más puntos hace por persona</li>);
    const meta = (mm.metas || {})[sv];
    if (meta) {
      const va = (mm.meta_va || {})[sv] || 0;
      lineas.push(<li key="m"><b>META</b>{va} de {meta} personas{va >= meta ? ' · cumplida' : ''}</li>);
    }
    if (m || lineas.length) {
      // la de la semana es una historia más: se ve una vez por semana, con la hora del lunes en que empezó
      slides.push(Slide('ESTA SEMANA · ' + siglaDe(sv), <><img className="st-logo" alt="" src={liga.logo(sv)} />
        {m ? <b className={'st-mult ' + (m > 1 ? 'sube' : 'baja')}>{mult(m)}</b> : null}<ul className="st-l">{lineas}</ul></>, 'lunes', 'Lunes de la Liga', { ancla: 'semana' },
      'sem:' + sv + ':' + (mm.ini || ''), String(mm.ini || '')));
    }
    const propios = muro.filter((it) => liga.svDe(it) === sv);
    // las seis más nuevas; en el círculo, de la más vieja a la más nueva (`masViejo`), y el visor abre en la primera que
    // no viste (Dlx, 02/10/2026: «no skipea las que ya vi»; 04/10/2026: «fijate cómo lo hace Instagram»)
    slidesDe(liga, propios).slice(0, 6).forEach((x) => slides.push(x));
    if (!propios.length) {
      slides.push(Slide(String(s.nombre || sv).toUpperCase(), <><img className="st-logo grande" alt="" src={liga.logo(sv, true)} /><h3 className="st-h">Todavía sin eventos en la {liga.temp}</h3>
        <small className="st-s">{String(s.tag || '').charAt(0) + String(s.tag || '').slice(1).toLowerCase()}</small></>, '', s.invita ? 'Entrar al servidor' : '', { link: s.invita },
      'vacio:' + sv));
    }
    slides.sort(masViejo);
    grupos.push({ id: 'sv-' + sv.toLowerCase(), tipo: 'sv', sv, nombre: s.nombre, logo: liga.logo(sv), nom: siglaDe(sv), espera, nuevo: propios.length > 0, firma: firma(propios, 'sem:' + (mm.ini || '')), slides });
  });
  // ── después, lo tuyo: tu país, tu crew y la gente que seguís. Dlx, 30/09/2026: «no hay necesidad de seguir a
  // todos… que ahí arriba aparezca simplemente tu país, tu crew si estás en una y las personas que tú sigues». Antes
  // iban las seis crews más grandes y cualquiera con una carta nueva, muchos sin foto.
  const yo = liga.yo;
  const pa = yo ? liga.paisDe(yo.cc) : null;
  if (pa) {
    const ks = new Set(pa.gente.map((f) => f.k));
    ks.delete(yo.k);
    const propios = muro.filter((it) => ksDe(it).some((k) => ks.has(k)));
    const nom = nombrePais(pa.cc);
    const top = pa.gente.slice(0, 6);
    const slides = [Slide('TU PAÍS', <><span className="st-bandera"><img alt="" src={'/banderas/g/' + pa.cc + '.webp'} /></span><h3 className="st-h">{nom}</h3>
      <small className="st-s">{pa.pos ? '#' + pa.pos + ' de la Liga · ' : ''}{pa.n} {pa.n === 1 ? 'rapero' : 'raperos'}{pa.pts ? ' · ' + num(pa.pts) + ' pts' : ''}</small>
      {top.length ? <ul className="st-gente">{top.map((f) => <li key={f.k}><Cara liga={liga} k={f.k} nombre={f.n} cls="st-mini" /><span>#{f.pos} {limpio(f.n)}</span></li>)}</ul> : null}</>,
    'esta temporada', 'Ver ' + nom, { ruta: '#/pais/' + pa.cc }, 'pais:' + pa.cc + ':' + (mm.ini || ''), String(mm.ini || ''))];
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    slides.sort(masViejo);
    grupos.push({ id: 'pais-' + pa.cc, tipo: 'pais', nombre: nom, cc: pa.cc, nom: PAIS_CORTO[pa.cc] || nom, espera, nuevo: propios.length > 0, firma: firma(propios, 'pais'), slides });
  }
  const c = yo ? liga.crewDe(yo) : null;
  if (c) {
    const ks = new Set(c.gente.map((n) => liga.fila(n)).filter(Boolean).map((f) => f.k));
    ks.delete(yo.k);
    const slides = [Slide('TU CREW', <><CrewCirculo c={c} cls="st-crew" /><h3 className="st-h">{limpio(c.crew).toUpperCase()}</h3>
      <small className="st-s">{c.n} {c.n !== 1 ? 'raperos' : 'rapero'} · {num(c.pts)} pts · el mejor: {limpio(c.mejor)}</small>
      <ul className="st-gente">{c.gente.slice(0, 8).map((n, i) => { const f = liga.fila(n); return <li key={i}><Cara liga={liga} k={f ? f.k : ''} nombre={n} cls="st-mini" /><span>{limpio(n)}</span></li>; })}</ul></>,
    'esta temporada', 'Ver la crew', { ruta: '#/crew/' + encodeURIComponent(c.clave || c.crew) }, 'crew:' + claveCrew(c.crew) + ':' + (mm.ini || ''),
    String(mm.ini || ''))];
    const propios = muro.filter((it) => ksDe(it).some((k) => ks.has(k)));
    slidesDe(liga, propios).slice(0, 3).forEach((x) => slides.push(x));
    slides.sort(masViejo);
    grupos.push({ id: 'crew-' + claveCrew(c.crew), tipo: 'crew', nombre: limpio(c.crew), crew: c, nom: c.sigla ? limpio(c.sigla) : limpio(c.crew), espera, nuevo: propios.length > 0, firma: firma(propios, 'crew'), slides });
  }
  const ETIQUETA = { tarjeta: 'carta nueva', campeon: 'campeón', caza: 'cazó' };
  const sig = liga.sigue.map((k) => {
    const f = liga.T[k];
    const propios = muro.filter((it) => ksDe(it).includes(k));
    // las cuatro más nuevas, y en el círculo de la más vieja a la más nueva como los demás (el muro viene al revés)
    let slides = slidesDe(liga, propios).slice(0, 4).sort(masViejo);
    // alguien que seguís y no hizo nada nuevo igual tiene su círculo: su carta y cómo va (una vez por semana)
    if (!slides.length) {
      slides = [Slide('SIGUES A', <><Carta liga={liga} k={k} cual="temporada" cls="st-carta" abre={false} /><h3 className="st-h">{limpio(f.n)}</h3>
        <small className="st-s">{f.pos ? '#' + f.pos + ' · ' : ''}OVR {f.ovr || '—'} · {num(f.pts)} pts · {f.ev || 0} {f.ev === 1 ? 'evento' : 'eventos'}</small></>,
      'esta temporada', 'Ver su perfil', { perfil: k }, 'seg:' + k + ':' + (mm.ini || ''), String(mm.ini || ''))];
    }
    const u = propios[0];
    const et = u ? (u.tipo === 'rango' ? 'rango ' + (u.rg || '') : ETIQUETA[u.tipo] || '') : (f.pos ? '#' + f.pos : '');
    return { id: 'p-' + k, tipo: 'gente', nombre: limpio(f.n), k, cc: f.cc, nom: limpio(f.n), et, espera, nuevo: !!u, t: u ? String(u.t) : '', pos: f.pos || 1e9, firma: firma(propios, 'perfil'), slides };
  });
  // primero los que tienen algo nuevo, lo más reciente adelante; después por el ranking
  sig.sort((a, b) => (Number(b.nuevo) - Number(a.nuevo)) || b.t.localeCompare(a.t) || (a.pos - b.pos));
  sig.slice(0, 15).forEach((g) => grupos.push(g));
  return grupos.filter((g) => g.slides.length);
}

// la cara de alguien en un círculo: su foto o, si no tiene, la inicial sobre su bandera (una inicial sobre negro,
// fila tras fila, era lo que se veía «sin avatar»)
export function CaraH({ liga, k, nombre, cc, cls = 'h-c' }) {
  const [mal, setMal] = useState(null);
  // la de la tabla; si no está (corta en 200), la que viene aparte por nombre (`avNombre()`)
  const src = (k && liga.avUrl(k)) || (liga.avNombre ? liga.avNombre(nombre) : null);
  if (src && mal !== src) return <span className={cls}><img alt="" src={src} onError={() => setMal(src)} /></span>;
  const ini = (limpio(nombre).slice(0, 1) || '?').toUpperCase();
  return (
    <span className={cls + ' ini' + (cc ? ' con-bandera' : '')} style={cc ? { backgroundImage: 'url(/banderas/g/' + cc + '.webp)' } : undefined}>
      <b>{ini}</b>
    </span>
  );
}

// 🔵 EL ORBE DE LAS PROMOS (Dlx, 16/10/2026: «que el icono del círculo sea como ese círculo de Siri, o sea algo como una
// galaxia o un ícono de vórtice», y a la pregunta, «gira despacio»). Tres capas que giran a distinto ritmo sobre un fondo
// casi negro, un remolino y un centro de luz. ⚠️ Es el ÚNICO lugar de la página con degradé, a propósito: el remake los
// prohíbe en todo lo demás. Quieto para quien apagó las animaciones (`prefers-reduced-motion`, en vivo.css)
export function Orbe() {
  return <span className="orbe" aria-hidden="true"><i /><i /><i /><i /></span>;
}

// 🎠 LA TIRA DE LOS CÍRCULOS (12/11/2026, Dlx: «arreglar esos de los círculos de arriba y hacer que se pueda jalar y mover y
// agregar flechitas. Mover el círculo de agregar o seguir a alguien a la izquierda y que todo sea de izquierda a
// derecha»): se arrastra con el mouse (en el celular ya se deslizaba con el dedo), lleva flechas a los costados cuando hay
// más para un lado, y «+ Sigue a alguien» va primero, siempre
function useTira() {
  const ref = useRef(null);
  const [lados, setLados] = useState([false, false]);
  const arr = useRef(null);
  const medir = () => {
    const el = ref.current;
    if (!el) return;
    const n = [el.scrollLeft > 4, el.scrollLeft + el.clientWidth < el.scrollWidth - 4];
    setLados((v) => (v[0] === n[0] && v[1] === n[1] ? v : n));
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const t = setTimeout(medir, 800);
    return () => { el.removeEventListener('scroll', medir); window.removeEventListener('resize', medir); clearTimeout(t); };
  });
  const mover = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.7), behavior: sinMovimiento() ? 'auto' : 'smooth' }); };
  // arrastrar con el mouse: el dedo ya lo hace el navegador. Si se movió, el clic de soltar no abre la historia
  const handlers = {
    onPointerDown: (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; arr.current = { x: e.clientX, s: ref.current.scrollLeft, movio: false }; },
    onPointerMove: (e) => {
      const a = arr.current;
      if (!a) return;
      const dx = e.clientX - a.x;
      if (!a.movio && Math.abs(dx) > 6) { a.movio = true; ref.current.classList.add('arrastra'); }
      if (a.movio) ref.current.scrollLeft = a.s - dx;
    },
    onPointerUp: () => { const a = arr.current; if (a && a.movio) setTimeout(() => { arr.current = null; }, 0); else arr.current = null; if (ref.current) ref.current.classList.remove('arrastra'); },
    onPointerLeave: () => { if (arr.current && !arr.current.movio) arr.current = null; if (ref.current) ref.current.classList.remove('arrastra'); },
    onClickCapture: (e) => { if (arr.current && arr.current.movio) { e.preventDefault(); e.stopPropagation(); arr.current = null; } },
  };
  return { ref, lados, mover, handlers };
}
const sinMovimiento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function Historias({ liga, grupos, vistos, onAbrir }) {
  const tira = useTira();
  const partes = [];
  // ➕ seguir a alguien, primero (Dlx: «mover el círculo de agregar o seguir a alguien a la izquierda»): se sigue desde el
  // perfil de cada uno, así que lleva al Ranking
  if ((liga.d.tabla || []).length) {
    // 🎞️ opción A (13/11/2026): chico, punteado y una sola palabra. Era lo más fuerte de la tira (aro blanco y dos
    // líneas) y sólo lleva al Ranking
    partes.push(<a key="sumar" className="h sumar" href="#/ranking" title="Sigue a alguien desde su perfil" aria-label="Seguir a alguien: se hace desde su perfil">
      <span className="h-c mas" aria-hidden="true">+</span><small>Seguir</small></a>);
  }
  let antes = null;
  let antesApagado = false;
  grupos.forEach((g, i) => {
    // gris cuando ya viste TODAS sus historias (se cuenta historia por historia: ver `Visor`) o cuando no tiene nada
    // nuevo (`apagadoH`). Los apagados van al final (`ordenHistorias`): una raya antes de ellos y ninguna entre ellos,
    // que ahí ya se mezclan los tipos. Entre los que tienen algo, una raya por tramo: La Liga, lo tuyo, los servidores
    const apag = apagadoH(g, vistos);
    if ((antes != null && (apag !== antesApagado || (!apag && tramoH(g) !== antes))) || (i === 0 && partes.length)) partes.push(<span key={'s' + i} className="h-sep" aria-hidden="true" />);
    antes = tramoH(g);
    antesApagado = apag;
    const visto = apag ? ' visto' : '';
    const abrir = () => onAbrir(i);
    if (g.tipo === 'vivo') {
      partes.push(<button type="button" key={g.id} className={'h en-vivo' + visto} onClick={abrir}><span className="h-w"><span className="h-c"><img alt="" src={g.logo} /></span>
        <span className="h-badge vivo-late">EN VIVO</span></span><small>{g.nom}</small></button>);
    } else if (g.tipo === 'liga') {
      partes.push(<button type="button" key={g.id} className={'h liga nuevo' + visto} onClick={abrir}><span className="h-c"><img alt="" src="/ul.png" /></span><small>La Liga</small></button>);
    } else if (g.tipo === 'yo') {
      partes.push(<button type="button" key={g.id} className={'h yo nuevo' + visto} onClick={abrir}><CaraH liga={liga} k={g.k} nombre={liga.yo ? liga.yo.n : ''} cc={g.cc} /><small>Tu semana</small></button>);
    } else if (g.tipo === 'promos') {
      partes.push(<button type="button" key={g.id} className={'h promos nuevo' + visto} onClick={abrir}><span className="h-c"><Orbe /></span><small>Promos</small></button>);
    } else if (g.tipo === 'sv') {
      partes.push(<button type="button" key={g.id} className={'h sv' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}><span className="h-c"><img alt="" src={g.logo} style={ZOOM_LOGO[g.sv] ? { transform: 'scale(' + ZOOM_LOGO[g.sv] + ')' } : undefined} /></span><small>{g.nom}</small></button>);
    } else if (g.tipo === 'pais') {
      partes.push(<button type="button" key={g.id} className={'h pais' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}>
        <span className="h-c bandera"><img alt="" src={'/banderas/g/' + g.cc + '.webp'} /></span><small>{g.nom}</small><em>tu país</em></button>);
    } else if (g.tipo === 'crew') {
      partes.push(<button type="button" key={g.id} className={'h crew' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}><CrewCirculo c={g.crew} /><small>{g.nom}</small><em>tu crew</em></button>);
    } else {
      partes.push(<button type="button" key={g.id} className={'h gente' + (g.nuevo ? ' nuevo' : '') + visto} onClick={abrir}>
        <CaraH liga={liga} k={g.k} nombre={g.nom} cc={g.cc} /><small>{g.nom}</small><em>{g.et}</em></button>);
    }
  });
  if (!partes.length) return null;
  return (
    <div className={'h-tira' + (tira.lados[0] ? ' hay-izq' : '') + (tira.lados[1] ? ' hay-der' : '')}>
      <nav className="historias" ref={tira.ref} aria-label="Historias: en vivo, servidores, tu país, tu crew y a quién sigues" {...tira.handlers}>{partes}</nav>
      {tira.lados[0] ? <button type="button" className="h-fl izq" aria-label="Ver los anteriores" onClick={() => tira.mover(-1)}><Chevron /></button> : null}
      {tira.lados[1] ? <button type="button" className="h-fl der" aria-label="Ver más" onClick={() => tira.mover(1)}><Chevron /></button> : null}
    </div>
  );
}

// ── el cuadro de cruces: cuartos, semis, final y el campeón, con líneas ─────────────────────────────
// 🔴 TODOS LOS LADOS, NO DOS. Dlx, 01/10/2026, «check the llaves», con la del Desgracias en Tokyo: los Octavos eran
// TRIANGULARES (CRK vs O.E.P vs ELSOLAR) y esto se quedaba con los dos primeros, así que ELSOLAR y ZIGNOS —que
// ganaron y pasaron a Cuartos— no aparecían, y esos cruces quedaban sin ganador. «Ver la llave» ya los dibujaba
// (los dos los usa también el botón del lobby, para «¡Te toca!»)
export const lados = (b) => (b[0] || []).map((z) => limpio(typeof z === 'string' ? z : z.join(' & ')));
export const ganador = (b) => limpio(typeof b[1] === 'string' ? b[1] : (b[1] || []).join(' & '));

// 🔑 `previa`: la llave en vivo que todavía sólo tiene la fase previa —el CYPHER de POESÍA CRUDA (URBF, 01/10/2026),
// grupos de tres y los cuartos vacíos—. Sin esto no se veía nada: los filtros no van en el cuadro.
const PREVIAS = ['Filtros', 'Clasificatorias', 'Preliminares'];
function CuadroRondas({ ll, previa }) {
  // 🔑 LA DOBLE, SÓLO EL FINAL (Dlx, 08/10/2026, con la Doble Eliminación Vol. 2 en la portada: «esto está así»):
  // entera son once columnas y la mitad quedaba cortada a la derecha. Acá van la última de ganadores, las dos últimas
  // de perdedores y la gran final; la llave entera está a un botón
  const d = esDoble(ll.rondas) ? partirDoble(ll.rondas) : null;
  const rondas = d ? d.G.slice(-1).map((R) => ({ r: /^final/i.test(R.r) ? R.r : 'Ganadores · ' + R.r, b: R.b }))
    .concat(d.P.slice(-2).map((R) => ({ r: /^final/i.test(R.r) ? R.r : 'Perdedores · ' + R.r, b: R.b })),
      d.F.length ? [{ r: 'Gran final', b: d.F }] : [])
    : (ll.rondas || []).filter((r) => r.r !== 'Tercer puesto' && (previa || r.r !== 'Filtros'));
  return (
    <>
      <div className="llave-cab"><span>{d ? 'DOBLE ELIMINACIÓN' : 'CUADRO'}</span><span className="apag">{d ? 'LAS FINALES' : 'POR RONDAS'}</span></div>
      <div className="llave-wrap"><div className="llave" style={{ gridTemplateColumns: 'repeat(' + rondas.length + ',150px)' }}>
        {rondas.map((r, ri) => (
          <div className="ronda" key={ri}><h4>{r.r}</h4>
            {/* sin ganador todavía nadie va apagado: tachado se lee como que perdió */}
            {/* un cruce de un solo lado espera a su rival (`⌞Geoka⌝ 🆚 ⌞⌝`): «por definir» en su lugar */}
            {(r.b || []).map((b, bi) => { const g = ganador(b); const ls = lados(b); return <div className={'m' + (g ? ' hecho' : '')} key={bi}>{ls.map((x, xi) => <span key={xi} className={g ? (x === g ? 'g' : 'x') : undefined}>{x}</span>)}{ls.length === 1 && !g ? <span className="m-espera">por definir</span> : null}</div>; })}
          </div>
        ))}
      </div></div>
    </>
  );
}

// ── el cuadro chico del escenario. Dlx, 30/09/2026: «estas llaves hay que hacerlas más bonitas». Va con la cara de
// cada uno, el ganador de cada cruce en blanco, el camino del campeón en verde y el perdedor apagado (sin tachar:
// tachado se leía como un error). En el celular y en pantallas medianas, semis y final: con los cuartos, el campeón
// quedaba afuera de la pantalla. La llave entera está a un botón.
const MEDIDAS = {
  movil: { rondas: 2, W: 104, G: 12, CAMP: 88 },
  medio: { rondas: 2, W: 116, G: 16, CAMP: 96 },
  pc: { rondas: 3, W: 106, G: 14, CAMP: 96 },
  // en una pantalla ancha, cuatro rondas: con Octavos entra la llave entera de 16 (Dlx, 01/10: «mostrar todas las
  // llaves»). Desde 1280: debajo, cuatro rondas no entran al lado del texto
  ancho: { rondas: 4, W: 116, G: 14, CAMP: 96 },
};
function useMedida() {
  const q = (m) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(m).matches : false);
  const leer = () => (q('(max-width: 599.98px)') ? 'movil' : (q('(max-width: 1099.98px)') ? 'medio'
    : (q('(max-width: 1279.98px)') ? 'pc' : 'ancho')));
  const [m, setM] = useState(leer);
  useEffect(() => {
    const f = () => setM(leer());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return MEDIDAS[m];
}

// ── la llave completa: las rondas que faltan y los cruces que todavía no se jugaron, vacíos ──────────────────────
// Dlx, 01/10/2026, con la llave en vivo de «Desgracias en Tokyo»: «para mostrar todas las llaves». Con los Cuartos a
// medio jugar (2 de 4) la llave no daba «regular» y caía al cuadro por rondas: sin caras, sin líneas y sin Semis ni
// Final. Se completa desde la primera ronda —cada una con la mitad de cruces que la anterior, hasta la Final— y cada
// cruce jugado va en SU lugar, el de los ganadores que lo forman, no en el orden en que llegó.
// ⚠️ Sólo si la primera ronda es potencia de 2 y ninguna trae más cruces de los que caben: si no, no se inventa la forma.
const NOMBRE_RONDA = { 1: 'Final', 2: 'Semis', 4: 'Cuartos', 8: 'Octavos', 16: '16avos' };
// hasta dónde puede crecer de alto la llave del escenario (los Octavos de 16 en 1 contra 1 miden 524)
const ALTO_LLAVE = 540;
// 🔴 CUÁNTOS CRUCES TIENE UNA RONDA LO DICE SU NOMBRE, NO CUÁNTOS YA SE CARGARON. POESÍA CRUDA (URBF, 01/10/2026) cargó
// el primer cruce de Cuartos y el escenario lo dibujó como una Final: un cruce y el «?» del campeón al lado.
const CRUCES = { 'Dieciseisavos': 16, '16avos': 16, 'Octavos': 8, 'Cuartos': 4, 'Semifinales': 2, 'Semis': 2, 'Final': 1 };
export function completar(todas) {
  const n0 = todas.length ? Math.max(todas[0].b.length, CRUCES[todas[0].r] || 0) : 0;
  if (!n0 || (n0 & (n0 - 1))) return todas;
  const out = [{ r: todas[0].r, b: todas[0].b.concat(new Array(n0 - todas[0].b.length).fill([[], ''])) }];
  for (let n = n0 / 2, i = 1; n >= 1; n /= 2, i += 1) {
    const r = todas[i];
    if (r && r.b.length > n) return todas;
    const previa = out[i - 1].b;
    const lugar = new Array(n).fill(null);
    (r ? r.b : []).forEach((b) => {
      const ls = lados(b);
      let k = previa.findIndex((p) => { const g = ganador(p); return !!g && ls.includes(g); });
      k = k >= 0 ? Math.floor(k / 2) : -1;
      if (k < 0 || lugar[k]) k = lugar.indexOf(null);
      if (k >= 0) lugar[k] = b;
    });
    out.push({ r: (r && r.r) || NOMBRE_RONDA[n] || 'Ronda ' + (i + 1), b: lugar.map((b) => b || [[], '']) });
  }
  return todas.length > out.length ? todas : out;
}

// 🔴 UNA LLAVE NO SIEMPRE SE ARMA COMO UN ÁRBOL. Dlx, 01/10/2026: «a veces se hacen batallas de otras llaves antes que la
// anterior». Dos Generaciones Vol 2 (FFA) armó sus Cuartos con los ganadores a medida que llegaban —el del grupo 2 contra
// el del 6, y del grupo 2 pasaron dos— y el árbol unía cada cruce con los grupos de al lado, que no eran los suyos. Si un
// cruce no está en el lugar de los grupos de donde salen sus lados, el árbol mentiría: el mismo cuadro, con cada cruce
// en el orden en que lo escribieron (`enRondas()`) y sin líneas
export function esArbol(todas) {
  for (let i = 1; i < todas.length; i += 1) {
    const previa = todas[i - 1].b;
    for (let j = 0; j < todas[i].b.length; j += 1) {
      const ks = lados(todas[i].b[j]).map((x) => previa.findIndex((p) => !!ganador(p) && ganador(p) === x));
      if (ks.some((k) => k >= 0 && Math.floor(k / 2) !== j)) return false;
    }
  }
  return true;
}
// …y por lo mismo, «AHORA» sólo si se juega en orden: con un cruce de más adelante ya decidido antes que uno de más
// atrás, no se sabe cuál se está jugando, y no se adivina
export function enOrden(todas) {
  let pendiente = false;
  for (let i = 0; i < todas.length; i += 1) {
    for (const b of todas[i].b) {
      if (jugado(todas, i, b)) { if (pendiente) return false; } else if (lados(b).length >= 2) pendiente = true;
    }
  }
  return true;
}
// 🔑 UN CRUCE SE JUGÓ SI TIENE GANADOR… O SI ALGUNO DE SUS LADOS YA ESTÁ EN LA RONDA SIGUIENTE (LA REDENCION, FFA,
// 03/10/2026). En un grupo de tres pueden pasar dos —Park Ji Sung + Yinn y Blitz, los dos a Cuartos— y la llave no marca
// un ganador: ese cruce quedaba «por jugarse» detrás de tres ya jugados, `enOrden()` daba que no, no había AHORA en
// ningún lado y la llave corta no salía. `i` es la ronda de `b` dentro de `todas`
export function jugado(todas, i, b) {
  if (ganador(b)) return true;
  const ls = new Set(lados(b));
  const sig = todas[i + 1];
  return !!sig && ls.size > 0 && sig.b.some((x) => lados(x).some((n) => ls.has(n)));
}

// la llave completa SIN reacomodar: cada ronda con sus cruces en el orden en que vienen y los lugares que faltan, vacíos,
// al final. Es la de una llave que no se arma como árbol (`esArbol()`): reacomodarla por los ganadores le inventaba la forma.
// ⚠️ Antes iba al cuadro por rondas, y se perdían las caras, los colores y el tope de alto (Dlx, 01/10: «se desactualizó»)
export function enRondas(todas) {
  const n0 = todas.length ? Math.max(todas[0].b.length, CRUCES[todas[0].r] || 0) : 0;
  if (!n0 || (n0 & (n0 - 1))) return todas;
  const out = [];
  for (let n = n0, i = 0; n >= 1; n /= 2, i += 1) {
    const r = todas[i];
    const bs = r ? r.b : [];
    if (bs.length > n) return todas;
    out.push({ r: (r && r.r) || NOMBRE_RONDA[n] || 'Ronda ' + (i + 1), b: bs.concat(new Array(n - bs.length).fill([[], ''])) });
  }
  return todas.length > out.length ? todas : out;
}

// 🔑 LA DOBLE ELIMINACIÓN, EN SUS TRES PARTES (Dlx, 08/10/2026: «sí, dale», a dibujarla como doble): la llave de
// ganadores, la de perdedores y la gran final. El lector junta cada llave en una ronda —«Llave de perdedores» trae
// todas sus batallas, en el orden de la llave— y FFA escribe la de ganadores por rondas (OCTAVOS, CUARTOS) con su
// final aparte («Winner's Final» → «Llave de ganadores»). Las rondas que faltan salen de POR DÓNDE APARECE CADA UNO:
// quien ya peleó en esta ronda, pelea en la siguiente. Funciona con la llave procesada y con la en vivo (`b[0]` de
// textos o de listas)
export const esDoble = (rs) => (rs || []).some((R) => /perdedores/i.test(R.r || ''));
const genteDe = (z) => String(typeof z === 'string' ? z : (z || []).join(',')).split(/[,+&]/)
  .map((s) => s.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim().toLowerCase()).filter(Boolean);
// ⚠️ Y POR DE DÓNDE BAJÓ (FFA, Doble Eliminación Vol. 2): la segunda ronda de perdedores arrancó con NC vs LitKunai,
// los dos recién caídos de Cuartos, y como ninguno había peleado en la primera, quedaba en la primera. Quien baja de una
// ronda de ganadores más honda que los de la ronda que se arma, abre la siguiente. `cae`: en qué ronda de ganadores
// perdió cada uno
function porAparicion(bs, cae) {
  const out = [];
  let vistos = null;
  let tope = -1;
  const antes = new Set();
  bs.forEach((b) => {
    const ms = (b[0] || []).flatMap(genteDe);
    const bajan = cae ? ms.filter((m) => !antes.has(m) && cae[m] != null).map((m) => cae[m]) : [];
    const mas = bajan.length && tope >= 0 && Math.max(...bajan) > tope;
    if (!out.length || ms.some((m) => vistos.has(m)) || mas) { out.push([]); vistos = new Set(); tope = -1; }
    out[out.length - 1].push(b);
    ms.forEach((m) => { vistos.add(m); antes.add(m); });
    bajan.forEach((x) => { tope = Math.max(tope, x); });
  });
  return out;
}
const DESDE_EL_FIN = ['Final de ganadores', 'Semifinales', 'Cuartos', 'Octavos', 'Dieciseisavos'];
// ⚠️ LA LLAVE GUARDADA PONE «Llave de ganadores» ANTES QUE OCTAVOS (`llaves_web` ordena las rondas que conoce y las
// demás van primero): la final de ganadores salía como «Octavos», a la izquierda de todo. Las rondas con nombre van por
// su orden, y lo que viene de «Llave de ganadores», después
const ORDEN_G = ['Dieciseisavos', '16avos', 'Octavos', 'Cuartos', 'Semifinales', 'Semis'];
export function partirDoble(rs) {
  const G = [];
  const Gx = [];
  const P = [];
  const F = [];
  (rs || []).forEach((R) => {
    const bs = (R.b || []).filter((b) => (b[0] || []).length);
    if (!bs.length) return;
    if (/perdedores/i.test(R.r)) P.push(...bs);
    else if (/^(gran )?final$/i.test(R.r)) F.push(...bs);
    else if (/ganadores/i.test(R.r)) porAparicion(bs).forEach((x) => Gx.push({ r: '', b: x }));
    else G.push({ r: R.r, b: bs });
  });
  G.sort((a, b) => ORDEN_G.indexOf(a.r) - ORDEN_G.indexOf(b.r));
  const GG = G.concat(Gx);
  GG.forEach((R, i) => { if (!R.r) R.r = DESDE_EL_FIN[GG.length - 1 - i] || 'Ronda ' + (i + 1); });
  const cae = {};
  GG.forEach((R, i) => R.b.forEach((b) => {
    if (!b[1]) return;
    const g = new Set(genteDe(b[1]));
    (b[0] || []).forEach((z) => { const ms = genteDe(z); if (!ms.some((m) => g.has(m))) ms.forEach((m) => { cae[m] = i; }); });
  }));
  const ps = porAparicion(P, cae);
  return {
    G: GG,
    // la última de perdedores es su final sólo si ya hay gran final: en vivo puede ser una ronda de dos que se juega
    P: ps.map((b, i) => ({ r: i === ps.length - 1 && i && b.length === 1 && F.length ? 'Final de perdedores' : 'Ronda ' + (i + 1), b })),
    F,
  };
}

// `lugar` (opcional): el ancho que tiene, medido. Con él la llave LO LLENA —las casillas se estiran hasta 220 y entran
// hasta cuatro rondas— en vez de quedarse con la medida de la pantalla: en Eventos, en la compu, la llave abierta usaba
// la mitad de la tarjeta y la otra mitad quedaba en blanco (Dlx, 02/10/2026: «too much white»). Sin `lugar`, como siempre
function medidaPara(lugar) {
  const G = 14;
  const CAMP = 96;
  return { rondas: Math.max(2, Math.min(4, Math.floor((lugar - CAMP + G) / (104 + G)))), G, CAMP, lugar };
}
// 🔑 UN LADO PUEDE SER UN EQUIPO, Y CADA UNO SE LEE POR SU AKA PRINCIPAL (Dlx, 03/10/2026, con LA REDENCION en vivo:
// «aquí no aparece que es el equipo de Oasis.. solo Park Ji Sung.. que debería aparecer el AKA principal»). Se parte
// por `+`, `&` y `,` —la llave en vivo escribe «A + B» y la procesada «A, B»— y cada integrante va con su cara y su
// nombre de la tabla: «Park Ji Sung» es un alias de Oasis. La lógica de quién pasó sigue con el texto de la llave
export const integrantes = (n) => String(n || '').split(/\s*[+&,]\s*/).map((x) => x.trim()).filter(Boolean);
function LadoCm({ liga, n, W }) {
  const ms = integrantes(n);
  const fs = ms.map((m) => liga.fila(m));
  const ns = ms.map((m, i) => capital(fs[i] ? limpio(fs[i].n) : m));
  const nom = ns.join(' + ');
  const caras = ms.slice(0, 3).map((m, i) => <Cara key={i} liga={liga} k={fs[i] ? fs[i].k : ''} nombre={fs[i] ? fs[i].n : m} cls="cm-av" />);
  if (ms.length < 2) return <>{caras}<em title={nom}>{nom || n}</em></>;
  // ⚠️ SI LOS NOMBRES NO ENTRAN, EL PRIMERO Y CUÁNTOS MÁS: «Abyssus +1», con las caras de todos al lado y el nombre
  // entero al pasar el mouse. Medido con LA REDENCION en una casilla de 128 px: «Six + ERIKDANIEL» pedía 115 y había 65.
  // La cuenta es la del ancho de la casilla, a ~7 px por letra (12 px, Archivo 800)
  // ⚠️ El «+1» va SOBRE las caras y no en el renglón: en el renglón le comía 20 px al nombre («Abyss… +1»)
  const lugar = (W || 116) - 22 - (18 + 11 * (Math.min(3, ms.length) - 1));
  const entra = nom.length * 6.5 <= lugar;
  return (
    <><span className="cm-eq" title={nom}>{caras}{entra ? null : <b className="cm-mas">+{ms.length - 1}</b>}</span>
      <em title={nom}>{entra ? nom : ns[0]}</em></>
  );
}
export function CuadroMini({ liga, ll, lugar }) {
  const M0 = useMedida();
  const M = lugar ? medidaPara(lugar) : M0;
  // la doble no es un árbol: tiene dos llaves y una gran final (`partirDoble()`)
  if (esDoble(ll.rondas)) return <CuadroRondas ll={ll} />;
  const base = (ll.rondas || []).filter((r) => !['Tercer puesto', ...PREVIAS].includes(r.r));
  let todas = completar(base);
  if (!todas.length && (ll.rondas || []).some((r) => PREVIAS.includes(r.r))) return <CuadroRondas ll={ll} previa />;
  const arbol = esArbol(todas);
  if (!arbol) todas = enRondas(base);
  // quién pasó de cada cruce: el ganador, o —si pasan varios, como en un grupo de tres donde siguen dos— los que aparecen
  // en la ronda de al lado
  const enLaSiguiente = (i) => new Set((todas[i + 1] ? todas[i + 1].b : []).flatMap((b) => lados(b)));
  // 🔑 QUÉ RONDAS SE VEN: con la llave completa, las últimas de una llave en vivo son lugares vacíos —en el celular
  // eran Semis y Final sin nadie—. Se ven desde la que SE ESTÁ JUGANDO, sin pasarse del final; terminada, las últimas.
  // Y la primera que se ve no puede tener más de 8 cruces: más alto no entra en el escenario
  // el alto de cada casilla sale de cuántos lados tiene (un triangular son tres), y con más de dos las filas son más
  // bajas: un triangular no puede estirar el escenario (Dlx, 01/10/2026: «tampoco hagas que se expanda demasiado en
  // altura innecesariamente, porque se ve algo raro»). El alto de cada lugar sale del cruce más alto de su ronda
  const TOP = 28;
  const nLados = (b) => Math.max(2, lados(b).length);
  const masLados = (r) => Math.max(...r.b.map(nLados));
  const filaDe = (r) => (masLados(r) >= 4 ? 19 : (masLados(r) === 3 ? 20 : 26));
  const mitad = (r) => Math.max(31, (filaDe(r) * masLados(r) + 8) / 2);
  const altoDesde = (i) => 2 * todas[i].b.length * mitad(todas[i]) + TOP;
  const decidida = (r) => r.b.every((b) => !!ganador(b));
  const enJuego = todas.findIndex((r, i) => r.b.some((b) => !jugado(todas, i, b) && lados(b).length >= 2));
  let desde = Math.max(0, todas.length - M.rondas);
  if (enJuego >= 0) desde = Math.min(enJuego, desde);
  while (desde < todas.length - 1 && todas[desde].b.length > 8) desde += 1;
  // y si así no entra de alto, la primera ronda que ya terminó queda para «Ver la llave»: lo que se mira en vivo es
  // lo que se está jugando (los Octavos triangulares terminados llevaban la llave a 814 px)
  while (desde < todas.length - 1 && altoDesde(desde) > ALTO_LLAVE && decidida(todas[desde])) desde += 1;
  const rondas = todas.slice(desde, desde + M.rondas);
  const conFinal = desde + rondas.length === todas.length;
  const regular = rondas.length && rondas.every((r, i) => i === rondas.length - 1 || rondas[i + 1].b.length * 2 === r.b.length);
  if (!regular) return <CuadroRondas ll={ll} />;
  const { G } = M;
  // el campeón sólo si se ve la Final: si no, el «campeón» sería el ganador de otra ronda
  // 📐 y si con su columna las casillas quedan más angostas que 104, el campeón no entra: en el teléfono, adentro de la
  // tarjeta abierta de Eventos (~280 px), salía cortado a la derecha (Dlx, 25/10/2026: «que todo esté bien
  // posicionado»). Ahí el podio de arriba ya dice quién ganó
  const entra = !M.lugar || (M.lugar - M.CAMP - rondas.length * G) / rondas.length >= 104;
  const CAMP = conFinal && entra ? M.CAMP : 0;
  const W = M.lugar ? Math.max(104, Math.min(220, Math.floor((M.lugar - CAMP - rondas.length * G) / rondas.length))) : M.W;
  const R = mitad(rondas[0]);
  const n0 = rondas[0].b.length;
  const campeon = conFinal ? ganador(rondas[rondas.length - 1].b[0]) : '';
  // 🔴 UNA LLAVE QUE YA TERMINÓ NO TIENE NADA «POR JUGARSE» (Dlx, 02/10/2026, con una captura de la Dos Generaciones
  // Vol 2): un lugar vacío es «—», y una batalla sin ganador —la que espera respuesta— dice «SIN GANADOR», no «AHORA»
  const cerrada = !ll.vivo || !!ll.terminada;
  // «AHORA» y «SIGUE» sólo en cruces con los dos lados: un lugar vacío todavía no se juega
  const pend = [];
  if (!cerrada && enOrden(todas)) rondas.forEach((r, ci) => r.b.forEach((b, j) => { if (!jugado(todas, desde + ci, b) && lados(b).length >= 2) pend.push(ci + ':' + j); }));
  const cajas = []; const lineas = []; const etiquetas = [];
  const alto = 2 * n0 * R + TOP;
  rondas.forEach((r, ci) => {
    const x = ci * (W + G);
    etiquetas.push(<b key={'e' + ci} className="cm-r" style={{ left: x, width: W }}>{String(r.r).toUpperCase()}</b>);
    const F = filaDe(r);
    const pasan = enLaSiguiente(desde + ci);
    r.b.forEach((b, j) => {
      const y = TOP + R * (2 ** ci) * (2 * j + 1);
      const g = ganador(b);
      // un lado solo: pasa directo si ya ganó, y si no, falta definir el otro
      const ls = lados(b);
      const est = pend[0] === ci + ':' + j ? 'ahora' : (pend[1] === ci + ':' + j ? 'sigue'
        : (cerrada && !jugado(todas, desde + ci, b) && ls.length >= 2 ? 'singan' : ''));
      const filas = ls.length >= 2 ? ls : [ls[0] || null, null];
      const falta = !ls.length ? (cerrada ? '—' : 'por jugarse') : (g ? 'pasa directo' : 'por definir');
      cajas.push(
        <div key={ci + '-' + j} className={'cm-m ' + est + (ls.length ? '' : ' vacio')}
          style={{ left: x, top: y - F * filas.length / 2, width: W, height: F * filas.length, gridTemplateRows: 'repeat(' + filas.length + ',1fr)' }}>
          {filas.map((n, i) => {
            if (!n) return <span key={i} className="vac"><em>{falta}</em></span>;
            const f = liga.fila(n);
            const cls = (g ? (n === g ? 'g' : 'x') : (pasan.has(n) ? 'g' : '')) + (g && n === campeon ? ' camino' : '');
            return <span key={i} className={cls}><LadoCm liga={liga} n={n} W={W} /></span>;
          })}
          {est ? <i>{est === 'ahora' ? 'AHORA' : est === 'sigue' ? 'SIGUE' : 'SIN GANADOR'}</i> : null}
        </div>,
      );
      const x1 = x + W; const x2 = x + W + G / 2;
      let yp; let x3;
      if (ci < rondas.length - 1) { yp = TOP + R * (2 ** (ci + 1)) * (2 * Math.floor(j / 2) + 1); x3 = x + W + G; } else { yp = y; x3 = x + W + G; }
      // sin árbol, sin líneas: unirían cada cruce con grupos que no son los suyos
      if (arbol) lineas.push(<path key={ci + '-' + j} className={g && g === campeon ? 'camino' : ''} d={'M' + x1 + ' ' + y + 'H' + x2 + 'V' + yp + 'H' + x3} />);
    });
  });
  const xc = rondas.length * (W + G);
  const yc = TOP + n0 * R;
  const f = liga.fila(campeon);
  const ancho = xc + CAMP;
  // la cara del campeón, a la altura de la línea de la final; abajo, el sello y el nombre
  const altoCamp = 124;
  const top = Math.max(0, yc - 32);
  const total = conFinal && CAMP ? Math.max(alto + 8, top + altoCamp) : alto + 8;
  return (
    <div className="cm" style={{ width: ancho, height: total }}>
      <svg className="cm-l" width={ancho} height={total} aria-hidden="true">{lineas}</svg>
      {etiquetas}{cajas}
      {conFinal && CAMP ? (
        <div className="cm-camp" style={{ left: xc, top, width: CAMP }}>
          {campeon ? <Cara liga={liga} k={f ? f.k : ''} nombre={campeon} cls="cm-cara" /> : <span className="cm-cara ini">?</span>}
          <small>{campeon ? 'CAMPEÓN' : 'EN JUEGO'}</small>{campeon ? <b>{campeon}</b> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── ⚡ LA LLAVE CORTA: la batalla que se acaba de jugar, la de AHORA y la que SIGUE ─────────────────────────────────
// Dlx, 03/10/2026, con LA REDENCION en vivo (Octavos de 16, en grupos de tres): «hacer una previa de la anterior llave a
// la actual, la actual y la siguiente, y dejar la opción de VER LAS LLAVES completas… si es que es octavos, para no hacer
// el espacio tan grande en el celular ni en la pc… queremos que sea estético y bonito». Con Octavos el cuadro pasaba los
// 500 px de alto; con Cuartos o menos entra entero y se queda. Va en el escenario del Inicio y en la tarjeta «En vivo
// ahora» de Eventos, adentro de lo negro (Dlx: «prefiero que esté dentro del espacio negro como estaba antes»).
// ⚠️ Las mismas reglas que el cuadro: «AHORA» sólo si se juega en orden (`enOrden()`) y sólo en un cruce con dos lados o
// más. Si no se sabe cuál va —o ya se jugaron todas—, `null`, y va el cuadro
export function momentosLlave(ll) {
  // ⚠️ con la misma vuelta que el cuadro (`CuadroMini`) y la página de la llave: si reacomodar por los ganadores no da un
  // árbol, se usa el orden en que lo escribieron. Sin esto, «Ahora» y «Sigue» salían en otro orden que el del organizador
  // y, con el primer ganador, la vista corta desaparecía (revisión del 04/10/2026)
  // ⚠️ en la doble no se sabe cuál va: las dos llaves se juegan intercaladas y la llave no dice en qué orden
  if (esDoble(ll && ll.rondas)) return null;
  const base = ((ll && ll.rondas) || []).filter((r) => !['Tercer puesto', ...PREVIAS].includes(r.r));
  let todas = completar(base);
  if (!esArbol(todas)) todas = enRondas(base);
  if (!enOrden(todas)) return null;
  const seq = [];
  let jugados = 0;
  todas.forEach((r, ri) => r.b.forEach((b) => {
    const hecho = jugado(todas, ri, b);
    if (hecho) jugados += 1;
    if (lados(b).length < 2) return;
    // quién pasó: el ganador o, si pasaron varios, los que están en la ronda siguiente (`jugado()`)
    const g = ganador(b);
    const sig = new Set(todas[ri + 1] ? todas[ri + 1].b.flatMap((x) => lados(x)) : []);
    seq.push({ r: r.r, lados: lados(b), hecho, pasan: g ? [g] : lados(b).filter((n) => sig.has(n)) });
  }));
  const i = seq.findIndex((x) => !x.hecho);
  if (i < 0) return null;
  return {
    antes: seq.slice(0, i).reverse().find((x) => x.hecho) || null,
    ahora: seq[i],
    sigue: seq.slice(i + 1).find((x) => !x.hecho) || null,
    jugados,
    total: todas.reduce((t, r) => t + r.b.length, 0),
  };
}
// «si es que es octavos»: la primera ronda con 8 cruces o más, por su nombre o por los que trae
export function llaveGrande(ll) {
  const base = ((ll && ll.rondas) || []).filter((r) => !['Tercer puesto', ...PREVIAS].includes(r.r));
  return !!base.length && Math.max(base[0].b.length, CRUCES[base[0].r] || 0) >= 8;
}
// la llave corta de una llave en vivo, o `null` si va el cuadro entero
export const cortaDe = (ll) => (ll && llaveGrande(ll) ? momentosLlave(ll) : null);
// las casillas son las del cuadro —la misma trama, el que pasó en blanco, «ahora» en magenta—, en una línea de tiempo.
// `W` es el ancho con el que LadoCm decide si los nombres de un equipo entran: el de la casilla en un celular
export function LlaveCorta({ liga, m }) {
  const items = [['antes', 'Antes', m.antes], ['ahora', 'Ahora', m.ahora], ['sigue', 'Sigue', m.sigue]].filter((x) => x[2]);
  return (
    <div className="lc">
      <ol className="lc-l">
        {items.map(([c, et, x]) => (
          <li key={c} className={'lc-b ' + c}>
            <small className="lc-t"><b>{et}</b>{x.r}</small>
            <div className="lc-m">
              {x.lados.map((n, i) => (
                <span key={i} className={x.hecho ? (x.pasan.includes(n) ? 'g' : 'x') : undefined}>
                  <LadoCm liga={liga} n={n} W={c === 'ahora' ? 210 : 240} />
                  {x.hecho && x.pasan.includes(n) ? <small className="lc-ok">PASA</small> : null}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="lc-n"><span>{m.jugados} de {m.total} batallas</span>
        <i><b style={{ width: Math.round((100 * m.jugados) / Math.max(1, m.total)) + '%' }} /></i></div>
    </div>
  );
}

// ── el escenario: un carrusel de momentos. Siempre hay algo: la llave de anoche no falta nunca ─────
export function gcal(e) {
  const t = utc(e.cuando);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fin = new Date(t.getTime() + 2 * 3600000);
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(limpio(e.nombre) + ' · ' + siglaDe(e.sv)) +
    '&dates=' + f(t) + '/' + f(fin) + '&details=' + encodeURIComponent(e.link || 'https://underlegends.pages.dev/freestyle-rap/eventos');
}

// 🎯 EL EVENTO DEL BOTÓN GRANDE DEL LOBBY (`ElBoton` de lobby.jsx): en el que estás anotado o, si no, el próximo para
// anotarte —el de tu servidor primero, en las próximas 36 h—. `e: null` si estás jugando uno en vivo (ahí el botón dice tu
// turno). Vive acá para que el escenario no lo repita (Dlx, 13/10/2026: «evitar que se repitan las cosas»)
export function eventoDelBoton(liga) {
  const yo = liga.yo;
  const estoy = (e) => !!(yo && liga.anotados(e).some((x) => x.f && x.f.k === yo.k));
  if (liga.vivo().some(estoy)) return { e: null, anotado: null };
  const luego = liga.luego();
  const anotado = luego.find(estoy) || null;
  const cerca = luego.filter((x) => utc(x.cuando) - liga.ahora < 36 * 3600000);
  return { e: anotado || (yo && cerca.find((x) => x.sv === yo.sv)) || cerca[0] || luego[0] || null, anotado };
}

export function llaveEnVivo(e, vivoL) {
  if (!vivoL || !window.llaveDeEvento) return null;
  try { return window.llaveDeEvento(e, Object.values(vivoL)); } catch (err) { return null; }
}

// ── lo tuyo, primero (Dlx, 30/09/2026: «me gustan todas», la B): si hoy te buscan y tu último evento, si fue en los
// últimos dos días. «Jugás esta noche» espera a que el payload traiga las inscripciones
function momentosTuyos(liga) {
  const yo = liga.yo;
  if (!yo) return [];
  const out = [];
  const b = liga.buscado(yo.k);
  const mw = liga.d.mw || {};
  if (b) {
    out.push({
      tipo: 'tebuscan', et: 'Te buscan', sv: yo.sv,
      txt: <><div className="hero-t"><span className="tag">HOY TE BUSCAN</span></div>
        <Tit c="hero-ev largo">{num(b.v)} PTS POR TU CABEZA</Tit>
        <p className="hero-p">{b.cn}{b.m ? ' · ' + b.m : ''}. Quien te gane, cobra. Vence {liga.dia(mw.fin)}.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.ir('sebusca')}>Ver Se busca</button>
          <Compartir cls="btn borde" url={enlace('#/r/' + encodeURIComponent(yo.k))} texto={'Hoy me buscan en la Liga Global: ' + num(b.v) + ' pts por mi cabeza'} /></div></>,
      vis: <div className="mo-poster"><Poster liga={liga} b={b} /></div>,
    });
  }
  const ult = liga.semanaDe(yo.k)[0];
  if (ult && (liga.ahora - utc(liga.fechaLlave(ult[0]))) / 3600000 < 48) {
    const [ll, res, pts] = ult;
    const carta = liga.cartaUrl(yo.k, 'temporada');
    out.push({
      tipo: 'tuevento', et: 'Tu evento', sv: ll.sv,
      txt: <><div className="hero-t"><span className="tag tg-seguis">TU ÚLTIMO EVENTO · {liga.cuando(liga.fechaLlave(ll)).toUpperCase()}</span></div>
        <Tit c="hero-ev">{resultado(res)}</Tit>
        <p className="hero-p">{limpio(ll.nombre)} · {siglaDe(ll.sv)} · {ll.participantes} raperos · +{num(pts)} pts para tu Temporada.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.llave(ll.n)}>Ver la llave</button>
          {carta ? <Compartir cls="btn borde" url={carta} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /> : null}</div></>,
      vis: <div className="mo-carta-w"><Carta liga={liga} k={yo.k} cual="temporada" cls="mo-carta" /></div>,
    });
  }
  // ── «Tu próximo» (Dlx, 01/10/2026, la B) vivía acá hasta el 13/10/2026: desde el lobby lo dice su botón grande, con
  // «Anotarme», y Dlx pidió «evitar que se repitan las cosas». El escenario se queda con lo que ya pasó
  return out;
}

function momentos(liga, vivoL) {
  const out = momentosTuyos(liga);
  // 🔴 TODOS LOS QUE SE ESTÁN JUGANDO, NO SÓLO EL PRIMERO (hasta tres). El 01/10/2026 a las 8 PM se jugaban a la vez
  // POESÍA CRUDA (URBF) y la VOL 21 2v2 (FFA), y el escenario mostraba uno: Dlx creyó que el de URBF había desaparecido
  const vivos = liga.vivo().slice(0, 3);
  vivos.forEach((e, iv) => {
    const m = liga.multSv(e.sv);
    const L = llaveEnVivo(e, vivoL);
    // con Octavos o más, la llave corta (ver `momentosLlave()`)
    const corta = cortaDe(L);
    const n = limpio(e.nombre);
    const dd = aDiscord(liga, e, true);
    // 🔑 LO BÁSICO DEL ANUNCIO, TAMBIÉN EN VIVO (Dlx, 03/10/2026, con LA REDENCION: «es MULTIVERSE… debería decirlo
    // ahí… no todo pero lo básico»): la modalidad, los cupos y el premio, como en el Próximo
    const det = [e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : ''].filter(Boolean).join(' · ');
    out.push({
      tipo: 'vivo', clave: iv ? 'vivo-' + e.sv + '-' + iv : 'vivo', et: vivos.length > 1 ? 'En vivo · ' + siglaDe(e.sv) : 'En vivo', sv: e.sv,
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag vivo-late">EN VIVO AHORA</span>
        <span className="hero-meta">{siglaDe(e.sv)} · EMPEZÓ {liga.dia(e.cuando).replace(/^hoy /, '')}{m ? ' · ' + mult(m) + ' ESTA SEMANA' : ''}</span></div>
        <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
        {det || e.premios ? <p className="hero-p">{det}{e.premios ? (det ? '. ' : '') + 'Premio: ' + recorte(e.premios, 70) : ''}</p> : null}
        <p className="hero-p">{L ? 'La llave, cruce por cruce, mientras se juega.' : 'La llave aparece acá apenas la carguen, cruce por cruce. Mientras, se mira en Discord.'}</p>
        {L ? null : <Anotados liga={liga} e={e} />}
        <div className="hero-acc">
          {L ? <button type="button" className="btn verde" onClick={() => accion.llave('v:' + L.id)}>{corta ? 'Ver la llave completa' : 'Ver la llave'}</button> : null}
          {dd ? <a className={'btn ' + (L ? 'borde' : 'verde')} href={dd.url} target="_blank" rel="noopener noreferrer">{dd.txt} ↗</a> : null}
          <a className="btn borde" href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
        </div></>,
      vis: L ? (corta ? <LlaveCorta liga={liga} m={corta} /> : <div className="cm-wrap"><CuadroMini liga={liga} ll={L} /></div>)
        : <div className="mo-logo vivo"><img alt="" src={liga.logo(e.sv, true)} /></div>,
    });
  });
  // el próximo de la Liga, si no es el mismo que ya muestra el botón grande del lobby (`eventoDelBoton()`)
  const delBoton = eventoDelBoton(liga).e;
  liga.luego().filter((x) => (utc(x.cuando) - liga.ahora) / 1000 < 36 * 3600 && x !== delBoton).slice(0, 1).forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [siglaDe(e.sv), e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : '', e.org ? 'organiza ' + e.org : ''].filter(Boolean).join(' · ');
    const n = limpio(e.nombre);
    // «Inscribite ya» primero, si el evento tiene su canal de inscripciones (Dlx, 03/10/2026: «2. A»)
    const dd = aDiscord(liga, e, false);
    const ins = dd && e.ins ? dd : null;
    out.push({
      tipo: 'prox', et: 'Próximo', sv: e.sv,
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(e.sv)} /><span className="tag tg-prox">PRÓXIMO · {liga.dia(e.cuando).toUpperCase()}</span></div>
        <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
        <p className="hero-p">{det}{e.premios ? '. Premio: ' + recorte(e.premios, 70) : ''}</p>
        <Anotados liga={liga} e={e} />
        <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(e.cuando)}</b></div>
        <div className="hero-acc">{ins ? <a className="btn verde" href={ins.url} target="_blank" rel="noopener noreferrer">{ins.txt} ↗</a> : null}
          <a className={'btn ' + (ins ? 'borde' : 'verde')} href="#/avisos"><Ico n="campana" t={18} />Quiero aviso</a>
          {ins ? null : <a className="btn borde" href={gcal(e)} target="_blank" rel="noopener noreferrer">+ Calendario</a>}</div></>,
      vis: <div className="mo-logo"><img alt="" src={liga.logo(e.sv, true)} />{dor ? <span className="mo-sello">DORADO ×3</span> : null}</div>,
    });
  });
  // 🏟️ LA FECHA DE HOY DE CADA LIGA, COMO UN EVENTO MÁS (Dlx, 14/10/2026: «Ligas en el Inicio»). Hoy es lo que la liga
  // anunció para hoy o una jornada con veredictos de hoy (`fechasHoy()` de liga.js). Con su flyer, si lo tiene; la cuenta
  // atrás sólo si el anuncio dijo la hora (sin dato no hay pieza). Hasta dos, para no tapar los eventos
  liga.fechasHoy().slice(0, 2).forEach((x) => {
    const L = x.L;
    const fl = L.fl;
    const ir = '#/ligas/' + encodeURIComponent(L.id);
    const futuro = !!(x.t && utc(x.t) > liga.ahora);
    const n = limpio(L.n);
    const ya = x.juega ? (x.n === 1 ? 'Una batalla ya tiene veredicto' : x.n + ' batallas ya tienen veredicto')
      + (x.j ? ' en la jornada ' + x.j + '. ' : '. ') : 'La liga anunció su fecha para hoy. ';
    out.push({
      tipo: 'ligahoy', clave: 'ligahoy-' + L.id, et: 'Liga · ' + siglaDe(L.sv), sv: L.sv,
      txt: <><div className="hero-t"><img className="hv-logo" alt="" src={liga.logo(L.sv)} /><span className="tag tg-prox">{futuro ? 'HOY · ' + liga.dia(x.t).replace(/^hoy /, '').toUpperCase() : 'HOY SE JUEGA'}</span>
        <span className="hero-meta">LIGA · {siglaDe(L.sv)}{x.j ? ' · JORNADA ' + x.j : ''}</span></div>
        <Tit c={'hero-ev' + (n.length > 16 ? ' largo' : '')}>{n}</Tit>
        <p className="hero-p">{ya}Sus batallas suman a tus duelos.</p>
        {futuro ? <div className="mo-cuenta"><small>EMPIEZA EN</small><b>{liga.falta(x.t)}</b></div> : null}
        <div className="hero-acc"><a className="btn verde" href={ir}>Ver la liga</a>
          {x.link ? <a className="btn borde" href={x.link} target="_blank" rel="noopener noreferrer">El anuncio ↗</a> : null}</div></>,
      vis: fl ? <a className="mo-flyer" href={ir} aria-label={'Ver ' + n}><img alt={'El flyer de ' + n} src={fl} /></a>
        : <div className="mo-logo"><img alt="" src={liga.logo(L.sv, true)} /></div>,
    });
  });
  const ll = liga.llavesPorFecha()[0];
  if (ll) {
    const gana = liga.campeon(ll);
    const cu = liga.cuando(liga.fechaLlave(ll));
    out.push({
      tipo: 'llave', et: cu.charAt(0).toUpperCase() + cu.slice(1), sv: ll.sv,
      txt: <><div className="hero-t"><span className="tag tg-llave">{cu.toUpperCase()} · LA LLAVE</span></div><Tit c={largo(limpio(ll.nombre))}>{juntos(limpio(ll.nombre))}</Tit>
        <p className="hero-p">{siglaDe(ll.sv)} · {ll.participantes} raperos. {gana.length > 1 ? 'Campeones:' : 'Campeón:'} {gana.join(' y ')}.</p>
        <div className="hero-acc"><button type="button" className="btn verde" onClick={() => accion.llave(ll.n)}>Ver la llave entera</button>
          <Compartir cls="btn borde" url={enlace('#/llave/' + ll.n)} texto={'La llave de ' + limpio(ll.nombre) + ' en la Liga Global'} /></div></>,
      vis: <div className="cm-wrap"><CuadroMini liga={liga} ll={ll} /></div>,
    });
  }
  const video = (liga.d.feed || []).find((x) => x.tipo === 'youtube');
  if (video) {
    const d = utc(video.t);
    out.push({
      tipo: 'video', et: 'Video', color: '#E41373',
      txt: <><div className="hero-t"><span className="tag tg-video">ÚLTIMO VIDEO · {limpio(video.canal || '').toUpperCase()}</span></div><Tit c={largo(limpio(video.tit))}>{limpio(video.tit)}</Tit>
        {/* en la zona de quien mira (Ajustes), no la del aparato (revisión del 04/10/2026) */}
        <p className="hero-p">Subido el {Number(diaISO(d).split('-')[2])} de {MESES[Number(diaISO(d).split('-')[1]) - 1]}.</p>
        <div className="hero-acc">{video.vid ? <button type="button" className="btn verde" onClick={() => abrirVideo({ vid: video.vid, tit: limpio(video.tit), link: video.link })}>▶ Mirar acá</button> : null}
          <a className={'btn ' + (video.vid ? 'borde' : 'verde')} href={video.link} target="_blank" rel="noopener noreferrer">En YouTube ↗</a></div></>,
      // 🔑 se mira acá, en la ventana de `video.jsx`; la miniatura es la grande (era la de 320×180, estirada)
      vis: video.vid ? (
        <button type="button" className="mo-yt" onClick={() => abrirVideo({ vid: video.vid, tit: limpio(video.tit), link: video.link })} aria-label="Mirar el video acá">
          <Miniatura vid={video.vid} /><span className="mo-play">▶</span></button>
      ) : null,
    });
  }
  const nov = (liga.d.novedades || [])[0];
  if (nov) {
    out.push({
      tipo: 'liga', et: 'La Liga', color: '#29B298',
      txt: <><div className="hero-t"><span className="tag tg-liga">LA LIGA · {liga.cuando(nov.t).toUpperCase()}</span></div><Tit c={largo(limpio(nov.tit))}>{limpio(nov.tit)}</Tit>
        <p className="hero-p">{recorte(nov.tx || '', 180)}</p>
        {nov.link ? <div className="hero-acc"><a className="btn verde" href={nov.link} target="_blank" rel="noopener noreferrer">Leer en Discord ↗</a></div> : null}</>,
      vis: <div className="mo-logo ul"><img alt="" src="/ul.png" /></div>,
    });
  }
  if (liga.sigue.length) {
    const sig = new Set(liga.sigue);
    for (const it of liga.muroLimpio()) {
      const ks = ksDe(it).filter((k) => sig.has(k));
      if (!ks.length || !['campeon', 'caza', 'rango', 'tarjeta'].includes(it.tipo) || (ll && it.ll === ll.n)) continue;
      const x = liga.itemMuro(it);
      if (!x) continue;
      const k = ks.sort()[0];
      out.push({
        tipo: 'seguis', et: 'Sigues', sv: liga.T[k].sv,
        txt: <><div className="hero-t"><span className="tag tg-seguis">DE LOS QUE SIGUES · {x[3].toUpperCase()}</span></div><Tit c={largo(x[1])}>{x[1]}</Tit>
          <p className="hero-p">{x[0].charAt(0) + x[0].slice(1).toLowerCase()}.</p>
          <div className="hero-acc"><a className="btn verde" href={'#/r/' + encodeURIComponent(k)}>Ver su perfil</a></div></>,
        vis: <div className="mo-cara"><Cara liga={liga} k={k} nombre={liga.T[k].n} cls="st-cara" grande /></div>,
      });
      break;
    }
  }
  return out;
}

// ── el fondo de cada momento. Dlx, 30/09/2026: «que haya diferentes fondos para ese apartado» y «usa los colores de
// los servidores que habíamos acordado y los logos actuales». El color es el acordado (`svs.color`, de
// datos/colores_sv_marca.json) oscurecido para que el texto blanco se lea; el logo, el de hoy (`liga.logo()`).
// ⚠️ EL FONDO SIGUE NEGRO: la primera versión teñía todo el escenario con el color oscurecido, y el naranja de Snake
// Rap oscurecido es MARRÓN (Dlx: «¿por qué el fondo es marrón o naranja?»). El color va en el círculo grande y el
// logo abajo, casi opaco: a media transparencia sobre negro el naranja volvía a dar marrón
function fondoDe(liga, m) {
  const s = m && m.sv ? liga.svs[m.sv] : null;
  const col = (s && s.color) || (m && m.color) || '#29B298';
  const logo = m && m.sv ? liga.logo(m.sv, true) : '/ul.png';
  const x = /^#?([0-9a-f]{6})$/i.exec(col);
  const n = x ? parseInt(x[1], 16) : 0;
  const luz = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return { '--mo-c': col, '--mo-o': luz < 0.2 ? 1 : 0.82, '--mo-logo': 'url("' + logo + '")', ...silueta(m && m.sv, col) };
}

// El escenario y «Esta semana» son un solo panel (Dlx, 30/09: «hazla como si estuviese dentro de ese panel»): la
// Tira entra como `children`, sin la línea que la separaba, y los círculos del fondo ya no se cortan entre los dos.
// ⏸️ YA NO PASA SOLO (13/10/2026). Pasaba cada 15 segundos (Dlx, 30/09: «después de 15 segundos»); con el Inicio
// hecho lobby (Dlx: «hacé lo que consideres mejor»), lo de arriba se queda quieto en lo más importante y se pasa con
// las flechas o las pestañas: algo que se mueve solo mientras leés es de lo que más confunde a quien llega.
export function Hero({ liga, vivoL, children }) {
  const mo = momentos(liga, vivoL);
  // ⚠️ el momento que se mira se sigue por su TIPO, no por su lugar: si empieza un evento en vivo, el suyo entra
  // adelante y corría a todos un lugar, y lo que estabas leyendo cambiaba solo (revisión del 01/10/2026)
  const [tipo, setTipo] = useState(null);
  const quieto = useRef(false);
  const x0 = useRef(null);
  const ultimo = useRef(Date.now());
  const lista = useRef(mo);
  lista.current = mo;
  const actual = useRef(tipo);
  actual.current = tipo;
  const n = mo.length;
  // cada momento se sigue por su clave: dos en vivo a la vez son dos momentos (`clave`), con el mismo `tipo`
  const idDe = (m) => m.clave || m.tipo;
  const j = Math.max(0, mo.findIndex((m) => idDe(m) === tipo));
  const ver = (k) => { ultimo.current = Date.now(); setTipo(idDe(mo[((k % n) + n) % n])); };
  // mientras se mira un video (`video.jsx`), el escenario no pasa solo
  const video = useRef(false);
  useEffect(() => {
    const f = (e) => { video.current = !!e.detail; ultimo.current = Date.now(); };
    window.addEventListener('lg:video-abierto', f);
    return () => window.removeEventListener('lg:video-abierto', f);
  }, []);
  if (!n) return children ? <div className="escena hero-ini" style={fondoDe(liga, null)}>{children}</div> : null;
  return (
    <div className="escena hero-ini" style={fondoDe(liga, mo[j])}>
      <section className="hero carrusel" id="envivo" aria-roledescription="carrusel" aria-label="Lo de ahora"
        onPointerDown={(e) => { x0.current = e.clientX; quieto.current = true; }}
        onPointerLeave={() => { x0.current = null; quieto.current = false; }}
        onPointerUp={(e) => {
          if (x0.current !== null && Math.abs(e.clientX - x0.current) > 40 && !e.target.closest('.cm-wrap')) ver(j + (e.clientX < x0.current ? 1 : -1));
          x0.current = null; quieto.current = false;
        }}>
        <div className="hero-in">
          {mo.map((m, k) => (
            <article key={idDe(m)} className={'mo mo-' + m.tipo + (k === j ? ' on' : '')} aria-hidden={k !== j}>
              <div className="mo-txt">{m.txt}</div><div className="mo-vis">{m.vis}</div>
            </article>
          ))}
        </div>
        {n > 1 ? <>
          <button type="button" className="mo-fl izq" aria-label="Momento anterior" onClick={() => ver(j - 1)}><Chevron /></button>
          <button type="button" className="mo-fl der" aria-label="Momento siguiente" onClick={() => ver(j + 1)}><Chevron /></button>
        </> : null}
        <nav className="mo-tabs" aria-label="Momentos">
          {mo.map((m, k) => <button type="button" key={idDe(m)} className={(k === j ? 'on' : '') + (m.tipo === 'vivo' ? ' vivo' : '')} onClick={() => ver(k)}>{m.et}</button>)}
        </nav>
      </section>
      {children}
    </div>
  );
}

// ── instalar la página como app (Dlx, 01/10/2026: «ok…», la C). En Android, cuando Chrome dice que se puede
// (`beforeinstallprompt`, que se guarda en index.html antes de que monte esto); en el iPhone no hay botón posible y va
// cómo se hace a mano —y ahí instalarla es lo que habilita los avisos—. Sólo en pantallas táctiles, una vez: con la ✕
// no vuelve (`lg:instalar`)
export function Instalar() {
  const [ev, setEv] = useState(() => window.__instalar || null);
  const [no, setNo] = useState(() => { try { return localStorage.getItem('lg:instalar') === 'no'; } catch (e) { return false; } });
  useEffect(() => {
    const f = () => setEv(window.__instalar || null);
    window.addEventListener('lg:instalar', f);
    return () => window.removeEventListener('lg:instalar', f);
  }, []);
  const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const app = mm('(display-mode: standalone)') || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (no || app || !mm('(pointer: coarse)') || (!ev && !ios)) return null;
  const cerrar = () => { setNo(true); try { localStorage.setItem('lg:instalar', 'no'); } catch (e) { /* igual */ } };
  const instalar = async () => {
    const e = ev;
    window.__instalar = null;
    setEv(null);
    try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === 'accepted') cerrar(); } catch (err) { /* el navegador no quiso */ }
  };
  return (
    <aside className="instalar" aria-label="Instalar la página como app">
      <img alt="" src="/ul-192.png" />
      <span className="inst-tx"><b>La Liga en tu celular</b>
        <small>{ev ? 'Instalala como app: queda en tu pantalla y se abre de un toque.' : 'En el iPhone se instala desde Safari, y así también te llegan los avisos.'}</small></span>
      {ev ? <button type="button" className="btn verde chico" onClick={instalar}>Instalar</button>
        // los pasos, con un dibujo por paso, viven en Ajustes (Dlx, 01/10/2026: «sé más específico»)
        : <a className="btn verde chico" href="#/cuenta/instalar">Ver cómo</a>}
      <button type="button" className="btn-ico inst-x" aria-label="No mostrar más" onClick={cerrar}><Ico n="cerrar" t={18} /></button>
    </aside>
  );
}

// ── Esta semana: la Tira (Dlx, 29/09 ~7 PM: «me gusta 3»). La votación del ×2 se mudó a Encuestas (30/09) ──
export function Tira({ liga }) {
  const m = liga.d.mult || {};
  const xs = m.sv || {};
  const svs = Object.keys(xs).sort((a, b) => (xs[b] - xs[a]) || (a < b ? -1 : 1));
  if (!svs.length) return null;
  const g = liga.doradoVigente();
  const nov = (liga.d.novedades || []).find((x) => /lunes de la liga/i.test(x.tit || ''));
  return (
    <section className="tira-s" id="semana" aria-label="Esta semana">
      <div className="ts-cab"><b className="ts-t">ESTA SEMANA</b>
        {nov && nov.link ? <a className="ts-a" href={nov.link} target="_blank" rel="noopener noreferrer">Lunes de la Liga <Ico n="flecha" t={14} /></a> : null}
      </div>
      {/* 🎞️ UNA TIRA QUE CORRE (Dlx, 12/11/2026: «la fila esa que dice esta semana se veía bien cuando había pocos
          servidores pero ahora que son varios…», y a las opciones, «me gusta una tira que corre… queda más visual»). Del
          más alto al más bajo, dos veces seguidas para que la vuelta no se note (la segunda, escondida para el lector de
          pantalla y el teclado). Se frena al pasar el mouse o con el foco adentro; con «Menos animaciones» o el
          movimiento reducido del teléfono, quieta y se desliza a mano */}
      <div className="ts-corre" style={{ '--ts-dur': Math.max(18, svs.length * 3) + 's' }}>
        <ul className="ts-l ts-pista">
          {[0, 1].map((vuelta) => svs.map((sv) => {
            const x = xs[sv];
            return <li key={vuelta + sv} className={(x > 1 ? 'sube' : (x < 1 ? 'baja' : '')) + (vuelta ? ' ts-eco' : '')} aria-hidden={vuelta ? 'true' : undefined}>
              <a className="ts-sv" href={'#/sv/' + siglaDe(sv)} aria-label={'Perfil de ' + siglaDe(sv)} tabIndex={vuelta ? -1 : undefined}>
                <span className="ts-id"><img alt="" src={liga.logo(sv)} /><b>{siglaDe(sv)}</b></span><span className="ts-x">{mult(x)}</span></a></li>;
          }))}
        </ul>
      </div>
      {g ? <p className="ts-dor"><b>DORADO ×3</b><span>{limpio(g.n)} · {siglaDe(g.sv)} · {utc(g.t) <= liga.ahora ? 'se juega ahora' : liga.dia(g.t)}</span></p> : null}
    </section>
  );
}

// ── IR A: una barra negra pegada arriba que aparece cuando pasaste el escenario ─────────────────────
const SECCIONES = [['envivo', 'Ahora'], ['semana', 'Esta semana'], ['fechas', 'Fechas'], ['sebusca', 'Se busca'],
  ['noticias', 'Lo último'], ['encuestas', 'Encuestas'], ['raperos', 'Los que mandan'], ['panel', 'Misiones'], ['merch', 'Merchandising'],
  ['numeros', 'La Liga']];

export function IrA({ raiz }) {
  const barra = useRef(null);
  const [ver, setVer] = useState(false);
  const [act, setAct] = useState('envivo');
  const fijo = useRef(0);
  // qué secciones hay se mira en la página, después de dibujarla: una que se apaga por no tener datos no va. La de
  // las encuestas se llama como su título («Encuestas» o «Tus eventos», si no hay ninguna abierta)
  const [hay, setHay] = useState(SECCIONES);
  useEffect(() => {
    const r = raiz.current;
    if (!r) return;
    const nuevo = SECCIONES.filter(([id]) => r.querySelector('#' + id)).map(([id, n]) => {
      const h = id === 'encuestas' ? r.querySelector('#encuestas > .sec-t h2') : null;
      return [id, h ? h.textContent : n];
    });
    if (JSON.stringify(nuevo) !== JSON.stringify(hay)) setHay(nuevo);
  });
  useEffect(() => {
    const mostrar = () => { if (barra.current) setVer(barra.current.getBoundingClientRect().top <= 1); };
    window.addEventListener('scroll', mostrar, { passive: true });
    mostrar();
    let io = null;
    if ('IntersectionObserver' in window && raiz.current) {
      io = new IntersectionObserver((es) => {
        if (Date.now() < fijo.current) return;
        es.forEach((e) => { if (e.isIntersecting) setAct(e.target.id); });
      }, { rootMargin: '-60px 0px -70% 0px' });
      SECCIONES.forEach(([id]) => { const s = raiz.current.querySelector('#' + id); if (s) io.observe(s); });
    }
    return () => { window.removeEventListener('scroll', mostrar); if (io) io.disconnect(); };
    // 🔴 con [raiz] solo, una sección que aparece después de montar —Lo último llega con el muro— no se miraba
    // nunca, y IR A no la marcaba al pasar (revisión del 30/09/2026)
  }, [raiz, hay.map((h) => h[0]).join()]);
  const ir = (id) => {
    const s = raiz.current && raiz.current.querySelector('#' + id);
    if (s) { fijo.current = Date.now() + 900; s.scrollIntoView({ behavior: 'smooth', block: 'start' }); setAct(id); }
    // sin momentos no hay escenario al que volver: «volver arriba» igual vuelve
    else if (id === 'envivo') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <nav className={'ir-a' + (ver ? ' ver' : '')} aria-label="Ir a" ref={barra}>
      <div className="ir-in">
        <span className="ir-t">IR A</span>
        <span className="ir-l">{hay.map(([id, n]) => <a key={id} href={'#' + id} className={act === id ? 'activo' : ''} onClick={(e) => { e.preventDefault(); ir(id); }}>{n}</a>)}</span>
        <select className="ir-s" aria-label="Ir a" value={act} onChange={(e) => ir(e.target.value)}>
          {hay.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <a className="ir-arr" href="#envivo" aria-label="Volver arriba" onClick={(e) => { e.preventDefault(); ir('envivo'); }}><Ico n="flecha" t={16} /></a>
      </div>
    </nav>
  );
}
