// El medio del Inicio: Fechas, Lo último, Los que mandan y el panel de abajo. Traducido de docs/remake/reales.py
// (fechas, noticias, raperos, panel, tus_eventos, tu_temporada, numeros).
import { DIAS, hora, ksDe, limpio, minutosDelDia, num, resultado, siglaDe, srcLogo, utc } from './liga.js';
import { miReaccion, reaccionesDe, useAplausos } from './aplausos.js';
import { PJ, delHilo, useComentarios } from './comentarios.jsx';
import { Escudo, escudoDe } from './escudo.jsx';
import { Bandera, Cara, Carta, Compartir, Ico, Pest, Rango, Sec, aDiscord, accion, enlace, nombrePais } from './piezas.jsx';
import { avance, premioTexto, proximoEspecial, usePase, usePases } from './pase.js';
import { useEffect, useRef, useState } from 'react';
import { pedirLigas } from './ligas_datos.js';

// 🗓️ HOY SUELE HABER (Dlx, 12/10/2026, «5. B»: casi todos anuncian a último momento, así que lo que no se ve con
// tiempo se adivina por costumbre). Un servidor que jugó este mismo día de la semana dos veces o más en las últimas
// cuatro semanas y todavía no anunció nada para hoy: «suele jugar · 18:00», marcado como probable. ⚠️ Sólo hasta una
// hora después de su hora de siempre: más tarde, ya no va a pasar. Como mucho dos, para no tapar lo anunciado
function sueleHoy(liga) {
  const hoy = liga.diaClave(liga.ahora);
  if (!hoy) return [];
  const dow = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };
  const dHoy = dow(hoy);
  const ya = new Set();
  liga.vivo().concat(liga.luego()).forEach((e) => { if (liga.diaClave(liga.cuandoDe(e)) === hoy) ya.add(e.sv); });
  const por = {};
  (liga.d.calendario || []).forEach((c) => {
    const t = utc(c.t);
    if (!c.sv || isNaN(t)) return;
    const k = liga.diaClave(t);
    if (k === hoy) { ya.add(c.sv); return; }
    if (c.fut || t > liga.ahora || liga.ahora - t > 28 * 864e5 || dow(k) !== dHoy) return;
    (por[c.sv] = por[c.sv] || []).push(t);
  });
  const ahoraM = minutosDelDia(liga.ahora);
  return Object.entries(por).filter(([sv, ts]) => ts.length >= 2 && !ya.has(sv)).map(([sv, ts]) => {
    const xs = ts.map((t) => [minutosDelDia(t), t]).sort((a, b) => a[0] - b[0]);
    const [m, t] = xs[Math.floor((xs.length - 1) / 2)];
    return { sv, m, t, n: ts.length };
  }).filter((x) => ahoraM <= x.m + 60).sort((a, b) => a.m - b.m).slice(0, 2);
}

// ── Fechas ────────────────────────────────────────────────────────────────────────────────────────
export function Fechas({ liga }) {
  const t = [];
  liga.vivo().forEach((e) => t.push({ c: 'vivo', dia: 'HOY', hora: '● EN VIVO · empezó ' + liga.dia(e.cuando).replace(/^hoy /, ''), sv: e.sv, ev: limpio(e.nombre),
    det: e.modalidad || 'se mira en Discord', link: (aDiscord(liga, e, true) || {}).url }));
  // ⏸ lo que el organizador pausó —«seguimos mañana»—: ni en vivo ni terminado (ver `liga.estado()`)
  liga.pausados().forEach(({ e, st }) => t.push({ c: 'pausado', dia: 'HOY', hora: '⏸ EN PAUSA', sv: e.sv, ev: limpio(e.nombre),
    det: liga.estadoTexto(st, e), link: (aDiscord(liga, e, true) || {}).url }));
  liga.luego().forEach((e) => {
    const dor = liga.esDorado(e.nombre, e.sv);
    const det = [e.modalidad, e.cupos ? 'cupos ' + String(e.cupos).toLowerCase() : ''].filter(Boolean).join(' · ');
    // ⏰ el que se atrasó, con su hora nueva y dicho
    const cu = liga.cuandoDe(e);
    const atr = (liga.estado(e) || {}).tipo === 'atrasado';
    t.push({ c: dor ? 'dorado' : atr ? 'pausado' : '', dia: liga.dia(cu).split(' ')[0].toUpperCase(),
      hora: (atr ? '⏰ ' : '') + hora(cu) + (atr ? ' · se atrasó' : ' · tu hora'),
      sv: e.sv, ev: limpio(e.nombre), det, badge: dor ? 'DORADO ×3' : '', link: (aDiscord(liga, e, false) || {}).url });
  });
  // 🗓️ lo que suele haber hoy y todavía no se anunció (ver `sueleHoy()`)
  sueleHoy(liga).forEach((x) => t.push({ c: 'suele', dia: 'HOY', hora: 'SUELE JUGAR · ' + hora(x.t), sv: x.sv,
    ev: (liga.svs[x.sv] || {}).nombre || siglaDe(x.sv), det: 'probable · todavía sin anuncio' }));
  // 🔴 lo que se canceló (el vigía vio que el anuncio se borró, ver `liga.cancelados()`): dice «CANCELADO» hasta seis
  // horas después de la hora en que era, en vez de desaparecer como si nada (Dlx, 01/10/2026: «B»). Uno borrado y vuelto
  // a publicar no: ver `cancelacionesVisibles()`
  liga.cancelacionesVisibles().forEach((c) => {
    const ini = c.ini ? new Date(c.ini) : null;
    if (ini && (liga.ahora - ini) > 6 * 3600000) return;
    t.push({ c: 'cancelado', dia: ini ? liga.dia(ini).split(' ')[0].toUpperCase() : 'HOY', hora: 'CANCELADO',
      sv: c.sv, ev: limpio(c.n), det: ini ? 'era a las ' + hora(ini) : 'el servidor lo canceló' });
  });
  // y lo que se canceló con el anuncio en pie: le borraron la llave y no hubo otra (LA REDENCION, 03/10/2026, ver
  // `liga.canceladoCal()`). Las mismas seis horas
  (liga.d.calendario || []).forEach((c) => {
    const ini = utc(c.t);
    if (liga.ahora - ini < 0 || liga.ahora - ini > 6 * 3600000 || !liga.canceladoCal(c)) return;
    if (t.some((x) => x.c === 'cancelado' && x.sv === c.sv && x.ev.toLowerCase() === limpio(c.n).toLowerCase())) return;
    t.push({ c: 'cancelado', dia: liga.dia(ini).split(' ')[0].toUpperCase(), hora: 'CANCELADO', sv: c.sv, ev: limpio(c.n),
      det: 'era a las ' + hora(ini) });
  });
  // 🔑 lo que terminó recién y el ciclo todavía no procesó (la NAVE DE EXTERMINACIÓN, 03/10/2026): con su campeón y su
  // llave, hasta que llegue la procesada. Ver `liga.recienTerminadas()`
  liga.recienTerminadas().forEach(({ L, e, camp }) => {
    t.push({ c: 'hecho', dia: liga.cuando(new Date(L.ed || L.pub)).toUpperCase(),
      hora: 'TERMINÓ' + (L.participantes ? ' · ' + L.participantes + ' raperos' : ''), sv: L.sv || (e && e.sv) || '',
      ev: limpio((e && e.nombre) || L.nombre), det: camp ? 'Campeón: ' + camp : 'los puntos llegan en un rato', llave: 'v:' + L.id });
  });
  // lo que pasó, hasta completar la fila de cinco de la compu (de diez si lo que viene ya pasa de cinco): con tres
  // fijas, sin nada anunciado quedaban dos lugares vacíos al lado (Dlx, 02/10/2026: «un espacio tan grande vacío»)
  const fila = t.length > 4 ? 10 : 5;
  // y por FECHA, del más nuevo al más viejo: el número de la llave es el orden en que se cargó, y con cinco «ayer» salía
  // después de «el miércoles»
  const porFecha = liga.llaves().slice().sort((a, b) => utc(liga.fechaLlave(b)) - utc(liga.fechaLlave(a)));
  porFecha.slice(0, Math.max(t.length > 4 ? 0 : 1, fila - t.length)).forEach((ll) => {
    const g = liga.campeon(ll);
    t.push({ c: 'hecho', dia: liga.cuando(liga.fechaLlave(ll)).toUpperCase(), hora: 'TERMINÓ · ' + ll.participantes + ' raperos', sv: ll.sv,
      ev: limpio(ll.nombre), det: (g.length > 1 ? 'Campeones: ' : 'Campeón: ') + g.join(' y '), llave: ll.n });
  });
  if (!t.length) return null;
  return (
    <Sec id="fechas" titulo="Fechas" enlace="Calendario" href="#/eventos">
      <div className="rail fechas2">
        {t.map((x, i) => {
          const cuerpo = <><div className="f-dia"><b>{x.dia}</b></div><img alt="" src={liga.logo(x.sv)} /><b className="f-ev">{x.ev}</b>
            <span className="f-hora">{x.hora}</span><small>{x.det}</small>{x.badge ? <span className="f-badge">{x.badge}</span> : null}</>;
          if (x.llave) return <button type="button" key={i} className={'fecha ' + x.c} onClick={() => accion.llave(x.llave)}>{cuerpo}</button>;
          if (x.link) return <a key={i} className={'fecha ' + x.c} href={x.link} target="_blank" rel="noopener noreferrer">{cuerpo}</a>;
          return <article key={i} className={'fecha ' + x.c}>{cuerpo}</article>;
        })}
      </div>
    </Sec>
  );
}

// ── Lo último ─────────────────────────────────────────────────────────────────────────────────────
export function Vis({ liga, v, cls = 'n-vis' }) {
  if (v[0] === 'carta') return <Carta liga={liga} k={v[1]} cual={v[2]} cls={cls + ' n-carta'} abre={false} />;
  if (v[0] === 'rango') return <span className={cls + ' rgv'} style={{ background: liga.colorRg(v[1]) }}>{v[1]}</span>;
  if (v[0] === 'cara') return <Cara liga={liga} k={v[1]} nombre={v[2]} cls={cls + ' n-cara'} />;
  if (v[0] === 'sv') return <img className={cls} alt="" src={liga.logo(v[1])} />;
  if (v[0] === 'enc') return <span className={cls + ' n-enc'}>{v[1]}</span>;
  // 🖼️ el flyer de una liga (14/10/2026): la imagen, recortada al cuadro
  if (v[0] === 'img') return <img className={cls + ' n-img'} alt="" src={v[1]} loading="lazy" />;
  return <img className={cls} alt="" src="/ul.png" />;
}
function irA(d, raiz) {
  if (!d) return;
  if (d.carta) accion.carta(d.carta, d.cual);
  else if (d.perfil) accion.perfil(d.perfil);
  else if (d.llave) accion.llave(d.llave);
  else if (d.ruta) location.hash = d.ruta;
  else if (d.link) window.open(d.link, '_blank', 'noopener');
  else if (d.ancla) accion.ir(d.ancla);
}
// 🔔 LO ÚLTIMO, CON EL ESTILO DE LA CAMPANA (Dlx, 13/11/2026, mirando el panel de notificaciones: «realmente me gusta
// bastante el estilo de notificaciones… que la sección de lo último sea algo así también», y «eso de TøKiØ rango B no se
// ve tan importante y el de Akus su tarjeta de País tampoco»). Era un mosaico (5.10) y las piezas chicas quedaban como
// cajas vacías con una línea de texto. Ahora: a la izquierda lo más grande —la última carta nueva o el último logro—, y
// a la derecha la lista de la campana: filtros arriba y cada novedad en una fila con su cara (o su carta) y la esquinita
// de qué es. Debajo de la grande, «Anoche en la Liga» y el afiche de la liga, para que las dos columnas queden parejas. La letra del rango va grande y en su color, al costado.
// Cada fila abre lo suyo; las reacciones y los comentarios no la abren
const LU_FILAS = 5;
const luHace = (liga, t) => { const c = liga.cuando(t); return c ? c.charAt(0).toUpperCase() + c.slice(1) : ''; };
// 👏 lo que el Worker deja reaccionar: `APLAUDIBLES` de bot/avisos.js. ⚠️ Una carta nueva no: «le toca a todo el que
// juega una vez». Si se cambia allá, se cambia acá
const LU_REAC = new Set(['campeon', 'rango', 'caza', 'sobrevivio', 'pase', 'sorteo', 'ligahito', 'mesaward']);
// los filtros: como los de la campana, cuatro
const LU_FILTROS = [['todo', 'Todo'], ['cartas', 'Cartas'], ['logros', 'Logros'], ['liga', 'Liga']];
const luCat = (it) => (it.tipo === 'tarjeta' ? 'cartas' : LU_REAC.has(it.tipo) ? 'logros' : 'liga');
// la esquinita de cada fila, por lo que cuenta
const LU_BADGE = { tarjeta: '🃏', campeon: '🏆', caza: '🎯', ligahito: '🏟️', flyer: '🏟️', liga: '📣', rango: '' };

// 🙂 LA CARITA DE REACCIONAR (Dlx, 13/11/2026, con la captura de la de Discord: «el emoji al que me refería era éste, pero
// feliz»): un círculo con ojos y sonrisa, dibujado acá —no un emoji—, para que se lea como botón
function Carita({ t = 18 }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="currentColor" />
      <circle cx="8.4" cy="9.8" r="1.55" fill="#0B0B0D" />
      <circle cx="15.6" cy="9.8" r="1.55" fill="#0B0B0D" />
      <path d="M7.3 13.4c1.1 2.4 2.8 3.6 4.7 3.6s3.6-1.2 4.7-3.6" fill="none" stroke="#0B0B0D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 🔥 LAS REACCIONES DE CADA NOVEDAD (Dlx, 13/11/2026: «donde si haces click ahí te aparecen las reacciones que tengas, se
// supone que tengo una de fueguito también pero no está»). La 🔥 y la 🎤 son de la fila premium del Pase (niveles 3 y 12)
// y nunca se habían conectado: ahora cada uno reacciona con una, la que quiera de las suyas, y cambiarla pisa la de antes
// (`reaccionesDe()` en bot/avisos.js). Al lado, lo que ya tiene esa novedad, como en Discord: tocar una que tienes es
// reaccionar con ésa. Las que te faltan salen apagadas, con el nivel que las da
function LuSocial({ liga, it, A, hilo, P }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { const p = e.composedPath ? e.composedPath() : []; if (caja.current && !p.includes(caja.current)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera, true); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const id = it.id;
  if (!id) return null;
  const reac = reaccionesDe(A, id);
  const mia = miReaccion(A, id);
  const yo = liga.yo;
  const propio = !!(yo && ksDe(it).includes(yo.k));
  const puede = LU_REAC.has(it.tipo) && !propio;
  const nc = hilo.length;
  // las tuyas (sin entrar, la de todos: tocarla te lleva a entrar con Discord) y todas las que existen, con su nivel
  const mias = (P && Array.isArray(P.reacciones) && P.reacciones.length) ? P.reacciones : ['👏'];
  const todas = [['👏', 0]];
  ((P && P.fila_premium) || []).forEach((p) => { if (p[2] === 'reaccion' && !todas.some((x) => x[0] === p[3])) todas.push([p[3], p[0]]); });
  const va = !!A.va[id];
  const reaccionar = (e) => { if (window.felicitar) window.felicitar(id, e); setAbierto(false); };
  const parar = (e) => e.stopPropagation();
  const err = A.err[id];
  return (
    <span className="lu-soc" ref={caja} onClick={parar} onKeyDown={parar}>
      {reac.map(([e, n]) => (
        <button key={e} type="button" className={'lu-rc' + (mia === e ? ' on' : '')} disabled={!puede || !mias.includes(e) || mia === e || va}
          onClick={() => reaccionar(e)} aria-pressed={mia === e}
          aria-label={num(n) + ' ' + e + (mia === e ? ', la tuya' : puede && mias.includes(e) ? ': reaccionar con ésta' : '')}>
          <span aria-hidden="true">{e}</span><em>{num(n)}</em></button>
      ))}
      {puede ? (
        <button type="button" className={'lu-car' + (abierto ? ' on' : '')} aria-expanded={abierto} aria-haspopup="dialog"
          aria-label={mia ? 'Cambiar tu reacción' : 'Reaccionar'} title={mia ? 'Cambiar tu reacción' : 'Reaccionar'} onClick={() => setAbierto((v) => !v)}>
          <Carita />{reac.length ? null : <span className="lu-car-t">Reaccionar</span>}
        </button>
      ) : null}
      <a className="lu-cm" href={'#/publicaciones/' + encodeURIComponent(id)} aria-label={nc ? nc + (nc === 1 ? ' comentario' : ' comentarios') : 'Comentar'}>
        <Ico n="globo" t={15} />{nc ? <em>{num(nc)}</em> : null}</a>
      {err && err.error === 'reaccion' ? <small className="lu-err">Esa reacción es del Pase premium</small> : null}
      {abierto ? (
        <span className="lu-reac" role="dialog" aria-label="Reaccionar">
          <span className="lu-reac-h">{mia ? 'Cambia tu reacción' : 'Reacciona'}</span>
          <span className="lu-reac-g">
            {todas.map(([e, nv]) => {
              const tiene = mias.includes(e);
              return (
                <button key={e} type="button" className={'lu-reac-e' + (mia === e ? ' on' : '') + (tiene ? '' : ' bloq')} disabled={!tiene || mia === e || va}
                  onClick={() => reaccionar(e)} aria-label={tiene ? 'Reaccionar con ' + e : e + ': Pase premium, nivel ' + nv}>
                  <span aria-hidden="true">{e}</span>{tiene ? null : <small>NV {nv}</small>}
                </button>
              );
            })}
          </span>
          {todas.some(([e]) => !mias.includes(e)) ? <a className="lu-reac-pie" href="#/pase">Las apagadas se ganan con el Pase premium</a> : null}
        </span>
      ) : null}
    </span>
  );
}

// 💬 EL ÚLTIMO COMENTARIO, A LA VISTA (Dlx, 13/11/2026: «que ese pop up de los comentarios sean mejores y quizás más
// grandes»). Antes flotaba al pasar el mouse y no se leía; ahora va debajo de la novedad, con la cara de quien escribió.
// En la grande, los dos últimos. ⚠️ El simulado lleva su etiqueta: eso lo decide el permiso en el ciclo, nunca acá
function LuNube({ liga, it, hilo, n = 1 }) {
  if (!hilo.length) return null;
  const cs = hilo.slice(-n);
  return (
    <a className={'lu-nube' + (n > 1 ? ' grande' : '')} href={'#/publicaciones/' + encodeURIComponent(it.id || '')} onClick={(e) => e.stopPropagation()}>
      {cs.map((c) => {
        const pj = c.et === 'l' ? PJ[c.k] || ['LG', '#E41373'] : null;
        return (
          <span className="lu-nube-c" key={c.id}>
            {pj ? <span className="lu-nube-cara pj" style={{ background: pj[1] }}>{pj[0]}</span> : <Cara liga={liga} k={c.k} nombre={c.n} cls="lu-nube-cara" lazy />}
            <span className="lu-nube-x"><b>{limpio(c.n)}{c.et === 's' ? <i>simulado</i> : null}</b><span>{c.tx}</span></span>
          </span>
        );
      })}
      {n > 1 ? <small className="lu-nube-mas">{hilo.length > n ? 'Ver los ' + hilo.length + ' comentarios' : 'Responder'}</small> : null}
    </a>
  );
}

export function Noticias({ liga, raiz }) {
  const A = useAplausos();
  // los comentarios de verdad (los simulados ya vienen en el muro): para contarlos y para la nube
  useComentarios();
  // tus reacciones (las del Pase): sólo si entraste con Discord
  const P = usePase(typeof window !== 'undefined' && !!window.DC);
  const [fil, setFil] = useState('todo');
  const hiloDe = (it) => (it && it.id ? delHilo(it, liga.ahora) : []);
  const muro = liga.muroLimpio().filter((it) => it.tipo !== 'anuncio' && it.tipo !== 'promo');
  if (!muro.length) return null;
  // la grande: la última carta nueva; si no hay, el último logro
  const feat = muro.find((it) => it.tipo === 'tarjeta') || muro.find((it) => LU_REAC.has(it.tipo) && liga.itemMuro(it)) || null;
  const noche = muro.find((it) => it.tipo === 'resnoche') || null;
  // el afiche de la liga va grande a la izquierda, debajo de la carta: es lo más visual que hay
  const flyer = muro.find((it) => it.tipo === 'flyer' && it.img) || null;
  // la lista: todo lo demás que se sabe dibujar, sin dos cartas seguidas de la misma persona (llegan juntas)
  const lista = [];
  for (const it of muro) {
    if (it === feat || it === flyer || it.tipo === 'resnoche' || !liga.itemMuro(it)) continue;
    if (it.tipo === 'tarjeta' && feat && JSON.stringify(ksDe(it)) === JSON.stringify(ksDe(feat))) continue;
    if (lista.some((o) => o.tipo === it.tipo && JSON.stringify(ksDe(o)) === JSON.stringify(ksDe(it)))) continue;
    lista.push(it);
    if (lista.length >= 40) break;
  }
  const cuenta = { todo: lista.length };
  lista.forEach((it) => { cuenta[luCat(it)] = (cuenta[luCat(it)] || 0) + 1; });
  const filtros = LU_FILTROS.filter(([k]) => k === 'todo' || cuenta[k]);
  const filas = lista.filter((it) => fil === 'todo' || luCat(it) === fil).slice(0, LU_FILAS);
  const ir = (it) => { const x = liga.itemMuro(it); if (x) irA(x[4], raiz); };
  const tecla = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // lo de la izquierda de cada fila: la carta, el afiche o la cara con su esquinita
  const visual = (it, x) => {
    const ks = ksDe(it);
    if (it.tipo === 'tarjeta') return <span className="lu-r-v v-carta"><Carta liga={liga} k={ks[0]} cual={it.carta} cls="lu-r-carta" abre={false} /></span>;
    if (it.tipo === 'flyer') return <span className="lu-r-v v-img"><img alt="" src={it.img} loading="lazy" /></span>;
    if (it.tipo === 'liga') return <span className="lu-r-v v-cara"><span className="nt-cara nt-ico"><img alt="" src="/ul.png" /></span></span>;
    const k = ks[0] || '';
    const f = k ? liga.T[k] : null;
    const badge = it.tipo === 'rango' ? <i className="nt-badge lu-r-rg" style={{ background: liga.colorRg(it.rg) }}>{it.rg}</i>
      : LU_BADGE[it.tipo] ? <i className="nt-badge">{LU_BADGE[it.tipo]}</i> : null;
    return (
      <span className="lu-r-v v-cara">
        <span className="nt-cara">
          {f ? <Cara liga={liga} k={k} nombre={f.n} cls="nt-c" /> : <span className="nt-c nt-ico">{(x[1] || '?').slice(0, 1)}</span>}
          {badge}
        </span>
        {/* los campeones de a dos: la cara del segundo, encimada */}
        {it.tipo === 'campeon' && ks[1] && liga.T[ks[1]] ? <Cara liga={liga} k={ks[1]} nombre={liga.T[ks[1]].n} cls="nt-c lu-r-dos" /> : null}
      </span>
    );
  };
  const fila = (it) => {
    const x = liga.itemMuro(it);
    const hilo = hiloDe(it);
    const sv = it.sv ? siglaDe(it.sv) : '';
    const sub = it.tipo === 'campeon' ? [sv, it.part ? it.part + ' raperos' : ''].filter(Boolean).join(' · ')
      : it.tipo === 'tarjeta' ? (() => { const f = liga.T[ksDe(it)[0]]; return f ? [f.rg ? 'Rango ' + f.rg : '', f.pos ? '#' + f.pos + ' Temporada' : ''].filter(Boolean).join(' · ') : ''; })()
        : sv;
    return (
      <li key={it.id || it.t + it.tipo}>
        <div className={'nt-f lu-r t-' + it.tipo} role="link" tabIndex={0} onClick={() => ir(it)} onKeyDown={tecla(() => ir(it))}>
          {visual(it, x)}
          <span className="nt-t">
            <span className="lu-cat">{x[0]}</span>
            <b>{x[1]}</b>
            {sub ? <small>{sub}</small> : null}
            <LuSocial liga={liga} it={it} A={A} hilo={hilo} P={P} />
            <LuNube liga={liga} it={it} hilo={hilo} />
          </span>
          <span className="lu-r-der">
            <span className="nt-hora">{luHace(liga, it.t)}</span>
            {/* 🅱️ la letra, grande y en su color (Dlx: «TøKiØ rango B no se ve tan importante») */}
            {it.tipo === 'rango' ? <span className="lu-r-letra" style={{ background: liga.colorRg(it.rg) }} aria-label={'Rango ' + it.rg}>{it.rg}</span> : null}
          </span>
        </div>
      </li>
    );
  };

  // la grande
  let grande = null;
  if (feat) {
    const x = liga.itemMuro(feat);
    const k = ksDe(feat)[0];
    const f = k ? liga.T[k] : null;
    const esCarta = feat.tipo === 'tarjeta';
    const hilo = hiloDe(feat);
    grande = (
      <div className="lu-feat" role="link" tabIndex={0} onClick={() => ir(feat)} onKeyDown={tecla(() => ir(feat))}>
        <span className="lu-feat-v"><Vis liga={liga} v={x[2]} cls="lu-feat-i" />{esCarta ? <span className="sticker">NUEVA</span> : null}</span>
        <span className="lu-feat-t">
          <span className="lu-cat">{x[0]} · {luHace(liga, feat.t)}</span>
          <b className="lu-tit">{x[1]}</b>
          {f ? <span className="lu-datos">
            {f.rg ? <span>Rango <b style={{ color: f.rgc || undefined }}>{f.rg}</b></span> : null}
            {f.pos ? <span>#{f.pos} Temporada</span> : null}
            {f.ev ? <span>{f.ev} eventos</span> : null}
          </span> : null}
          <span className="lu-acc">
            {esCarta ? <button type="button" className="lu-btn v" onClick={(e) => { e.stopPropagation(); accion.carta(k, feat.carta); }}>Ver la carta</button> : null}
            {k ? <a className="lu-btn" href={'#/r/' + encodeURIComponent(k)} onClick={(e) => e.stopPropagation()}>Su perfil</a> : null}
          </span>
          <LuSocial liga={liga} it={feat} A={A} hilo={hilo} P={P} />
          <LuNube liga={liga} it={feat} hilo={hilo} n={2} />
        </span>
      </div>
    );
  }

  // 🌙 anoche en la Liga y 🖼️ el afiche: debajo de la grande, así las dos columnas quedan parejas
  let nocheT = null;
  if (noche) {
    const cs = (noche.campeones || []);
    const caras = [];
    cs.forEach((c) => (c.quien || []).forEach(([n, k]) => { if (caras.length < 5 && !caras.some((y) => y[1] === k)) caras.push([n, k]); }));
    nocheT = (
      <a className="lu-noche" href="#/publicaciones">
        <span className="lu-cat">Anoche en la Liga</span>
        <span className="lu-num">{noche.eventos}<small>{noche.eventos === 1 ? 'evento' : 'eventos'}</small>{noche.part}<small>raperos</small>{cs.length}<small>{cs.length === 1 ? 'campeón' : 'campeones'}</small></span>
        <span className="lu-noche-c">{caras.map(([n, k]) => <Cara key={k} liga={liga} k={k} nombre={n} cls="nt-c" />)}
          <small>{cs.slice(0, 2).map((c) => (c.quien || []).map((y) => limpio(y[0])).join(' y ')).join(', ')}{cs.length > 2 ? ' y ' + (cs.length - 2) + ' más' : ''}</small></span>
      </a>
    );
  }
  let flyerT = null;
  if (flyer) {
    const x = liga.itemMuro(flyer);
    flyerT = (
      <div className="lu-fly" role="link" tabIndex={0} onClick={() => ir(flyer)} onKeyDown={tecla(() => ir(flyer))}>
        <img alt="" src={flyer.img} loading="lazy" />
        <span className="lu-fly-p"><span className="lu-cat">{x[0]} · {luHace(liga, flyer.t)}</span><b>{x[1]}</b></span>
      </div>
    );
  }

  return (
    <Sec id="noticias" titulo="Lo último" enlace="Publicaciones" href="#/publicaciones">
      <div className={'lu-dos' + (grande || nocheT || flyerT ? '' : ' solo')}>
        {grande || nocheT || flyerT ? <div className="lu-izq">{grande}{nocheT}{flyerT}</div> : null}
        <div className="nt-p lu-panel">
          {filtros.length > 2 ? (
            <div className="nt-chips" role="group" aria-label="Filtrar lo último">{filtros.map(([k, t]) => (
              <button key={k} type="button" className={'nt-chip' + (fil === k ? ' on' : '')} aria-pressed={fil === k} onClick={() => setFil(k)}>
                {t}<em>{cuenta[k] || 0}</em></button>
            ))}</div>
          ) : null}
          <ul className="lu-lista">{filas.map(fila)}</ul>
          <a className="nt-pie lu-pie" href="#/publicaciones"><span>Todo lo que pasó, en Publicaciones</span><b>Ver todo</b></a>
        </div>
      </div>
    </Sec>
  );
}

// ── Los que mandan: las siete categorías del podio de la web de hoy, cinco en cada una ──────────────
// la tarjeta ya dice quién es, de dónde, su puesto y sus números: abajo va sólo lo que la tarjeta NO dice (los duelos
// ganados, los podios, la racha). Dlx, 01/10/2026: «las cosas de abajo son innecesarias porque la tarjeta ya tiene esa
// info». El perfil sigue a un toque: la tarjeta abre su visor, que tiene «Ver su perfil»
export function McPersona({ liga, f, dato, cual = 'temporada', arriba = '' }) {
  // ⏳ mientras la carta se redibuja, su número puede no coincidir con el orden de acá: se dice
  const vieja = liga.cartaVieja(f.k, cual);
  return (
    <article className="mc">
      {/* el puesto de ESTE ranking, arriba y aparte, cuando la carta trae el «#» de otro (ELO, Ligas) */}
      {arriba ? <span className="mc-arriba">{arriba}</span> : null}
      <Carta liga={liga} k={f.k} cual={cual} cls="ci mc-ci" />
      {dato || vieja ? <div className="mc-pie"><small>{dato}{dato && vieja ? ' · ' : ''}{vieja ? '⏳ SE ESTÁ REDIBUJANDO' : ''}</small></div> : null}
    </article>
  );
}
function McGrupo({ n, img, nombre, dato, href }) {
  return (
    <a className="mc grupo" href={href}>
      <div className="mc-tile"><span className="mc-n">#{n}</span>{img}</div>
      <div className="mc-pie"><b>{nombre}</b><small>{dato}</small></div>
    </a>
  );
}
// ── tu puesto, debajo del top 5 (Dlx, 30/09/2026: «me gustan todas», la A): dónde estás y a cuánto del de arriba.
// Sólo si no estás en el top 5 —ahí ya te ves—; sin haber entrado, la invitación a entrar.
// 🏁 CON SU BARRA DESDE EL 13/11/2026 (la opción A de la maqueta, «Progress Card»): cuánto te falta para el de arriba,
// dicho con su nombre («Te faltan 9.714 pts para pasar a Tenor (#33)»), y la barra de lo tuyo contra lo suyo
function Puesto({ cara, quien, pos, txt, href, pct }) {
  return (
    <div className="mc-yo">
      {cara}
      <span className="mc-yo-q"><small>{quien}</small><b>{pos}</b></span>
      <span className="mc-yo-t">{pct != null ? <span className="mc-yo-barra" aria-hidden="true"><i style={{ width: pct + '%' }} /></span> : null}{txt}</span>
      {href ? <a className="mc-yo-a" href={href}>Ver el ranking <Ico n="flecha" t={14} /></a> : null}
    </div>
  );
}
// el nombre de lo que va en una lista: una fila de la tabla, un `[x, fila]` del ELO, un duelo, un país o una crew
const nomDe = (o) => (Array.isArray(o) ? limpio((o[1] || {}).n || '') : o.crew ? limpio(o.crew) : o.n && typeof o.n === 'string' ? limpio(o.n) : o.cc ? nombrePais(o.cc) : '');
function puestoDe(liga, lista, esMio, valor, unidad, dec = 0, posDe = null) {
  const i = lista.findIndex(esMio);
  if (i < 5) return null;
  const d = valor(lista[i - 1]) - valor(lista[i]);
  const dist = dec ? d.toFixed(dec).replace('.', ',') : num(d);
  // el puesto: el oficial si la lista lo trae (la Temporada tiene empates), si no el lugar en la lista
  const pos = posDe ? posDe(lista[i]) : i + 1;
  const arriba = posDe ? posDe(lista[i - 1]) : i;
  const nom = nomDe(lista[i - 1]);
  const pct = valor(lista[i - 1]) > 0 ? Math.max(2, Math.min(100, Math.round((100 * valor(lista[i])) / valor(lista[i - 1])))) : null;
  return {
    i, pos, pct,
    txt: d > 0 ? 'Te faltan ' + dist + ' ' + unidad + ' para pasar a ' + (nom ? nom + ' (#' + arriba + ')' : 'el #' + arriba) : 'Empatado con ' + (nom || 'el #' + arriba),
  };
}

// 👑 LOS QUE MANDAN, OPCIÓN A (Dlx, 13/11/2026: «x último remakea estas 2 últimas secciones», y a la maqueta
// https://claude.ai/artifact/Rumigw5P7eu1sFKJqaa8T9, «A y A»): la carta del #1 grande y sus números al lado; del #2 al
// #5 en filas, cada uno con su carta chica, su bandera, su letra y una barra contra el #1, y abajo tu fila. Las cartas
// son las de verdad: no se tocan. Cada fila es `{key, href, grande, mini, nom, cc, rg, sub, v, vt, vl}`: `v` el número
// de la barra, `vt` cómo se lee y `vl` qué es (OVR, SCORE…). Ideas de 21st, sólo miradas: «First Place Leaderboard»,
// «Leaderboard Card» (trophyso) y «Rank Bars» (eugeneshilow)
const QUIEN_MANDA = {
  temporada: 'El que manda en la temporada', competitivo: 'El mejor Score de la temporada', elo: 'El de más ELO',
  duelos: 'El que más duelos ganó', ligas: 'El mejor OVR de las ligas', podios: 'El de más campeonatos',
  rachas: 'La racha más larga', paises: 'El país que manda', crews: 'La crew que manda',
};
function Mandan({ liga, c, xs, yoFila }) {
  const uno = xs[0];
  const tope = Math.max(1, Number(uno.v) || 0);
  return (
    <div className="mn">
      <div className="mn-uno">{uno.grande}</div>
      <div className="mn-lado">
        <a className="mn-top" href={uno.href}>
          <span className="mn-n1">#1</span>
          <span className="mn-top-t">
            <small>{QUIEN_MANDA[c] || ''}</small>
            <b>{uno.cc ? <Bandera cc={uno.cc} cls="mn-flag" /> : null}{uno.nom}</b>
            <span>{uno.sub1 || uno.sub}</span>
          </span>
        </a>
        <ol className="mn-lista">
          {xs.slice(1).map((x, i) => (
            <li key={x.key}>
              <a className="mn-f" href={x.href}>
                <span className="mn-n">{i + 2}</span>
                <span className="mn-mini">{x.mini}</span>
                <span className="mn-t">
                  <b>{x.cc ? <Bandera cc={x.cc} cls="mn-flag" /> : null}<span className="mn-nom">{x.nom}</span>{x.rg ? <Rango liga={liga} rg={x.rg} /> : null}</b>
                  <small>{x.sub}</small>
                </span>
                <span className="mn-barra" aria-hidden="true"><i style={{ width: Math.max(3, Math.min(100, Math.round((100 * (Number(x.v) || 0)) / tope))) + '%' }} /></span>
                <span className="mn-v">{x.vt}<small>{x.vl}</small></span>
              </a>
            </li>
          ))}
        </ol>
        {yoFila}
      </div>
    </div>
  );
}

// los números grandes en corto: 786.861 → 787K, 1.250.000 → 1,25M
const corto = (n) => (n >= 1e6 ? (Math.round(n / 1e4) / 100).toString().replace('.', ',') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : num(n));

export function LosQueMandan({ liga, dc }) {
  const [ligasR, setLigasR] = useState(null);
  useEffect(() => { let vivo = true; pedirLigas(liga.d.sello).then((d) => { if (vivo && d) setLigasR(d); }); return () => { vivo = false; }; }, [liga.d.sello]);
  const ligasC = ligasR && ligasR.cartas;
  const ligasL = ligasR && ligasR.lobby;
  const T = liga.oficiales();
  const yo = liga.yo;
  const cara = yo ? <Cara liga={liga} k={yo.k} nombre={yo.n} cls="mc-yo-c" /> : null;
  const quien = yo ? 'TÚ · ' + limpio(yo.n).toUpperCase() : '';
  const fila = (x, href) => (x ? <Puesto cara={cara} quien={quien} pos={'#' + x.pos} txt={x.txt} pct={x.pct} href={href} /> : null);
  // una persona de la tabla: su carta grande (abre su visor) y la chica en la fila, que lleva a su perfil
  // `sub1`: lo que dice el #1, que tiene más lugar (si no, lo mismo que las filas)
  const per = (f, cual, v, vt, vl, sub, sub1) => ({
    key: f.k, href: '#/r/' + encodeURIComponent(f.k), nom: limpio(f.n), cc: f.cc, rg: f.rg, sub, sub1: sub1 || sub, v, vt, vl,
    grande: <Carta liga={liga} k={f.k} cual={cual} cls="ci mn-carta" />,
    mini: <Carta liga={liga} k={f.k} cual={cual} cls="ci mn-ci" abre={false} />,
  });
  const evs = (f) => num(f.pts || 0) + ' pts · ' + (f.ev || 0) + (f.ev === 1 ? ' evento' : ' eventos');
  const cats = [];
  cats.push(['temporada', 'Temporada', T.slice(0, 5).map((f) => per(f, 'temporada', f.ovr || 0, f.ovr || '—', 'OVR', evs(f),
    (f.ovr || '—') + ' de OVR · ' + evs(f) + (f.oro ? ' · ' + f.oro + (f.oro === 1 ? ' campeonato' : ' campeonatos') : ''))),
    yo ? fila(puestoDe(liga, T, (f) => f.k === yo.k, (f) => f.pts || 0, 'pts', 0, (f) => f.pos), '#/ranking/temporada') : null]);
  const compT = T.filter((f) => f.rg).sort((a, b) => (b.sc || 0) - (a.sc || 0));
  let yoComp = null;
  if (yo && !yo.rg) {
    const falta = Math.max(0, 10 - (yo.ev || 0));
    yoComp = <Puesto cara={cara} quien={quien} pos="—" pct={Math.round((100 * Math.min(10, yo.ev || 0)) / 10)}
      txt={falta ? 'Te faltan ' + falta + (falta === 1 ? ' evento' : ' eventos') + ' para tu letra' : 'Tu letra llega con la próxima corrida'} href="#/ranking/competitivo" />;
  } else if (yo) {
    yoComp = fila(puestoDe(liga, compT, (f) => f.k === yo.k, (f) => f.sc || 0, 'de Score', 1), '#/ranking/competitivo');
  }
  const sc1 = (x) => (Number(x) || 0).toFixed(1).replace('.', ',');
  cats.push(['competitivo', 'Competitivo', compT.slice(0, 5).map((f) => per(f, 'competitivo', f.sc || 0, sc1(f.sc), 'SCORE', 'Rango ' + f.rg + ' · ' + (f.ev || 0) + ' eventos')), yoComp]);
  // ⚔️ ELO (Dlx, 12/11/2026: «los rankings que faltan»): las batallas uno contra uno por divisiones. La carta es la
  // Competitiva (la que habla de batallas); su «#» es el del Competitivo: el puesto en ELO es el de esta lista
  const eloT = [];
  for (const g of ((liga.d.div || {}).d || [])) for (const gg of g || []) for (const x of gg || []) eloT.push(x);
  eloT.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  // sin los de «fuera de concurso», como los demás rankings de acá (`oficiales()`)
  const eloF = eloT.map((x) => [x, liga.fila(x[0])]).filter(([, f]) => f && f.k && liga.T[f.k] && !liga.T[f.k].fc);
  const yoElo = yo ? puestoDe(liga, eloF, ([, f]) => f.k === yo.k, ([x]) => x[1] || 0, 'de ELO') : null;
  cats.push(['elo', 'ELO', eloF.slice(0, 5).map(([x, f]) => per(liga.T[f.k], liga.cartaDe(f.k, { comp: 1 }) || 'temporada', x[1] || 0, num(x[1] || 0), 'ELO',
    'Batallas 1 contra 1 por divisiones')), yoElo ? fila(yoElo, '#/ranking/divisiones') : null]);
  // ⚔️ de la tabla (`du: [ganados, jugados]`, 29/10/2026): la lista entera de Duelos ya no viaja en el lobby, y acá sólo
  // se mira a los de la tabla. El mismo orden que el Ranking de Duelos: ganados, jugados y nombre
  const duT = (liga.d.duelos || T.filter((f) => f.du).map((f) => ({ k: f.k, n: f.n, g: f.du[0], t: f.du[1], fc: f.fc }))
    .sort((a, b) => b.g - a.g || b.t - a.t || ((a.n || '') < (b.n || '') ? -1 : (a.n || '') > (b.n || '') ? 1 : 0)))
    .filter((d) => !d.fc && liga.T[d.k]);
  cats.push(['duelos', 'Duelos', duT.slice(0, 5).map((d) => per(liga.T[d.k], liga.cartaDe(d.k, { comp: 1 }) || 'temporada', d.g || 0, d.g || 0, 'GANADOS',
    'de ' + (d.t || 0) + ' duelos jugados')),
    yo ? fila(puestoDe(liga, duT, (d) => d.k === yo.k, (d) => d.g || 0, 'duelos ganados'), '#/ranking/duelos') : null]);
  // 🏟️ LIGAS (Dlx, 12/11/2026): los cinco mejores OVR de liga, sumando todas las ligas, con su carta de liga. Quién tiene
  // carta y con qué OVR viene en `/api/ligas` (`cartas`), el mismo pedido que la página ya hace una vez por lobby
  if (ligasC && Object.keys(ligasC).length) {
    const nomLiga = {};
    ((ligasL || {}).ligas || []).forEach((L) => { nomLiga[L.id] = L.n; });
    const todas = [];
    Object.entries(ligasC).forEach(([k, xs]) => (xs || []).forEach((x) => { if (liga.T[k] && !liga.T[k].fc) todas.push({ k, lid: x[0], v: x[1], ovr: x[2] || 0 }); }));
    todas.sort((a, b) => b.ovr - a.ovr);
    const vistos = new Set();
    const mejores = todas.filter((x) => (vistos.has(x.k) ? false : vistos.add(x.k))).slice(0, 5);
    const miL = yo ? todas.filter((x) => x.k === yo.k)[0] : null;
    const iMiL = miL ? todas.filter((x, j) => todas.findIndex((y) => y.k === x.k) === j).findIndex((x) => x.k === yo.k) : -1;
    const src = (x, chica) => liga.d.r2 + '/' + encodeURIComponent(x.k) + '/liga-' + x.lid + (chica ? '.chica' : '') + '.webp?v=' + x.v;
    cats.push(['ligas', 'Ligas', mejores.map((x) => {
      const f = liga.T[x.k];
      return {
        key: x.k, href: '#/ligas/' + encodeURIComponent(x.lid), nom: limpio(f.n), cc: f.cc, sub: nomLiga[x.lid] ? limpio(nomLiga[x.lid]) : 'Su liga', v: x.ovr, vt: x.ovr, vl: 'OVR',
        grande: <img className="ci mn-carta" alt={'Carta de liga de ' + limpio(f.n)} loading="lazy" src={src(x, true)} />,
        mini: <img className="ci mn-ci" alt="" loading="lazy" src={src(x, true)} />,
      };
    }),
    iMiL >= 5 ? <Puesto cara={cara} quien={quien} pos={'#' + (iMiL + 1)} txt={'OVR de liga ' + miL.ovr + (nomLiga[miL.lid] ? ' · ' + nomLiga[miL.lid] : '')} href="#/ligas" /> : null]);
  }
  const medT = T.filter((f) => (f.oro || 0) + (f.seg || 0) + (f.ter || 0))
    .sort((a, b) => (b.oro || 0) - (a.oro || 0) || (b.seg || 0) - (a.seg || 0) || (b.ter || 0) - (a.ter || 0) || a.pos - b.pos);
  const iMed = yo ? medT.findIndex((f) => f.k === yo.k) : -1;
  cats.push(['podios', 'Podios', medT.slice(0, 5).map((f) => per(f, 'temporada', f.oro || 0, f.oro || 0, '1.º', '2.º ×' + (f.seg || 0) + ' · 3.º ×' + (f.ter || 0))),
    iMed >= 5 ? <Puesto cara={cara} quien={quien} pos={'#' + (iMed + 1)} txt={'1.º ×' + (yo.oro || 0) + ' · 2.º ×' + (yo.seg || 0) + ' · 3.º ×' + (yo.ter || 0)} href="#/ranking/podios" /> : null]);
  const con = T.filter((f) => (f.rch || []).length > 1 && f.rch[1]);
  const vivas = con.filter((f) => f.rch[0]);
  const raT = (vivas.length ? vivas : con).slice().sort((a, b) => (vivas.length ? b.rch[0] - a.rch[0] : b.rch[1] - a.rch[1]) || a.pos - b.pos);
  const racha = (f) => (vivas.length ? f.rch[0] : f.rch[1]);
  cats.push(['rachas', 'Rachas', raT.slice(0, 5).map((f) => per(f, 'temporada', racha(f), racha(f), 'SEGUIDOS', vivas.length ? 'Eventos seguidos, y sigue' : 'Su mejor racha de la temporada')),
    yo ? fila(puestoDe(liga, raT, (f) => f.k === yo.k, racha, 'eventos seguidos'), '#/ranking/rachas') : null]);
  const paT = (liga.d.paises || []).filter((p) => p.n);
  const miPais = yo && yo.cc ? puestoDe(liga, paT, (p) => p.cc === yo.cc, (p) => p.pts || 0, 'pts') : null;
  cats.push(['paises', 'Países', paT.slice(0, 5).map((p) => ({
    key: p.cc, href: '#/pais/' + p.cc, nom: nombrePais(p.cc), sub: p.n + (p.n === 1 ? ' rapero' : ' raperos'), sub1: num(p.pts || 0) + ' pts · ' + p.n + (p.n === 1 ? ' rapero' : ' raperos'), v: p.pts || 0, vt: corto(p.pts || 0), vl: 'PTS',
    grande: <a className="mn-tile" href={'#/pais/' + p.cc}><Bandera cc={p.cc} cls="mn-tile-bandera" /></a>,
    mini: <Bandera cc={p.cc} cls="mn-ci bandera" />,
  })),
  miPais ? <Puesto cara={<Bandera cc={yo.cc} cls="mc-yo-flag" />} quien={'TU PAÍS · ' + nombrePais(yo.cc).toUpperCase()} pos={'#' + miPais.pos} txt={miPais.txt} pct={miPais.pct} href="#/ranking/paises" /> : null]);
  const crT = (liga.d.crews || []).filter((c) => c.rk !== 0);
  const miCrew = yo ? liga.crewDe(yo) : null;
  const xCrew = miCrew ? puestoDe(liga, crT, (c) => c.crew === miCrew.crew, (c) => c.pts || 0, 'pts') : null;
  const escudo = (c, cls) => (escudoDe(c.logo, limpio(c.crew)) ? <span className={cls + ' con-esc'}><Escudo e={escudoDe(c.logo, limpio(c.crew))} /></span>
    : <img className={cls} alt="" src={srcLogo(c.logo)} />);
  cats.push(['crews', 'Crews', crT.slice(0, 5).map((c) => ({
    key: c.crew, href: '#/crew/' + encodeURIComponent(c.clave || c.crew), nom: limpio(c.crew), sub: c.n + (c.n === 1 ? ' rapero' : ' raperos'), sub1: num(c.pts || 0) + ' pts · ' + c.n + (c.n === 1 ? ' rapero' : ' raperos'), v: c.pts || 0, vt: corto(c.pts || 0), vl: 'PTS',
    grande: <a className="mn-tile" href={'#/crew/' + encodeURIComponent(c.clave || c.crew)}>{escudo(c, 'mn-tile-logo')}</a>,
    mini: escudo(c, 'mn-ci logo'),
  })),
  xCrew ? <Puesto cara={null} quien={'TU CREW · ' + limpio(miCrew.crew).toUpperCase()} pos={'#' + xCrew.pos} txt={xCrew.txt} pct={xCrew.pct} href="#/ranking/crews" /> : null]);
  // sin haber entrado (ni con Discord ni eligiendo quién eres), la invitación a verse
  const invita = !yo && !dc ? (
    <div className="mc-yo invita"><span className="mc-yo-t">¿Y tú? Entra con Discord y ves tu puesto en cada categoría.</span>
      <button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar</button></div>
  ) : null;
  const items = cats.filter((x) => x[2].length).map(([c, et, xs, yoFila]) => ({ c, et, t: 'Los que mandan', cuerpo: <Mandan liga={liga} c={c} xs={xs} yoFila={yoFila || invita} /> }));
  return <Pest id="raperos" titulo="Los que mandan" bajada="Los cinco primeros de cada ranking de la temporada." enlace="Todos los raperos" href="#/ranking" items={items} extra="negra raya" />;
}

// ── el panel de abajo: Misiones + el Pase · Tus eventos + Tu temporada · La Liga en números ──────────
// Hasta el 05/10/2026 las dos iban como «Próximamente», sin números de ejemplo (Dlx, «3. sí»). Ahora existen: las
// Misiones viajan en el lobby (`mis`, bot/misiones.py) y el Pase lo pide cada uno con su sesión (pase.js).
function Misiones({ liga }) {
  const M = liga.d.mis;
  const lista = (M && M.lista) || [];
  if (!lista.length) return null;
  const yo = liga.yo;
  const esYo = (raw) => !!yo && liga.esDe(raw, yo.k);
  const mio = Object.keys(M.prog || {}).find(esYo);
  return (
    <section className="mis">
      <div className="mis-cab"><span>MISIONES DE LA SEMANA · SUMAN A TU TEMPORADA</span><em>HASTA {liga.dia(M.fin).toUpperCase()}</em></div>
      <ol>
        {lista.map((x, i) => {
          const v = Math.min(mio ? (M.prog[mio] || [])[i] || 0 : 0, x.m);
          const ok = !!mio && v >= x.m;
          return (
            <li key={x.id} className={ok ? 'hecha' : ''}>
              <span className="mis-ok" aria-hidden="true">{ok ? '✓' : ''}</span>
              <div className="mis-txt">
                <b>{x.t}</b>
                {yo ? <><span className="mb"><i style={{ width: Math.round(100 * v / x.m) + '%' }} /></span><small>{v} de {x.m}</small></> : null}
              </div>
              <span className="mis-pts">+{num(x.p)}<small>PTS</small></span>
            </li>
          );
        })}
      </ol>
      <div className="mis-pie"><small>Fácil, media y difícil juntas: <b>+{num(M.bono)}</b> más.</small><a className="btn borde2 chico" href="#/ranking/misiones">Ver las misiones</a></div>
    </section>
  );
}
// ── 🚪 LAS PUERTAS DEL LOBBY (Dlx, 13/10/2026: «el Inicio quiero que se sienta como un inicio, un home, un lobby»). En
// el lobby de un juego, lo de abajo del escenario son puertas, y cada una dice qué hay del otro lado AHORA: cuántos
// eventos hay hoy, en qué puesto vas, cuántos buscados quedan, tu nivel. Son la forma corta de los bloques que se
// mudaron a su sección (Misiones, Se busca, Encuestas, Merch, La Liga en números): el Inicio pasó de 11 a 6
export function Puertas({ liga, dc }) {
  const P = usePase(!!dc);
  const ahora = liga.ahora;
  const hoyK = liga.diaClave(new Date(ahora).toISOString());
  const cal = (liga.d.calendario || []).filter((c) => !liga.canceladoCal(c));
  const hoy = cal.filter((c) => liga.diaClave(c.t) === hoyK && utc(c.t) > ahora - 3 * 3600000);
  const prox = cal.filter((c) => utc(c.t) > ahora).sort((a, b) => utc(a.t) - utc(b.t))[0];
  const ev = hoy.length ? (hoy.length === 1 ? 'Hoy hay 1 evento' : 'Hoy hay ' + hoy.length + ' eventos')
    : prox ? 'El próximo, ' + liga.cuando(new Date(utc(prox.t))) : 'El calendario de la Liga';
  const yo = liga.yo;
  const uno = (liga.d.tabla || []).find((f) => f.pos === 1);
  const rk = yo && yo.pos ? 'Vas #' + yo.pos + ' de la temporada' : uno ? '#1: ' + limpio(uno.n) : 'Las tablas de la temporada';
  const mw = liga.d.mw || {};
  const bus = (mw.b || []).length;
  const se = bus ? bus + ' buscados · vencen ' + liga.dia(mw.fin) : 'Quién cazó a quién';
  const pa = dc && P && P.listo && P.miembro ? 'Vas en el nivel ' + P.nivel + ' de ' + P.niveles : '30 niveles con premios';
  const tj = yo ? 'La tuya y las de todos' : 'Las de cada rapero';
  const puertas = [
    ['eventos', '#/eventos', 'Eventos', ev],
    ['ranking', '#/ranking', 'Ranking', rk],
    ['mira', '#/ranking/mw', 'Se busca', se],
    ['tarjetas', '#/tarjetas', 'Tarjetas', tj],
    ['pase', '#/pase', 'Pase', pa],
    ['tienda', '#/tienda', 'Tienda', 'Puntos, precios y ropa'],
  ];
  return (
    <nav className="puertas" aria-label="Entrar a">
      {puertas.map(([ic, href, t, d]) => (
        <a key={href} className="pu" href={href}><Ico n={ic} t={26} /><b>{t}</b><small>{d}</small></a>
      ))}
    </nav>
  );
}

// 🎟️ el Pase: tu nivel y tu XP si sos miembro de DRA; si no, qué es y cómo se sube (con XP desde el 06/10/2026)
function Pase({ liga, dc }) {
  const P = usePase(!!dc);
  const pub = usePases();
  if (dc && P && P.listo && P.miembro) {
    const cuenta = (b) => (b ? b.tareas.filter((t) => t.hecha).length + ' de ' + b.tareas.length : '');
    const sig = proximoEspecial(P.premios, P.nivel);
    const a = avance(P);
    return (
      <section className="tu pase">
        <div className="tu-t">PASE DE RAPERO · {liga.temp}</div>
        <div className="tu-fila">
          <div className="tu-pos"><b>NIVEL {P.nivel}</b><small>de {P.niveles} · {num(P.xp)} XP</small></div>
          {P.nivel < P.niveles ? <span className="pase-sig" title="El próximo nivel">{P.nivel + 1}</span> : null}
        </div>
        {/* lo que llevás del nivel que estás haciendo; con el Pase completo, llena */}
        <span className="mb pase-b"><i style={{ width: (a ? Math.round((100 * a.lleva) / a.de) : 100) + '%' }} /></span>
        <ul className="pase-l">
          {a ? <li><span>Para el nivel {P.nivel + 1}</span><b>{num(a.falta)} XP</b></li> : null}
          {P.hoy ? <li><span>Tareas de hoy</span><b>{cuenta(P.hoy)}</b></li> : null}
          {P.semana ? <li><span>Tareas de esta semana</span><b>{cuenta(P.semana)}</b></li> : null}
          {sig ? <li><span>En el nivel {sig[0]}</span><b>{premioTexto(sig)}</b></li> : null}
        </ul>
        <a className="btn negro" href="#/pase">Ver el Pase</a>
      </section>
    );
  }
  const cfg = (pub && pub.cfg) || {};
  return (
    <section className="tu pase">
      <div className="tu-t">PASE DE RAPERO · {liga.temp}</div>
      <p className="pronto-p pase-p">{cfg.niveles || 30} niveles por temporada: las Tareas dan XP, la XP sube de nivel y cada nivel paga Puntos de Tienda.</p>
      {(cfg.semanales || []).length ? <ul className="pase-l">{cfg.semanales.map((t) => <li key={t[0]}><span>{t[1]}</span><b>+{num(t[5])} XP</b></li>)}</ul> : null}
      {dc ? <a className="btn negro" href="#/pase">Ver el Pase</a>
        : <button type="button" className="btn verde" onClick={accion.entrar}>Entrar con Discord</button>}
      <small className="pase-nota">Para los miembros de Discord Rap Español.</small>
    </section>
  );
}
// Dlx, 30/09/2026: «tus últimos eventos son raros porque dice que son los últimos eventos». Decía «Tus eventos» en
// la pestaña y mostraba los de la Liga, que ya están en Fechas. Ahora son los tuyos, o cómo verlos.
// 🔴 QUIEN JUGÓ Y NO ESTÁ EN LAS 200 FILAS QUE VIAJAN (revisión del 03/10/2026): `liga.yo` sale de la tabla, que llega
// cortada en 200, y a los de más abajo se les decía «todavía no jugaste». `lg:dc` trae sus eventos y su clave
function FueraDe200({ dc, cls, tit }) {
  return (
    <section className={cls}>
      {cls === 'te' ? <div className="mis-cab"><span>{tit}</span></div> : <div className="tu-t">{tit}</div>}
      <p className="pronto-p">Jugaste {dc.ev} {dc.ev === 1 ? 'evento' : 'eventos'} en la temporada: estás más abajo de los 200 que muestra la tabla de la página. En tu perfil están tus tarjetas; tus eventos y tus duelos aparecen cuando entras entre los 200.</p>
      <div className="te-acc"><a className="btn negro" href={'#/r/' + encodeURIComponent(dc.clave)}>Ver mi perfil</a></div>
    </section>
  );
}

export function TusEventos({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc && dc.ev > 0 && dc.clave) return <FueraDe200 dc={dc} cls="te" tit="CÓMO TE FUE" />;
  if (!f && dc) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Tu cuenta de Discord todavía no tiene eventos en la {liga.temp}. Con el primero que juegues, acá aparecen tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><a className="btn negro" href="#/eventos">Ver los próximos eventos</a></div>
      </section>
    );
  }
  if (!f) {
    return (
      <section className="te">
        <div className="mis-cab"><span>CÓMO TE FUE</span></div>
        <p className="pronto-p">Entra con Discord y acá aparecen los eventos que jugaste esta temporada, con tu puesto y los puntos que sumaste.</p>
        <div className="te-acc"><button type="button" className="btn negro" onClick={accion.entrar}>Entrar con Discord</button></div>
      </section>
    );
  }
  const mios = liga.semanaDe(f.k).slice(0, 5);
  return (
    <section className="te">
      <div className="mis-cab"><span>CÓMO TE FUE · {liga.temp}</span><em>{f.ev || 0} {f.ev === 1 ? 'EVENTO' : 'EVENTOS'}</em></div>
      {mios.length ? (
        <ol className="te-l">
          {mios.map(([ll, res, pts]) => (
            <li key={ll.n}><button type="button" className="sin-boton te-b" onClick={() => accion.llave(ll.n)}>
              <img alt="" src={liga.logo(ll.sv)} />
              <div><b>{limpio(ll.nombre)}</b><small>{siglaDe(ll.sv)} · {liga.cuando(liga.fechaLlave(ll))} · {ll.participantes} raperos</small></div>
              <span className={'te-vos' + (res === 'Campeón' ? ' campeon' : '')}>{resultado(res, true)}<small>+{num(pts)} pts</small></span>
            </button></li>
          ))}
        </ol>
      ) : (
        <p className="pronto-p">Todavía no jugaste en esta temporada. Los próximos eventos están en el <a className="te-link" href="#/eventos">calendario</a>.</p>
      )}
    </section>
  );
}
export function TuTemporada({ liga, dc }) {
  const f = liga.yo;
  if (!f && dc && dc.ev > 0 && dc.clave) return <FueraDe200 dc={dc} cls="tu" tit="TU TEMPORADA" />;
  if (!f && dc) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Todavía no jugaste en la {liga.temp}. Con tu primer evento aparecen tu puesto y tu OVR; tu carta de Temporada sale con tu primera Tarea del Pase.</p>
        <button type="button" className="btn negro" onClick={accion.cuenta}>Mi cuenta</button>
      </section>
    );
  }
  if (!f) {
    return (
      <section className="tu">
        <div className="tu-t">TU TEMPORADA</div>
        <p className="pronto-p">Entra con Discord y acá vas a ver tu puesto, tu OVR, cuánto te falta para tu letra y si te buscan.</p>
        <button type="button" className="btn negro" onClick={accion.entrar}>Entrar con Discord</button>
      </section>
    );
  }
  const ev = f.ev || 0;
  const falta = Math.max(0, 10 - ev);
  const bus = liga.buscado(f.k);
  const mw = liga.d.mw || {};
  return (
    <section className="tu" id="tu">
      <div className="tu-t">TU TEMPORADA · {limpio(f.n).toUpperCase()}</div>
      <div className="tu-fila">
        <div className="tu-pos"><b>{f.pos ? '#' + f.pos : '—'}</b><small>OVR {f.ovr || '—'} · {num(f.pts)} pts · {ev} eventos</small></div>
        {f.rg ? <Rango liga={liga} rg={f.rg} /> : <span className="rg sinletra">?</span>}
      </div>
      <div className="tu-prog">
        <div className="barra10">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < ev ? 'si' : ''} />)}</div>
        <small>{falta ? 'Todavía sin letra: ' + ev + ' de 10 eventos. Te faltan ' + falta + ' para tu rango.' : 'Ya tienes letra.'}</small>
      </div>
      {bus ? <div className="te-buscan"><b>HOY TE BUSCAN</b><span>{num(bus.v)} pts por tu cabeza · {bus.cn} · hasta {liga.dia(mw.fin)}</span></div> : null}
      <div className="tu-acc"><a className="btn negro" href={'#/r/' + encodeURIComponent(f.k)}>Ver mi perfil</a>
        <Compartir cls="btn borde2" url={liga.cartaUrl(f.k, 'temporada') || enlace('#/r/' + encodeURIComponent(f.k))} texto="Mi carta de la Liga Global" etiqueta="Compartir mi carta" /></div>
    </section>
  );
}
// ¿hubo al menos una participación en las dos semanas de «Lo que se jugó»?
const jugoAlgo = (a) => (a.dias || []).some(([, x]) => Object.values(x || {}).some((n) => n > 0));
function Numeros({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const grandes = [['PERSONAS', c.personas, 'en ' + (c.servidores || 0) + ' servidores'], ['EN LA LISTA', c.lista, 'compitieron o se anotaron'],
    ['CON SU DISCORD', c.con_id, 'el bot sabe quiénes son'], ['VERIFICADAS', c.verificados, 'con las cuatro tarjetas']].filter((x) => x[1]);
  // sin un solo evento en las dos semanas no se dibuja: una tira de ceros el día del arranque dice «no pasa nada»,
  // y lo que pasa es que la temporada recién empieza (medido con la página en cero, 02/10/2026)
  const dias = jugoAlgo(a) ? a.dias : [];
  const tope = Math.max(1, ...dias.map(([, x]) => Object.values(x).reduce((s, v) => s + v, 0)));
  return (
    <div className="num-g">
      <div>
        {grandes.length ? <div className="num-4">{grandes.map(([t, v, d]) => <div key={t}><span>{t}</span><b>{num(v)}</b><small>{d}</small></div>)}</div> : null}
        {dias.length ? (
          <section className="act">
            <div className="mis-cab"><span>LO QUE SE JUGÓ · DOS SEMANAS</span><em>{a.ev || 0} EVENTOS ESTA SEMANA</em></div>
            <div className="act-g">
              {dias.map(([d, x]) => {
                const dd = utc(d + 'T12:00:00Z');
                return (
                  <i key={d}><span className="act-b">{Object.entries(x).sort().map(([sv, n]) => (
                    <u key={sv} style={{ height: (100 * n / tope).toFixed(1) + '%', background: (liga.svs[sv] || {}).color || '#A5A5A0' }} title={siglaDe(sv) + ' ' + n} />
                  ))}</span><em>{DIAS[dd.getUTCDay()].slice(0, 1).toUpperCase()}</em></i>
                );
              })}
            </div>
            {/* 🔑 MÁS DETALLE (Dlx, 03/10/2026: «cuántos nuevos hay, cuántas personas rapearon estas 2 semanas, etc.»):
                la semana, las dos semanas, los nuevos y los que volvieron. Sin el dato nuevo (un payload viejo), la línea
                de siempre */}
            {a.gente14 != null ? (
              <div className="act-4">
                <div><span>ESTA SEMANA</span><b>{num(a.gente || 0)}</b><small>raperos · {num(a.part || 0)} participaciones</small></div>
                <div><span>DOS SEMANAS</span><b>{num(a.gente14 || 0)}</b><small>raperos distintos</small></div>
                <div><span>NUEVOS</span><b>{num(a.nuevos || 0)}</b><small>{a.nuevos_ant ? 'su primer evento · ' + num(a.nuevos_ant) + ' la anterior' : 'su primer evento, esta semana'}</small></div>
                <div><span>VOLVIERON</span><b>{num(a.vuelven || 0)}</b><small>{a.gente_ant ? 'de los ' + num(a.gente_ant) + ' de la semana anterior' : 'jugaron las dos semanas'}</small></div>
              </div>
            ) : <p className="act-n"><b>{num(a.part || 0)}</b> participaciones · <b>{num(a.gente || 0)}</b> raperos distintos en 7 días</p>}
          </section>
        ) : null}
      </div>
      {(liga.d.records || []).length ? (
        <section className="rec">
          <div className="mis-cab"><span>LOS RÉCORDS DE LA {liga.temp}</span></div>
          <ol>{(liga.d.records || []).slice(0, 6).map((r) => (
            <li key={r.id}><span>{r.que}</span><a href={r.k ? '#/r/' + encodeURIComponent(r.k) : undefined}><b>{limpio(r.n)}</b></a><em>{typeof r.v === 'number' ? num(r.v) : r.v}</em></li>
          ))}</ol>
        </section>
      ) : null}
    </div>
  );
}
// Misiones, solas: Dlx, 30/09/2026, «dejar abajo solo las misiones». Tus eventos subió al lugar de las encuestas y
// La Liga en números bajó, debajo del Merchandising.
export function Panel({ liga, dc }) {
  return (
    <Sec id="panel" titulo="Misiones" enlace="El Pase" href="#/pase">
      <div className="pz-2"><Misiones liga={liga} /><Pase liga={liga} dc={dc} /></div>
    </Sec>
  );
}

// La Liga en números, sola, debajo del Merchandising (Dlx, 30/09/2026). Sin datos, no se dibuja
export function LaLiga({ liga }) {
  const c = liga.d.comunidad || {};
  const a = liga.d.actividad || {};
  const hay = c.personas || c.lista || c.con_id || c.verificados || jugoAlgo(a) || (liga.d.records || []).length;
  if (!hay) return null;
  return <Sec id="numeros" titulo="La Liga en números" enlace="Socios" href="#/socios"><Numeros liga={liga} /></Sec>;
}
