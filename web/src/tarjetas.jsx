// Tarjetas (`#/tarjetas` y `#/tarjetas/<carta>`). 🗂️ EL REMAKE «A · EL ÁLBUM» (Dlx, 24/10/2026: «Me gusta más A la
// verdad», a la maqueta https://claude.ai/artifact/4ngSbFMEtwAMnmtuttqUAf): arriba TU ÁLBUM —tus cartas en la mano, las
// que te faltan en gris con lo que te falta, «3 de 4» y lo que llega en la T2— y abajo la colección de la Liga en CUATRO
// ESTANTES que se deslizan de costado. Tocar una carta abre una hoja con la carta grande, y se pasa a la siguiente
// deslizando. En la compu, tu álbum y «Comparar» quedan fijos en la columna negra mientras bajas por los estantes.
// `#/tarjetas/<carta>` («Ver todas») es la galería entera de ese tipo, con el buscador y los filtros de antes.
//
// 🔴 CADA TIPO SE ORDENA POR LO QUE MIDE (lo encontró la maqueta): hasta la 3.98 las cuatro galerías salían en el orden
// de la tabla —el puesto de Temporada—, así que las cuatro mostraban a las mismas nueve personas en el mismo orden. Ahora:
// la Temporada por OVR, la Competitiva por Score, y la de Servidor y la de País, el #1 de cada uno (por Score, que es como
// la carta cuenta el puesto adentro: CLAUDE.md, «los números de los círculos se calculan por Score»).
//
// ⚠️ LOS DATOS SON LOS DE ANTES: quién aparece (`conTarjeta()` de app.js: alguna carta y su foto), lo que falta (`req` de
// /api/perfiles), las filas de «Comparar» (`CMP_FILAS` de app.js) y «Comparar conmigo» del perfil (`?a=<tú>&b=<él>`).
import { useEffect, useMemo, useRef, useState } from 'react';
import { limpio, norm, num, siglaDe, utc } from './liga.js';
import { Bandera, Carta, Compartir, FaltaLista, Ico, accion, enlace, nombrePais, usePerfiles } from './piezas.jsx';
import { W, aPng, armarYCompartir, carta, lienzo, pie } from './historia.js';
import { usePaseDe } from './pase.js';
import { svElegido, useElegidos } from './elegidos.js';
import * as RQ from './requisitos.js';
import CSS_PAGINA from './css/tarjetas.css?inline';
import { usarCss } from './css.js';

// 🎨 su CSS, con su pedazo (web/src/css/tarjetas.css)
usarCss('tarjetas', CSS_PAGINA);

const ORDEN = ['temporada', 'competitivo', 'servidor', 'pais'];
const NOMBRE = { temporada: 'Temporada', competitivo: 'Competitiva', servidor: 'Servidor', pais: 'País' };
// las filas de «Comparar»: [campo de la tabla, cómo se llama, 1 = gana el más alto · -1 = el más bajo]
const FILAS = {
  temporada: [['ovr', 'OVR', 1], ['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
  competitivo: [['sc', 'Score', 1], ['ev', 'Eventos', 1], ['wr', 'Win%', 1], ['oro', 'Títulos', 1]],
  servidor: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['oro', 'Títulos', 1], ['pos', 'Puesto', -1]],
  pais: [['pts', 'Puntos', 1], ['ev', 'Eventos', 1], ['pod', 'Podios', 1], ['pos', 'Puesto', -1]],
};
// 🎟️ lo que llega en la T2 (CLAUDE.md: Prime e Histórico cuelgan de la Histórica, que sale con la T2). Sólo el nombre:
// todavía no tienen diseño ni número
const T2 = ['Prime', 'Histórico'];
const movil = () => typeof matchMedia === 'function' && matchMedia('(max-width: 599.98px)').matches;
const sc = (f) => parseFloat(String(f.sc || 0).replace(',', '.')) || 0;

// ── cada tipo, ordenado por lo que mide ──
function ordenar(t, lista) {
  if (t === 'competitivo') return [...lista].sort((a, b) => sc(b) - sc(a));
  if (t === 'servidor' || t === 'pais') return [...lista].sort((a, b) => sc(b) - sc(a) || (a.o || a.pos || 999) - (b.o || b.pos || 999));
  return lista;                                                     // la Temporada: el orden de la tabla (OVR)
}
// de cada grupo (servidor o país), el que va primero; los grupos, del más grande al más chico
function grupos(t, lista) {
  const campo = t === 'servidor' ? 'sv' : 'cc';
  const m = new Map();
  ordenar(t, lista).forEach((f) => { if (f[campo]) { if (!m.has(f[campo])) m.set(f[campo], []); m.get(f[campo]).push(f); } });
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
function pieDe(liga, f, t, i, grupo) {
  if (t === 'temporada') return (f.pos ? '#' + f.pos : 'fuera de concurso') + (f.ovr ? ' · OVR ' + f.ovr : '');
  if (t === 'competitivo') return [f.rg || '—', f.sc ? String(f.sc).replace('.', ',') : ''].filter(Boolean).join(' · ');
  const de = t === 'servidor' ? siglaDe(f.sv) : nombrePais(f.cc);
  return grupo ? '#' + (i + 1) + ' de ' + de : de;
}

// ── tu tarjeta para historias (Dlx, 03/10/2026: «2. A»): la imagen vertical de esa carta con el marco de la Liga ──
function datoDe(liga, f, c) {
  if (c === 'temporada') return (f.pos ? '#' + f.pos + ' DE LA TEMPORADA' : 'FUERA DE CONCURSO') + (f.ovr ? ' · OVR ' + f.ovr : '');
  if (c === 'competitivo') return [f.rg ? 'RANGO ' + f.rg : '', f.sc ? 'SCORE ' + String(f.sc).replace('.', ',') : ''].filter(Boolean).join(' · ');
  if (c === 'servidor') return f.sv ? String((liga.svs[f.sv] || {}).nombre || f.sv).toUpperCase() : '';
  if (c === 'pais') return f.cc ? nombrePais(f.cc).toUpperCase() : '';
  return '';
}
async function imagenTarjeta(liga, k, c) {
  const f = liga.T[k] || {};
  const { c: lz, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · MI TARJETA').toUpperCase(), 72, 132);
  const tit = NOMBRE[c].toUpperCase();
  let px = 116;
  letra(900, px, false);
  while (px > 60 && g.measureText(tit).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(tit, 72, 132 + 24 + px * 0.9);
  const y0 = 330;
  const ch = await carta(g, letra, liga, k, f.n || k, c, W / 2, y0, 700, 1120);
  // debajo, en verde agua, lo que dice esa carta: el puesto, el rango, el servidor o el país
  const dato = datoDe(liga, f, c);
  if (dato) {
    const ye = y0 + ch + 36;
    let pd = 40;
    letra(700, pd, true);
    while (pd > 24 && g.measureText(dato).width > 760 - 60) { pd -= 2; letra(700, pd, true); }
    g.fillStyle = '#29B298'; g.fillRect((W - 760) / 2, ye, 760, 104);
    g.fillStyle = '#030304'; g.textAlign = 'center';
    g.fillText(dato, W / 2, ye + 52 + Math.round(pd * 0.36));
  }
  await pie(g, letra);
  return aPng(lz);
}
// 🗂️ tu álbum para historias: tus cartas de a dos por fila, con «MI ÁLBUM · 3 DE 4» arriba
async function imagenAlbum(liga, k, tiene) {
  const f = liga.T[k] || {};
  const { c: lz, g, letra } = await lienzo();
  letra(700, 34, true); g.fillStyle = '#A5A5A0';
  g.fillText(('LIGA GLOBAL · ' + liga.temp + ' · MI ÁLBUM').toUpperCase(), 72, 132);
  const tit = limpio(f.n || k).toUpperCase();
  let px = 100;
  letra(900, px, false);
  while (px > 54 && g.measureText(tit).width > W - 144) { px -= 6; letra(900, px, false); }
  g.fillStyle = '#F6F6F6'; g.fillText(tit, 72, 132 + 20 + px * 0.9);
  letra(700, 40, true); g.fillStyle = '#29B298';
  g.fillText(tiene.length + ' DE ' + ORDEN.length + ' TARJETAS', 72, 132 + 20 + px * 0.9 + 64);
  const y0 = 400;
  const uno = tiene.length === 1;
  for (let i = 0; i < tiene.length; i += 1) {
    const cx = uno ? W / 2 : i % 2 ? W * 0.74 : W * 0.26;
    const y = y0 + Math.floor(i / 2) * 640;
    await carta(g, letra, liga, k, f.n || k, tiene[i], cx, y, uno ? 600 : 420, uno ? 1000 : 600); // eslint-disable-line no-await-in-loop
  }
  await pie(g, letra);
  return aPng(lz);
}
function BotonHistoria({ liga, k, c, album, cls = 'tj-hist', texto = 'Para historias' }) {
  const [est, setEst] = useState('');
  const hacer = () => {
    if (est === 'armando') return;
    armarYCompartir(() => (album ? imagenAlbum(liga, k, album) : imagenTarjeta(liga, k, c)),
      album ? 'mi-album-' + k + '.png' : 'mi-tarjeta-' + c + '-' + k + '.png',
      (album ? 'Mi álbum de la Liga Global. ' : 'Mi tarjeta de ' + NOMBRE[c] + ' de la Liga Global. ') + enlace('#/r/' + encodeURIComponent(k)),
      setEst, 'tarjetas');
  };
  const txt = est === 'armando' ? 'Armando…' : est === 'bajada' ? 'Imagen guardada' : est === 'error' ? 'No pude armarla' : texto;
  return (
    <button type="button" className={cls} onClick={hacer} aria-busy={est === 'armando'} aria-live="polite">
      <Ico n="compartir" t={14} /><span>{txt}</span>
    </button>
  );
}

// ── TU ÁLBUM: tus cartas en la mano y lo que te falta ──
// 🔑 LAS REGLAS DEL 05/10/2026 (2.41; Dlx: «C», «1. dale», «4. nivel 1»): sin verificarse, ninguna; la Servidor sale al
// verificarse; la Temporada, con el nivel 1 del Pase (tu primera Tarea); la Competitiva y la de País, verificado y con su
// requisito. Quien ya las tenía las conserva hasta la T1: eso es `tiene`
function faltaDe(c, { cs, nv, nivel }) {
  if (nv) return { txt: 'Primero verifícate. ' + RQ.sinVerificar(nv, true), ir: ['#/cuenta/verificar', 'Verificarme'] };
  if (c === 'servidor') return { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' };
  if (c === 'temporada') return nivel >= 1 ? { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' } : { txt: RQ.pase(true), ir: ['#/pase', 'Ver el Pase'] };
  if (cs.length && cs.every((q) => q[0] >= q[1])) return { txt: 'Se está dibujando: llega en la próxima vuelta del ciclo.' };
  return { cs: cs.filter((q) => q[0] < q[1]).slice(0, 1) };
}

function Mano({ liga, k, tiene, bl, onAbrir }) {
  const n = ORDEN.length;
  // las que tienes primero; las que te faltan, al final de la mano
  const orden = ORDEN.filter((c) => tiene.includes(c)).concat(ORDEN.filter((c) => !tiene.includes(c)));
  return (
    <ol className="ta-mano" style={{ '--n': n }} aria-label="Tu álbum">
      {orden.map((c, i) => {
        const la = tiene.includes(c);
        let img;
        if (la) img = <Carta liga={liga} k={k} cual={c} cls="tj-c" abre={false} />;
        else if (bl.includes(c)) img = <img className="tj-c" alt="" src={liga.d.r2 + '/' + encodeURIComponent(k) + '/bloq-' + c + '.webp'} loading="lazy" />;
        else img = <span className="tj-c ta-hueco"><Ico n="candado" t={26} /></span>;
        return (
          <li key={c} className={'ta-mn tj-' + c + (la ? '' : ' bloq')} style={{ '--i': i }}>
            {la ? (
              <button type="button" className="sin-boton" onClick={() => onAbrir(c)} aria-label={'Tu carta de ' + NOMBRE[c]}>{img}</button>
            ) : <>{img}<span className="ta-cand" aria-label={'Tu ' + NOMBRE[c] + ', bloqueada'}><Ico n="candado" t={22} /></span></>}
          </li>
        );
      })}
    </ol>
  );
}

function Album({ liga, dc, perf, onAbrir }) {
  const f = liga.yo;
  const k = (f && f.k) || (dc && dc.clave) || '';
  const tiene = (f ? f.c : dc && dc.cs) || [];
  const bl = (dc && dc.clave === k && dc.bl) || [];
  const p = (perf && perf.p && perf.p[k]) || null;
  const req = (p && p.req) || {};
  const nv = (f && f.nv) || (dc && dc.nv) || '';
  const pase = usePaseDe(k);
  const nivel = (pase && pase.nivel) || 0;
  const dra = ((liga.svs || {}).DRA || {}).invita;
  const mira = !!(f || (dc && (dc.clave || dc.id)));
  if (!mira) {
    return (
      <section className="sec negra ta-alb">
        <span className="tag">TU ÁLBUM · {liga.temp}</span>
        <h1 className="ta-h">¿Y las tuyas?</h1>
        <p className="ta-p">Entra con Discord y te mostramos tus tarjetas, y lo que te falta para las que no tienes.</p>
        <div className="ta-acc"><button type="button" className="btn verde chico" onClick={accion.entrar}>Entrar con Discord</button></div>
      </section>
    );
  }
  if (!k) {
    // entró con Discord, pero su cuenta no es (todavía) de nadie de la Lista
    return (
      <section className="sec negra ta-alb">
        <span className="tag">TU ÁLBUM · {liga.temp}</span>
        <h1 className="ta-h">Todavía no tienes tarjetas</h1>
        <p className="ta-p">Son dos pasos: verifícate —estar en Discord Rap Español con el rol Miembro y tu país— y se desbloquea
          tu Servidor; cumple tu primera Tarea del Pase de rapero y se desbloquea tu Temporada. Escribe <code>/verificar</code> en
          Discord y el bot te dice qué te falta.</p>
        <div className="ta-acc">
          {dra ? <a className="btn verde chico" href={dra} target="_blank" rel="noopener noreferrer">Entrar a Discord Rap Español ↗</a> : null}
          <a className="btn borde2 chico" href="#/guia">Cómo funciona</a>
        </div>
      </section>
    );
  }
  const faltan = ORDEN.filter((c) => !tiene.includes(c));
  // de las que faltan, la primera que dice CUÁNTO falta (la Competitiva o la de País); si no, la primera
  const fc = faltan.find((c) => (c === 'competitivo' || c === 'pais') && !nv) || faltan[0];
  const fx = fc ? faltaDe(fc, { cs: req[fc] || [], nv, nivel }) : null;
  const nombre = limpio((f && f.n) || (dc && (dc.rapero || dc.n)) || k);
  const cc = (f && f.cc) || (dc && dc.cc) || '';
  const sv = (f && f.sv) || (dc && dc.sv) || '';
  const primera = ORDEN.find((c) => tiene.includes(c));
  return (
    <section className="sec negra ta-alb">
      <span className="tag">TU ÁLBUM · {liga.temp}</span>
      <div className="ta-q">
        {primera ? <Carta liga={liga} k={k} cual={primera} cls="tj-c ta-mini" abre={false} /> : null}
        <div>
          <h1 className="ta-h">{nombre}</h1>
          <p className="ta-n"><b>{tiene.length} de {ORDEN.length}</b> tarjetas
            {cc ? <> · <Bandera cc={cc} cls="ta-fl" />{nombrePais(cc)}</> : null}{sv ? ' · ' + siglaDe(sv) : ''}</p>
        </div>
      </div>
      <div className="ta-seg" role="img" aria-label={tiene.length + ' de ' + ORDEN.length + ' tarjetas'}>
        {ORDEN.map((c) => <i key={c} className={tiene.includes(c) ? 'ok' : ''} />)}
      </div>
      <Mano liga={liga} k={k} tiene={tiene} bl={bl} onAbrir={onAbrir} />
      {fc ? (
        <div className="ta-falta">
          <small><Ico n="candado" t={13} />TU {NOMBRE[fc].toUpperCase()}{faltan.length > 1 ? ' · Y ' + (faltan.length - 1) + ' MÁS' : ''}</small>
          {fx.cs && fx.cs.length ? <FaltaLista q={fx.cs} tu /> : <p>{fx.txt}</p>}
          {fx.ir ? <a className="tj-lnk" href={fx.ir[0]}>{fx.ir[1]}</a> : null}
        </div>
      ) : <p className="ta-p ta-todas">Tienes las cuatro de la {liga.temp}.</p>}
      <div className="ta-acc">
        {tiene.length ? <BotonHistoria liga={liga} k={k} album={ORDEN.filter((c) => tiene.includes(c))} cls="btn verde chico ta-bh" texto="Mi álbum para historias" /> : null}
        {liga.T[k] ? <a className="btn borde2 chico" href={'#/r/' + encodeURIComponent(k)}>Ver mi perfil</a> : null}
      </div>
      <div className="ta-t2"><span>LLEGAN EN LA T2</span>{T2.map((x) => <i key={x}>{x}</i>)}</div>
    </section>
  );
}

// ── un estante: los de un tipo, de costado. La Servidor y la de País traen sus grupos: tocar uno muestra los de ese
// servidor o ese país; sin tocar, el #1 de cada uno ──
function Estante({ liga, t, lista, nuevas, onAbrir }) {
  const req = (liga.d.requisitos || []).find((r) => r.id === t) || {};
  const [g, setG] = useState('');
  const gs = useMemo(() => (t === 'servidor' || t === 'pais' ? grupos(t, lista) : null), [t, lista]);
  const tope = 10;
  let fs;
  let orden;
  let grupo = false;
  if (gs && g) {
    fs = (gs.find((x) => x[0] === g) || [0, []])[1];
    grupo = true;
    orden = 'de ' + (t === 'servidor' ? siglaDe(g) : nombrePais(g)) + ', por Score';
  } else if (gs) {
    fs = gs.map((x) => x[1][0]);
    orden = 'el #1 de cada uno';
  } else {
    fs = ordenar(t, lista);
    orden = t === 'competitivo' ? 'por Score' : 'por OVR';
  }
  const vis = fs.slice(0, tope);
  if (!lista.length) return null;
  return (
    <section className="ta-est" aria-label={NOMBRE[t]}>
      <div className="ta-est-t">
        <h2>{NOMBRE[t]} <small>{num(lista.length)} · {orden}</small></h2>
        <a href={'#/tarjetas/' + t}>Ver todas <Ico n="flecha" t={14} /></a>
      </div>
      {req.mide ? <p className="ta-est-p">{req.mide}</p> : null}
      {gs && gs.length > 1 ? (
        <div className="rk-chips ta-chips" role="group" aria-label={t === 'servidor' ? 'Por servidor' : 'Por país'}>
          {gs.map(([x, v]) => (
            <button type="button" key={x} className={g === x ? 'on' : ''} aria-pressed={g === x} onClick={() => setG(g === x ? '' : x)}>
              {t === 'servidor' ? <img alt="" src={liga.logo(x)} /> : <Bandera cc={x} cls="ta-fl" />}
              {t === 'servidor' ? siglaDe(x) + ' · ' : ''}{v.length}
            </button>
          ))}
        </div>
      ) : null}
      <ul className={'ta-riel tj-' + t}>
        {vis.map((f, i) => (
          <li key={f.k} className="ta-fc">
            <button type="button" className="sin-boton" onClick={() => onAbrir(t, fs, i, grupo)} aria-label={'La ' + NOMBRE[t] + ' de ' + limpio(f.n)}>
              <Carta liga={liga} k={f.k} cual={t} cls="tj-c" abre={false} />
            </button>
            {nuevas.has(f.k) ? <em className="ta-nueva">NUEVA</em> : null}
            <b>{limpio(f.n)}</b>
            <small>{pieDe(liga, f, t, i, grupo)}</small>
          </li>
        ))}
        {fs.length > vis.length ? (
          <li className="ta-fc ta-mas"><a href={'#/tarjetas/' + t}><b>+{num(fs.length - vis.length)}</b><small>Ver las {num(lista.length)}</small></a></li>
        ) : null}
      </ul>
    </section>
  );
}

// ── LA HOJA: la carta grande, y deslizar para pasar a la siguiente del mismo estante ──
function Hoja({ liga, yoK, h, setH, onComparar }) {
  const { t, lista, i, grupo } = h;
  const f = lista[i];
  const cerrar = () => setH(null);
  const cerrarB = useRef(null);
  const toque = useRef(null);
  const ir = (d) => setH({ ...h, i: (i + d + lista.length) % lista.length });
  // las teclas leen siempre la hoja de ahora; el efecto corre una vez (si corriera en cada carta, el foco saltaría al ✕)
  const teclas = useRef(null);
  teclas.current = { cerrar, ir };
  useEffect(() => {
    const antes = document.activeElement;
    const tecla = (e) => {
      if (e.key === 'Escape') teclas.current.cerrar();
      if (e.key === 'ArrowRight') teclas.current.ir(1);
      if (e.key === 'ArrowLeft') teclas.current.ir(-1);
    };
    window.addEventListener('keydown', tecla);
    const o = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    if (cerrarB.current) cerrarB.current.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', tecla);
      document.documentElement.style.overflow = o;
      if (antes && antes.focus) { try { antes.focus({ preventScroll: true }); } catch (e) { /* ya no está */ } }
    };
  }, []);
  if (!f) return null;
  const nombre = limpio(f.n);
  const sv = f.sv && liga.svs[f.sv];
  const url = liga.cartaUrl(f.k, t);
  const mia = yoK && f.k === yoK;
  return (
    <div className="ta-velo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="ta-hoja" role="dialog" aria-modal="true" aria-label={'La ' + NOMBRE[t] + ' de ' + nombre}
        onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const d = toque.current == null ? 0 : e.changedTouches[0].clientX - toque.current;
          toque.current = null;
          if (Math.abs(d) > 50 && lista.length > 1) ir(d < 0 ? 1 : -1);
        }}>
        <i className="ta-asa" aria-hidden="true" />
        <div className="ta-h-top">
          <small>{NOMBRE[t].toUpperCase()} · {i + 1} DE {lista.length}</small>
          <button type="button" className="ta-x" ref={cerrarB} onClick={cerrar} aria-label="Cerrar">×</button>
        </div>
        <div className={'ta-h-c tj-' + t}>
          {lista.length > 1 ? <button type="button" className="ta-fl-n" onClick={() => ir(-1)} aria-label="La anterior">‹</button> : <span />}
          <Carta key={f.k + t} liga={liga} k={f.k} cual={t} cls="tj-c" abre={false} />
          {lista.length > 1 ? <button type="button" className="ta-fl-n" onClick={() => ir(1)} aria-label="La siguiente">›</button> : <span />}
        </div>
        {liga.cartaVieja(f.k, t) ? <p className="ta-h-d tj-dib"><Ico n="reloj" t={13} /> se está redibujando con los datos de ahora</p> : null}
        <b className="ta-h-n">{nombre}</b>
        <p className="ta-h-d">
          {pieDe(liga, f, t, i, grupo)}
          {f.cc ? <> · <Bandera cc={f.cc} cls="ta-fl" />{nombrePais(f.cc)}</> : null}
          {sv ? ' · ' + siglaDe(f.sv) : ''}
        </p>
        <div className="ta-h-acc">
          {liga.T[f.k] ? <a className="btn verde chico" href={'#/r/' + encodeURIComponent(f.k)} onClick={cerrar}>{mia ? 'Ver mi perfil' : 'Ver su perfil'}</a> : null}
          {yoK && !mia ? <button type="button" className="btn borde2 chico" onClick={() => { cerrar(); onComparar(t, f.k); }}>⇄ Comparar conmigo</button> : null}
          {mia ? <BotonHistoria liga={liga} k={f.k} c={t} cls="btn borde2 chico ta-bh" /> : url ? <Compartir cls="btn borde2 chico" url={url} texto={'La ' + NOMBRE[t] + ' de ' + nombre} etiqueta="Compartir" /> : null}
        </div>
        {lista.length > 1 ? <p className="ta-h-t">Desliza para pasar a la siguiente</p> : null}
      </div>
    </div>
  );
}

// ── «Ver todas» (`#/tarjetas/<carta>`): la galería entera de un tipo, con el buscador y los filtros (Dlx, 03/10/2026:
// «3. A»): las Nuevas —las de este tipo que salieron esta semana, del muro—, A quién sigues y por servidor. Un filtro
// que no filtra nada no se dibuja ──
function Galeria({ liga, t, lista, nuevas, onAbrir }) {
  const [q, setQ] = useState('');
  const [ver, setVer] = useState(false);
  const [sv, setSv] = useState('');
  const [soloNuevas, setSoloNuevas] = useState(false);
  const [soloSigo, setSoloSigo] = useState(false);
  useEffect(() => { setVer(false); }, [t]);
  const sigo = useMemo(() => new Set(liga.sigue || []), [liga]);
  // 🏠 de dónde es cada uno, sólo si lo eligió (Dlx, 12/10/2026). Ver elegidos.js
  const eleg = useElegidos();
  const orden = useMemo(() => ordenar(t, lista), [t, lista]);
  const svs = useMemo(() => [...new Set(lista.map((f) => f.sv).filter(Boolean))].sort(), [lista]);
  const nNuevas = lista.filter((f) => nuevas.has(f.k)).length;
  const nSigo = lista.filter((f) => sigo.has(f.k)).length;
  const qn = norm(q).trim();
  const filtra = !!(sv || soloNuevas || soloSigo);
  const fs = orden.filter((f) => (!qn || norm(limpio(f.n)).includes(qn)) && (!sv || f.sv === sv)
    && (!soloNuevas || nuevas.has(f.k)) && (!soloSigo || sigo.has(f.k)));
  const tope = movil() ? 12 : 24;
  const vis = ver || qn || filtra ? fs : fs.slice(0, tope);
  const sacar = () => { setQ(''); setSv(''); setSoloNuevas(false); setSoloSigo(false); };
  return (
    <section className="sec tj-gal" id="tj-gal">
      <div className="sec-t"><h2>{NOMBRE[t]}</h2><span className="tj-n">{num(lista.length)} · {t === 'competitivo' ? 'por Score' : t === 'temporada' ? 'por OVR' : 'por Score'}</span></div>
      {lista.length ? (
        <div className="rk-fil tj-fil">
          <label className="rk-buscar"><Ico n="buscar" t={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar rapero" aria-label="Buscar rapero" enterKeyHint="search" />
          </label>
          {nNuevas || nSigo || svs.length > 1 ? (
            <div className="rk-chips" role="group" aria-label="Filtrar">
              <button type="button" className={!filtra ? 'on' : ''} aria-pressed={!filtra} onClick={() => { setSv(''); setSoloNuevas(false); setSoloSigo(false); }}>Todas · {num(lista.length)}</button>
              {nNuevas ? <button type="button" className={'rk-chip-nuevo' + (soloNuevas ? ' on' : '')} aria-pressed={soloNuevas}
                onClick={() => setSoloNuevas(!soloNuevas)} title="Las que salieron esta semana">Nuevas · {nNuevas}</button> : null}
              {nSigo ? <button type="button" className={soloSigo ? 'on' : ''} aria-pressed={soloSigo} onClick={() => setSoloSigo(!soloSigo)}>A quién sigues · {nSigo}</button> : null}
              {svs.length > 1 ? svs.map((s) => (
                <button type="button" key={s} className={sv === s ? 'on' : ''} aria-pressed={sv === s} onClick={() => setSv(sv === s ? '' : s)}>
                  <img alt="" src={liga.logo(s)} />{siglaDe(s)} · {lista.filter((f) => f.sv === s).length}
                </button>
              )) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!lista.length ? <p className="rk-vacio">Todavía nadie tiene la de {NOMBRE[t]}. La primera aparece acá apenas alguien la desbloquee.</p>
        : !fs.length ? <p className="rk-vacio">Nadie con {qn ? 'ese nombre' : 'ese filtro'}. <button type="button" className="rk-lnk" onClick={sacar}>{qn && !filtra ? 'Borrar la búsqueda' : 'Sacar los filtros'}</button></p>
          : (
            <ul className={'tj-grilla aparece tj-' + t}>
              {vis.map((f, i) => (
                <li key={f.k}>
                  <button type="button" className="sin-boton" onClick={() => onAbrir(t, fs, i, false)} aria-label={'La ' + NOMBRE[t] + ' de ' + limpio(f.n)}>
                    <Carta liga={liga} k={f.k} cual={t} cls="tj-c" abre={false} />
                  </button>
                  {nuevas.has(f.k) ? <em className="ta-nueva">NUEVA</em> : null}
                  <div className="tj-pie">
                    <b>{limpio(f.n)}</b>
                    <small>{pieDe(liga, f, t, i, false)}{svElegido(liga, eleg, f.k) ? ' · ' + siglaDe(svElegido(liga, eleg, f.k)) : ''}</small>
                    {liga.cartaVieja(f.k, t) ? <small className="tj-dib"><Ico n="reloj" t={13} />se está redibujando</small> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
      {fs.length > vis.length ? <button type="button" className="btn borde2 chico tj-mas" onClick={() => setVer(true)}>Ver las {num(fs.length)}</button> : null}
    </section>
  );
}

// ── «Comparar»: tú contra alguien, fila por fila, con una barra por lado; el que gana cada fila, en verde ──
const valor = (f, campo) => {
  const v = f[campo];
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return isNaN(n) ? null : n;
};
const mostrar = (campo, n) => (n == null ? '—' : campo === 'pos' ? '#' + n : campo === 'wr' ? String(n).replace('.', ',') + '%'
  : campo === 'sc' ? String(n).replace('.', ',') : num(n));

function Elegir({ lista, f, onElegir, et, id }) {
  const [txt, setTxt] = useState(limpio(f.n));
  const [mal, setMal] = useState(false);
  useEffect(() => { setTxt(limpio(f.n)); setMal(false); }, [f.k]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolver = (v) => {
    const qn = norm(v).trim();
    if (!qn) { setTxt(limpio(f.n)); return; }
    const x = lista.find((g) => norm(limpio(g.n)) === qn) || lista.find((g) => norm(limpio(g.n)).startsWith(qn))
      || lista.find((g) => norm(limpio(g.n)).includes(qn));
    if (x) { onElegir(x.k); setTxt(limpio(x.n)); setMal(false); } else setMal(true);
  };
  return (
    <label className={'rk-buscar tj-elegir' + (mal ? ' mal' : '')}>
      <Ico n="buscar" t={16} />
      <input list={id} value={txt} aria-label={et} placeholder="Buscar rapero" enterKeyHint="search"
        onFocus={(e) => e.target.select()}
        onChange={(e) => { const v = e.target.value; setTxt(v); setMal(false); if (lista.some((g) => limpio(g.n) === v)) resolver(v); }}
        onBlur={(e) => resolver(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolver(e.currentTarget.value); } }} />
    </label>
  );
}

function Comparar({ liga, porTipo, perf, cmp, setCmp, yoK }) {
  const [elige, setElige] = useState(false);
  const t = cmp.t;
  const lista = useMemo(() => ordenar(t, porTipo[t] || []), [t, porTipo]);
  if (lista.length < 2) return null;
  // 🔑 sin par elegido: tú y el que tienes justo adelante en ese tipo; si no tienes esa carta, los dos primeros
  const iyo = lista.findIndex((f) => f.k === yoK);
  const def = iyo > 0 ? [yoK, lista[iyo - 1].k] : iyo === 0 ? [yoK, lista[1].k] : [lista[0].k, lista[1].k];
  const A = lista.find((f) => f.k === (cmp.a || def[0])) || lista[0];
  const B = lista.find((f) => f.k === (cmp.b || def[1]) && f.k !== A.k) || lista.find((f) => f.k !== A.k);
  const filas = FILAS[t].map(([campo, et, dir]) => {
    const a = valor(A, campo);
    const b = valor(B, campo);
    const gana = a == null || b == null || a === b ? 0 : (dir > 0 ? a > b : a < b) ? 1 : 2;
    // cada barra mide contra el mejor de los dos; en Puesto, el mejor es el número más bajo
    const w = (x, y) => (x == null || y == null ? 0 : dir > 0 ? (Math.max(x, y) ? (100 * x) / Math.max(x, y) : 0) : (x ? (100 * Math.min(x, y)) / x : 0));
    return { campo, et, a, b, gana, wa: w(a, b), wb: w(b, a) };
  });
  // cara a cara: sus duelos, de /api/perfiles (los mismos del perfil)
  const du = ((perf && perf.p && perf.p[A.k]) || {}).du || [];
  const cc = du.filter((d) => { const r = liga.fila(d[1]); return r && r.k === B.k; });
  const g = cc.filter((d) => d[2]).length;
  const tipos = ORDEN.filter((c) => (porTipo[c] || []).length >= 2);
  const quien = (f) => (f.k === yoK ? 'Tú' : limpio(f.n));
  return (
    <section className="ta-cmp" id="tj-cmp">
      <div className="ta-est-t">
        <h2>Comparar <small>{NOMBRE[t]}</small></h2>
        <button type="button" className="rk-lnk" onClick={() => setElige(!elige)} aria-expanded={elige}>{elige ? 'Listo' : 'Elegir otros'}</button>
      </div>
      {tipos.length > 1 ? (
        <div className="rk-chips ta-chips" role="group" aria-label="Qué tarjeta">
          {tipos.map((c) => <button type="button" key={c} className={c === t ? 'on' : ''} aria-pressed={c === t} onClick={() => setCmp({ t: c, a: cmp.a, b: cmp.b })}>{NOMBRE[c]}</button>)}
        </div>
      ) : null}
      {elige ? (
        <div className="ta-cmp-el">
          <datalist id="tj-nombres">{lista.map((f) => <option key={f.k} value={limpio(f.n)} />)}</datalist>
          <Elegir lista={lista} f={A} et="El primero" id="tj-nombres" onElegir={(k) => setCmp({ t, a: k, b: k === B.k ? A.k : B.k })} />
          <Elegir lista={lista} f={B} et="El segundo" id="tj-nombres" onElegir={(k) => setCmp({ t, a: k === A.k ? B.k : A.k, b: k })} />
        </div>
      ) : null}
      <div className={'ta-vs tj-' + t}>
        <figure><Carta liga={liga} k={A.k} cual={t} cls="tj-c" /><figcaption>{quien(A)}</figcaption></figure>
        <b className="ta-vs-x">VS</b>
        <figure><Carta liga={liga} k={B.k} cual={t} cls="tj-c" /><figcaption>{quien(B)}</figcaption></figure>
      </div>
      <ul className="ta-barras">
        {cc.length ? (
          <li className="ta-cara"><span className={g > cc.length - g ? 'gana' : ''}>{g}</span><em>Cara a cara · {cc.length === 1 ? 'una vez' : cc.length + ' veces'}</em><span className={cc.length - g > g ? 'gana' : ''}>{cc.length - g}</span></li>
        ) : null}
        {filas.map((x) => (
          <li key={x.campo}>
            <span className={x.gana === 1 ? 'gana' : ''}>{mostrar(x.campo, x.a)}</span>
            <i className="ba"><u className={x.gana === 1 ? 'g' : ''} style={{ width: x.wa + '%' }} /></i>
            <em>{x.et}</em>
            <i className="bb"><u className={x.gana === 2 ? 'g' : ''} style={{ width: x.wb + '%' }} /></i>
            <span className={x.gana === 2 ? 'gana' : ''}>{mostrar(x.campo, x.b)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 🔑 «Comparar conmigo» (Dlx, 03/10/2026: «2. A»): el perfil de otro trae `?a=<tú>&b=<él>`, y «Comparar» arranca con los
// dos puestos y la página baja hasta ahí
export function Tarjetas({ liga, dc, tipo, q = '' }) {
  const pq = new URLSearchParams(q);
  const t = ORDEN.includes(tipo) ? tipo : '';
  const perf = usePerfiles();
  const yoK = (liga.yo && liga.yo.k) || (dc && dc.clave) || '';
  const [h, setH] = useState(null);
  const [cmp, setCmp] = useState({ t: 'temporada', a: pq.get('a') || '', b: pq.get('b') || '' });
  useEffect(() => {
    if (!(pq.get('a') && pq.get('b'))) return undefined;
    setCmp({ t: 'temporada', a: pq.get('a'), b: pq.get('b') });
    const r = setTimeout(() => accion.ir('tj-cmp'), 400);
    return () => clearTimeout(r);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  // quién aparece: alguna carta y su foto (`conTarjeta()` de app.js), en el orden de la tabla
  const con = useMemo(() => (liga.d.tabla || []).filter((f) => (f.c || []).length && f.fo !== 0), [liga]);
  const porTipo = useMemo(() => Object.fromEntries(ORDEN.map((c) => [c, con.filter((f) => f.c.includes(c))])), [con]);
  // las Nuevas: las de cada tipo que salieron esta semana, del muro
  const nuevas = useMemo(() => {
    const d = liga.desdeLunes();
    return Object.fromEntries(ORDEN.map((c) => [c, new Set(liga.muro.filter((it) => it.tipo === 'tarjeta' && it.carta === c && utc(it.t) >= d).flatMap((it) => it.ks || []))]));
  }, [liga]);
  const abrir = (tt, lista, i, grupo) => setH({ t: tt, lista, i, grupo });
  const comparar = (tt, k) => {
    setCmp({ t: tt, a: yoK, b: k });
    setTimeout(() => accion.ir('tj-cmp'), 150);
  };
  // tocar una de tus cartas en la mano: la hoja con las tuyas
  const abrirMia = (c) => {
    const f = liga.T[yoK];
    if (!f) { accion.carta(yoK, c); return; }
    setH({ t: c, lista: [f], i: 0, grupo: false });
  };
  const hoja = h ? <Hoja liga={liga} yoK={yoK} h={h} setH={setH} onComparar={comparar} /> : null;
  if (t) {
    return (
      <>
        <nav className="rk-subs" aria-label="Tarjetas">
          <div className="rk-subs-in">
            <a href="#/tarjetas">← Tu álbum</a>
            {ORDEN.map((c) => (
              <a key={c} href={'#/tarjetas/' + c} className={c === t ? 'on' : ''} aria-current={c === t ? 'page' : undefined}>
                {NOMBRE[c]}<i>{num(porTipo[c].length)}</i>
              </a>
            ))}
          </div>
        </nav>
        <Galeria liga={liga} t={t} lista={porTipo[t]} nuevas={nuevas[t]} onAbrir={abrir} />
        {hoja}
      </>
    );
  }
  return (
    <div className="ta-g">
      <aside className="ta-izq">
        <Album liga={liga} dc={dc} perf={perf} onAbrir={abrirMia} />
        <div className="sec ta-cmp-w"><Comparar liga={liga} porTipo={porTipo} perf={perf} cmp={cmp} setCmp={setCmp} yoK={yoK} /></div>
      </aside>
      <div className="sec ta-der">
        {ORDEN.map((c) => <Estante key={c} liga={liga} t={c} lista={porTipo[c]} nuevas={nuevas[c]} onAbrir={abrir} />)}
      </div>
      {hoja}
    </div>
  );
}
